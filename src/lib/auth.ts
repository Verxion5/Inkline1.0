import crypto from "crypto";
import { cookies } from "next/headers";
import { db, get, run, rid, now, parseJson } from "./db";
import type { User, UserPrefs } from "./types";

// ─── Password hashing (scrypt, no external deps) ────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "inkline_session";
const SESSION_DAYS = 30;

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userId, expires);
  return token;
}

export function destroySession(token: string) {
  run("DELETE FROM sessions WHERE token = ?", token);
}

export function userFromToken(token: string | undefined): User | null {
  if (!token) return null;
  const row = get<{ user_id: string; expires_at: string }>("SELECT user_id, expires_at FROM sessions WHERE token = ?", token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return userById(row.user_id);
}

export function userById(id: string): User | null {
  const r = get<Record<string, unknown>>("SELECT * FROM users WHERE id = ?", id);
  if (!r) return null;
  return {
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    passwordHash: r.password_hash as string,
    prefs: { experienceMode: "beginner", defaultFormat: "manga", accent: "rose", defaultArtMode: "manga-bw", ...parseJson<Partial<UserPrefs>>(r.prefs, {}) },
    createdAt: r.created_at as string,
  };
}

export function userByEmail(email: string): User | null {
  const r = get<Record<string, unknown>>("SELECT * FROM users WHERE email = ?", email.toLowerCase().trim());
  if (!r) return null;
  return {
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    passwordHash: r.password_hash as string,
    prefs: { experienceMode: "beginner", defaultFormat: "manga", accent: "rose", defaultArtMode: "manga-bw", ...parseJson<Partial<UserPrefs>>(r.prefs, {}) },
    createdAt: r.created_at as string,
  };
}

/** Get the current authenticated user from cookies (server components & routes). */
export function currentUser(): User | null {
  const store = cookies();
  return userFromToken(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}

export function setSessionCookie(token: string) {
  const store = cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie() {
  const store = cookies();
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

export { rid };
