"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api, useApiData, useDebouncedCallback } from "@/lib/client";
import { useToast } from "@/components/toast";
import { EmptyState, Spinner } from "@/components/ui";
import type { Chapter, Scene, ShotType, CameraAngle, StoryboardSpec, Location } from "@/lib/types";

const SHOTS: ShotType[] = ["establishing", "wide", "medium", "close-up", "extreme-close-up", "over-the-shoulder", "action", "splash", "insert"];
const CAMERAS: CameraAngle[] = ["eye-level", "high", "low", "overhead", "dutch", "worms-eye"];

const SHOT_ICON: Record<string, string> = {
  establishing: "🌐", wide: "🖼", medium: "🧍", "close-up": "👁", "extreme-close-up": "🔍",
  "over-the-shoulder": "🗼", action: "💥", splash: "✨", insert: "📎",
};

const SAMPLE_SCRIPT = `EXT. HAKURAI SHRINE STREET - NIGHT

The street roars with festival light. Hundreds of paper lanterns drift upward like slow fireworks.

YUKI (weary smile): Two hundred sixteen... two hundred seventeen. Last one.

She lifts the final lantern — crimson, older than the others. It does not rise. It leans toward her, gently, like a listener.

YUKI (startled): ...You're supposed to go UP.

Behind her, high on the shrine steps, a fox mask catches the light.

SORA (sharp whisper): Yuki. Do NOT touch it again.`;

function StoryboardInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const { data: chapterData } = useApiData<{ chapters: Chapter[] }>(`/api/projects/${id}/overview`);
  const [chapterId, setChapterId] = useState(search.get("chapter") ?? "");
  const chapters = chapterData?.chapters ?? [];
  useEffect(() => {
    if (!chapterId && chapters.length) setChapterId(chapters[0].id);
  }, [chapters, chapterId]);

  const { data: full, loading: fullLoading, reload } = useApiData<{ chapter: Chapter; scenes: Scene[]; pages: unknown[] }>(
    chapterId ? `/api/chapters/${chapterId}/full` : null);
  const scenes = full?.scenes ?? [];
  const [sceneId, setSceneId] = useState(search.get("scene") ?? "");
  useEffect(() => {
    if (scenes.length && !scenes.some((s) => s.id === sceneId)) setSceneId(scenes[0].id);
  }, [scenes, sceneId]);
  const scene = scenes.find((s) => s.id === sceneId);

  const { data: charData } = useApiData<{ items: { id: string; name: string }[] }>(`/api/projects/${id}/characters`);
  const { data: locData } = useApiData<{ items: Location[] }>(`/api/projects/${id}/locations`);
  const characters = charData?.items ?? [];
  const locations = locData?.items ?? [];

  const [script, setScript] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (scene && loadedFor !== scene.id) {
      setScript(scene.script);
      setLoadedFor(scene.id);
    }
  }, [scene, loadedFor]);

  const saveScript = useDebouncedCallback(async (value: string) => {
    if (!sceneId) return;
    try {
      await api.patch(`/api/scenes/${sceneId}`, { script: value, status: value.trim() && scene?.status === "outline" ? "scripted" : scene?.status });
    } catch { /* silent autosave failure */ }
  }, 700);

  const [specs, setSpecs] = useState<StoryboardSpec[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pushing, setPushing] = useState(false);

  const dirty = useMemo(() => scene !== undefined && script !== (scene.script ?? ""), [scene, script]);

  async function runStoryboard() {
    setGenerating(true);
    try {
      const res = await api.post<{ specs: StoryboardSpec[] }>("/api/storyboard/generate", {
        projectId: id, sceneId: sceneId || undefined, script,
        characterIds: scene?.characterIds ?? [],
      });
      setSpecs(res.specs);
      toast.push("success", `Storyboarded ${res.specs.length} panels. Tweak anything before generating art.`);
      if (scene && scene.status === "outline") {
        await api.patch(`/api/scenes/${sceneId}`, { status: "boarded" });
        reload();
      }
    } catch (e) { toast.push("error", (e as Error).message); } finally { setGenerating(false); }
  }

  async function pushToPage() {
    if (!specs?.length || !chapterId) return;
    setPushing(true);
    try {
      const res = await api.post<{ page: { id: string; number: number } }>("/api/storyboard/to-page", {
        projectId: id, chapterId, sceneId: sceneId || undefined,
        title: scene ? `${scene.title} — boarded` : "Storyboarded page",
        specs,
      });
      toast.push("success", `Page ${res.page.number} created with ${specs.length} planned panels.`);
      router.push(`/projects/${id}/studio?page=${res.page.id}`);
    } catch (e) { toast.push("error", (e as Error).message); } finally { setPushing(false); }
  }

  function patchSpec(i: number, changes: Partial<StoryboardSpec>) {
    setSpecs((s) => s ? s.map((sp, j) => j === i ? { ...sp, ...changes } : sp) : s);
  }
  function moveSpec(i: number, dir: -1 | 1) {
    setSpecs((s) => {
      if (!s) return s;
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">AI Storyboard</h1>
          <p className="mt-0.5 text-sm text-ink-400">Script → Scene → Shot → Panel → Dialogue → Composition. Plan first, generate after.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select w-auto" value={chapterId} onChange={(e) => { setChapterId(e.target.value); setSpecs(null); }}>
            <option value="" disabled>Chapter…</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>Ch. {c.number} — {c.title}</option>)}
          </select>
        </div>
      </div>

      {fullLoading && <div className="mt-6 skeleton h-96" />}

      {!fullLoading && chapters.length === 0 && (
        <div className="card mt-6"><EmptyState icon="🗂" title="No chapters to board"
          description="Create a chapter first — storyboards live inside chapters as scenes."
          action={<a className="btn-primary" href={`/projects/${id}/chapters`}>Go to chapters</a>} /></div>
      )}

      {!fullLoading && chapters.length > 0 && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Script column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Script</h2>
              <div className="flex items-center gap-2">
                <select className="select h-8 w-auto text-xs" value={sceneId} onChange={(e) => { setSceneId(e.target.value); setSpecs(null); }}>
                  {scenes.length === 0 && <option>No scenes</option>}
                  {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.number} — {s.title}</option>)}
                </select>
              </div>
            </div>
            <div className="card overflow-hidden">
              {scene ? (
                <>
                  <textarea
                    className="input min-h-[380px] resize-y rounded-none border-0 bg-ink-925 font-mono text-[12.5px] leading-relaxed focus:ring-0"
                    value={script}
                    onChange={(e) => { setScript(e.target.value); saveScript(e.target.value); }}
                    placeholder={SAMPLE_SCRIPT}
                    spellCheck={false}
                  />
                  <div className="flex items-center justify-between border-t border-ink-800 px-4 py-2">
                    <span className="text-[11px] text-ink-500">
                      {dirty ? "Unsaved changes — autosaving…" : "Autosaved ✓"} · supports <code className="text-ink-400">EXT./INT.</code>, <code className="text-ink-400">NAME: line</code>, <code className="text-ink-400">(direction)</code>
                    </span>
                    {!script.trim() && (
                      <button className="btn-ghost btn-sm" onClick={() => setScript(SAMPLE_SCRIPT)}>Try sample</button>
                    )}
                  </div>
                </>
              ) : (
                <div className="px-5 py-10 text-center text-sm text-ink-500">
                  No scenes in this chapter yet.
                  <button className="btn-secondary btn-sm ml-3" onClick={async () => {
                    try {
                      await api.post(`/api/chapters/${chapterId}/scenes`, { title: "New scene" });
                      toast.push("success", "Scene created.");
                      reload();
                    } catch (e) { toast.push("error", (e as Error).message); }
                  }}>＋ Create scene</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-primary flex-1" onClick={runStoryboard} disabled={generating || !script.trim()}>
                {generating ? <><Spinner /> Boarding…</> : <>✦ Generate storyboard{script.trim() ? "" : " (write a script first)"}</>}
              </button>
            </div>
            {scene && (
              <div className="card px-4 py-3 text-xs text-ink-400">
                <span className="text-ink-500">Scene cast:</span>{" "}
                {scene.characterIds.length
                  ? scene.characterIds.map((cid) => characters.find((c) => c.id === cid)?.name ?? "?").join(", ")
                  : "all project characters"} ·{" "}
                <span className="text-ink-500">Location:</span>{" "}
                {locations.find((l) => l.id === scene.locationId)?.name ?? "unassigned"}
              </div>
            )}
          </div>

          {/* Storyboard column */}
          <div>
            <h2 className="section-title">Panel plan {specs ? `· ${specs.length} panels` : ""}</h2>
            {!specs && (
              <div className="card mt-3">
                <EmptyState icon="🎞" title="No storyboard yet"
                  description="Write a script on the left and press Generate. The AI assigns shots, cameras, expressions, effects and pacing — you stay the editor."
                />
              </div>
            )}
            {specs && (
              <>
                <div className="mt-3 space-y-2.5">
                  {specs.map((sp, i) => (
                    <div key={i} className="card px-4 py-3 animate-fadeUp">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-sm" title={sp.shot}>{SHOT_ICON[sp.shot]}</span>
                        <span className="text-xs font-semibold text-ink-200">Panel {i + 1}</span>
                        <span className="chip capitalize">{sp.purpose}</span>
                        <span className="ml-auto flex items-center gap-0.5">
                          <button className="btn-icon !p-1 text-ink-500 hover:text-ink-200 text-[9px]" onClick={() => moveSpec(i, -1)}>▲</button>
                          <button className="btn-icon !p-1 text-ink-500 hover:text-ink-200 text-[9px]" onClick={() => moveSpec(i, 1)}>▼</button>
                          <button className="btn-icon !p-1 text-ink-500 hover:text-red-400 text-xs" onClick={() => setSpecs((s) => s ? s.filter((_, j) => j !== i) : s)}>✕</button>
                        </span>
                      </div>
                      <textarea className="input mt-2 min-h-[44px] border-0 bg-transparent px-0 py-1 text-sm focus:ring-0"
                        value={sp.description} onChange={(e) => patchSpec(i, { description: e.target.value })} />
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <select className="select h-7 w-auto py-0 text-xs" value={sp.shot} onChange={(e) => patchSpec(i, { shot: e.target.value as ShotType })}>
                          {SHOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select className="select h-7 w-auto py-0 text-xs" value={sp.camera} onChange={(e) => patchSpec(i, { camera: e.target.value as CameraAngle })}>
                          {CAMERAS.map((s) => <option key={s} value={s}>cam: {s}</option>)}
                        </select>
                        <select className="select h-7 w-auto py-0 text-xs" value={sp.size} onChange={(e) => patchSpec(i, { size: e.target.value as StoryboardSpec["size"] })}>
                          {["splash", "large", "medium", "small", "strip"].map((s) => <option key={s} value={s}>size: {s}</option>)}
                        </select>
                        <input className="input h-7 w-36 py-0 text-xs" placeholder="expression" value={sp.expression} onChange={(e) => patchSpec(i, { expression: e.target.value })} />
                      </div>
                      {sp.characterNames.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sp.characterNames.map((n) => <span key={n} className="chip">🎎 {n}</span>)}
                        </div>
                      )}
                      {sp.dialogue.map((d, j) => (
                        <div key={j} className="mt-2 rounded-lg border border-ink-700 bg-ink-925 px-2.5 py-1.5 text-xs">
                          <span className="font-semibold" style={{ color: "var(--accent)" }}>{d.character || "…"}</span>
                          <span className="text-ink-500"> ({d.kind})</span>: <span className="text-ink-200">{d.text}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="sticky bottom-4 mt-4 flex gap-2 rounded-xl border border-ink-700 bg-ink-900/95 p-2 backdrop-blur shadow-pop">
                  <button className="btn-secondary flex-1 btn-sm" onClick={runStoryboard} disabled={generating}>
                    {generating ? <Spinner /> : "↻ Re-board from script"}
                  </button>
                  <button className="btn-primary flex-[2]" onClick={pushToPage} disabled={pushing}>
                    {pushing ? <><Spinner /> Creating page…</> : `▭ Push ${specs.length} panels to a new page`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoryboardPage() {
  return <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-6 sm:px-8"><div className="skeleton h-96" /></div>}><StoryboardInner /></Suspense>;
}
