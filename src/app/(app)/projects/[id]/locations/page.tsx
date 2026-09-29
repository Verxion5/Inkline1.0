"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Menu, MenuItem, Modal, SkeletonGrid, Spinner } from "@/components/ui";
import type { Location } from "@/lib/types";

export default function LocationsPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, loading, reload, setData } = useApiData<{ items: Location[] }>(`/api/projects/${id}/locations`);
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Location | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", architecture: "", environment: "exterior" as Location["environment"],
    lighting: "", details: "", timeOfDay: "", weather: "", tags: "",
  });

  const locations = data?.items ?? [];

  function openCreate() {
    setForm({ name: "", description: "", architecture: "", environment: "exterior", lighting: "", details: "", timeOfDay: "", weather: "", tags: "" });
    setCreating(true);
  }
  function openEdit(l: Location) {
    setForm({
      name: l.name, description: l.description, architecture: l.architecture, environment: l.environment,
      lighting: l.lighting, details: l.details, timeOfDay: l.timeOfDay, weather: l.weather, tags: l.tags.join(", "),
    });
    setEditing(l);
  }

  async function save() {
    if (!form.name.trim()) { toast.push("error", "Name the location."); return; }
    setBusy(true);
    const payload = {
      name: form.name.trim(), description: form.description, architecture: form.architecture,
      environment: form.environment, lighting: form.lighting, details: form.details,
      timeOfDay: form.timeOfDay, weather: form.weather,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        const res = await api.patch<{ item: Location }>(`/api/locations/${editing.id}`, payload);
        setData((d) => d ? { items: d.items.map((l) => l.id === editing.id ? res.item : l) } : d);
        toast.push("success", "Location updated.");
        setEditing(null);
      } else {
        const res = await api.post<{ item: Location }>(`/api/projects/${id}/locations`, payload);
        setData((d) => d ? { items: [...(d.items ?? []), res.item] } : d);
        toast.push("success", `“${res.item.name}” added to the world.`);
        setCreating(false);
      }
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  async function generateImage(l: Location) {
    setGenerating(l.id);
    try {
      const res = await api.post<{ location: Location }>(`/api/locations/${l.id}/image`);
      setData((d) => d ? { items: d.items.map((x) => x.id === l.id ? res.location : x) } : d);
      toast.push("success", `Establishing art generated for ${l.name}.`);
    } catch (e) { toast.push("error", (e as Error).message); } finally { setGenerating(null); }
  }

  async function destroy() {
    if (!deleteFor) return;
    setData((d) => d ? { items: (d.items ?? []).filter((l) => l.id !== deleteFor.id) } : d);
    try {
      await api.del(`/api/locations/${deleteFor.id}`);
      toast.push("success", "Location removed.");
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Location library</h1>
          <p className="mt-0.5 text-sm text-ink-400">Recurring places stay visually consistent — architecture, lighting, time of day, weather.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={openCreate}>＋ New location</button>
      </div>

      {loading && <div className="mt-6"><SkeletonGrid count={3} height="h-52" /></div>}

      {!loading && locations.length === 0 && (
        <div className="card mt-6">
          <EmptyState icon="⛩" title="Where does the story happen?"
            description="Define the places your story returns to — the AI will keep their architecture, lighting and atmosphere consistent in every panel."
            action={<button className="btn-primary" onClick={openCreate}>＋ Create your first location</button>} />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((l) => (
          <div key={l.id} className="card-hover overflow-hidden animate-fadeUp" onClick={() => openEdit(l)}>
            <div className="relative aspect-video bg-ink-850">
              {l.imageUrl ? <img src={l.imageUrl} alt={l.name} className="h-full w-full object-cover" />
                : <div className="flex h-full items-center justify-center text-4xl text-ink-700">⛰</div>}
              <div className="absolute left-2 top-2 flex gap-1">
                <span className="badge bg-black/60 text-ink-100 capitalize backdrop-blur">{l.environment}</span>
                {l.timeOfDay && <span className="badge bg-black/60 text-ink-100 backdrop-blur">{l.timeOfDay}</span>}
              </div>
              <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
                <Menu trigger={<button className="btn-icon bg-black/60 text-white backdrop-blur hover:bg-black/80">⋯</button>}>
                  <MenuItem onClick={() => openEdit(l)}>✎ Edit</MenuItem>
                  <MenuItem onClick={() => generateImage(l)} disabled={generating === l.id}>{generating === l.id ? "Generating…" : "✦ Generate establishing art"}</MenuItem>
                  <MenuItem danger onClick={() => setDeleteFor(l)}>✕ Remove</MenuItem>
                </Menu>
              </div>
            </div>
            <div className="px-4 py-3">
              <h3 className="truncate text-sm font-semibold">{l.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">{l.description || "No description."}</p>
              {l.lighting && <div className="mt-2 text-[10px] text-ink-500">☀ {l.lighting}</div>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : "New location"} wide
        footer={<><button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : editing ? "Save" : "Add location"}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hakurai Shrine Street" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What it feels like, what happens here" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Architecture</label>
              <input className="input" value={form.architecture} onChange={(e) => setForm({ ...form, architecture: e.target.value })} placeholder="wooden facades, stone steps, torii gate" />
            </div>
            <div>
              <label className="label">Environment</label>
              <select className="select" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value as Location["environment"] })}>
                <option value="exterior">Exterior</option>
                <option value="interior">Interior</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="label">Lighting</label>
              <input className="input" value={form.lighting} onChange={(e) => setForm({ ...form, lighting: e.target.value })} placeholder="warm lantern glow against night blue" />
            </div>
            <div>
              <label className="label">Time of day</label>
              <input className="input" value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} placeholder="night / sunset / dawn" />
            </div>
            <div>
              <label className="label">Weather</label>
              <input className="input" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} placeholder="clear / rain / windy" />
            </div>
            <div>
              <label className="label">Tags</label>
              <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="recurring, festival" />
            </div>
          </div>
          <div>
            <label className="label">Environmental details</label>
            <textarea className="input min-h-[52px]" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Lantern strings cross the street; petals drift upward here." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteFor} onClose={() => setDeleteFor(null)} onConfirm={destroy}
        title={`Remove ${deleteFor?.name}?`} message="Scenes and panels referencing it will be flagged by the continuity engine." />
    </div>
  );
}
