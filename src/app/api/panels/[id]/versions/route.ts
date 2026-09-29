import { all, get, now, run } from "@/lib/db";
import { fail, json, readBody, requireUser } from "@/lib/api-helpers";
import { toPanel, toPanelVersion } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function own(ctx: Ctx) {
  const auth = requireUser();
  if ("res" in auth) return { res: auth.res } as const;
  const row = get<Record<string, unknown>>(
    `SELECT pl.* FROM panels pl JOIN projects p ON p.id = pl.project_id
     WHERE pl.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!row) return { res: fail("Panel not found", 404) } as const;
  return { panel: toPanel(row) } as const;
}

export async function GET(_req: Request, ctx: Ctx) {
  const o = own(ctx);
  if ("res" in o) return o.res;
  const versions = all<Record<string, unknown>>(
    "SELECT * FROM panel_versions WHERE panel_id = ? ORDER BY created_at DESC", o.panel.id).map(toPanelVersion);
  return json({ versions });
}

/** Restore a previous version: current art is archived first, then version art is swapped back in. */
export async function POST(req: Request, ctx: Ctx) {
  const o = own(ctx);
  if ("res" in o) return o.res;
  const body = await readBody<{ versionId: string }>(req);
  const v = get<Record<string, unknown>>("SELECT * FROM panel_versions WHERE id = ? AND panel_id = ?", body.versionId, o.panel.id);
  if (!v) return fail("Version not found", 404);
  const t = now();
  if (o.panel.imageUrl) {
    run("INSERT INTO panel_versions (id,panel_id,image_url,prompt,seed,label,created_at) VALUES (?,?,?,?,?,?,?)",
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8), o.panel.id, o.panel.imageUrl, o.panel.prompt,
      o.panel.seed, "auto-saved", t);
  }
  run("UPDATE panels SET image_url = ?, prompt = ?, seed = ?, stage = 'generated', updated_at = ? WHERE id = ?",
    v.image_url, v.prompt, v.seed, t, o.panel.id);
  run("DELETE FROM panel_versions WHERE id = ?", v.id);
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, o.panel.projectId);
  const fresh = toPanel(get<Record<string, unknown>>("SELECT * FROM panels WHERE id = ?", o.panel.id)!);
  const versions = all<Record<string, unknown>>("SELECT * FROM panel_versions WHERE panel_id = ? ORDER BY created_at DESC", o.panel.id).map(toPanelVersion);
  return json({ panel: fresh, versions });
}
