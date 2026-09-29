import { all, get, now, run } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api-helpers";
import { suggestLayout } from "@/lib/ai";
import { toPanel } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** AI page-layout suggestion: arranges panels by purpose/shot rhythm. */
export async function POST(_req: Request, ctx: Ctx) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const pg = get<Record<string, unknown>>(
    `SELECT pg.* FROM pages pg JOIN projects p ON p.id = pg.project_id
     WHERE pg.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!pg) return fail("Page not found", 404);
  const panels = all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num, created_at", ctx.params.id).map(toPanel);
  if (!panels.length) return fail("Add panels to the page first");
  const rects = suggestLayout(panels.length, panels.map((p) => (p.shot === "splash" || p.shot === "establishing" ? "large" : p.shot === "close-up" || p.shot === "insert" ? "small" : "medium")));
  const t = now();
  panels.forEach((p, i) => {
    const r = rects[i];
    if (!r) return;
    run("UPDATE panels SET x = ?, y = ?, w = ?, h = ?, order_num = ?, updated_at = ? WHERE id = ?",
      r.x, r.y, r.w, r.h, i + 1, t, p.id);
  });
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, pg.project_id);
  const fresh = all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num, created_at", ctx.params.id).map(toPanel);
  return json({ panels: fresh });
}
