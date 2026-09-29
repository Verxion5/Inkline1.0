import { all, get } from "@/lib/db";
import { json, requireUser } from "@/lib/api-helpers";
import { toGeneration, toProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** Dashboard aggregate: stats, recent projects, recent generations. */
export async function GET() {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const uid = auth.user.id;
  const c = (sql: string) => Number((get<{ c: number | bigint }>(sql, uid) ?? { c: 0 }).c);

  const projects = all<Record<string, unknown>>(
    "SELECT * FROM projects WHERE user_id = ? ORDER BY datetime(updated_at) DESC", uid).map((r) => {
    const p = toProject(r);
    const n = (sql: string) => Number((get<{ c: number }>(sql, p.id) ?? { c: 0 }).c);
    return {
      ...p,
      stats: {
        chapters: n("SELECT COUNT(*) as c FROM chapters WHERE project_id = ? AND archived = 0"),
        pages: n("SELECT COUNT(*) as c FROM pages WHERE project_id = ?"),
        panels: n("SELECT COUNT(*) as c FROM panels WHERE project_id = ?"),
        panelsGenerated: n("SELECT COUNT(*) as c FROM panels WHERE project_id = ? AND stage != 'planned'"),
        characters: n("SELECT COUNT(*) as c FROM characters WHERE project_id = ?"),
      },
    };
  });
  const recentGenerations = all<Record<string, unknown>>(
    `SELECT g.* FROM generations g JOIN projects p ON p.id = g.project_id
     WHERE p.user_id = ? ORDER BY g.created_at DESC LIMIT 8`, uid).map(toGeneration);

  return json({
    stats: {
      projects: projects.length,
      activeProjects: projects.filter((p) => p.status === "active").length,
      chapters: c(`SELECT COUNT(*) as c FROM chapters ch JOIN projects p ON p.id = ch.project_id WHERE p.user_id = ?`),
      pages: c(`SELECT COUNT(*) as c FROM pages pg JOIN projects p ON p.id = pg.project_id WHERE p.user_id = ?`),
      panels: c(`SELECT COUNT(*) as c FROM panels pl JOIN projects p ON p.id = pl.project_id WHERE p.user_id = ?`),
      characters: c(`SELECT COUNT(*) as c FROM characters ch JOIN projects p ON p.id = ch.project_id WHERE p.user_id = ?`),
      generations: c(`SELECT COUNT(*) as c FROM generations g JOIN projects p ON p.id = g.project_id WHERE p.user_id = ?`),
    },
    projects,
    recentGenerations,
  });
}
