import { all, get, now, rid, run } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api-helpers";
import { toPage } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const src = get<Record<string, unknown>>(
    `SELECT pg.* FROM pages pg JOIN projects p ON p.id = pg.project_id
     WHERE pg.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!src) return fail("Page not found", 404);
  const t = now();
  const newId = rid();
  const max = get<{ c: number }>("SELECT COALESCE(MAX(number),0) as c FROM pages WHERE chapter_id = ?", src.chapter_id);
  run("INSERT INTO pages (id,chapter_id,project_id,number,title,status,template,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    newId, src.chapter_id, src.project_id, Number(max?.c ?? 0) + 1, `${src.title as string} (copy)`, "empty", src.template, src.notes, t, t);
  for (const pl of all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num", src.id)) {
    run(`INSERT INTO panels (id,page_id,project_id,scene_id,order_num,x,y,w,h,shape,prompt,description,character_ids,location_id,shot,camera,expression,pose,lighting,mood,effects,focus,purpose,image_url,stage,seed,negative_prompt,bubbles,notes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      rid(), newId, pl.project_id, pl.scene_id, pl.order_num, pl.x, pl.y, pl.w, pl.h, pl.shape,
      pl.prompt, pl.description, pl.character_ids, pl.location_id, pl.shot, pl.camera, pl.expression, pl.pose,
      pl.lighting, pl.mood, pl.effects, pl.focus, pl.purpose,
      String(pl.image_url ?? "").startsWith("/seed/") ? pl.image_url : null,
      String(pl.image_url ?? "").startsWith("/seed/") ? "generated" : "planned",
      null, pl.negative_prompt, pl.bubbles, pl.notes, t, t);
  }
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, src.project_id);
  return json({ page: toPage(get<Record<string, unknown>>("SELECT * FROM pages WHERE id = ?", newId)!) }, 201);
}
