import { fail, json, requireUser } from "@/lib/api-helpers";
import { get } from "@/lib/db";
import { makeCollectionHandlers } from "@/lib/crud";
import { panelDef } from "@/lib/entities";

export const dynamic = "force-dynamic";

const h = makeCollectionHandlers(panelDef);
type Ctx = { params: { id: string } };

function guard(pageId: string) {
  const auth = requireUser();
  if ("res" in auth) return { res: auth.res } as const;
  const row = get<Record<string, unknown>>("SELECT pg.project_id as pid, p.user_id as uid FROM pages pg JOIN projects p ON p.id = pg.project_id WHERE pg.id = ?", pageId);
  if (!row || row.uid !== auth.user.id) return { res: fail("Page not found", 404) } as const;
  return { auth, projectId: String(row.pid) } as const;
}

export async function GET(_req: Request, ctx: Ctx) {
  const g = guard(ctx.params.id);
  if ("res" in g) return g.res;
  return h.GET(_req, g.projectId, ctx.params.id);
}

export async function POST(req: Request, ctx: Ctx) {
  const g = guard(ctx.params.id);
  if ("res" in g) return g.res;
  return h.POST(req, g.projectId, ctx.params.id);
}
