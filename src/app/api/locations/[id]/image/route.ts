import { get, now, rid, run } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api-helpers";
import { toLocation, toProject } from "@/lib/serialize";
import { locationArt } from "@/lib/art";

export const dynamic = "force-dynamic";

/** Generate a location establishing thumbnail. */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const row = get<Record<string, unknown>>(
    `SELECT l.* FROM locations l JOIN projects p ON p.id = l.project_id
     WHERE l.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!row) return fail("Location not found", 404);
  const loc = toLocation(row);
  const project = toProject(get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", loc.projectId)!);
  const mono = ["manga-bw", "manga-gray", "sketch", "lineart"].includes(project.style.artMode);
  const seed = Math.floor(Math.random() * 2147483647);
  const art = locationArt({ name: loc.name, description: loc.description, environment: loc.environment, lighting: `${loc.lighting} ${loc.timeOfDay} ${loc.weather}`, mono, seed });
  const genId = rid();
  const t = now();
  run(`INSERT INTO generations (id,project_id,panel_id,character_id,kind,prompt,settings,status,result_url,result_svg,seed,error,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    genId, loc.projectId, null, null, "location",
    `Establishing art: ${loc.name} — ${loc.description}`,
    JSON.stringify({ seed }), "done", `/api/art/${genId}`, art.svg, seed, null, t);
  run("UPDATE locations SET image_url = ?, updated_at = ? WHERE id = ?", `/api/art/${genId}`, t, loc.id);
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, loc.projectId);
  const fresh = toLocation(get<Record<string, unknown>>("SELECT * FROM locations WHERE id = ?", loc.id)!);
  return json({ location: fresh });
}
