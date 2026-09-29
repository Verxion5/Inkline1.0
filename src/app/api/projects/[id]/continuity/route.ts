import { json, requireProject } from "@/lib/api-helpers";
import { continuityCheck } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  const issues = continuityCheck(ctx.params.id);
  return json({ issues });
}
