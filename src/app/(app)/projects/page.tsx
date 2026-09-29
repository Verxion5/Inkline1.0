"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, timeAgo, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Menu, MenuItem, Modal, SkeletonGrid, Spinner } from "@/components/ui";
import type { Project } from "@/lib/types";

type P = Project & { stats: { chapters: number; pages: number; panels: number; panelsGenerated: number; characters: number } };

export default function ProjectsPage() {
  const { data, loading, reload, setData } = useApiData<{ projects: P[] }>("/api/projects");
  const toast = useToast();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [sort, setSort] = useState<"recent" | "title" | "progress">("recent");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameFor, setRenameFor] = useState<P | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteFor, setDeleteFor] = useState<P | null>(null);
  const [form, setForm] = useState({ title: "", description: "", format: "manga", mode: "ai-assisted" });
  const [busy, setBusy] = useState(false);

  const projects = useMemo(() => {
    let list = data?.projects ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (formatFilter !== "all") list = list.filter((p) => p.format === formatFilter);
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "progress") {
        const pa = a.stats.panels ? a.stats.panelsGenerated / a.stats.panels : 0;
        const pb = b.stats.panels ? b.stats.panelsGenerated / b.stats.panels : 0;
        return pb - pa;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return sorted;
  }, [data, query, statusFilter, formatFilter, sort]);

  function patchLocal(id: string, changes: Partial<P>) {
    setData((d) => d ? { projects: d.projects.map((p) => p.id === id ? { ...p, ...changes } : p) } : d);
  }

  async function toggleFavorite(p: P) {
    patchLocal(p.id, { favorite: !p.favorite });
    try { await api.patch(`/api/projects/${p.id}`, { favorite: !p.favorite }); } catch { reload(); }
  }
  async function archive(p: P) {
    const next = p.status === "archived" ? "active" : "archived";
    patchLocal(p.id, { status: next });
    toast.push("success", next === "archived" ? `“${p.title}” archived.` : `“${p.title}” restored.`);
    try { await api.patch(`/api/projects/${p.id}`, { status: next }); } catch { reload(); }
  }
  async function duplicate(p: P) {
    try {
      const res = await api.post<{ project: P }>(`/api/projects/${p.id}/duplicate`);
      toast.push("success", `Duplicated as “${res.project.title}”.`);
      reload();
    } catch (e) { toast.push("error", (e as Error).message); }
  }
  async function rename() {
    if (!renameFor || !renameValue.trim()) return;
    patchLocal(renameFor.id, { title: renameValue.trim() });
    try {
      await api.patch(`/api/projects/${renameFor.id}`, { title: renameValue.trim() });
      toast.push("success", "Project renamed.");
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
    setRenameFor(null);
  }
  async function destroy() {
    if (!deleteFor) return;
    const id = deleteFor.id, title = deleteFor.title;
    setData((d) => d ? { projects: d.projects.filter((p) => p.id !== id) } : d);
    try {
      await api.del(`/api/projects/${id}`);
      toast.push("success", `“${title}” deleted.`);
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }
  async function createProject() {
    if (!form.title.trim()) { toast.push("error", "Give your manga a title."); return; }
    setBusy(true);
    try {
      const res = await api.post<{ project: Project }>("/api/projects", form);
      toast.push("success", `“${res.project.title}” created.`);
      setCreateOpen(false);
      setForm({ title: "", description: "", format: form.format, mode: form.mode });
      router.push(`/projects/${res.project.id}`);
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Projects</h1>
          <p className="mt-1 text-sm text-ink-400">Each project is a complete creative workspace — story, cast, chapters, pages, assets.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>＋ New project</button>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs flex-1" placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex rounded-lg border border-ink-700 bg-ink-900 p-0.5">
          {(["all", "active", "archived"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-ink-700 text-white" : "text-ink-400 hover:text-ink-200"}`}>
              {s}
            </button>
          ))}
        </div>
        <select className="select w-auto" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
          <option value="all">All formats</option>
          <option value="manga">Manga</option>
          <option value="manhwa">Manhwa</option>
          <option value="webtoon">Webtoon</option>
          <option value="comic">Comic</option>
        </select>
        <select className="select w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="recent">Recently edited</option>
          <option value="title">Title A–Z</option>
          <option value="progress">Progress</option>
        </select>
      </div>

      {/* Grid */}
      <div className="mt-6">
        {loading && <SkeletonGrid count={6} height="h-64" />}
        {!loading && projects.length === 0 && (
          <EmptyState
            icon={query || statusFilter !== "all" ? "⌕" : "📚"}
            title={query || statusFilter !== "all" ? "No projects match" : "No projects yet"}
            description={query || statusFilter !== "all"
              ? "Try a different search or filter."
              : "Start with one idea. Inkline keeps every character, chapter, page and generated panel organized inside its workspace."}
            action={(query || statusFilter !== "all") ? undefined : <button className="btn-primary" onClick={() => setCreateOpen(true)}>＋ Create your first project</button>}
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const pct = p.stats.panels ? Math.round((p.stats.panelsGenerated / p.stats.panels) * 100) : 0;
            return (
              <div key={p.id} className="card-hover group overflow-hidden animate-fadeUp" onClick={() => router.push(`/projects/${p.id}`)}>
                <div className="relative h-36 overflow-hidden bg-ink-850">
                  {p.coverUrl
                    ? <img src={p.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    : <div className="flex h-full items-center justify-center text-4xl text-ink-700">墨</div>}
                  <div className="absolute left-2 top-2 flex gap-1">
                    <span className="badge bg-black/60 text-ink-100 capitalize backdrop-blur">{p.format}</span>
                    {p.status === "archived" && <span className="badge bg-black/60 text-ink-400 backdrop-blur">archived</span>}
                  </div>
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <Menu trigger={<button className="btn-icon bg-black/60 text-white backdrop-blur hover:bg-black/80" aria-label="Project menu">⋯</button>}>
                      <MenuItem onClick={() => router.push(`/projects/${p.id}`)}>◈ Open workspace</MenuItem>
                      <MenuItem onClick={() => toggleFavorite(p)}>{p.favorite ? "★ Unfavorite" : "☆ Favorite"}</MenuItem>
                      <MenuItem onClick={() => { setRenameFor(p); setRenameValue(p.title); }}>✎ Rename</MenuItem>
                      <MenuItem onClick={() => duplicate(p)}>⧉ Duplicate</MenuItem>
                      <MenuItem onClick={() => archive(p)}>{p.status === "archived" ? "↩ Restore" : "🗄 Archive"}</MenuItem>
                      <MenuItem danger onClick={() => setDeleteFor(p)}>✕ Delete…</MenuItem>
                    </Menu>
                  </div>
                  {p.favorite && <span className="absolute bottom-2 right-2 text-lg drop-shadow" style={{ color: "var(--accent)" }}>★</span>}
                </div>
                <div className="p-4">
                  <h3 className="truncate font-display text-sm font-semibold">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 min-h-[2.4em] text-xs leading-relaxed text-ink-400">{p.description || "No description."}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-ink-400">
                    <span className="chip">{p.stats.chapters} ch</span>
                    <span className="chip">{p.stats.pages} pages</span>
                    <span className="chip">{p.stats.panelsGenerated}/{p.stats.panels} panels</span>
                    <span className="chip">{p.stats.characters} cast</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                    </div>
                    <span className="text-[10px] text-ink-500">{timeAgo(p.updatedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a new project"
        footer={<><button className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={createProject} disabled={busy}>{busy ? <Spinner /> : "Create"}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" autoFocus placeholder="e.g. Neon Bloom" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[64px]" placeholder="What's the story?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {["manga", "manhwa", "webtoon", "comic"].map((f) => (
              <button key={f} type="button" onClick={() => setForm({ ...form, format: f })}
                className={`rounded-lg border px-3 py-2 text-sm capitalize transition-all ${form.format === f ? "border-[var(--accent)] bg-ink-850" : "border-ink-700 hover:border-ink-500"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Rename modal */}
      <Modal open={!!renameFor} onClose={() => setRenameFor(null)} title="Rename project"
        footer={<><button className="btn-secondary" onClick={() => setRenameFor(null)}>Cancel</button>
          <button className="btn-primary" onClick={rename}>Save</button></>}>
        <input className="input" autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={destroy}
        title={`Delete “${deleteFor?.title}”?`}
        message="This permanently deletes the project with all chapters, pages, panels, characters and generated assets. This cannot be undone."
      />
    </div>
  );
}
