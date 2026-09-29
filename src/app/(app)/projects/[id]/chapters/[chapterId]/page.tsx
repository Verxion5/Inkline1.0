"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Menu, MenuItem, Modal, SkeletonGrid, Spinner, StatusBadge } from "@/components/ui";
import type { Chapter, Page, Panel, Scene } from "@/lib/types";

interface ChapterFull {
  chapter: Chapter;
  scenes: Scene[];
  pages: (Page & { panels: Panel[] })[];
}

const PAGE_TEMPLATES: Record<string, string> = {
  blank: "Blank page",
  "classic-4": "Classic 4 (band + 3)",
  "dynamic-6": "Dynamic 6",
  "manga-5": "Manga 5",
  "splash": "Splash page",
  "dialogue-3": "Dialogue 3",
};

export default function ChapterDetailPage() {
  const { id, chapterId } = useParams<{ id: string; chapterId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, loading, reload, setData } = useApiData<ChapterFull>(`/api/chapters/${chapterId}/full`);
  const [addOpen, setAddOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [template, setTemplate] = useState("blank");
  const [busy, setBusy] = useState(false);
  const [deletePage, setDeletePage] = useState<(Page & { panels: Panel[] }) | null>(null);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8"><div className="skeleton h-24" /><div className="mt-4 skeleton h-64" /></div>;
  if (!data) return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8"><p className="text-sm text-ink-400">Chapter not found.</p></div>;

  const { chapter, scenes, pages } = data;

  async function addPage() {
    setBusy(true);
    try {
      const res = await api.post<{ page: Page }>(`/api/chapters/${chapterId}/pages`, { title: pageTitle, template });
      toast.push("success", `Page ${res.page.number} added.`);
      setAddOpen(false);
      setPageTitle("");
      router.push(`/projects/${id}/studio?page=${res.page.id}`);
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  async function duplicatePage(p: Page) {
    try {
      await api.post(`/api/pages/${p.id}/duplicate`);
      toast.push("success", "Page duplicated with its panel plans.");
      reload();
    } catch (e) { toast.push("error", (e as Error).message); }
  }

  async function destroyPage() {
    if (!deletePage) return;
    setData((d) => d ? { ...d, pages: d.pages.filter((pg) => pg.id !== deletePage.id) } : d);
    try {
      await api.del(`/api/pages/${deletePage.id}`);
      toast.push("success", `Page ${deletePage.number} deleted.`);
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink-800 font-display text-2xl font-bold" style={{ color: "var(--accent)" }}>{chapter.number}</span>
          <div>
            <h1 className="font-display text-xl font-bold sm:text-2xl">{chapter.title}</h1>
            <p className="mt-0.5 text-sm text-ink-400">{chapter.description || "No chapter description yet."}</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={chapter.status} />
              <span className="text-xs text-ink-500">{scenes.length} scenes · {pages.length} pages</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => setAddOpen(true)}>＋ Add page</button>
          <Link className="btn-primary btn-sm" href={`/projects/${id}/storyboard?chapter=${chapter.id}`}>🎞 Storyboard a scene</Link>
        </div>
      </div>

      {/* Scenes */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Scenes & script</h2>
          <Link href={`/projects/${id}/storyboard?chapter=${chapter.id}`} className="text-xs text-ink-400 hover:text-ink-200 hover:underline">Edit in storyboard →</Link>
        </div>
        {scenes.length === 0 ? (
          <div className="card mt-3 px-5 py-6 text-center text-sm text-ink-500">
            No scenes yet. <Link className="hover:underline" style={{ color: "var(--accent)" }} href={`/projects/${id}/storyboard?chapter=${chapter.id}`}>Write your first scene script</Link> — then board it into panels.
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {scenes.map((sc) => (
              <Link key={sc.id} href={`/projects/${id}/storyboard?chapter=${chapter.id}&scene=${sc.id}`} className="card block px-4 py-3 hover:border-ink-600 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-500">Scene {sc.number}</span>
                  <h3 className="truncate text-sm font-medium">{sc.title}</h3>
                  <span className="ml-auto"><StatusBadge status={sc.status} /></span>
                </div>
                {sc.script && <p className="mt-1.5 line-clamp-2 font-mono text-[11px] leading-relaxed text-ink-500">{sc.script.split("\n").filter(Boolean).slice(0, 2).join(" · ")}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pages */}
      <section className="mt-8">
        <h2 className="section-title">Pages</h2>
        {pages.length === 0 ? (
          <div className="card mt-3">
            <EmptyState icon="📄" title="No pages in this chapter"
              description="Pages hold the panels you plan, generate, arrange and letter. Start with one — you can pick a layout template."
              action={<button className="btn-primary" onClick={() => setAddOpen(true)}>＋ Create page 1</button>} />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pages.map((p) => {
              const generated = p.panels.filter((pl) => pl.imageUrl).length;
              return (
                <div key={p.id} className="card-hover group animate-fadeUp" onClick={() => router.push(`/projects/${id}/studio?page=${p.id}`)}>
                  <div className="relative aspect-[1000/1414] overflow-hidden rounded-lg border border-ink-700 bg-white">
                    <div className="absolute inset-0" style={{ background: "var(--paper)" }}>
                      {p.panels.map((pl) => (
                        <div key={pl.id} className="absolute overflow-hidden border border-black/70 bg-ink-200"
                          style={{ left: `${pl.x}%`, top: `${pl.y}%`, width: `${pl.w}%`, height: `${pl.h}%` }}>
                          {pl.imageUrl
                            ? <img src={pl.imageUrl} alt="" className="h-full w-full object-cover" />
                            : <div className="flex h-full w-full items-center justify-center text-[7px] text-ink-400" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 3px, transparent 3px 6px)" }}>?</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1 px-0.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">Page {p.number}{p.title ? ` — ${p.title}` : ""}</div>
                      <div className="text-[10px] text-ink-500">{generated}/{p.panels.length} panels</div>
                    </div>
                    <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      <Menu trigger={<button className="btn-icon !p-1 text-ink-400 hover:text-ink-100">⋯</button>}>
                        <MenuItem onClick={() => router.push(`/projects/${id}/studio?page=${p.id}`)}>▭ Open in studio</MenuItem>
                        <MenuItem onClick={() => duplicatePage(p)}>⧉ Duplicate</MenuItem>
                        <MenuItem danger onClick={() => setDeletePage(p)}>✕ Delete</MenuItem>
                      </Menu>
                    </div>
                  </div>
                  <div className="mt-1 px-0.5"><StatusBadge status={p.status} /></div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New page"
        footer={<><button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={addPage} disabled={busy}>{busy ? <Spinner /> : "Create & open studio"}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Page title (optional)</label>
            <input className="input" autoFocus value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} placeholder="e.g. The reveal" />
          </div>
          <div>
            <label className="label">Layout template</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PAGE_TEMPLATES).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setTemplate(value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${template === value ? "border-[var(--accent)] bg-ink-850" : "border-ink-700 hover:border-ink-500"}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-500">Templates place starter panel frames you can drag, resize or clear. Blank pages work too — the storyboard can auto-fill panels.</p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletePage} onClose={() => setDeletePage(null)} onConfirm={destroyPage}
        title={`Delete page ${deletePage?.number}?`} message="Its panels, prompts and lettering will be permanently deleted." />
    </div>
  );
}
