import { all } from "@/lib/db";
import { json, requireUser } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const LIKE = (q: string) => `%${q.replace(/[%_]/g, "")}%`;

export async function GET(req: Request) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return json({ results: [] });
  const uid = auth.user.id;
  const like = LIKE(q);

  const projects = all<Record<string, unknown>>(
    `SELECT DISTINCT pr.id, pr.title, pr.updated_at, 'project' as type
     FROM projects pr WHERE pr.user_id = ? AND (pr.title LIKE ? OR pr.description LIKE ?)
     LIMIT 6`, uid, like, like);
  const chapters = all<Record<string, unknown>>(
    `SELECT c.id, c.title || ' — Chapter ' || c.number as title, c.project_id, 'chapter' as type
     FROM chapters c JOIN projects p ON p.id = c.project_id
     WHERE p.user_id = ? AND c.title LIKE ? LIMIT 6`, uid, like);
  const characters = all<Record<string, unknown>>(
    `SELECT c.id, c.name as title, c.project_id, 'character' as type
     FROM characters c JOIN projects p ON p.id = c.project_id
     WHERE p.user_id = ? AND (c.name LIKE ? OR c.description LIKE ?) LIMIT 6`, uid, like, like);
  const locations = all<Record<string, unknown>>(
    `SELECT l.id, l.name as title, l.project_id, 'location' as type
     FROM locations l JOIN projects p ON p.id = l.project_id
     WHERE p.user_id = ? AND l.name LIKE ? LIMIT 6`, uid, like);
  const pages = all<Record<string, unknown>>(
    `SELECT pg.id, 'Page ' || pg.number || COALESCE(NULLIF(pg.title, ''), '') as title, pg.project_id, pg.chapter_id, 'page' as type
     FROM pages pg JOIN projects p ON p.id = pg.project_id
     WHERE p.user_id = ? AND (pg.title LIKE ? OR pg.notes LIKE ?) LIMIT 6`, uid, like, like);
  const panels = all<Record<string, unknown>>(
    `SELECT pl.id, substr(pl.description, 1, 60) as title, pl.project_id, pl.page_id, 'panel' as type
     FROM panels pl JOIN projects p ON p.id = pl.project_id
     WHERE p.user_id = ? AND (pl.description LIKE ? OR pl.prompt LIKE ?) AND pl.description != '' LIMIT 6`, uid, like, like);
  const story = all<Record<string, unknown>>(
    `SELECT s.id, s.title as title, s.project_id, 'story' as type
     FROM story_blocks s JOIN projects p ON p.id = s.project_id
     WHERE p.user_id = ? AND (s.title LIKE ? OR s.content LIKE ?) LIMIT 6`, uid, like, like);

  // Attach project titles for display
  const titleFor = (pid: unknown) =>
    (all("SELECT title FROM projects WHERE id = ?", pid)[0]?.title as string) ?? "";

  const map = (r: Record<string, unknown>) => ({
    id: r.id, type: r.type, title: r.title, projectId: r.project_id,
    chapterId: r.chapter_id ?? null, pageId: r.page_id ?? null,
    projectTitle: titleFor(r.project_id),
  });
  return json({
    results: [...projects, ...chapters, ...characters, ...locations, ...pages, ...panels, ...story].map(map),
  });
}
