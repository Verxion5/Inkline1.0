"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, timeAgo, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { EmptyState, Modal, SkeletonGrid, Spinner } from "@/components/ui";
import { useState } from "react";
import type { Project } from "@/lib/types";

interface DashData {
  stats: { projects: number; activeProjects: number; chapters: number; pages: number; panels: number; characters: number; generations: number };
  projects: (Project & { stats: { chapters: number; pages: number; panels: number; panelsGenerated: number; characters: number } })[];
  recentGenerations: { id: string; kind: string; resultUrl: string | null; prompt: string; createdAt: string; projectId: string }[];
}

interface NewProjectForm { title: string; description: string; format: string; mode: string }

const FORMATS = [
  { value: "manga", label: "Manga", desc: "B&W, right-to-left, classic panels" },
  { value: "manhwa", label: "Manhwa", desc: "Full-color, vertical-scroll friendly" },
  { value: "webtoon", label: "Webtoon", desc: "Mobile-first long-scroll episodes" },
  { value: "comic", label: "Comic", desc: "Western format, left-to-right" },
];

const MODES = [
  { value: "manual", label: "Manual", desc: "You control everything" },
  { value: "ai-assisted", label: "AI-Assisted", desc: "AI handles repetitive work" },
  { value: "storyboard", label: "Storyboard-first", desc: "Script → plan → generate" },
  { value: "production", label: "AI Production", desc: "Generate, then review" },
];

