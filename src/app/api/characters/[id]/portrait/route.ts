import { get, now, rid, run, all } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api-helpers";
import { toCharacter, toProject } from "@/lib/serialize";
import { portraitArt } from "@/lib/art";

export const dynamic = "force-dynamic";

/** Generate a character reference portrait (uses a remote model if configured, else built-in art engine). */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const row = get<Record<string, unknown>>(
    `SELECT c.* FROM characters c JOIN projects p ON p.id = c.project_id
     WHERE c.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!row) return fail("Character not found", 404);
  const character = toCharacter(row);
  const project = toProject(get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", character.projectId)!);
  const mono = ["manga-bw", "manga-gray", "sketch", "lineart"].includes(project.style.artMode);
  const seed = Math.floor(Math.random() * 2147483647);
  const t = now();
  const genId = rid();

  let imageUrl: string | null = null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && process.env.INKLINE_USE_REMOTE_IMAGES === "1") {
    try {
      const prompt = `manga character reference portrait of ${character.name}, ${character.appearance.hair} ${character.appearance.hairColor} hair, ${character.appearance.eyes} eyes, wearing ${character.appearance.clothing}, ${project.style.artMode} style`;
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: { url?: string }[] };
        imageUrl = data.data?.[0]?.url ?? null;
      }
    } catch { /* fall through */ }
  }
  let svg: string | null = null;
  if (!imageUrl) {
    const art = portraitArt({ name: character.name, hairColor: character.appearance.hairColor, hair: character.appearance.hair, eyes: character.appearance.eyes, mono, seed });
    svg = art.svg;
    imageUrl = `/api/art/${genId}`;
  }
  run(`INSERT INTO generations (id,project_id,panel_id,character_id,kind,prompt,settings,status,result_url,result_svg,seed,error,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    genId, character.projectId, null, character.id, "portrait",
    `Reference portrait: ${character.name} — ${character.appearance.hair} hair, ${character.appearance.eyes} eyes, ${character.appearance.clothing}`,
    JSON.stringify({ seed }), "done", imageUrl, svg, seed, null, t);
  run("UPDATE characters SET portrait_url = ?, updated_at = ? WHERE id = ?", imageUrl, t, character.id);
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, character.projectId);
  const fresh = toCharacter(get<Record<string, unknown>>("SELECT * FROM characters WHERE id = ?", character.id)!);
  return json({ character: fresh });
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const versions = all<Record<string, unknown>>(
    `SELECT g.* FROM generations g JOIN characters c ON c.id = g.character_id
     WHERE g.character_id = ? ORDER BY g.created_at DESC LIMIT 20`, ctx.params.id);
  return json({ generations: versions.map((v) => ({ id: v.id, url: v.result_url, seed: v.seed, createdAt: v.created_at })) });
}
