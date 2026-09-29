import { json, requireProject } from "@/lib/api-helpers";
import { makeCollectionHandlers } from "@/lib/crud";
import { characterDef } from "@/lib/entities";

export const dynamic = "force-dynamic";

const h = makeCollectionHandlers(characterDef);
type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  return h.GET(_req, ctx.params.id);
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  return h.POST(req, ctx.params.id);
}