export default function DashboardPage() {
  const { data, loading, reload } = useApiData<DashData>("/api/dashboard");
  const router = useRouter();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<NewProjectForm>({ title: "", description: "", format: "manga", mode: "ai-assisted" });
  const [busy, setBusy] = useState(false);

  const projects = data?.projects ?? [];
  const activeProjects = projects.filter((p) => p.status === "active");
  const featured = activeProjects[0];

  async function createProject() {
    if (!form.title.trim()) { toast.push("error", "Give your manga a title first."); return; }
    setBusy(true);
    try {
      const res = await api.post<{ project: Project }>("/api/projects", form);
      toast.push("success", `“${res.project.title}” created. Your studio awaits.`);
      setCreateOpen(false);
      setForm({ title: "", description: "", format: form.format, mode: form.mode });
      router.push(`/projects/${res.project.id}`);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Onboarding checklist derived from real data
  const checklist = featured ? [
    { done: true, label: "Create a project", href: `/projects/${featured.id}` },
    { done: featured.stats.characters > 0, label: "Create your first character", href: `/projects/${featured.id}/characters` },
    { done: featured.stats.chapters > 0, label: "Create a chapter", href: `/projects/${featured.id}/chapters` },
    { done: featured.stats.pages > 0, label: "Create a page", href: `/projects/${featured.id}/chapters` },
    { done: featured.stats.panelsGenerated > 0, label: "Generate your first panel", href: `/projects/${featured.id}/studio` },
  ] : [
    { done: false, label: "Create your first project", href: "#new" },
    { done: false, label: "Create a character", href: "" },
    { done: false, label: "Board a scene", href: "" },
    { done: false, label: "Generate a panel", href: "" },
  ];
  const checklistDone = checklist.filter((c) => c.done).length;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 5 ? "Late night inking" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {greeting}, <span style={{ color: "var(--accent)" }}>{data ? "creator" : "…"}</span>
          </h1>
          <p className="mt-1 text-sm text-ink-400">The page is blank. The story isn&apos;t.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>＋ New project</button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Projects", value: data?.stats.activeProjects, icon: "📚" },
          { label: "Chapters", value: data?.stats.chapters, icon: "🗂" },
          { label: "Pages", value: data?.stats.pages, icon: "📄" },
          { label: "Panels", value: data?.stats.panels, icon: "▤" },
          { label: "Characters", value: data?.stats.characters, icon: "mask" },
          { label: "Generations", value: data?.stats.generations, icon: "✦" },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="text-[11px] uppercase tracking-widest text-ink-500">{s.label}</div>
            <div className="mt-1 font-display text-2xl font-bold">
              {s.value === undefined ? <span className="inline-block h-7 w-12 skeleton" /> : s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Continue working */}
        <div className="lg:col-span-2 space-y-6">
          {loading && <SkeletonGrid count={2} height="h-44" />}
          {!loading && featured && (
            <section className="card overflow-hidden animate-fadeUp">
              <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
                <h2 className="section-title">Continue working</h2>
                <span className="text-xs text-ink-500">edited {timeAgo(featured.updatedAt)}</span>
              </div>
              <Link href={`/projects/${featured.id}`} className="block">
                <div className="flex gap-5 p-5 hover:bg-ink-850/50 transition-colors">
                  <div className="h-36 w-28 shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
                    {featured.coverUrl
                      ? <img src={featured.coverUrl} alt="" className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center text-3xl text-ink-600">墨</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display truncate text-lg font-semibold">{featured.title}</h3>
                      <span className="chip capitalize">{featured.format}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-400">{featured.description || "No description yet."}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-300">
                      <span className="chip">{featured.stats.chapters} chapters</span>
                      <span className="chip">{featured.stats.pages} pages</span>
                      <span className="chip">{featured.stats.panelsGenerated}/{featured.stats.panels} panels generated</span>
                      <span className="chip">{featured.stats.characters} characters</span>
                    </div>
                    <div className="mt-4">
                      {(() => {
                        const pct = featured.stats.panels ? Math.round((featured.stats.panelsGenerated / featured.stats.panels) * 100) : 0;
                        return (
                          <>
                            <div className="flex justify-between text-[11px] text-ink-500"><span>Panel production</span><span>{pct}%</span></div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* Recent projects */}
          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
              <h2 className="section-title">My projects</h2>
              <Link href="/projects" className="text-xs text-ink-400 hover:text-ink-200 hover:underline">View all →</Link>
            </div>
            <div className="p-5">
              {loading && <SkeletonGrid count={3} height="h-28" />}
              {!loading && projects.length === 0 && (
                <EmptyState icon="📚" title="No projects yet" description="Every manga starts as one idea. Create your first project and Inkline will set up the full workspace — story, cast, chapters and pages."
                  action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>＋ Start your first manga</button>} />
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {projects.slice(0, 3).map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="card-hover overflow-hidden">
                    <div className="h-20 w-full overflow-hidden bg-ink-850">
                      {p.coverUrl ? <img src={p.coverUrl} alt="" className="h-full w-full object-cover opacity-90" />
                        : <div className="flex h-full items-center justify-center text-2xl text-ink-700">墨</div>}
                    </div>
                    <div className="px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{p.title}</span>
                        {p.favorite && <span className="text-xs" style={{ color: "var(--accent)" }}>★</span>}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-500">
                        <span className="capitalize">{p.format} · {p.stats.panels} panels</span>
                        {p.status === "archived" && <span className="chip">archived</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Onboarding */}
          <section className="card px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Getting started</h2>
              <span className="text-xs text-ink-500">{checklistDone}/{checklist.length}</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {checklist.map((step, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    step.done ? "text-white" : "border border-ink-600 text-ink-500"}`}
                    style={step.done ? { background: "var(--accent)" } : {}}>
                    {step.done ? "✓" : i + 1}
                  </span>
                  {step.href ? (
                    <Link href={step.href} className={step.done ? "text-ink-500 line-through" : "text-ink-200 hover:underline"}>{step.label}</Link>
                  ) : (
                    <span className="text-ink-500">{step.label}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Recent generations */}
          <section className="card">
            <div className="border-b border-ink-800 px-5 py-3"><h2 className="section-title">Recent generations</h2></div>
            <div className="p-4">
              {loading && <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>}
              {!loading && (data?.recentGenerations.length ?? 0) === 0 && (
                <p className="py-4 text-center text-sm text-ink-500">Nothing generated yet.<br />Panels you generate will appear here.</p>
              )}
              <div className="space-y-2.5">
                {data?.recentGenerations.map((g) => (
                  <Link key={g.id} href={`/projects/${g.projectId}/studio`} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-ink-850 transition-colors">
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-ink-700 bg-ink-850">
                      {g.resultUrl ? <img src={g.resultUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-ink-200">{g.prompt.slice(0, 64)}…</div>
                      <div className="text-[10px] text-ink-500">{g.kind} · {timeAgo(g.createdAt)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Workflow */}
          <section className="card px-5 py-4">
            <h2 className="section-title">The Inkline workflow</h2>
            <ol className="mt-3 space-y-1.5 text-xs text-ink-400">
              {["Story", "Characters", "Locations & Assets", "Chapters", "Scenes & Script", "Storyboard", "Generate Panels", "Arrange Page", "Lettering", "Review & Export"].map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-ink-800 text-[9px] text-ink-400">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {/* New project modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a new project" wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createProject} disabled={busy}>{busy ? <Spinner /> : "Create project"}</button>
          </>
        }>
        <div className="space-y-5">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="e.g. Crimson Petal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="label">Description / logline</label>
            <textarea className="input min-h-[72px]" placeholder="A shrine keeper's daughter discovers the festival lanterns guide the dead…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button key={f.value} type="button" onClick={() => setForm({ ...form, format: f.value })}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-all ${form.format === f.value ? "border-[var(--accent)] bg-ink-850" : "border-ink-700 hover:border-ink-500"}`}>
                  <div className="text-sm font-semibold">{f.label}</div>
                  <div className="text-[11px] text-ink-500">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Production mode</label>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button key={m.value} type="button" onClick={() => setForm({ ...form, mode: m.value })}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-all ${form.mode === m.value ? "border-[var(--accent)] bg-ink-850" : "border-ink-700 hover:border-ink-500"}`}>
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-[11px] text-ink-500">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
