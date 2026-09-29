"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api, timeAgo, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Menu, MenuItem, Modal, SkeletonRows, Spinner, StatusBadge } from "@/components/ui";
import type { Chapter } from "@/lib/types";

type Ch = Chapter & { pageCount: number; doneCount: number; panelCount: number; generatedCount: number };

const STATUSES: Chapter["status"][] = ["planning", "scripting", "storyboard", "in-progress", "lettering", "review", "done"];

export default function ChaptersPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, loading, reload, setData } = useApiData<{ chapters: Ch[] }>(`/api/projects/${id}/overview`);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Ch | null>(null);

  const chapters = data?.chapters ?? [];

  async function create() {
    setBusy(true);
    try {
      const res = await api.post<{ chapter: Chapter }>(`/api/projects/${id}/chapters`, { title: title || undefined, description });
      toast.push("success", `Chapter ${res.chapter.number} created.`);
      setCreating(false);
      setTitle("");
      setDescription("");
      router.push(`/projects/${id}/chapters/${res.chapter.id}`);
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  async function patchChapter(ch: Ch, changes: Partial<Chapter>) {
    setData((d) => d ? { ...d, chapters: d.chapters.map((c) => c.id === ch.id ? { ...c, ...changes } : c) } : d);
    try { await api.patch(`/api/chapters/${ch.id}`, changes); } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  async function move(ch: Ch, dir: -1 | 1) {
    const idx = chapters.findIndex((c) => c.id === ch.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= chapters.length) return;
    const a = chapters[idx], b = chapters[swapIdx];
    setData((d) => d ? { ...d, chapters: d.chapters.map((c) => c.id === a.id ? { ...c, number: b.number } : c.id === b.id ? { ...c, number: a.number } : c) } : d);
    try {
      await Promise.all([
        api.patch(`/api/chapters/${a.id}`, { number: b.number }),
        api.patch(`/api/chapters/${b.id}`, { number: a.number }),
      ]);
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  async function duplicate(ch: Ch) {
    try {
      await api.post(`/api/chapters/${ch.id}/duplicate`);
      toast.push("success", `Chapter duplicated with its pages and panel plans.`);
      reload();
    } catch (e) { toast.push("error", (e as Error).message); }
  }

  async function destroy() {
    if (!deleteFor) return;
    setData((d) => d ? { ...d, chapters: d.chapters.filter((c) => c.id !== deleteFor.id) } : d);
    try {
      await api.del(`/api/chapters/${deleteFor.id}`);
      toast.push("success", `Chapter ${deleteFor.number} deleted.`);
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Chapters</h1>
          <p className="mt-0.5 text-sm text-ink-400">Chapter → scenes → pages → panels. Reorder freely; Inkline keeps the numbers straight.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setCreating(true)}>＋ New chapter</button>
      </div>

      {loading && <div className="mt-6"><SkeletonRows count={3} /></div>}

      {!loading && chapters.length === 0 && (
        <div className="card mt-6">
          <EmptyState icon="🗂" title="No chapters yet"
            description="Chapters hold your scenes, scripts, storyboards and finished pages. Create Chapter 1 — you can plan it as loosely or as thoroughly as you like."
            action={<button className="btn-primary" onClick={() => setCreating(true)}>＋ Create Chapter 1</button>} />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {chapters.map((ch, idx) => {
          const pct = ch.pageCount ? Math.round((ch.doneCount / ch.pageCount) * 100) : ch.panelCount ? Math.round((ch.generatedCount / ch.panelCount) * 100) : 0;
          return (
            <div key={ch.id} className="card animate-fadeUp">
              <div className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-800 font-display text-lg font-bold" style={{ color: "var(--accent)" }}>{ch.number}</span>
                <Link href={`/projects/${id}/chapters/${ch.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-sm font-semibold">{ch.title}</h3>
                    <StatusBadge status={ch.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-500">{ch.description || "No description."} · edited {timeAgo(ch.updatedAt)}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                    </div>
                    <span className="text-[10px] text-ink-500">{ch.pageCount} pages · {ch.generatedCount}/{ch.panelCount} panels · {pct}%</span>
                  </div>
                </Link>
                <div className="flex flex-col gap-0.5">
                  <button className="btn-icon text-ink-500 hover:text-ink-200 disabled:opacity-20" style={{ fontSize: "10px" }} disabled={idx === 0} onClick={() => move(ch, -1)} aria-label="Move up">▲</button>
                  <button className="btn-icon text-ink-500 hover:text-ink-200 disabled:opacity-20" style={{ fontSize: "10px" }} disabled={idx === chapters.length - 1} onClick={() => move(ch, 1)} aria-label="Move down">▼</button>
                </div>
                <Menu trigger={<button className="btn-icon text-ink-400 hover:text-ink-100">⋯</button>}>
                  <MenuItem onClick={() => router.push(`/projects/${id}/chapters/${ch.id}`)}>◈ Open chapter</MenuItem>
                  <MenuItem onClick={() => duplicate(ch)}>⧉ Duplicate</MenuItem>
                  <MenuItem onClick={() => router.push(`/projects/${id}/chapters/${ch.id}`)}>＋ Add page</MenuItem>
                  <MenuItem danger onClick={() => setDeleteFor(ch)}>✕ Delete</MenuItem>
                </Menu>
              </div>
              <div className="border-t border-ink-800/60 px-5 py-2">
                <label className="sr-only">Status</label>
                <select className="select h-7 w-auto border-0 bg-transparent py-0 text-xs text-ink-400 hover:text-ink-200"
                  value={ch.status} onChange={(e) => patchChapter(ch, { status: e.target.value as Chapter["status"] })}>
                  {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New chapter"
        footer={<><button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
          <button className="btn-primary" onClick={create} disabled={busy}>{busy ? <Spinner /> : "Create chapter"}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" autoFocus placeholder="e.g. The Lantern Festival" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">What happens in this chapter?</label>
            <textarea className="input min-h-[72px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One or two sentences — enough to aim the scenes." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteFor} onClose={() => setDeleteFor(null)} onConfirm={destroy}
        title={`Delete Chapter ${deleteFor?.number}?`}
        message="All scenes, pages and panels in this chapter will be permanently deleted." />
    </div>
  );
}
