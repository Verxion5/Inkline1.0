"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api, timeAgo, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Menu, MenuItem, Modal, SkeletonGrid, Spinner, StatusBadge, Tabs } from "@/components/ui";
import type { Character } from "@/lib/types";

const ROLES = ["protagonist", "deuteragonist", "antagonist", "supporting", "sidekick", "mentor", "rival", "extra"];
const HAIR_COLORS = ["black", "brown", "blonde", "silver", "white", "red", "crimson", "pink", "blue", "green", "purple", "gray", "orange"];

const emptyAppearance = { hair: "", hairColor: "", eyes: "", build: "", clothing: "", features: "", accessories: "" };

export default function CharactersPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, loading, reload, setData } = useApiData<{ items: Character[] }>(`/api/projects/${id}/characters`);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Character | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Character | null>(null);
  const [deleteFor, setDeleteFor] = useState<Character | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [designNote, setDesignNote] = useState("");
  const [detailTab, setDetailTab] = useState<"profile" | "memory" | "story">("profile");

  const characters = useMemo(() => {
    let list = data?.items ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.role.includes(q) || c.tags.some((t) => t.includes(q)));
    }
    return list;
  }, [data, query]);

  const [form, setForm] = useState({
    name: "", role: "supporting", age: "", description: "", personality: "", history: "", abilities: "", relationships: "",
    appearance: emptyAppearance, tags: "", status: "designing" as Character["status"],
  });

  function openCreate() {
    setForm({ name: "", role: "supporting", age: "", description: "", personality: "", history: "", abilities: "", relationships: "", appearance: emptyAppearance, tags: "", status: "designing" });
    setCreating(true);
  }
  function openEdit(c: Character) {
    setForm({
      name: c.name, role: c.role, age: c.age, description: c.description, personality: c.personality,
      history: c.history, abilities: c.abilities, relationships: c.relationships,
      appearance: { ...emptyAppearance, ...c.appearance }, tags: c.tags.join(", "), status: c.status,
    });
    setEditing(c);
  }

  async function save() {
    if (!form.name.trim()) { toast.push("error", "Every legend needs a name."); return; }
    setBusy(true);
    const payload = {
      name: form.name.trim(), role: form.role, age: form.age, description: form.description,
      personality: form.personality, history: form.history, abilities: form.abilities, relationships: form.relationships,
      appearance: form.appearance, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), status: form.status,
    };
    try {
      if (editing) {
        const res = await api.patch<{ item: Character }>(`/api/characters/${editing.id}`, payload);
        setData((d) => d ? { items: d.items.map((c) => c.id === editing.id ? res.item : c) } : d);
        toast.push("success", `${res.item.name} updated — their memory profile is live in every new generation.`);
        setEditing(null);
      } else {
        const res = await api.post<{ item: Character }>(`/api/projects/${id}/characters`, payload);
        setData((d) => d ? { items: [...(d.items ?? []), res.item] } : d);
        toast.push("success", `${res.item.name} joined the cast.`);
        setCreating(false);
      }
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  async function generatePortrait(c: Character) {
    setGenerating(c.id);
    try {
      const res = await api.post<{ character: Character }>(`/api/characters/${c.id}/portrait`);
      setData((d) => d ? { items: d.items.map((x) => x.id === c.id ? res.character : x) } : d);
      if (viewing?.id === c.id) setViewing(res.character);
      toast.push("success", `Reference portrait generated for ${c.name}.`);
    } catch (e) { toast.push("error", (e as Error).message); } finally { setGenerating(null); }
  }

  async function updateDesign(c: Character) {
    if (!designNote.trim()) { toast.push("error", "Describe what changed (e.g. 'cut hair short after Ch3')."); return; }
    const changeLog = [...c.changeLog, { date: new Date().toISOString().slice(0, 10), note: designNote.trim() }];
    try {
      const res = await api.patch<{ item: Character }>(`/api/characters/${c.id}`, { change_log: changeLog, status: "evolved" });
      setData((d) => d ? { items: d.items.map((x) => x.id === c.id ? res.item : x) } : d);
      if (viewing?.id === c.id) setViewing(res.item);
      setDesignNote("");
      toast.push("success", "Design evolution logged into character memory.");
    } catch (e) { toast.push("error", (e as Error).message); }
  }

  async function destroy() {
    if (!deleteFor) return;
    setData((d) => d ? { items: (d.items ?? []).filter((c) => c.id !== deleteFor.id) } : d);
    try {
      await api.del(`/api/characters/${deleteFor.id}`);
      toast.push("success", `${deleteFor.name} left the cast.`);
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  const memoryFields: [string, string][] = [
    ["Hair", form.appearance.hair], ["Hair color", form.appearance.hairColor], ["Eyes", form.appearance.eyes],
    ["Build", form.appearance.build], ["Clothing", form.appearance.clothing], ["Distinctive features", form.appearance.features],
    ["Accessories", form.appearance.accessories],
  ];

  const formFields = (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Yuki Hara" autoFocus />
        </div>
        <div>
          <label className="label">Age</label>
          <input className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="17" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Story role</label>
          <select className="select capitalize" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Design status</label>
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Character["status"] })}>
            <option value="designing">Designing</option>
            <option value="final">Final</option>
            <option value="evolved">Evolved</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Who are they, in one breath?" />
      </div>
      <div>
        <label className="label">Personality</label>
        <textarea className="input min-h-[52px]" value={form.personality} onChange={(e) => setForm({ ...form, personality: e.target.value })} />
      </div>
      <div className="rounded-xl border border-ink-700 bg-ink-925 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">Identity profile</span>
          <span className="text-[10px] text-ink-500">injected into every generation for consistency</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Hair</label>
            <input className="input" value={form.appearance.hair} onChange={(e) => setForm({ ...form, appearance: { ...form.appearance, hair: e.target.value } })} placeholder="long, straight, blunt bangs" />
          </div>
          <div>
            <label className="label">Hair color</label>
            <select className="select" value={form.appearance.hairColor} onChange={(e) => setForm({ ...form, appearance: { ...form.appearance, hairColor: e.target.value } })}>
              <option value="">—</option>
              {HAIR_COLORS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Eyes</label>
            <input className="input" value={form.appearance.eyes} onChange={(e) => setForm({ ...form, appearance: { ...form.appearance, eyes: e.target.value } })} placeholder="large amber" />
          </div>
          <div>
            <label className="label">Build</label>
            <input className="input" value={form.appearance.build} onChange={(e) => setForm({ ...form, appearance: { ...form.appearance, build: e.target.value } })} placeholder="slight, 158cm" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Clothing (default outfit)</label>
            <input className="input" value={form.appearance.clothing} onChange={(e) => setForm({ ...form, appearance: { ...form.appearance, clothing: e.target.value } })} placeholder="white shrine maiden robe, crimson hakama" />
          </div>
          <div>
            <label className="label">Distinctive features</label>
            <input className="input" value={form.appearance.features} onChange={(e) => setForm({ ...form, appearance: { ...form.appearance, features: e.target.value } })} placeholder="mole under left eye, scar" />
          </div>
          <div>
            <label className="label">Accessories</label>
            <input className="input" value={form.appearance.accessories} onChange={(e) => setForm({ ...form, appearance: { ...form.appearance, accessories: e.target.value } })} placeholder="pendant, charms" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">History</label>
          <textarea className="input min-h-[52px]" value={form.history} onChange={(e) => setForm({ ...form, history: e.target.value })} />
        </div>
        <div>
          <label className="label">Abilities</label>
          <textarea className="input min-h-[52px]" value={form.abilities} onChange={(e) => setForm({ ...form, abilities: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">Relationships</label>
        <textarea className="input min-h-[52px]" value={form.relationships} onChange={(e) => setForm({ ...form, relationships: e.target.value })} placeholder="Bound to Ren; distrusts Kaede…" />
      </div>
      <div>
        <label className="label">Tags (comma separated)</label>
        <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="lead, shrine, spirit" />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Character library</h1>
          <p className="mt-0.5 text-sm text-ink-400">Persistent identities — hair, eyes, clothing, features — remembered across every chapter.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={openCreate}>＋ New character</button>
      </div>

      <input className="input mt-5 max-w-xs" placeholder="Search the cast…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {loading && <div className="mt-6"><SkeletonGrid count={4} height="h-56" /></div>}

      {!loading && characters.length === 0 && (
        <div className="card mt-6">
          <EmptyState icon="🎎" title="No characters yet"
            description="Characters are Inkline's memory anchors. Give each one an identity profile and the AI will draw the same person in Chapter 1 and Chapter 80."
            action={<button className="btn-primary" onClick={openCreate}>＋ Create your first character</button>} />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {characters.map((c) => (
          <div key={c.id} className="card-hover overflow-hidden animate-fadeUp" onClick={() => setViewing(c)}>
            <div className="relative aspect-[3/4] bg-ink-850">
              {c.portraitUrl ? <img src={c.portraitUrl} alt={c.name} className="h-full w-full object-cover" />
                : <div className="flex h-full items-center justify-center text-5xl text-ink-700">◫</div>}
              <div className="absolute left-2 top-2"><span className="badge bg-black/60 capitalize text-ink-100 backdrop-blur">{c.role}</span></div>
              <div className="absolute right-2 top-2 opacity-0 transition-opacity hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <Menu trigger={<button className="btn-icon bg-black/60 text-white backdrop-blur hover:bg-black/80">⋯</button>}>
                  <MenuItem onClick={() => openEdit(c)}>✎ Edit profile</MenuItem>
                  <MenuItem onClick={() => generatePortrait(c)} disabled={generating === c.id}>{generating === c.id ? "Generating…" : "✦ Generate portrait"}</MenuItem>
                  <MenuItem danger onClick={() => setDeleteFor(c)}>✕ Remove</MenuItem>
                </Menu>
              </div>
            </div>
            <div className="px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-semibold">{c.name}</h3>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-500">{[c.appearance.hair, c.appearance.hairColor, c.appearance.eyes].filter(Boolean).join(" · ") || "No identity profile yet"}</p>
              {c.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.tags.slice(0, 3).map((t) => <span key={t} className="chip">{t}</span>)}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Character detail viewer */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? ""} wide>
        {viewing && (
          <div>
            <Tabs tabs={[{ value: "profile", label: "Profile" }, { value: "memory", label: "Memory & consistency" }, { value: "story", label: "Story" }]} value={"profile" in {} ? "profile" : detailTab} onChange={(v) => setDetailTab(v)} />
            {detailTab === "profile" && (
              <div className="mt-4 flex flex-col gap-5 sm:flex-row">
                <div className="shrink-0">
                  <div className="aspect-[3/4] w-40 overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
                    {viewing.portraitUrl ? <img src={viewing.portraitUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl text-ink-700">◫</div>}
                  </div>
                  <button className="btn-secondary btn-sm mt-2 w-full" onClick={() => generatePortrait(viewing)} disabled={generating === viewing.id}>
                    {generating === viewing.id ? <Spinner /> : "✦ Generate portrait"}
                  </button>
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="chip capitalize">{viewing.role}</span>
                    {viewing.age && <span className="chip">age {viewing.age}</span>}
                    <StatusBadge status={viewing.status} />
                    {viewing.tags.map((t) => <span key={t} className="chip">{t}</span>)}
                  </div>
                  {viewing.description && <p className="leading-relaxed text-ink-300">{viewing.description}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><span className="text-ink-500">Hair:</span> {viewing.appearance.hair || "—"}{viewing.appearance.hairColor ? ` (${viewing.appearance.hairColor})` : ""}</div>
                    <div><span className="text-ink-500">Eyes:</span> {viewing.appearance.eyes || "—"}</div>
                    <div><span className="text-ink-500">Build:</span> {viewing.appearance.build || "—"}</div>
                    <div><span className="text-ink-500">Clothing:</span> {viewing.appearance.clothing || "—"}</div>
                    <div className="col-span-2"><span className="text-ink-500">Features:</span> {viewing.appearance.features || "—"}</div>
                    <div className="col-span-2"><span className="text-ink-500">Accessories:</span> {viewing.appearance.accessories || "—"}</div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button className="btn-secondary btn-sm" onClick={() => { setViewing(null); openEdit(viewing); }}>✎ Edit profile</button>
                  </div>
                </div>
              </div>
            )}
            {detailTab === "memory" && (
              <div className="mt-4 space-y-4">
                <p className="text-xs leading-relaxed text-ink-400">
                  This identity profile is injected into every panel {viewing.name} appears in — face, hair, clothing, proportions and distinctive features stay anchored across chapters.
                </p>
                <div className="rounded-lg border border-ink-700 bg-ink-925 p-3 font-mono text-[11px] leading-relaxed text-ink-300">
                  {viewing.name} · {viewing.appearance.hair || "?"} {viewing.appearance.hairColor || "?"} hair · {viewing.appearance.eyes || "?"} eyes · {viewing.appearance.build || "?"} · wearing {viewing.appearance.clothing || "?"}{viewing.appearance.features ? ` · distinctive: ${viewing.appearance.features}` : ""}{viewing.appearance.accessories ? ` · ${viewing.appearance.accessories}` : ""}
                </div>
                <div>
                  <div className="section-title mb-2">Design evolution log</div>
                  {viewing.changeLog.length === 0 && <p className="text-xs text-ink-500">No design changes logged yet.</p>}
                  <div className="space-y-1.5">
                    {viewing.changeLog.map((cl, i) => (
                      <div key={i} className="flex gap-2.5 text-xs">
                        <span className="chip shrink-0">{cl.date}</span>
                        <span className="text-ink-300">{cl.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-ink-700 p-3">
                  <label className="label">Story progressed? Update the design</label>
                  <div className="flex gap-2">
                    <input className="input" placeholder="e.g. new scar after Chapter 3 battle" value={designNote} onChange={(e) => setDesignNote(e.target.value)} />
                    <button className="btn-primary btn-sm shrink-0" onClick={() => updateDesign(viewing)}>Log change</button>
                  </div>
                </div>
              </div>
            )}
            {detailTab === "story" && (
              <div className="mt-4 space-y-4 text-sm">
                <div><div className="section-title mb-1">History</div><p className="text-ink-300">{viewing.history || "—"}</p></div>
                <div><div className="section-title mb-1">Personality</div><p className="text-ink-300">{viewing.personality || "—"}</p></div>
                <div><div className="section-title mb-1">Abilities</div><p className="text-ink-300">{viewing.abilities || "—"}</p></div>
                <div><div className="section-title mb-1">Relationships</div><p className="text-ink-300">{viewing.relationships || "—"}</p></div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create / edit modal */}
      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : "New character"} wide
        footer={<><button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : editing ? "Save profile" : "Add to cast"}</button></>}>
        {formFields}
      </Modal>

      <ConfirmDialog open={!!deleteFor} onClose={() => setDeleteFor(null)} onConfirm={destroy}
        title={`Remove ${deleteFor?.name}?`} message="They'll be detached from panels and the story. Panels referencing them will be flagged by the continuity engine." />
    </div>
  );
}

let detailTabState: never;
const [detailTab, setDetailTab] = [(() => "profile")(), (_v: string) => {}];
