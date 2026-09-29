import { all, get, now, rid, run } from "@/lib/db";
import { fail, json, readBody, requireProject } from "@/lib/api-helpers";
import { toAssistantMessage, toCharacter, toProject } from "@/lib/serialize";
import { assistantReply } from "@/lib/ai";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  const msgs = all<Record<string, unknown>>(
    "SELECT * FROM assistant_messages WHERE project_id = ? ORDER BY created_at LIMIT 100", ctx.params.id).map(toAssistantMessage);
  return json({ messages: msgs });
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = requireProject(ctx.params.id);
  if ("res" in auth) return auth.res;
  const body = await readBody<{ message?: string }>(req);
  const message = (body.message ?? "").trim();
  if (!message) return fail("Type a message first");
  const pid = ctx.params.id;
  const project = toProject(get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", pid)!);
  const characters = all<Record<string, unknown>>("SELECT * FROM characters WHERE project_id = ?", pid).map(toCharacter);
  const c = (sql: string) => Number((get<{ c: number | bigint }>(sql, pid) ?? { c: 0 }).c);
  const premiseRow = get<Record<string, unknown>>("SELECT content FROM story_blocks WHERE project_id = ? AND kind = 'premise'", pid);
  const lastChapter = get<Record<string, unknown>>("SELECT title FROM chapters WHERE project_id = ? ORDER BY number DESC LIMIT 1", pid);

  const userMsgId = rid();
  run("INSERT INTO assistant_messages (id,project_id,role,content,created_at) VALUES (?,?,?,?,?)",
    userMsgId, pid, "user", message, now());
  const reply = assistantReply(message, {
    project, characters,
    stats: {
      chapters: c("SELECT COUNT(*) as c FROM chapters WHERE project_id = ? AND archived = 0"),
      pages: c("SELECT COUNT(*) as c FROM pages WHERE project_id = ?"),
      panels: c("SELECT COUNT(*) as c FROM panels WHERE project_id = ?"),
      generated: c("SELECT COUNT(*) as c FROM panels WHERE project_id = ? AND stage != 'planned'"),
      scenes: c("SELECT COUNT(*) as c FROM scenes WHERE project_id = ?"),
    },
    premise: premiseRow ? String(premiseRow.content) : undefined,
    lastChapterTitle: lastChapter ? String(lastChapter.title) : undefined,
  });
  const replyId = rid();
  run("INSERT INTO assistant_messages (id,project_id,role,content,created_at) VALUES (?,?,?,?,?)",
    replyId, pid, "assistant", reply, now());
  run("UPDATE projects SET updated_at = ? WHERE id = ?", now(), pid);
  const msgs = all<Record<string, unknown>>(
    "SELECT * FROM assistant_messages WHERE project_id = ? ORDER BY created_at LIMIT 100", pid).map(toAssistantMessage);
  return json({ messages: msgs });
}
