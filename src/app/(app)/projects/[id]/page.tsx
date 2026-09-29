"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, timeAgo, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ConfirmDialog, Modal, Progress, SkeletonRows, StatusBadge } from "@/components/ui";
import type { Project, ProjectStyle } from "@/lib/types";

interface Overview {
  stats: { chapters: number; scenes: number; pages: number; panels: number; panelsGenerated: number; characters: number; locations: number; assets: number; bubbles: number; generations: number; donePages: number; scriptedScenes: number };
  chapters: { id: string; number: number; title: string; status: string; pageCount: number; doneCount: number }[];
  recentGenerations: { id: string; resultUrl: string | null; prompt: string; createdAt: string }[];
  recentPages: { id: string; number: number; title: string; status: string; panelCount: number; chapterId: string }[];
}

const ART_MODES: { value: ProjectStyle["artMode"]; label: string }[] = [
  { value: "manga-bw", label: "Black & white manga" },
  { value: "manga-gray", label: "Grayscale manga" },
  { value: "manhwa-color", label: "Full-color manhwa" },
  { value: "sketch", label: "Sketch" },
  { value: "lineart", label: "Line art" },
  { value: "cinematic", label: "Cinematic comic" },
  { value: "stylized", label: "Stylized comic" },
  { value: "custom", label: "Custom" },
];

