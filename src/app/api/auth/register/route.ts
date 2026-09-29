import { rid, now, run, get } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie, userById } from "@/lib/auth";
import { fail, json, readBody } from "@/lib/api-helpers";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  ensureSeeded();
  const body = await readBody<{ name?: string; email?: string; password?: string }>(req);
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").toLowerCase().trim();
  const password = body.password ?? "";
  if (name.length < 2) return fail("Please enter your name (2+ characters).");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Please enter a valid email address.");
  if (password.length < 8) return fail("Password must be at least 8 characters.");
  if (get("SELECT id FROM users WHERE email = ?", email)) return fail("An account with this email already exists.", 409);

  const id = rid();
  run("INSERT INTO users (id, email, name, password_hash, prefs, created_at) VALUES (?,?,?,?,?,?)",
    id, email, name, hashPassword(password),
    JSON.stringify({ experienceMode: "beginner", defaultFormat: "manga", accent: "rose", defaultArtMode: "manga-bw" }),
    now());
  const token = createSession(id);
  setSessionCookie(token);
  const user = userById(id)!;
  return json({ user: { id: user.id, email: user.email, name: user.name, prefs: user.prefs } });
}
