import { all, get, now, rid, run } from "@/lib/db";
import { fail, json, readBody, requireUser } from "@/lib/api-helpers";
import { toProject } from "@/lib/serialize";
import { projectStats } from "@/lib/stats";
import { ensureSeeded } from "@/lib/seed";
import type { ProjectFormat, ProjectMode, ProjectStyle } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_STYLE: ProjectStyle = {
  artMode: "manga-bw", lineStyle: "clean confident inking", shading: "screentone + hatching",
  rendering: "high-contrast", backgroundStyle: "detailed atmospheric", mood: "", customNotes: "",
};

export async function GET() {
  ensureSeeded();
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const rows = all<Record<string, unknown>>(
    "SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC", auth.user.id);
  const projects = rows.map((r) => {
    const p = toProject(r);
    const stats = projectStats(p.id);
    return { ...p, stats };
  });
  return json({ projects });
}

export async function POST(req: Request) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const body = await readBody<{
    title?: string; description?: string; format?: ProjectFormat; mode?: ProjectMode; style?: Partial<ProjectStyle>;
  }>(req);
  const title = (body.title ?? "").trim();
  if (!title) return fail("Give your project a title.");
  const id = rid();
  const t = now();
  const style = { ...DEFAULT_STYLE, ...(body.style ?? {}) };
  run(`INSERT INTO projects (id,user_id,title,description,format,mode,status,favorite,cover_url,reading_direction,page_w,page_h,gutter,border_width,style,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, auth.user.id, title, body.description ?? "", body.format ?? "manga", body.mode ?? "ai-assisted",
    "active", 0, null, body.format === "manga" ? "rtl" : "ltr", 1000, 1414, 1.5, 0.55, JSON.stringify(style), t, t);
  // Starter story premise block
  run("INSERT INTO story_blocks (id,project_id,kind,title,content,order_num,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
    rid(), id, "premise", "Story Premise", "", 0, t, t);
  return json({ project: toProject(get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", id)!) }, 201);
}
