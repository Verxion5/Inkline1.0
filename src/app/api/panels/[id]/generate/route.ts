import { all, get, now, rid, run } from "@/lib/db";
import { fail, json, readBody, requireUser } from "@/lib/api-helpers";
import { toCharacter, toLocation, toPanel, toProject, toPanelVersion } from "@/lib/serialize";
import { buildPanelPrompt } from "@/lib/ai";
import { panelArt } from "@/lib/art";

export const dynamic = "force-dynamic";

/** Generate panel artwork. Body may carry overrides (variation: new seed; edit: new settings). */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const row = get<Record<string, unknown>>(
    `SELECT pl.* FROM panels pl JOIN projects p ON p.id = pl.project_id
     WHERE pl.id = ? AND p.user_id = ?`, ctx.params.id, auth.user.id);
  if (!row) return fail("Panel not found", 404);
  const body = await readBody<{
    variation?: boolean; seed?: number | null;
    overrides?: Partial<Record<string, unknown>>;
  }>(req);

  const projectId = String(row.project_id);
  const project = toProject(get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", projectId)!);
  const merged = { ...toPanel(row), ...(body.overrides ?? {}) } as ReturnType<typeof toPanel>;

  const characters = merged.characterIds
    .map((cid) => get<Record<string, unknown>>("SELECT * FROM characters WHERE id = ?", cid))
    .filter(Boolean).map((r) => toCharacter(r!));
  const location = merged.locationId
    ? toLocation(get<Record<string, unknown>>("SELECT * FROM locations WHERE id = ?", merged.locationId)!)
    : null;

  const prompt = buildPanelPrompt({
    project, characters, location,
    description: merged.description || merged.prompt,
    shot: merged.shot, camera: merged.camera,
    expression: merged.expression, pose: merged.pose,
    lighting: merged.lighting, mood: merged.mood, effects: merged.effects, focus: merged.focus,
  });

  const seed = body.seed ?? (body.variation && merged.seed !== null ? (merged.seed * 7919 + 104729) % 2147483647 : Math.floor(Math.random() * 2147483647));
  const t = now();
  const genId = rid();

  run(`INSERT INTO generations (id,project_id,panel_id,character_id,kind,prompt,settings,status,result_url,result_svg,seed,error,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    genId, projectId, merged.id, null, "panel", prompt,
    JSON.stringify({ shot: merged.shot, camera: merged.camera, seed, characters: merged.characterIds, locationId: merged.locationId }),
    "done", null, null, seed, null, t);

  // Archive the current artwork as a version before replacing it
  const previous = toPanel(get<Record<string, unknown>>("SELECT * FROM panels WHERE id = ?", merged.id)!);
  if (previous.imageUrl) {
    run("INSERT INTO panel_versions (id,panel_id,image_url,prompt,seed,label,created_at) VALUES (?,?,?,?,?,?,?)",
      rid(), previous.id, previous.imageUrl, previous.prompt, previous.seed,
      `v${all("SELECT id FROM panel_versions WHERE panel_id = ?", previous.id).length + 1}`, t);
  }

  // Real generation hook: if an OpenAI-compatible key is configured server-side, try it first.
  const apiKey = process.env.OPENAI_API_KEY;
  let imageUrl: string | null = null;
  let svgArt: string | null = null;
  if (apiKey && process.env.INKLINE_USE_REMOTE_IMAGES === "1") {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: { url?: string; b64_json?: string }[] };
        imageUrl = data.data?.[0]?.url ?? null;
      }
    } catch { /* fall through to the built-in art engine */ }
  }
  if (!imageUrl) {
    const art = panelArt({
      prompt: merged.description || merged.prompt,
      shot: merged.shot, camera: merged.camera,
      lighting: merged.lighting, mood: merged.mood, effects: merged.effects,
      characterCount: characters.length,
      hairColor: characters[0]?.appearance?.hairColor,
      environment: location?.environment,
      mono: project.style.artMode === "manga-bw" || project.style.artMode === "manga-gray" || project.style.artMode === "sketch" || project.style.artMode === "lineart",
      seed, label: merged.shot,
    });
    svgArt = art.svg;
    imageUrl = `/api/art/${genId}`;
    run("UPDATE generations SET result_svg = ? WHERE id = ?", art.svg, genId);
  }

  run(`UPDATE panels SET image_url = ?, stage = 'generated', prompt = ?, seed = ?, updated_at = ? WHERE id = ?`,
    imageUrl, prompt, seed, t, merged.id);
  run("UPDATE projects SET updated_at = ? WHERE id = ?", t, projectId);

  const fresh = toPanel(get<Record<string, unknown>>("SELECT * FROM panels WHERE id = ?", merged.id)!);
  const versions = all<Record<string, unknown>>("SELECT * FROM panel_versions WHERE panel_id = ? ORDER BY created_at DESC", merged.id).map(toPanelVersion);
  return json({ panel: fresh, generationId: genId, versions });
}
