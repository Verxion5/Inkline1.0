import { all, get, now, rid, run } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api-helpers";
import { toChapter } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const src = get<Record<string, unknown>>(
    `SELECT c.* FROM chapters c JOIN projects p ON p.id = c.project_id
     WHERE c.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!src) return fail("Chapter not found", 404);
  const t = now();
  const newId = rid();
  const max = get<{ c: number }>("SELECT COALESCE(MAX(number),0) as c FROM chapters WHERE project_id = ?", src.project_id);
  run("INSERT INTO chapters (id,project_id,number,title,description,status,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    newId, src.project_id, Number(max?.c ?? 0) + 1, `${src.title as string} (copy)`, src.description, "planning", 0, t, t);

  const sceneMap = new Map<string, string>();
  for (const s of all<Record<string, unknown>>("SELECT * FROM scenes WHERE chapter_id = ? ORDER BY number", src.id)) {
    const sid = rid(); sceneMap.set(String(s.id), sid);
    run(`INSERT INTO scenes (id,chapter_id,project_id,number,title,description,location_id,character_ids,script,objective,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      sid, newId, s.project_id, s.number, s.title, s.description, s.location_id, s.character_ids, s.script, s.objective, s.status, t, t);
  }
  for (const p of all<Record<string, unknown>>("SELECT * FROM pages WHERE chapter_id = ? ORDER BY number", src.id)) {
    const pid = rid();
    run("INSERT INTO pages (id,chapter_id,project_id,number,title,status,template,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      pid, newId, p.project_id, p.number, p.title, "empty", p.template, p.notes, t, t);
    for (const pl of all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num", p.id)) {
      run(`INSERT INTO panels (id,page_id,project_id,scene_id,order_num,x,y,w,h,shape,prompt,description,character_ids,location_id,shot,camera,expression,pose,lighting,mood,effects,focus,purpose,image_url,stage,seed,negative_prompt,bubbles,notes,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        rid(), pid, pl.project_id, pl.scene_id ? sceneMap.get(String(pl.scene_id)) ?? null : null,
        pl.order_num, pl.x, pl.y, pl.w, pl.h, pl.shape, pl.prompt, pl.description, pl.character_ids, pl.location_id,
        pl.shot, pl.camera, pl.expression, pl.pose, pl.lighting, pl.mood, pl.effects, pl.focus, pl.purpose,
        null, "planned", null, pl.negative_prompt, pl.bubbles, pl.notes, t, t);
    }
  }
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, src.project_id);
  return json({ chapter: toChapter(get<Record<string, unknown>>("SELECT * FROM chapters WHERE id = ?", newId)!) }, 201);
}
