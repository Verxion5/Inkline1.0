import { all, get, now, rid, run } from "@/lib/db";
import { fail, json, readBody, requireUser } from "@/lib/api-helpers";
import { suggestLayout } from "@/lib/ai";
import { toPage } from "@/lib/serialize";
import type { StoryboardSpec } from "@/lib/types";

export const dynamic = "force-dynamic";

const SIZE_MAP: Record<StoryboardSpec["size"], { w: number; h: number }> = {
  splash: { w: 100, h: 100 }, large: { w: 100, h: 34 }, medium: { w: 48.5, h: 30 }, small: { w: 48.5, h: 22 }, strip: { w: 100, h: 14 },
};

/** Push an approved panel plan into a real page + panels. */
export async function POST(req: Request) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const body = await readBody<{
    projectId: string; chapterId: string; sceneId?: string;
    title?: string; specs: StoryboardSpec[];
  }>(req);
  if (!body.projectId || !body.chapterId || !Array.isArray(body.specs) || !body.specs.length) {
    return fail("Missing projectId, chapterId or specs");
  }
  const owned = get("SELECT id FROM projects WHERE id = ? AND user_id = ?", body.projectId, auth.user.id);
  if (!owned) return fail("Project not found", 404);
  const ch = get("SELECT id FROM chapters WHERE id = ? AND project_id = ?", body.chapterId, body.projectId);
  if (!ch) return fail("Chapter not found", 404);

  const t = now();
  const max = get<{ c: number }>("SELECT COALESCE(MAX(number),0) as c FROM pages WHERE chapter_id = ?", body.chapterId);
  const pageId = rid();
  run("INSERT INTO pages (id,chapter_id,project_id,number,title,status,template,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    pageId, body.chapterId, body.projectId, Number(max?.c ?? 0) + 1, body.title ?? "New page from storyboard", "draft",
    "storyboard", `${body.specs.length} panels from storyboard`, t, t);

  const chars = all<Record<string, unknown>>("SELECT * FROM characters WHERE project_id = ?", body.projectId);
  const byName = (name: string) => chars.find((c) => (c.name as string).toLowerCase() === name.toLowerCase().trim())?.id ?? null;
  const locs = all<Record<string, unknown>>("SELECT * FROM locations WHERE project_id = ?", body.projectId);

  const rects = suggestLayout(body.specs.length, body.specs.map((s) => s.size));
  body.specs.forEach((spec, i) => {
    const r = rects[i] ?? SIZE_MAP[spec.size] ?? { x: 10, y: 10, w: 80, h: 30 };
    const rect = (spec.size === "splash") ? { x: 0, y: 0, w: 100, h: 100 } : { x: r.x, y: r.y, w: r.w, h: r.h };
    const bubbles = spec.dialogue.filter((d) => d.text.trim()).map((d, j) => ({
      id: rid(), kind: d.kind, text: d.text, characterId: byName(d.character),
      x: 8 + (j % 2) * 42, y: 8 + j * 14, w: 48, align: "left" as const, size: 1,
      tail: d.kind === "speech" || d.kind === "whisper" || d.kind === "shout" ? "bl" : "none",
    }));
    const locMatch = locs.find((l) => spec.description.toLowerCase().includes((l.name as string).toLowerCase().split(" ")[0]));
    run(`INSERT INTO panels (id,page_id,project_id,scene_id,order_num,x,y,w,h,shape,prompt,description,character_ids,location_id,shot,camera,expression,pose,lighting,mood,effects,focus,purpose,image_url,stage,seed,negative_prompt,bubbles,notes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      rid(), pageId, body.projectId, body.sceneId ?? null, i + 1,
      rect.x, rect.y, rect.w, rect.h, spec.size === "splash" ? "splash" : "rect",
      "", spec.description,
      JSON.stringify(spec.characterNames.map(byName).filter(Boolean)),
      locMatch?.id ?? null,
      spec.shot, spec.camera, spec.expression, spec.pose, spec.lighting, spec.mood, spec.effects, "", spec.purpose,
      null, "planned", null, "text, watermark, blurry", JSON.stringify(bubbles), "", t, t);
  });
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, body.projectId);
  return json({ page: toPage(get<Record<string, unknown>>("SELECT * FROM pages WHERE id = ?", pageId)!) }, 201);
}
