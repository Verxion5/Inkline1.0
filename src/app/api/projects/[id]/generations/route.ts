import { all, get, run } from "@/lib/db";
import { fail, json, requireProject } from "@/lib/api-helpers";
import { toGeneration } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  const gens = all<Record<string, unknown>>(
    "SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC LIMIT 100", ctx.params.id).map(toGeneration);
  return json({ generations: gens });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  const url = new URL(req.url);
  const genId = url.searchParams.get("generationId");
  if (!genId) return fail("Missing generationId");
  run("DELETE FROM generations WHERE id = ? AND project_id = ?", genId, ctx.params.id);
  return json({ ok: true });
}
