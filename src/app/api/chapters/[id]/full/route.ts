import { all, get } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api-helpers";
import { toChapter, toPage, toPanel, toScene } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** Full chapter payload: chapter + scenes + pages (each with its panels). */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const ch = get<Record<string, unknown>>(
    `SELECT c.* FROM chapters c JOIN projects p ON p.id = c.project_id
     WHERE c.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!ch) return fail("Chapter not found", 404);
  const chapter = toChapter(ch);
  const scenes = all<Record<string, unknown>>("SELECT * FROM scenes WHERE chapter_id = ? ORDER BY number", chapter.id).map(toScene);
  const pages = all<Record<string, unknown>>("SELECT * FROM pages WHERE chapter_id = ? ORDER BY number", chapter.id).map((pr) => {
    const page = toPage(pr);
    const panels = all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num, created_at", page.id).map(toPanel);
    return { ...page, panels };
  });
  return json({ chapter, scenes, pages });
}
