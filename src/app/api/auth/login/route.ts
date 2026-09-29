import { createSession, setSessionCookie, verifyPassword, userByEmail } from "@/lib/auth";
import { fail, json, readBody } from "@/lib/api-helpers";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  ensureSeeded();
  const body = await readBody<{ email?: string; password?: string }>(req);
  const email = (body.email ?? "").toLowerCase().trim();
  const password = body.password ?? "";
  const user = userByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail("Incorrect email or password.", 401);
  }
  const token = createSession(user.id);
  setSessionCookie(token);
  return json({ user: { id: user.id, email: user.email, name: user.name, prefs: user.prefs } });
}
