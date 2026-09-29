"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, useApiData, useDebouncedCallback } from "@/lib/client";
import { useToast } from "@/components/toast";
import { EmptyState, Menu, MenuItem, Modal, Segmented, Spinner, StatusBadge, Tabs } from "@/components/ui";
import { renderPageCanvas } from "@/lib/export-image";
import type { Bubble, BubbleKind, CameraAngle, Chapter, Character, Location, Page, Panel, Project, ShotType } from "@/lib/types";

const SHOTS: ShotType[] = ["establishing", "wide", "medium", "close-up", "extreme-close-up", "over-the-shoulder", "action", "splash", "insert"];
const CAMERAS: CameraAngle[] = ["eye-level", "high", "low", "overhead", "dutch", "worms-eye"];

const SIZE_PRESETS: { label: string; rect: { x: number; y: number; w: number; h: number } }[] = [
  { label: "Band (full width)", rect: { x: 0, y: 0, w: 100, h: 18 } },
  { label: "Half width", rect: { x: 0, y: 0, w: 48.5, h: 30 } },
  { label: "Third width", rect: { x: 0, y: 0, w: 31, h: 24 } },
  { label: "Tall column", rect: { x: 0, y: 0, w: 31, h: 45 } },
  { label: "Wide panel", rect: { x: 0, y: 0, w: 100, h: 32 } },
  { label: "Splash (full page)", rect: { x: 0, y: 0, w: 100, h: 100 } },
];

const BUBBLE_KINDS: { value: BubbleKind; label: string }[] = [
  { value: "speech", label: "💬 Speech" },
  { value: "thought", label: "💭 Thought" },
  { value: "shout", label: "💥 Shout" },
  { value: "whisper", label: "🤫 Whisper" },
  { value: "narration", label: "▤ Narration" },
  { value: "caption", label: "▪ Caption" },
  { value: "sfx", label: "✴ SFX" },
];

type InspectorTab = "art" | "dialogue" | "layout";

function StudioInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const { data: projectData } = useApiData<{ project: Project }>(`/api/projects/${id}`);
  const project = projectData?.project;
  const { data: charsData } = useApiData<{ items: Character[] }>(`/api/projects/${id}/characters`);
  const { data: locsData } = useApiData<{ items: Location[] }>(`/api/projects/${id}/locations`);
  const { data: overview } = useApiData<{ chapters: Chapter[] }>(`/api/projects/${id}/overview`);
  const characters = charsData?.items ?? [];
  const locations = locsData?.items ?? [];
  const chapters = overview?.chapters ?? [];

  const [chapterId, setChapterId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(search.get("page"));

  // pick chapter containing requested page or first chapter
  useEffect(() => {
    if (!chapters.length) return;
    if (pageId) {
      for (const ch of chapters) {
        // we don't know pages per chapter here; overview doesn't include them. Load lazily below.
      }
      if (!chapterId) setChapterId(chapters[0].id);
    } else if (!chapterId) setChapterId(chapters[0].id);
  }, [chapters, chapterId, pageId]);

  const { data: full, loading: fullLoading, reload } = useApiData<{ chapter: Chapter; scenes: unknown[]; pages: (Page & { panels: Panel[] })[] }>(
    chapterId ? `/api/chapters/${chapterId}/full` : null);

  const pages = full?.pages ?? [];

  // resolve requested page across chapters
  useEffect(() => {
    if (!search.get("page") || !full) return;
    const found = full.pages.some((p) => p.id === pageId);
    if (!found) {
      // look through other chapters: fetch each? simple approach: iterate all chapters once
      (async () => {
        for (const ch of chapters) {
          if (ch.id === chapterId) continue;
          try {
            const d = await api.get<{ pages: { id: string }[] }>(`/api/chapters/${ch.id}/full`);
            if (d.pages.some((p) => p.id === pageId)) { setChapterId(ch.id); return; }
          } catch { /* ignore */ }
        }
        const first = pages[0] ?? null;
        if (first) setPageId(first.id);
      })();
    }
  }, [full, search, pageId, chapterId, chapters, pages]);

  useEffect(() => {
    if (!pageId && pages.length) setPageId(pages[0].id);
  }, [pages, pageId]);

  const page = pages.find((p) => p.id === pageId) ?? null;

  // ── Local panel state (optimistic editing) ──
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>("art");
  const [previewMode, setPreviewMode] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState(0);
  const [savingPage, setSavingPage] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ kind: "move" | "resize"; panelId: string; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number }; rect: DOMRect } | null>(null);

  useEffect(() => { setPanels(page?.panels ?? []); setSelectedId(null); }, [page?.id, page?.panels.length]);

  const selected = panels.find((p) => p.id === selectedId) ?? null;

  const commitGeometry = useDebouncedCallback(async (list: Panel[]) => {
    if (!pageId) return;
    try {
      await api.post(`/api/pages/${pageId}/geometry`, {
        panels: list.map((p, i) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h, order: i + 1 })),
      });
    } catch (e) { toast.push("error", (e as Error).message); }
  }, 600);

  function updatePanelLocal(panelId: string, changes: Partial<Panel>) {
    setPanels((ps) => ps.map((p) => p.id === panelId ? { ...p, ...changes } : p));
  }

  async function patchPanel(panelId: string, changes: Partial<Panel> & Record<string, unknown>) {
    updatePanelLocal(panelId, changes);
    try {
      await api.patch(`/api/panels/${panelId}`, changes);
    } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  // ── Drag / resize ──
  const onPointerDown = useCallback((e: React.PointerEvent, panel: Panel, kind: "move" | "resize") => {
    if (previewMode || !canvasRef.current) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedId(panel.id);
    dragState.current = {
      kind, panelId: panel.id,
      startX: e.clientX, startY: e.clientY,
      orig: { x: panel.x, y: panel.y, w: panel.w, h: panel.h },
      rect: canvasRef.current.getBoundingClientRect(),
    };
  }, [previewMode]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    const dxPct = ((e.clientX - ds.startX) / ds.rect.width) * 100;
    const dyPct = ((e.clientY - ds.startY) / ds.rect.height) * 100;
    const snap = (v: number) => Math.round(v * 4) / 4;
    if (ds.kind === "move") {
      updatePanelLocal(ds.panelId, {
        x: Math.max(0, Math.min(100 - ds.orig.w, snap(ds.orig.x + dxPct))),
        y: Math.max(0, Math.min(100 - ds.orig.h, snap(ds.orig.y + dyPct))),
      });
    } else {
      updatePanelLocal(ds.panelId, {
        w: Math.max(6, Math.min(100 - ds.orig.x, snap(ds.orig.w + dxPct))),
        h: Math.max(6, Math.min(100 - ds.orig.y, snap(ds.orig.h + dyPct))),
      });
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    setPanels((ps) => { commitGeometry(ps); return ps; });
  }, [commitGeometry]);

  // ── Panel CRUD ──
  async function addPanel(rect?: { x: number; y: number; w: number; h: number }) {
    if (!pageId) return;
    try {
      const res = await api.post<{ item: Panel }>(`/api/pages/${pageId}/panels`, {
        templateRect: rect ?? { x: 5, y: 5, w: 90, h: 40 },
        description: "", order: panels.length + 1,
      });
      setPanels((ps) => [...ps, res.item]);
      setSelectedId(res.item.id);
      setTab("art");
      setAddPanelOpen(false);
    } catch (e) { toast.push("error", (e as Error).message); }
  }

  async function deletePanel(panelId: string) {
    setPanels((ps) => ps.filter((p) => p.id !== panelId));
    if (selectedId === panelId) setSelectedId(null);
    try { await api.del(`/api/panels/${panelId}`); } catch (e) { toast.push("error", (e as Error).message); reload(); }
  }

  async function reorder(panelId: string, dir: -1 | 1) {
    const sorted = [...panels].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((p) => p.id === panelId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const withOrders = sorted.map((p, idx) => ({ ...p, order: idx + 1 }));
    setPanels(withOrders);
    commitGeometry(withOrders);
  }

  async function applySizePreset(panelId: string, rect: { x: number; y: number; w: number; h: number }) {
    updatePanelLocal(panelId, rect);
    setPanels((ps) => { commitGeometry(ps); return ps; });
  }

  async function suggestLayout() {
    if (!pageId) return;
    try {
      const res = await api.post<{ panels: Panel[] }>(`/api/pages/${pageId}/suggest-layout`);
      setPanels(res.panels);
      toast.push("success", "Layout suggested from each panel's shot & purpose. Drag anything to adjust.");
    } catch (e) { toast.push("error", (e as Error).message); }
  }

  // ── Generation ──
  async function generate(panel: Panel, variation = false) {
    if (!panel.description.trim() && !panel.prompt.trim()) {
      toast.push("error", "Describe the scene for this panel first.");
      setTab("art");
      setSelectedId(panel.id);
      return;
    }
    setGenerating(panel.id);
    setGenProgress(8);
    const timer = setInterval(() => setGenProgress((p) => Math.min(92, p + Math.random() * 14)), 160);
    const started = Date.now();
    try {
      const res = await api.post<{ panel: Panel; versions: { id: string; imageUrl: string; label: string; createdAt: string }[] }>(
        `/api/panels/${panel.id}/generate`, { variation });
      const elapsed = Date.now() - started;
      if (elapsed < 1100) await new Promise((r) => setTimeout(r, 1100 - elapsed));
      setPanels((ps) => ps.map((p) => p.id === panel.id ? res.panel : p));
      toast.push("success", variation ? "Variation generated — compare versions below." : "Panel artwork generated.");
    } catch (e) {
      toast.push("error", `Generation failed: ${(e as Error).message}`);
    } finally {
      clearInterval(timer);
      setGenerating(null);
      setGenProgress(0);
    }
  }

  async function restoreVersion(panelId: string, versionId: string) {
    try {
      const res = await api.post<{ panel: Panel }>(`/api/panels/${panelId}/versions`, { versionId });
      setPanels((ps) => ps.map((p) => p.id === panelId ? res.panel : p));
      toast.push("success", "Previous version restored.");
    } catch (e) { toast.push("error", (e as Error).message); }
  }

  // ── Bubbles ──
  async function addBubble(panelId: string, kind: BubbleKind) {
    const panel = panels.find((p) => p.id === panelId);
    if (!panel) return;
    const bubble: Bubble = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      text: kind === "sfx" ? "DOSH!!" : "",
      characterId: characters.length && (kind === "speech" || kind === "shout" || kind === "whisper") ? characters[0].id : null,
      x: 6 + (panel.bubbles.length % 2) * 40, y: 6 + Math.floor(panel.bubbles.length / 2) * 16,
      w: 44, align: "left", size: 1,
      tail: kind === "speech" || kind === "shout" || kind === "whisper" ? "bl" : "none",
    };
    updatePanelLocal(panelId, { bubbles: [...panel.bubbles, bubble] });
    await patchPanel(panelId, { bubbles: [...panel.bubbles, bubble] });
  }

  async function patchBubble(panelId: string, bubbleId: string, changes: Partial<Bubble>) {
    const panel = panels.find((p) => p.id === panelId);
    if (!panel) return;
    const bubbles = panel.bubbles.map((b) => b.id === bubbleId ? { ...b, ...changes } : b);
    updatePanelLocal(panelId, { bubbles });
    saveBubblesDebounced(panelId, bubbles);
  }

  const saveBubblesDebounced = useDebouncedCallback(async (panelId: string, bubbles: Bubble[]) => {
    try { await api.patch(`/api/panels/${panelId}`, { bubbles }); } catch { /* retry on next change */ }
  }, 500);

  const bubbleDrag = useRef<{ panelId: string; bubbleId: string; startX: number; startY: number; ox: number; oy: number; rect: DOMRect } | null>(null);

  function bubblePointerDown(e: React.PointerEvent, panelId: string, bubbleId: string) {
    if (previewMode || !canvasRef.current) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const panel = panels.find((p) => p.id === panelId);
    const bubble = panel?.bubbles.find((b) => b.id === bubbleId);
    if (!panel || !bubble) return;
    bubbleDrag.current = { panelId, bubbleId, startX: e.clientX, startY: e.clientY, ox: bubble.x, oy: bubble.y, rect: canvasRef.current.getBoundingClientRect() };
    setSelectedId(panelId);
  }
  function bubblePointerMove(e: React.PointerEvent) {
    const bd = bubbleDrag.current;
    if (!bd) return;
    const panel = panels.find((p) => p.id === bd.panelId);
    if (!panel) return;
    const dx = ((e.clientX - bd.startX) / bd.rect.width) * 100 * (panel.w / 100);
    const dy = ((e.clientY - bd.startY) / bd.rect.height) * 100 * (panel.h / 100);
    updatePanelLocal(bd.panelId, {
      bubbles: panel.bubbles.map((b) => b.id === bd.bubbleId
        ? { ...b, x: Math.max(-5, Math.min(95, Math.round((bd.ox + dx) * 2) / 2)), y: Math.max(-5, Math.min(95, Math.round((bd.oy + dy) * 2) / 2)) }
        : b),
    });
  }
  function bubblePointerUp() {
    const bd = bubbleDrag.current;
    if (!bd) return;
    bubbleDrag.current = null;
    const panel = panels.find((p) => p.id === bd.panelId);
    if (panel) saveBubblesDebounced(bd.panelId, panel.bubbles);
  }

  // ── Page ops ──
  async function patchPage(changes: Partial<Page>) {
    if (!page) return;
    setSavingPage(true);
    try { await api.patch(`/api/pages/${page.id}`, changes); reload(); } finally { setSavingPage(false); }
  }

  // ── Export PNG ──
  async function exportPng() {
    if (!page) return;
    toast.push("info", "Rendering page at 1000×1414…");
    try {
      const canvas = await renderPageCanvas(panels);
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.title.replace(/\s+/g, "-").toLowerCase() ?? "page"}-ch${page.chapterId.slice(0, 4)}-page${page.number}.png`;
      a.click();
      toast.push("success", "Page PNG downloaded.");
    } catch (e) { toast.push("error", `Export failed: ${(e as Error).message}`); }
  }

  const sortedPanels = useMemo(() => [...panels].sort((a, b) => a.order - b.order), [panels]);
  const ungenerated = panels.filter((p) => !p.imageUrl).length;

  const readingNumber = (panel: Panel) => sortedPanels.findIndex((p) => p.id === panel.id) + 1;

  // ── Render ──
  if (!chapters.length && !fullLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="card"><EmptyState icon="🗂" title="No chapters yet" description="Create a chapter and a page first — the studio arranges panels into pages."
        action={<a className="btn-primary" href={`/projects/${id}/chapters`}>Go to chapters</a>} /></div>
    </div>;
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col lg:h-screen lg:flex-row">
      {/* Page rail */}
      <aside className="shrink-0 border-b border-ink-800 bg-ink-950 lg:h-full lg:w-56 lg:overflow-y-auto lg:border-b-0 lg:border-r no-print">
        <div className="p-3">
          <select className="select mb-2 text-xs" value={chapterId ?? ""} onChange={(e) => { setChapterId(e.target.value); setPageId(null); }}>
            {chapters.map((c) => <option key={c.id} value={c.id}>Ch. {c.number} — {c.title}</option>)}
          </select>
          {fullLoading && <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-14" />)}</div>}
          <div className="space-y-1.5">
            {pages.map((p) => (
              <button key={p.id} onClick={() => { setPageId(p.id); router.replace(`?page=${p.id}`); }}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${
                  pageId === p.id ? "border-[var(--accent)] bg-ink-900" : "border-transparent hover:bg-ink-900"}`}>
                <span className="text-xs font-bold text-ink-500">{p.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{p.title || `Page ${p.number}`}</span>
                  <span className="block text-[10px] text-ink-500">{p.panels.filter((pl) => pl.imageUrl).length}/{p.panels.length} art</span>
                </span>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
          <button className="btn-secondary btn-sm mt-2 w-full" onClick={async () => {
            try {
              const res = await api.post<{ page: Page }>(`/api/chapters/${chapterId}/pages`, { template: "blank" });
              toast.push("success", `Page ${res.page.number} created.`);
              reload();
              setPageId(res.page.id);
            } catch (e) { toast.push("error", (e as Error).message); }
          }}>＋ New page</button>
        </div>
      </aside>

      {/* Canvas */}
      <div className="flex min-w-0 flex-1 flex-col bg-ink-975">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-800 bg-ink-950/70 px-3 py-2 no-print">
          <div className="flex items-center gap-1.5">
            <button className="btn-icon text-ink-400 hover:text-ink-100" disabled={!page || pages.indexOf(page) <= 0}
              onClick={() => { const i = pages.indexOf(page!); setPageId(pages[i - 1].id); }}>←</button>
            <span className="text-xs font-medium">{page ? `Page ${page.number}${page.title ? ` — ${page.title}` : ""}` : "No page selected"}</span>
            <button className="btn-icon text-ink-400 hover:text-ink-100" disabled={!page || pages.indexOf(page!) >= pages.length - 1}
              onClick={() => { const i = pages.indexOf(page!); setPageId(pages[i + 1].id); }}>→</button>
          </div>
          {page && <StatusBadge status={page.status} />}
          {ungenerated > 0 && <span className="chip" style={{ borderColor: "var(--accent-soft)" }}>✦ {ungenerated} panel{ungenerated > 1 ? "s" : ""} to generate</span>}
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn-ghost btn-sm" onClick={() => setPreviewMode((v) => !v)}>{previewMode ? "✎ Edit" : "👁 Preview"}</button>
            <button className="btn-ghost btn-sm" onClick={suggestLayout} title="AI page layout">✦ Suggest layout</button>
            <button className="btn-ghost btn-sm" onClick={exportPng}>⤓ PNG</button>
            <button className="btn-primary btn-sm" onClick={() => setAddPanelOpen(true)}>＋ Panel</button>
          </div>
        </div>

        {/* Page canvas */}
        <div className="flex-1 overflow-auto p-4 sm:p-8" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {!page ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-500">{fullLoading ? "Loading page…" : "Create or select a page."}</div>
          ) : (
            <div
              ref={canvasRef}
              className={`paper relative mx-auto ${previewMode ? "" : "cursor-default"}`}
              style={{ aspectRatio: "1000/1414", width: "min(100%, 620px)", maxWidth: "100%" }}
              onPointerDown={() => setSelectedId(null)}
            >
              {sortedPanels.map((panel) => {
                const isSelected = panel.id === selectedId && !previewMode;
                const chars = panel.characterIds.map((cid) => characters.find((c) => c.id === cid)).filter(Boolean) as Character[];
                return (
                  <div
                    key={panel.id}
                    onPointerDown={(e) => onPointerDown(e, panel, "move")}
                    className={`group absolute overflow-hidden ${previewMode ? "" : "cursor-move"}`}
                    style={{
                      left: `${panel.x}%`, top: `${panel.y}%`, width: `${panel.w}%`, height: `${panel.h}%`,
                      border: `${project?.borderWidth ?? 0.55}pt solid #111`,
                      outline: isSelected ? "2px solid var(--accent)" : "none",
                      outlineOffset: "1px",
                      background: "#ddd",
                      zIndex: isSelected ? 20 : 1,
                      transition: dragState.current ? "none" : "outline 0.1s",
                    }}
                  >
                    {panel.imageUrl ? (
                      <img src={panel.imageUrl} alt={panel.description} className="pointer-events-none h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-1 text-center"
                        style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 4px, transparent 4px 8px)" }}>
                        <span className="text-[10px] font-medium uppercase tracking-widest text-ink-500">{panel.shot}</span>
                        <span className="max-w-[90%] text-[9px] leading-tight text-ink-400">{panel.description || "describe this panel"}</span>
                      </div>
                    )}
                    {/* bubbles */}
                    <div className="pointer-events-none absolute inset-0">
                      {panel.bubbles.map((b) => (
                        <div key={b.id}
                          className={`pointer-events-auto ${bubbleClass(b.kind)}`}
                          style={{
                            left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`,
                            textAlign: b.align,
                            fontSize: `${(b.size || 1) * (b.kind === "sfx" ? 18 : 7.5)}px`,
                            cursor: previewMode ? "default" : "move",
                          }}
                          onPointerDown={(e) => bubblePointerDown(e, panel.id, b.id)}
                        >
                          {b.text || <span className="opacity-40">…</span>}
                          {b.tail !== "none" && b.kind !== "sfx" && <span className={`bubble-tail bubble-tail-${b.tail}`} />}
                        </div>
                      ))}
                    </div>
                    {/* chrome */}
                    {!previewMode && (
                      <>
                        <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {readingNumber(panel)}
                        </span>
                        {chars.length > 0 && (
                          <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                            {chars.map((c) => c.name.split(" ")[0]).join(" · ")}
                          </span>
                        )}
                        {generating === panel.id && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-sm">
                            <Spinner className="h-6 w-6 text-white" />
                            <span className="text-[10px] font-medium uppercase tracking-widest text-white">Generating…</span>
                            <div className="h-1 w-2/3 overflow-hidden rounded-full bg-white/20">
                              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${genProgress}%` }} />
                            </div>
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize rounded-sm opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ background: "var(--accent)", clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }}
                          onPointerDown={(e) => onPointerDown(e, panel, "resize")} />
                      </>
                    )}
                  </div>
                );
              })}
              {sortedPanels.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <span className="text-4xl opacity-20">▤</span>
                  <p className="max-w-[240px] text-xs text-ink-400">Empty page. Add panels manually, or use the <b>Storyboard</b> tab to plan them from a script.</p>
                  <button className="btn-primary btn-sm" onClick={() => addPanel()}>＋ Add first panel</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inspector */}
      {!previewMode && page && (
        <aside className="shrink-0 border-t border-ink-800 bg-ink-950 lg:h-full lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0 no-print">
          {!selected ? (
            <div className="px-4 py-6 text-center text-sm text-ink-500">
              <div className="mb-3 text-3xl">▭</div>
              Select a panel to edit its art direction, dialogue and layout.<br /><br />
              <button className="btn-secondary btn-sm" onClick={() => setAddPanelOpen(true)}>＋ Add a panel</button>
            </div>
          ) : (
            <div className="p-3">
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: "art" as const, label: "Art" },
                { value: "dialogue" as const, label: "Dialogue", badge: selected.bubbles.length },
                { value: "layout" as const, label: "Layout" },
              ]} />

              {tab === "art" && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="label">Scene description (what happens)</label>
                    <textarea className="input min-h-[60px] text-[13px]" value={selected.description}
                      onChange={(e) => updatePanelLocal(selected.id, { description: e.target.value })}
                      onBlur={() => patchPanel(selected.id, { description: selected.description })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Shot</label>
                      <select className="select" value={selected.shot} onChange={(e) => patchPanel(selected.id, { shot: e.target.value as ShotType })}>
                        {SHOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Camera</label>
                      <select className="select" value={selected.camera} onChange={(e) => patchPanel(selected.id, { camera: e.target.value as CameraAngle })}>
                        {CAMERAS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Characters in panel</label>
                    <div className="flex flex-wrap gap-1.5">
                      {characters.map((c) => {
                        const on = selected.characterIds.includes(c.id);
                        return (
                          <button key={c.id} onClick={() => patchPanel(selected.id, { characterIds: on ? selected.characterIds.filter((x) => x !== c.id) : [...selected.characterIds, c.id] })}
                            className={`chip transition-colors ${on ? "!border-[var(--accent)] !text-white" : ""}`}
                            style={on ? { background: "var(--accent-soft)" } : {}}>
                            {c.portraitUrl && <img src={c.portraitUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />}
                            {c.name.split(" ")[0]}
                          </button>
                        );
                      })}
                      {characters.length === 0 && <span className="text-xs text-ink-500">No characters in the project yet.</span>}
                    </div>
                  </div>
                  <div>
                    <label className="label">Location</label>
                    <select className="select" value={selected.locationId ?? ""} onChange={(e) => patchPanel(selected.id, { locationId: e.target.value || null })}>
                      <option value="">— none —</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Expression</label>
                      <input className="input" value={selected.expression} onChange={(e) => updatePanelLocal(selected.id, { expression: e.target.value })}
                        onBlur={() => patchPanel(selected.id, { expression: selected.expression })} placeholder="startled" />
                    </div>
                    <div>
                      <label className="label">Pose / action</label>
                      <input className="input" value={selected.pose} onChange={(e) => updatePanelLocal(selected.id, { pose: e.target.value })}
                        onBlur={() => patchPanel(selected.id, { pose: selected.pose })} placeholder="mid-leap" />
                    </div>
                    <div>
                      <label className="label">Lighting</label>
                      <input className="input" value={selected.lighting} onChange={(e) => updatePanelLocal(selected.id, { lighting: e.target.value })}
                        onBlur={() => patchPanel(selected.id, { lighting: selected.lighting })} placeholder="lantern glow" />
                    </div>
                    <div>
                      <label className="label">Effects</label>
                      <input className="input" value={selected.effects} onChange={(e) => updatePanelLocal(selected.id, { effects: e.target.value })}
                        onBlur={() => patchPanel(selected.id, { effects: selected.effects })} placeholder="speed lines, sparks" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Mood</label>
                    <input className="input" value={selected.mood} onChange={(e) => updatePanelLocal(selected.id, { mood: e.target.value })}
                      onBlur={() => patchPanel(selected.id, { mood: selected.mood })} placeholder="hush before the reveal" />
                  </div>

                  <div className="rounded-lg border border-ink-700 bg-ink-925 p-2.5">
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-500">Composed prompt</div>
                    <p className="max-h-24 overflow-y-auto text-[10.5px] leading-relaxed text-ink-400">
                      {selected.prompt || "Auto-built from character memory + location + style + shot when you generate."}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button className="btn-primary btn-sm col-span-3" onClick={() => generate(selected)} disabled={generating === selected.id}>
                      {generating === selected.id ? <><Spinner /> Generating…</> : selected.imageUrl ? "↻ Regenerate" : "✦ Generate panel"}
                    </button>
                    {selected.imageUrl && (
                      <>
                        <button className="btn-secondary btn-sm col-span-2" onClick={() => generate(selected, true)} disabled={generating === selected.id}>✦ Variation</button>
                        <button className="btn-secondary btn-sm" onClick={() => patchPanel(selected.id, { imageUrl: null, stage: "planned" })}>Clear</button>
                      </>
                    )}
                  </div>
                  {selected.imageUrl && <p className="text-[10px] text-ink-500">Previous artwork is archived automatically — restore from page versions below.</p>}
                </div>
              )}

              {tab === "dialogue" && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {BUBBLE_KINDS.map((k) => (
                      <button key={k.value} className="chip hover:!border-ink-400" onClick={() => addBubble(selected.id, k.value)}>＋ {k.label}</button>
                    ))}
                  </div>
                  {selected.bubbles.length === 0 && (
                    <p className="px-1 py-6 text-center text-xs text-ink-500">No lettering yet. Add bubbles above, then drag them into place on the panel.</p>
                  )}
                  {selected.bubbles.map((b) => (
                    <div key={b.id} className="rounded-lg border border-ink-700 bg-ink-925 p-2.5">
                      <div className="flex items-center gap-1.5">
                        <select className="select h-7 w-auto flex-1 py-0 text-xs" value={b.kind}
                          onChange={(e) => patchBubble(selected.id, b.id, { kind: e.target.value as BubbleKind, tail: ["speech", "shout", "whisper"].includes(e.target.value) && b.tail === "none" ? "bl" : b.tail })}>
                          {BUBBLE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                        </select>
                        {["speech", "shout", "whisper", "thought"].includes(b.kind) && (
                          <select className="select h-7 w-auto py-0 text-xs" value={b.characterId ?? ""} onChange={(e) => patchBubble(selected.id, b.id, { characterId: e.target.value || null })}>
                            <option value="">voice…</option>
                            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                        <button className="btn-icon !p-1 text-xs text-ink-500 hover:text-red-400"
                          onClick={async () => {
                            const bubbles = selected.bubbles.filter((x) => x.id !== b.id);
                            updatePanelLocal(selected.id, { bubbles });
                            await patchPanel(selected.id, { bubbles });
                          }}>✕</button>
                      </div>
                      <textarea className="input mt-1.5 min-h-[40px] py-1.5 text-[13px]" value={b.text} placeholder={b.kind === "sfx" ? "DOSH!!" : "Line of dialogue…"}
                        onChange={(e) => patchBubble(selected.id, b.id, { text: e.target.value })} />
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-500">
                        <label className="flex items-center gap-1">size
                          <input type="range" min="0.6" max="2" step="0.1" value={b.size} className="w-16 accent-[var(--accent)]"
                            onChange={(e) => patchBubble(selected.id, b.id, { size: Number(e.target.value) })} />
                        </label>
                        <select className="select h-6 w-auto py-0 text-[10px]" value={b.align} onChange={(e) => patchBubble(selected.id, b.id, { align: e.target.value as Bubble["align"] })}>
                          <option value="left">left</option><option value="center">center</option><option value="right">right</option>
                        </select>
                        {["speech", "shout", "whisper"].includes(b.kind) && (
                          <select className="select h-6 w-auto py-0 text-[10px]" value={b.tail} onChange={(e) => patchBubble(selected.id, b.id, { tail: e.target.value as Bubble["tail"] })}>
                            <option value="none">no tail</option><option value="bl">tail ↙</option><option value="br">tail ↘</option><option value="tl">tail ↖</option><option value="tr">tail ↗</option>
                          </select>
                        )}
                        <span className="ml-auto">drag on canvas to move</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "layout" && (
                <div className="mt-3 space-y-4">
                  <div>
                    <label className="label">Reading order</label>
                    <div className="flex items-center gap-2">
                      <button className="btn-secondary btn-sm flex-1" onClick={() => reorder(selected.id, -1)}>▲ Earlier</button>
                      <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>#{readingNumber(selected)}</span>
                      <button className="btn-secondary btn-sm flex-1" onClick={() => reorder(selected.id, 1)}>▼ Later</button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Size presets</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SIZE_PRESETS.map((p) => (
                        <button key={p.label} className="btn-secondary btn-sm justify-start" onClick={() => applySizePreset(selected.id, p.rect)}>{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Page status</label>
                    <select className="select" value={page.status} onChange={(e) => patchPage({ status: e.target.value as Page["status"] })}>
                      {["empty", "draft", "pencils", "inked", "lettered", "done"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Page notes</label>
                    <textarea className="input min-h-[52px] text-[13px]" value={page.notes} onChange={(e) => patchPage({ notes: e.target.value })} />
                  </div>
                  <div className="border-t border-ink-800 pt-3">
                    <button className="btn-danger btn-sm w-full" onClick={() => deletePanel(selected.id)}>✕ Delete this panel</button>
                  </div>
                </div>
              )}

              {/* Versions */}
              {selected.imageUrl && (
                <div className="mt-5 border-t border-ink-800 pt-3">
                  <div className="section-title mb-2">Version history</div>
                  <VersionStrip panelId={selected.id} onRestore={(vid) => restoreVersion(selected.id, vid)} />
                </div>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function bubbleClass(kind: BubbleKind): string {
  switch (kind) {
    case "thought": return "bubble bubble-thought";
    case "narration": return "bubble bubble-narration";
    case "caption": return "bubble bubble-caption";
    case "whisper": return "bubble bubble-whisper";
    case "shout": return "bubble bubble-shout";
    case "sfx": return "bubble bubble-sfx";
    default: return "bubble";
  }
}

function VersionStrip({ panelId, onRestore }: { panelId: string; onRestore: (versionId: string) => void }) {
  const { data, loading } = useApiData<{ versions: { id: string; imageUrl: string; label: string; createdAt: string }[] }>(`/api/panels/${panelId}/versions`);
  if (loading) return <div className="skeleton h-16" />;
  const versions = data?.versions ?? [];
  if (!versions.length) return <p className="text-[11px] text-ink-500">No archived versions yet — previous art is kept automatically when you regenerate.</p>;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {versions.map((v) => (
        <div key={v.id} className="group relative h-16 w-20 shrink-0 overflow-hidden rounded-md border border-ink-700">
          <img src={v.imageUrl} alt={v.label} className="h-full w-full object-cover" />
          <button className="absolute inset-0 flex items-center justify-center bg-black/60 text-[9px] font-semibold uppercase tracking-widest text-white opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onRestore(v.id)}>
            Restore
          </button>
          <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 text-[8px] text-white">{v.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function StudioPage() {
  return <Suspense fallback={<div className="p-8"><div className="skeleton h-96" /></div>}><StudioInner /></Suspense>;
}
