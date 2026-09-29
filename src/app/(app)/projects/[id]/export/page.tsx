"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api, downloadJson, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { EmptyState, Segmented, Spinner } from "@/components/ui";
import type { Chapter } from "@/lib/types";

interface Ch extends Chapter { pageCount: number; doneCount: number }

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data } = useApiData<{ chapters: Ch[] }>(`/api/projects/${id}/overview`);
  const projectApi = useApiData<{ project: { title: string; format: string } }>(`/api/projects/${id}`);
  const [chapterId, setChapterId] = useState<string>("");
  const [scope, setScope] = useState<"chapter" | "project">("chapter");
  const [busy, setBusy] = useState(false);

  const chapters = data?.chapters ?? [];
  const target = chapterId || chapters[0]?.id || "";

  async function exportArchive() {
    setBusy(true);
    try {
      const url = target && scope === "chapter" ? `/api/projects/${id}/export?chapterId=${target}` : `/api/projects/${id}/export`;
      const archive = await api.get<Record<string, unknown>>(url);
      const name = (projectApi.data?.project.title ?? "inkline").replace(/\s+/g, "-").toLowerCase();
      downloadJson(`${name}-archive.json`, archive);
      toast.push("success", "Project archive downloaded (JSON).");
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  function openPrintView() {
    const query = scope === "chapter" && target ? `?chapter=${target}` : "";
    window.open(`/projects/${id}/print${query}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      <h1 className="font-display text-xl font-bold sm:text-2xl">Export & publishing</h1>
      <p className="mt-0.5 text-sm text-ink-400">Ship finished pages: print-ready PDF (via your browser), PNG per page, or a full JSON archive.</p>

      {chapters.length === 0 ? (
        <div className="card mt-6">
          <EmptyState icon="⤓" title="Nothing to export yet"
            description="Export unlocks once your project has chapters and pages. Head to Chapters to start production."
            action={<a className="btn-primary" href={`/projects/${id}/chapters`}>Go to chapters</a>} />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Scope</div>
                <p className="text-xs text-ink-500">Export one chapter or the whole project.</p>
              </div>
              <Segmented value={scope} onChange={setScope} options={[{ value: "chapter", label: "Chapter" }, { value: "project", label: "Whole project" }]} />
            </div>
            {scope === "chapter" && (
              <select className="select mt-3" value={target} onChange={(e) => setChapterId(e.target.value)}>
                {chapters.map((c) => <option key={c.id} value={c.id}>Ch. {c.number} — {c.title} ({c.pageCount} pages)</option>)}
              </select>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button className="card-hover p-4 text-left" onClick={openPrintView}>
              <div className="text-2xl">🖨</div>
              <div className="mt-2 text-sm font-semibold">Print / PDF</div>
              <p className="mt-1 text-xs text-ink-500">Open a print-ready view — save as PDF from your browser (Ctrl/Cmd+P).</p>
            </button>
            <button className="card-hover p-4 text-left" onClick={exportArchive} disabled={busy}>
              <div className="text-2xl">{busy ? <Spinner /> : "🗂"}</div>
              <div className="mt-2 text-sm font-semibold">Project archive</div>
              <p className="mt-1 text-xs text-ink-500">Full JSON backup — story, cast, chapters, pages, panel plans and lettering.</p>
            </button>
            <a className="card-hover p-4 text-left" href={`/projects/${id}/studio`}>
              <div className="text-2xl">🖼</div>
              <div className="mt-2 text-sm font-semibold">Page PNGs</div>
              <p className="mt-1 text-xs text-ink-500">Open the Studio and use ⤓ PNG on any page (1000×1414).</p>
            </a>
          </div>

          <div className="card px-5 py-4">
            <div className="text-sm font-semibold">Publishing checklist</div>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-400">
              <li>✓ Run the <a className="hover:underline" style={{ color: "var(--accent)" }} href={`/projects/${id}/continuity`}>continuity report</a> — resolve ❌ blocking issues first</li>
              <li>✓ Pages are 1000×1414 (B5 ratio) — fit for web publishing; for print, export PNGs at 2× via browser zoom</li>
              <li>✓ Manga reads right-to-left; manhwa/webtoon left-to-right — set this in project settings</li>
              <li>✓ Page order follows chapter order and page numbers</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
