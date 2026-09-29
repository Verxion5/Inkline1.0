import { destroySession } from "@/lib/auth";
import { clearSessionCookie } from "@/lib/auth";
import { json } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/inkline_session=([^;]+)/);
  if (match) destroySession(match[1]);
  clearSessionCookie();
  return json({ ok: true });
}
