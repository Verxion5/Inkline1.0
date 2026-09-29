import { get } from "@/lib/db";
import { requireUser } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** Serve generated SVG artwork from the generation history. */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const gen = get<Record<string, unknown>>("SELECT result_svg FROM generations WHERE id = ?", ctx.params.id);
  const svg = gen?.result_svg as string | null;
  if (!svg) return new Response("Not found", { status: 404 });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
