"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Menu, MenuItem, Modal, SkeletonGrid, Spinner } from "@/components/ui";
import type { Asset, AssetKind } from "@/lib/types";

const KINDS: AssetKind[] = ["prop", "vehicle", "weapon", "clothing", "background", "reference", "effect", "logo", "panel", "other"];
const KIND_ICONS: Record<AssetKind, string> = {
  prop: "🏺", vehicle: "🏍", weapon: "⚔", clothing: "🎽", background: "🏞",
  reference: "🖼", effect: "✴", logo: "◈", panel: "▤", other: "◆",
};

export default function AssetsPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, loading, reload, setData } = useApiData<{ items: Asset[] }>(`/api/projects/${id}/assets`);
  const [kindFilter, setKindFilter] = useState<"all" | AssetKind>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleteFor, setDeleteFor] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "prop" as AssetKind, description: "", tags: "" });

  const assets = useMemo(() => {
    let list = data?.items ?? [];
    if (kindFilter !== "all") list = list.filter((a) => a.kind === kindFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q)));
    }
    return list;
  }, [data, kindFilter, query]);

  async function save() {
    if (!form.name.trim()) { toast.push("error", "Name the asset."); return; }
    setBusy(true);
    const payload = {
      name: form.name.trim(), kind: form.kind, description: form.description,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        const res = await api.patch<{ item: Asset }>(`/api/assets/${editing.id}`, payload);
        setData((d) => d ? { items: d.items.map((a) => a.id === editing.id ? res.item : a) } : d);
        setEditing(null);
        toast.push("success", "Asset updated.");
      } else {
        const res = await api.post<{ item: Asset }>(`/api/projects/${id}/assets`, payload);
        setData((d) => d ? { items: [...(d.items ?? []), res.item] } : d);
        setCreating(false);
        toast.push("success", `“${res.item.name}” added to the library.`);
      }
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  async function destroy() {
    if (!deleteFor) return;
    setData((d) => d ? { items: (d.items ?? []).filter((a) => a.id !== deleteFor.id) } : d);
    try {
      await api.del(`/api/assets/${deleteFor.id}`);
      toast.push("success", "Asset removed.");
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  function openEdit(a: Asset) {
    setForm({ name: a.name, kind: a.kind, description: a.description, tags: a.tags.join(", ") });
    setEditing(a);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Asset library</h1>
          <p className="mt-0.5 text-sm text-ink-400">Props, effects, references — reusable across every chapter.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => { setForm({ name: "", kind: "prop", description: "", tags: "" }); setCreating(true); }}>＋ New asset</button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input className="input max-w-xs flex-1" placeholder="Search assets…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="select w-auto capitalize" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}>
          <option value="all">All kinds</option>
          {KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
        </select>
      </div>

      {loading && <div className="mt-6"><SkeletonGrid count={4} height="h-36" /></div>}

      {!loading && assets.length === 0 && (
        <div className="card mt-6">
          <EmptyState icon="◆" title={query || kindFilter !== "all" ? "No matching assets" : "The prop shelf is empty"}
            description={query || kindFilter !== "all" ? "Try another search or kind." : "Key props, sound-effect packs, references — anything you'll reuse belongs here so it never drifts between chapters."}
            action={query || kindFilter !== "all" ? undefined : <button className="btn-primary" onClick={() => setCreating(true)}>＋ Add your first asset</button>} />
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {assets.map((a) => (
          <div key={a.id} className="card px-4 py-3.5 animate-fadeUp">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-lg">{KIND_ICONS[a.kind]}</span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{a.name}</h3>
                  <span className="text-[10px] uppercase tracking-widest text-ink-500">{a.kind}</span>
                </div>
              </div>
              <Menu trigger={<button className="btn-icon text-ink-400 hover:text-ink-100">⋯</button>}>
                <MenuItem onClick={() => openEdit(a)}>✎ Edit</MenuItem>
                <MenuItem danger onClick={() => setDeleteFor(a)}>✕ Remove</MenuItem>
              </Menu>
            </div>
            {a.description && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-400">{a.description}</p>}
            {a.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{a.tags.slice(0, 4).map((t) => <span key={t} className="chip">{t}</span>)}</div>}
          </div>
        ))}
      </div>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : "New asset"}
        footer={<><button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : editing ? "Save" : "Add asset"}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Kind</label>
            <select className="select capitalize" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AssetKind })}>
              {KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[72px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What it is, and any visual rules it must follow" />
          </div>
          <div>
            <label className="label">Tags</label>
            <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="key-item, recurring" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteFor} onClose={() => setDeleteFor(null)} onConfirm={destroy} title={`Remove ${deleteFor?.name}?`} message="The asset will be removed from the library." />
    </div>
  );
}
