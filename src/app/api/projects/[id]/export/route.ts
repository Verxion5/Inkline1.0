import { all, get } from "@/lib/db";
import { fail, json, requireProject } from "@/lib/api-helpers";
import { toCharacter, toChapter, toLocation, toPage, toPanel, toProject, toScene, toStoryBlock } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** Project archive (JSON). Optionally scoped to one chapter via ?chapterId=. */
export async function GET(req: Request, ctx: { params: { id: string } }) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  const pid = ctx.params.id;
  const project = toProject(get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", pid)!);
  const chapterId = new URL(req.url).searchParams.get("chapterId");

  const chapters = (chapterId
    ? all<Record<string, unknown>>("SELECT * FROM chapters WHERE project_id = ? AND id = ?", pid, chapterId)
    : all<Record<string, unknown>>("SELECT * FROM chapters WHERE project_id = ? ORDER BY number", pid)
  ).map((r) => {
    const chapter = toChapter(r);
    const scenes = all<Record<string, unknown>>("SELECT * FROM scenes WHERE chapter_id = ? ORDER BY number", chapter.id).map(toScene);
    const pages = all<Record<string, unknown>>("SELECT * FROM pages WHERE chapter_id = ? ORDER BY number", chapter.id).map((pr) => {
      const page = toPage(pr);
      const panels = all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num", page.id).map(toPanel);
      return { ...page, panels };
    });
    return { ...chapter, scenes, pages };
  });

  const archive = {
    format: "inkline-archive",
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    story: all<Record<string, unknown>>("SELECT * FROM story_blocks WHERE project_id = ? ORDER BY order_num", pid).map(toStoryBlock),
    characters: all<Record<string, unknown>>("SELECT * FROM characters WHERE project_id = ?", pid).map(toCharacter),
    locations: all<Record<string, unknown>>("SELECT * FROM locations WHERE project_id = ?", pid).map(toLocation),
    chapters,
  };
  return json(archive);
}
