import { all, get } from "@/lib/db";
import { fail, json, readBody, requireUser } from "@/lib/api-helpers";
import { toCharacter } from "@/lib/serialize";
import { scriptToStoryboard } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** Script → panel plan. */
export async function POST(req: Request) {
  const auth = requireUser();
  if ("res" in auth) return auth.res;
  const body = await readBody<{ projectId: string; script?: string; sceneId?: string; characterIds?: string[] }>(req);
  if (!body.projectId) return fail("Missing projectId");
  const owned = get("SELECT id FROM projects WHERE id = ? AND user_id = ?", body.projectId, auth.user.id);
  if (!owned) return fail("Project not found", 404);

  let script = body.script ?? "";
  let characterIds = body.characterIds ?? [];
  if (!script && body.sceneId) {
    const scene = get<Record<string, unknown>>("SELECT * FROM scenes WHERE id = ? AND project_id = ?", body.sceneId, body.projectId);
    if (scene) {
      script = (scene.script as string) ?? "";
      characterIds = JSON.parse((scene.character_ids as string) ?? "[]");
    }
  }
  if (!script.trim()) return fail("Write a script first — the storyboard needs story to board.");

  const chars = characterIds.length
    ? characterIds.map((id) => get<Record<string, unknown>>("SELECT * FROM characters WHERE id = ?", id)).filter(Boolean).map((r) => toCharacter(r!))
    : all<Record<string, unknown>>("SELECT * FROM characters WHERE project_id = ?", body.projectId).map(toCharacter);

  const specs = scriptToStoryboard(script, chars);
  if (!specs.length) return fail("Couldn't find any beats in that script. Try 'NAME: dialogue' lines or plain action descriptions.");
  return json({ specs });
}
