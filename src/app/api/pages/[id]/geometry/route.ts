import { all, get, now, run } from "@/lib/db";
import { fail, json, readBody, requireUser } from "@/lib/api-helpers";
import { toPanel } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** Batch-save panel geometry & reading order after drag/resize/reorder. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const pg = get<Record<string, unknown>>(
    `SELECT pg.* FROM pages pg JOIN projects p ON p.id = pg.project_id
     WHERE pg.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!pg) return fail("Page not found", 404);
  const body = await readBody<{ panels: { id: string; x: number; y: number; w: number; h: number; order: number }[] }>(req);
  if (!Array.isArray(body.panels)) return fail("Expected panels array");
  const t = now();
  for (const p of body.panels) {
    run("UPDATE panels SET x = ?, y = ?, w = ?, h = ?, order_num = ?, updated_at = ? WHERE id = ? AND page_id = ?",
      clamp(p.x), clamp(p.y), clamp(p.w), clamp(p.h), p.order, t, p.id, ctx.params.id);
  }
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, pg.project_id);
  const panels = all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num, created_at", ctx.params.id).map(toPanel);
  return json({ panels });
}

const clamp = (n: number) => Math.max(0, Math.min(100, Number(n)));
