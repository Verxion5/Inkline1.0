import { fail, json, requireUser } from "@/lib/api-helpers";
import { get } from "@/lib/db";
import { makeCollectionHandlers } from "@/lib/crud";
import { pageDef } from "@/lib/entities";

export const dynamic = "force-dynamic";

const h = makeCollectionHandlers(pageDef);
type Ctx = { params: { id: string } };

function guard(chapterId: string) {
  const auth = requireUser();
  if ("res" in auth) return { res: auth.res } as const;
  const row = get<Record<string, unknown>>("SELECT c.project_id as pid, p.user_id as uid FROM chapters c JOIN projects p ON p.id = c.project_id WHERE c.id = ?", chapterId);
  if (!row || row.uid !== auth.user.id) return { res: fail("Chapter not found", 404) } as const;
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
