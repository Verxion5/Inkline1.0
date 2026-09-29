import { all, get } from "@/lib/db";
import { json, requireProject } from "@/lib/api-helpers";
import { toChapter, toGeneration, toPage } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  const pid = ctx.params.id;

  const c = (sql: string, ...params: unknown[]) => Number((get<{ c: number | bigint }>(sql, ...params) ?? { c: 0 }).c);
  const stats = {
    chapters: c("SELECT COUNT(*) as c FROM chapters WHERE project_id = ? AND archived = 0", pid),
    scenes: c("SELECT COUNT(*) as c FROM scenes WHERE project_id = ?", pid),
    pages: c("SELECT COUNT(*) as c FROM pages WHERE project_id = ?", pid),
    panels: c("SELECT COUNT(*) as c FROM panels WHERE project_id = ?", pid),
    panelsGenerated: c("SELECT COUNT(*) as c FROM panels WHERE project_id = ? AND stage != 'planned'", pid),
    characters: c("SELECT COUNT(*) as c FROM characters WHERE project_id = ?", pid),
    locations: c("SELECT COUNT(*) as c FROM locations WHERE project_id = ?", pid),
    assets: c("SELECT COUNT(*) as c FROM assets WHERE project_id = ?", pid),
    bubbles: c(`SELECT COUNT(*) as c FROM panels WHERE project_id = ? AND bubbles != '[]'`, pid),
    generations: c("SELECT COUNT(*) as c FROM generations WHERE project_id = ?", pid),
    donePages: c("SELECT COUNT(*) as c FROM pages WHERE project_id = ? AND status = 'done'", pid),
    scriptedScenes: c("SELECT COUNT(*) as c FROM scenes WHERE project_id = ? AND status != 'outline'", pid),
  };
  const chapters = all<Record<string, unknown>>("SELECT * FROM chapters WHERE project_id = ? AND archived = 0 ORDER BY number", pid).map((r) => {
    const ch = toChapter(r);
    const pageCount = Number((get<{ c: number }>("SELECT COUNT(*) as c FROM pages WHERE chapter_id = ?", ch.id) ?? { c: 0 }).c);
    const doneCount = Number((get<{ c: number }>("SELECT COUNT(*) as c FROM pages WHERE chapter_id = ? AND status = 'done'", ch.id) ?? { c: 0 }).c);
    return { ...ch, pageCount, doneCount };
  });
  const recentGenerations = all<Record<string, unknown>>(
    "SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC LIMIT 8", pid).map(toGeneration);
  const recentPages = all<Record<string, unknown>>(
    "SELECT * FROM pages WHERE project_id = ? ORDER BY updated_at DESC LIMIT 4", pid).map((r) => {
    const page = toPage(r);
    const panelCount = Number((get<{ c: number }>("SELECT COUNT(*) as c FROM panels WHERE page_id = ?", page.id) ?? { c: 0 }).c);
    return { ...page, panelCount };
  });
  return json({ stats, chapters, recentGenerations, recentPages });
}
