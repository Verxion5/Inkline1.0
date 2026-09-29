import { NextResponse } from "next/server";
import { currentUser } from "./auth";
import { ensureSeeded } from "./seed";
import { get } from "./db";
import type { User } from "./types";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Require an authenticated user; returns the user or a 401 response. */
export function requireUser(): { user: User } | { res: NextResponse } {
  ensureSeeded();
  const user = currentUser();
  if (!user) return { res: fail("Not authenticated", 401) };
  return { user };
}

export async function readBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Auth + project ownership guard. */
export function requireProject(projectId: string): { user: User } | { res: NextResponse } {
  const auth = requireUser();
  if ("res" in auth) return auth;
  if (!get("SELECT id FROM projects WHERE id = ? AND user_id = ?", projectId, auth.user.id)) {
    return { res: fail("Project not found", 404) };
  }
  return auth;
}

export const touch = () => new Date().toISOString();