function Pipeline({ stats }: { stats: Overview["stats"] }) {
  const stages = [
    { label: "Story", value: stats.scenes, total: Math.max(stats.scenes, 1), hint: `${stats.scenes} scenes` },
    { label: "Cast", value: Math.min(stats.characters, 4), total: 4, hint: `${stats.characters} characters` },
    { label: "World", value: Math.min(stats.locations + stats.assets, 4), total: 4, hint: `${stats.locations} locations · ${stats.assets} assets` },
    { label: "Script", value: stats.scriptedScenes, total: Math.max(stats.scenes, 1), hint: `${stats.scriptedScenes}/${stats.scenes} scripted` },
    { label: "Panels", value: stats.panelsGenerated, total: Math.max(stats.panels, 1), hint: `${stats.panelsGenerated}/${stats.panels} generated` },
    { label: "Pages", value: stats.donePages, total: Math.max(stats.pages, 1), hint: `${stats.donePages}/${stats.pages} done` },
    { label: "Lettering", value: stats.bubbles, total: Math.max(stats.panels, 1), hint: `${stats.bubbles} lettered panels` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {stages.map((s, i) => (
        <div key={s.label} className="card px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-500">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-ink-800 text-[9px] text-ink-400">{i + 1}</span>
            {s.label}
          </div>
          <Progress value={(s.value / s.total) * 100} className="mt-2" />
          <div className="mt-1.5 truncate text-[10px] text-ink-500">{s.hint}</div>
        </div>
      ))}
    </div>
  );
}

function OverviewInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { data, loading, reload } = useApiData<Overview>(`/api/projects/${id}/overview`);
  const projectApi = useApiData<{ project: Project }>(`/api/projects/${id}`);
  const project = projectApi.data?.project;
  const [settingsOpen, setSettingsOpen] = useState(search.get("settings") === "1");
  const [form, setForm] = useState<Partial<Project> & { style?: ProjectStyle }>({});
  const [saving, setSaving] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  function openSettings() {
    if (project) setForm({ title: project.title, description: project.description, format: project.format, mode: project.mode, readingDirection: project.readingDirection, style: project.style, gutter: project.gutter, borderWidth: project.borderWidth });
    setSettingsOpen(true);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await api.patch(`/api/projects/${id}`, form);
      toast.push("success", "Project settings saved.");
      setSettingsOpen(false);
      projectApi.reload(); reload();
      router.refresh();
    } catch (e) { toast.push("error", (e as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Production overview</h1>
          <p className="text-sm text-ink-400">Idea → Story → Script → Storyboard → Panels → Pages → Lettering → QC → Export</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={openSettings}>⚙ Project settings</button>
      </div>

      {loading && <div className="mt-6"><div className="skeleton h-20" /><div className="mt-4 skeleton h-48" /></div>}
      {data && (
        <>
          <div className="mt-5"><Pipeline stats={data.stats} /></div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="card lg:col-span-2">
              <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
                <h2 className="section-title">Chapters</h2>
                <Link href={`/projects/${id}/chapters`} className="text-xs text-ink-400 hover:text-ink-200 hover:underline">Manage →</Link>
              </div>
              <div className="divide-panel">
                {data.chapters.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-ink-500">
                    No chapters yet. <Link className="hover:underline" style={{ color: "var(--accent)" }} href={`/projects/${id}/chapters`}>Create Chapter 1</Link> to start production.
                  </div>
                )}
                {data.chapters.map((ch) => (
                  <Link key={ch.id} href={`/projects/${id}/chapters/${ch.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-ink-850/50 transition-colors">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 font-display text-sm font-bold">{ch.number}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{ch.title}</div>
                      <div className="text-xs text-ink-500">{ch.pageCount} pages · {ch.doneCount} done</div>
                    </div>
                    <StatusBadge status={ch.status} />
                  </Link>
                ))}
              </div>
            </section>

            <div className="space-y-6">
              <section className="card">
                <div className="border-b border-ink-800 px-5 py-3"><h2 className="section-title">Recent pages</h2></div>
                <div className="divide-panel">
                  {data.recentPages.length === 0 && <div className="px-5 py-6 text-center text-xs text-ink-500">No pages yet.</div>}
                  {data.recentPages.map((p) => (
                    <Link key={p.id} href={`/projects/${id}/studio?page=${p.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-ink-850/50 transition-colors">
                      <span className="text-ink-500">Page {p.number}</span>
                      <span className="truncate text-ink-300">{p.title || "Untitled"}</span>
                      <span className="ml-auto"><StatusBadge status={p.status} /></span>
                    </Link>
                  ))}
                </div>
              </section>
              <section className="card">
                <div className="border-b border-ink-800 px-5 py-3"><h2 className="section-title">Generation history</h2></div>
                <div className="p-4">
                  {data.recentGenerations.length === 0 && <div className="py-4 text-center text-xs text-ink-500">No generations yet.</div>}
                  <div className="grid grid-cols-4 gap-2">
                    {data.recentGenerations.slice(0, 8).map((g) => (
                      <div key={g.id} className="aspect-square overflow-hidden rounded-md border border-ink-700 bg-ink-850" title={g.prompt}>
                        {g.resultUrl ? <img src={g.resultUrl} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {/* Settings modal */}
      <Modal open={settingsOpen} onClose={() => { setSettingsOpen(false); if (search.get("settings")) router.replace(`/projects/${id}`); }}
        title="Project settings" wide
        footer={<><button className="btn-secondary" onClick={() => setSettingsOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save settings"}</button></>}>
        {!project ? <div className="skeleton h-64" /> : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Title</label>
                <input className="input" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Format</label>
                <select className="select" value={form.format ?? "manga"} onChange={(e) => setForm({ ...form, format: e.target.value as Project["format"] })}>
                  {["manga", "manhwa", "webtoon", "comic"].map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input min-h-[64px]" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Production mode</label>
                <select className="select" value={form.mode ?? "ai-assisted"} onChange={(e) => setForm({ ...form, mode: e.target.value as Project["mode"] })}>
                  <option value="manual">Manual — you drive everything</option>
                  <option value="ai-assisted">AI-Assisted — AI does repetitive work</option>
                  <option value="storyboard">Storyboard-first — script → plan → generate</option>
                  <option value="production">AI Production — generate, then review</option>
                </select>
              </div>
              <div>
                <label className="label">Reading direction</label>
                <select className="select" value={form.readingDirection ?? "rtl"} onChange={(e) => setForm({ ...form, readingDirection: e.target.value as "rtl" | "ltr" })}>
                  <option value="rtl">Right-to-left (manga)</option>
                  <option value="ltr">Left-to-right (manhwa/comic)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Visual style</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <select className="select" value={form.style?.artMode ?? "manga-bw"}
                  onChange={(e) => setForm({ ...form, style: { ...project.style, artMode: e.target.value as ProjectStyle["artMode"] } })}>
                  {ART_MODES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <input className="input" placeholder="Line style (e.g. bold weighted ink)" value={form.style?.lineStyle ?? ""}
                  onChange={(e) => setForm({ ...form, style: { ...project.style, lineStyle: e.target.value } })} />
                <input className="input" placeholder="Shading (e.g. screentone + hatching)" value={form.style?.shading ?? ""}
                  onChange={(e) => setForm({ ...form, style: { ...project.style, shading: e.target.value } })} />
                <input className="input" placeholder="Background style" value={form.style?.backgroundStyle ?? ""}
                  onChange={(e) => setForm({ ...form, style: { ...project.style, backgroundStyle: e.target.value } })} />
                <input className="input sm:col-span-2" placeholder="Overall mood (e.g. eerie beauty, hopeful dawn)" value={form.style?.mood ?? ""}
                  onChange={(e) => setForm({ ...form, style: { ...project.style, mood: e.target.value } })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Panel gutter (pt)</label>
                <input type="number" step="0.5" min="0" className="input" value={form.gutter ?? project.gutter}
                  onChange={(e) => setForm({ ...form, gutter: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Panel border width (pt)</label>
                <input type="number" step="0.1" min="0" className="input" value={form.borderWidth ?? project.borderWidth}
                  onChange={(e) => setForm({ ...form, borderWidth: Number(e.target.value) })} />
              </div>
            </div>
            <div className="rounded-lg border border-ink-700 bg-ink-925 p-4">
              <div className="text-sm font-medium text-ink-200">Danger zone</div>
              <p className="mt-1 text-xs text-ink-500">Archived projects stay out of the active workspace but keep all their data.</p>
              <div className="mt-3 flex gap-2">
                {project.status === "active" ? (
                  <button className="btn-secondary btn-sm" onClick={async () => { await api.patch(`/api/projects/${id}`, { status: "archived" }); toast.push("success", "Project archived."); projectApi.reload(); }}>🗄 Archive project</button>
                ) : (
                  <button className="btn-secondary btn-sm" onClick={async () => { await api.patch(`/api/projects/${id}`, { status: "active" }); toast.push("success", "Project restored."); projectApi.reload(); }}>↩ Restore project</button>
                )}
                <button className="btn-danger btn-sm" onClick={() => setArchiveConfirm(true)}>✕ Delete project…</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={archiveConfirm} onClose={() => setArchiveConfirm(false)}
        onConfirm={async () => { await api.del(`/api/projects/${id}`); toast.push("success", "Project deleted."); router.push("/projects"); }}
        title="Delete this project?" message="Everything inside — chapters, pages, panels, characters, generations — will be permanently deleted." />
    </div>
  );
}

export default function ProjectOverviewPage() {
  return <Suspense><OverviewInner /></Suspense>;
}
