import { run, get } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { fail, json, readBody, requireUser } from "@/lib/api-helpers";
import type { UserPrefs } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const { user } = auth;
  return json({ user: { id: user.id, email: user.email, name: user.name, prefs: user.prefs, createdAt: user.createdAt } });
}

export async function PATCH(req: Request) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const { user } = auth;
  const body = await readBody<{ name?: string; prefs?: Partial<UserPrefs>; currentPassword?: string; newPassword?: string }>(req);

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 2) return fail("Name must be at least 2 characters.");
    run("UPDATE users SET name = ? WHERE id = ?", name, user.id);
  }
  if (body.prefs) {
    const merged = { ...user.prefs, ...body.prefs };
    run("UPDATE users SET prefs = ? WHERE id = ?", JSON.stringify(merged), user.id);
  }
  if (body.newPassword) {
    if (!body.currentPassword || !verifyPassword(body.currentPassword, user.passwordHash)) {
      return fail("Current password is incorrect.", 403);
    }
    if (body.newPassword.length < 8) return fail("New password must be at least 8 characters.");
    run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(body.newPassword), user.id);
  }
  const fresh = get<Record<string, unknown>>("SELECT * FROM users WHERE id = ?", user.id)!;
  return json({ ok: true, user: { id: user.id, email: user.email, name: fresh.name as string, prefs: user.prefs } });
}
