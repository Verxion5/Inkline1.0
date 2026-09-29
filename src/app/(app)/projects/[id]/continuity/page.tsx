"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApiData } from "@/lib/client";
import { EmptyState, Spinner } from "@/components/ui";
import type { ContinuityIssue } from "@/lib/types";

const SEVERITY: Record<ContinuityIssue["severity"], { label: string; cls: string; icon: string }> = {
  error: { label: "Blocking", cls: "border-red-500/30 bg-red-950/40", icon: "❌" },
  warning: { label: "Warning", cls: "border-amber-500/30 bg-amber-950/30", icon: "⚠️" },
  info: { label: "Suggestion", cls: "border-sky-500/30 bg-sky-950/25", icon: "ℹ️" },
};

export default function ContinuityPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useApiData<{ issues: ContinuityIssue[] }>(`/api/projects/${id}/continuity`);
  const issues = data?.issues ?? [];
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  const grouped = issues.reduce<Record<string, ContinuityIssue[]>>((acc, issue) => {
    (acc[issue.area] ??= []).push(issue);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Continuity & quality control</h1>
          <p className="mt-0.5 text-sm text-ink-400">Production checks run before export: missing art, broken references, unfinished pages.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="chip !border-red-500/30">❌ {errors}</span>
          <span className="chip !border-amber-500/30">⚠️ {warnings}</span>
          <span className="chip !border-sky-500/30">ℹ️ {infos}</span>
        </div>
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-sm text-ink-400"><Spinner /> Sweeping the project…</div>
      )}

      {!loading && issues.length === 0 && (
        <div className="card mt-6">
          <EmptyState icon="✅" title="All clear!"
            description="No continuity problems found. Characters, locations, panels and pages all check out — run a final pass from here any time before export." />
        </div>
      )}

      <div className="mt-6 space-y-5">
        {Object.entries(grouped).map(([area, list]) => (
          <section key={area}>
            <h2 className="section-title mb-2">{area}</h2>
            <div className="space-y-2">
              {list.map((issue) => (
                <div key={issue.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${SEVERITY[issue.severity].cls}`}>
                  <span className="mt-0.5">{SEVERITY[issue.severity].icon}</span>
                  <p className="flex-1 text-sm leading-relaxed text-ink-200">{issue.message}</p>
                  {issue.link && (
                    <Link href={issue.link} className="btn-secondary btn-sm shrink-0">Open</Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {!loading && issues.length > 0 && (
        <p className="mt-6 text-xs text-ink-500">These checks re-run live every time you open this page. Blocking issues (❌) should be resolved before exporting a chapter.</p>
      )}
    </div>
  );
}
