import { all, get } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api-helpers";
import { toPage, toPanel } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const pg = get<Record<string, unknown>>(
    `SELECT pg.* FROM pages pg JOIN projects p ON p.id = pg.project_id
     WHERE pg.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!pg) return fail("Page not found", 404);
  const page = toPage(pg);
  const panels = all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num, created_at", page.id).map(toPanel);
  return json({ page, panels });
}
