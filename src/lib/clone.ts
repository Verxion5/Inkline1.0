import { all, get, now, rid, run } from "@/lib/db";
import { toProject } from "@/lib/serialize";

/** Deep-duplicate a project including chapters, scenes, pages and panel plans.
 *  Generated artwork is intentionally re-linked (not copied) via original URLs. */
export function duplicateProject(srcId: string, title: string) {
  const src = get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", srcId)!;
  const t = now();
  const newId = rid();
  run(`INSERT INTO projects (id,user_id,title,description,format,mode,status,favorite,cover_url,reading_direction,page_w,page_h,gutter,border_width,style,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    newId, src.user_id, title, src.description, src.format, src.mode, "active", 0, src.cover_url, src.reading_direction,
    src.page_w, src.page_h, src.gutter, src.border_width, src.style, t, t);

  const idMap = new Map<string, string>();
  const nid = (key: string): string | null => idMap.get(key) ?? null;

  for (const r of all<Record<string, unknown>>("SELECT * FROM characters WHERE project_id = ?", srcId)) {
    const id = rid(); idMap.set(String(r.id), id);
    run(`INSERT INTO characters (id,project_id,name,role,age,description,personality,history,abilities,relationships,appearance,portrait_url,tags,status,change_log,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, newId, r.name, r.role, r.age, r.description, r.personality, r.history, r.abilities, r.relationships,
      r.appearance, r.portrait_url, r.tags, r.status, r.change_log, t, t);
  }
  for (const r of all<Record<string, unknown>>("SELECT * FROM locations WHERE project_id = ?", srcId)) {
    const id = rid(); idMap.set(String(r.id), id);
    run(`INSERT INTO locations (id,project_id,name,description,architecture,environment,lighting,details,time_of_day,weather,image_url,tags,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, newId, r.name, r.description, r.architecture, r.environment, r.lighting, r.details, r.time_of_day, r.weather,
      r.image_url, r.tags, t, t);
  }
  for (const r of all<Record<string, unknown>>("SELECT * FROM assets WHERE project_id = ?", srcId)) {
    const id = rid(); idMap.set(String(r.id), id);
    run("INSERT INTO assets (id,project_id,name,kind,description,image_url,tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      id, newId, r.name, r.kind, r.description, r.image_url, r.tags, t, t);
  }
  for (const r of all<Record<string, unknown>>("SELECT * FROM story_blocks WHERE project_id = ?", srcId)) {
    const id = rid(); idMap.set(String(r.id), id);
    run("INSERT INTO story_blocks (id,project_id,kind,title,content,order_num,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
      id, newId, r.kind, r.title, r.content, r.order_num, t, t);
  }
  for (const r of all<Record<string, unknown>>("SELECT * FROM chapters WHERE project_id = ? ORDER BY number", srcId)) {
    const id = rid(); idMap.set(String(r.id), id);
    run("INSERT INTO chapters (id,project_id,number,title,description,status,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      id, newId, r.number, r.title, r.description, r.status, r.archived, t, t);
  }
  for (const r of all<Record<string, unknown>>("SELECT * FROM scenes WHERE project_id = ?", srcId)) {
    const id = rid(); idMap.set(String(r.id), id);
    run(`INSERT INTO scenes (id,chapter_id,project_id,number,title,description,location_id,character_ids,script,objective,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, nid(String(r.chapter_id)) ?? "", newId, r.number, r.title, r.description,
      r.location_id ? nid(String(r.location_id)) : null, r.character_ids, r.script, r.objective, r.status, t, t);
  }
  for (const r of all<Record<string, unknown>>("SELECT * FROM pages WHERE project_id = ? ORDER BY number", srcId)) {
    const id = rid(); idMap.set(String(r.id), id);
    run("INSERT INTO pages (id,chapter_id,project_id,number,title,status,template,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      id, nid(String(r.chapter_id)) ?? "", newId, r.number, r.title, "empty", r.template, r.notes, t, t);
  }
  for (const r of all<Record<string, unknown>>("SELECT * FROM panels WHERE project_id = ?", srcId)) {
    const id = rid();
    run(`INSERT INTO panels (id,page_id,project_id,scene_id,order_num,x,y,w,h,shape,prompt,description,character_ids,location_id,shot,camera,expression,pose,lighting,mood,effects,focus,purpose,image_url,stage,seed,negative_prompt,bubbles,notes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, nid(String(r.page_id)) ?? "", newId, r.scene_id ? nid(String(r.scene_id)) : null,
      r.order_num, r.x, r.y, r.w, r.h, r.shape, r.prompt, r.description, r.character_ids,
      r.location_id ? nid(String(r.location_id)) : null,
      r.shot, r.camera, r.expression, r.pose, r.lighting, r.mood, r.effects, r.focus, r.purpose,
      // Keep artwork if it points at /seed static art (shareable); otherwise plans start ungenerated.
      String(r.image_url ?? "").startsWith("/seed/") ? r.image_url : null,
      String(r.image_url ?? "").startsWith("/seed/") ? "generated" : "planned",
      null, r.negative_prompt, r.bubbles, r.notes, t, t);
  }
  return toProject(get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", newId)!);
}
