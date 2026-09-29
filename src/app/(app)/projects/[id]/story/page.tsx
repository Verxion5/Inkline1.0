"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api, timeAgo, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { EmptyState, Menu, MenuItem, Modal, SkeletonRows, Spinner } from "@/components/ui";
import type { StoryBlock, StoryKind } from "@/lib/types";

const KINDS: { value: StoryKind; label: string; icon: string; hint: string }[] = [
  { value: "premise", label: "Premise", icon: "◈", hint: "The one-paragraph heart of the story" },
  { value: "synopsis", label: "Synopsis", icon: "▤", hint: "Chapter-by-chapter summary" },
  { value: "event", label: "Key event", icon: "⚡", hint: "Moments that must stay consistent" },
  { value: "thread", label: "Plot thread", icon: "🧵", hint: "Open questions to pay off later" },
  { value: "lore", label: "Lore", icon: "📖", hint: "World rules, history, organizations" },
  { value: "theme", label: "Theme", icon: "◐", hint: "What the story is really about" },
  { value: "conflict", label: "Conflict", icon: "⚔", hint: "Central tensions and stakes" },
  { value: "note", label: "Note", icon: "✎", hint: "Freeform story notes" },
];

export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, loading, reload, setData } = useApiData<{ items: StoryBlock[] }>(`/api/projects/${id}/story`);
  const [editing, setEditing] = useState<StoryBlock | null>(null);
  const [creating, setCreating] = useState<StoryKind | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [busy, setBusy] = useState(false);

  const blocks = data?.items ?? [];

  function patchLocal(blockId: string, changes: Partial<StoryBlock>) {
    setData((d) => d ? { items: d.items.map((b) => b.id === blockId ? { ...b, ...changes } : b) } : d);
  }

  async function createBlock() {
    if (!creating) return;
    setBusy(true);
    try {
      const res = await api.post<{ item: StoryBlock }>(`/api/projects/${id}/story`, { kind: creating, title: draft.title || KINDS.find((k) => k.value === creating)?.label, content: draft.content });
      setData((d) => d ? { items: [...(d.items ?? []), res.item] } : d);
      toast.push("success", "Story block added.");
      setCreating(null);
      setDraft({ title: "", content: "" });
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  async function saveBlock() {
    if (!editing) return;
    setBusy(true);
    patchLocal(editing.id, { title: editing.title, content: editing.content });
    try {
      await api.patch(`/api/story/${editing.id}`, { title: editing.title, content: editing.content });
      toast.push("success", "Saved.");
      setEditing(null);
    } catch (e) { toast.push("error", (e as Error).message); reload(); } finally { setBusy(false); }
  }

  async function removeBlock(b: StoryBlock) {
    setData((d) => d ? { items: d.items.filter((x) => x.id !== b.id) } : d);
    try {
      await api.del(`/api/story/${b.id}`);
      toast.push("success", `Removed “${b.title}”.`);
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Story development</h1>
          <p className="mt-0.5 text-sm text-ink-400">Premise, synopsis, lore and events — the AI reads these to keep generations on-story.</p>
        </div>
        <Menu trigger={<button className="btn-primary btn-sm">＋ Add block ▾</button>} align="right">
          {KINDS.map((k) => (
            <MenuItem key={k.value} onClick={() => { setCreating(k.value); setDraft({ title: k.label, content: "" }); }}>
              {k.icon} {k.label}
            </MenuItem>
          ))}
        </Menu>
      </div>

      {loading && <div className="mt-6"><SkeletonRows count={4} /></div>}

      {!loading && blocks.length === 0 && (
        <div className="card mt-6">
          <EmptyState icon="✍" title="The blank page before the blank page"
            description="Write your premise first — even one rough paragraph gives the AI (and you) a north star for every scene, character and panel that follows."
            action={<button className="btn-primary" onClick={() => { setCreating("premise"); setDraft({ title: "Story Premise", content: "" }); }}>◈ Write the premise</button>} />
        </div>
      )}

      <div className="mt-6 space-y-4">
        {blocks.map((b) => {
          const kind = KINDS.find((k) => k.value === b.kind) ?? KINDS[KINDS.length - 1];
          return (
            <article key={b.id} className="card px-5 py-4 animate-fadeUp">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="chip">{kind.icon} {kind.label}</span>
                    <h3 className="truncate font-display text-sm font-semibold">{b.title}</h3>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-300">{b.content || <span className="italic text-ink-500">Empty — click edit to write.</span>}</p>
                </div>
                <Menu trigger={<button className="btn-icon text-ink-400 hover:text-ink-100">⋯</button>}>
                  <MenuItem onClick={() => setEditing(b)}>✎ Edit</MenuItem>
                  <MenuItem danger onClick={() => removeBlock(b)}>✕ Remove</MenuItem>
                </Menu>
              </div>
              <div className="mt-2 text-[10px] text-ink-600">updated {timeAgo(b.updatedAt)}</div>
            </article>
          );
        })}
      </div>

      {/* Create modal */}
      <Modal open={!!creating} onClose={() => setCreating(null)} title={`New ${creating ? KINDS.find((k) => k.value === creating)?.label.toLowerCase() : "block"}`}
        footer={<><button className="btn-secondary" onClick={() => setCreating(null)}>Cancel</button>
          <button className="btn-primary" onClick={createBlock} disabled={busy}>{busy ? <Spinner /> : "Add block"}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea className="input min-h-[160px]" placeholder={creating === "premise" ? "In a world where…, someone wants… but…" : "Write freely — the AI reads this."} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit story block"
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn-primary" onClick={saveBlock} disabled={busy}>{busy ? <Spinner /> : "Save"}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={editing?.title ?? ""} onChange={(e) => setEditing((p) => p ? { ...p, title: e.target.value } : p)} />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea className="input min-h-[200px] font-mono text-[13px]" value={editing?.content ?? ""} onChange={(e) => setEditing((p) => p ? { ...p, content: e.target.value } : p)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
