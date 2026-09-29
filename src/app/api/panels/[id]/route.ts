import { fail, json, requireUser } from "@/lib/api-helpers";
import { get } from "@/lib/db";
import { makeItemHandlers } from "@/lib/crud";
import { panelDef } from "@/lib/entities";

export const dynamic = "force-dynamic";

const h = makeItemHandlers(panelDef);
type Ctx = { params: { id: string } };

function own(itemId: string) {
  const auth = requireUser();
  if ("res" in auth) return { res: auth.res } as const;
  const row = get<Record<string, unknown>>("SELECT p.user_id as uid FROM panels s JOIN projects p ON p.id = s.project_id WHERE s.id = ?", itemId);
  if (!row || row.uid !== auth.user.id) return { res: fail("Not found", 404) } as const;
  return {} as const;
}

export async function GET(_req: Request, ctx: Ctx) {
  const o = own(ctx.params.id);
  if ("res" in o) return o.res;
  return h.GET(ctx.params.id);
}
export async function PATCH(req: Request, ctx: Ctx) {
  const o = own(ctx.params.id);
  if ("res" in o) return o.res;
  return h.PATCH(req, ctx.params.id);
}
export async function DELETE(_req: Request, ctx: Ctx) {
  const o = own(ctx.params.id);
  if ("res" in o) return o.res;
  return h.DELETE(ctx.params.id);
}
