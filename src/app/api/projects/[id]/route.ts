import { get, now, run } from "@/lib/db";
import { fail, json, readBody, requireUser } from "@/lib/api-helpers";
import { toProject } from "@/lib/serialize";
import type { ProjectStyle } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const row = get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ? AND user_id = ?", ctx.params.id, auth.user.id);
  if (!row) return fail("Project not found", 404);
  return json({ project: toProject(row) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const row = get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ? AND user_id = ?", ctx.params.id, auth.user.id);
  if (!row) return fail("Project not found", 404);
  const body = await readBody<{
    title?: string; description?: string; format?: string; mode?: string; status?: string; favorite?: boolean;
    readingDirection?: "rtl" | "ltr"; style?: Partial<ProjectStyle>; gutter?: number; borderWidth?: number;
  }>(req);

  const updates: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, val: unknown) => { updates.push(`${col} = ?`); params.push(val); };

  if (body.title !== undefined) { const t = body.title.trim(); if (!t) return fail("Title cannot be empty."); set("title", t); }
  if (body.description !== undefined) set("description", body.description);
  if (body.format !== undefined) set("format", body.format);
  if (body.mode !== undefined) set("mode", body.mode);
  if (body.status !== undefined) set("status", body.status);
  if (body.favorite !== undefined) set("favorite", body.favorite ? 1 : 0);
  if (body.readingDirection !== undefined) set("reading_direction", body.readingDirection);
  if (body.gutter !== undefined) set("gutter", body.gutter);
  if (body.borderWidth !== undefined) set("border_width", body.borderWidth);
  if (body.style) {
    const current = toProject(row).style;
    set("style", JSON.stringify({ ...current, ...body.style }));
  }
  if (!updates.length) return json({ project: toProject(row) });
  set("updated_at", now());
  params.push(ctx.params.id);
  run(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`, ...params);
  return json({ project: toProject(get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", ctx.params.id)!) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const row = get<Record<string, unknown>>("SELECT id FROM projects WHERE id = ? AND user_id = ?", ctx.params.id, auth.user.id);
  if (!row) return fail("Project not found", 404);
  const pid = ctx.params.id;
  run("DELETE FROM panel_versions WHERE panel_id IN (SELECT id FROM panels WHERE project_id = ?)", pid);
  run("DELETE FROM panels WHERE project_id = ?", pid);
  run("DELETE FROM pages WHERE project_id = ?", pid);
  run("DELETE FROM scenes WHERE project_id = ?", pid);
  run("DELETE FROM chapters WHERE project_id = ?", pid);
  run("DELETE FROM characters WHERE project_id = ?", pid);
  run("DELETE FROM locations WHERE project_id = ?", pid);
  run("DELETE FROM assets WHERE project_id = ?", pid);
  run("DELETE FROM story_blocks WHERE project_id = ?", pid);
  run("DELETE FROM generations WHERE project_id = ?", pid);
  run("DELETE FROM assistant_messages WHERE project_id = ?", pid);
  run("DELETE FROM projects WHERE id = ?", pid);
  return json({ ok: true });
}
