import { get } from "./db";

export function projectStats(projectId: string) {
  const c = (sql: string, ...params: unknown[]) => Number((get<{ c: number | bigint }>(sql, ...params) ?? { c: 0 }).c);
  return {
    chapters: c("SELECT COUNT(*) as c FROM chapters WHERE project_id = ? AND archived = 0", projectId),
    scenes: c("SELECT COUNT(*) as c FROM scenes WHERE project_id = ?", projectId),
    pages: c("SELECT COUNT(*) as c FROM pages WHERE project_id = ?", projectId),
    panels: c("SELECT COUNT(*) as c FROM panels WHERE project_id = ?", projectId),
    panelsGenerated: c("SELECT COUNT(*) as c FROM panels WHERE project_id = ? AND stage != 'planned'", projectId),
    characters: c("SELECT COUNT(*) as c FROM characters WHERE project_id = ?", projectId),
    locations: c("SELECT COUNT(*) as c FROM locations WHERE project_id = ?", projectId),
    assets: c("SELECT COUNT(*) as c FROM assets WHERE project_id = ?", projectId),
    generations: c("SELECT COUNT(*) as c FROM generations WHERE project_id = ?", projectId),
    donePages: c("SELECT COUNT(*) as c FROM pages WHERE project_id = ? AND status = 'done'", projectId),
  };
}
