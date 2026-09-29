import { get } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api-helpers";
import { duplicateProject } from "@/lib/clone";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const src = get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ? AND user_id = ?", ctx.params.id, auth.user.id);
  if (!src) return fail("Project not found", 404);
  const project = duplicateProject(ctx.params.id, `${src.title as string} (copy)`);
  return json({ project }, 201);
}
