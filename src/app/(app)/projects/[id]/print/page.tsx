import { all, get } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { toChapter, toPage, toPanel, toProject } from "@/lib/serialize";
import PrintButton from "@/components/PrintButton";
import { notFound, redirect } from "next/navigation";
import type { Bubble } from "@/lib/types";

export const dynamic = "force-dynamic";

function BubbleView({ b }: { b: Bubble }) {
  const cls = b.kind === "thought" ? "bubble bubble-thought" : b.kind === "narration" ? "bubble bubble-narration"
    : b.kind === "caption" ? "bubble bubble-caption" : b.kind === "whisper" ? "bubble bubble-whisper"
    : b.kind === "shout" ? "bubble bubble-shout" : b.kind === "sfx" ? "bubble bubble-sfx" : "bubble";
  return (
    <div className={cls} style={{
      left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, textAlign: b.align,
      fontSize: `${(b.size || 1) * (b.kind === "sfx" ? 26 : 11)}px`,
    }}>
      {b.text}
      {b.tail !== "none" && b.kind !== "sfx" && <span className={`bubble-tail bubble-tail-${b.tail}`} />}
    </div>
  );
}

export default async function PrintView({ params, searchParams }: {
  params: { id: string };
  searchParams: { chapter?: string };
}) {
  const user = currentUser();
  if (!user) redirect("/login");
  const projectRow = get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ? AND user_id = ?", params.id, user.id);
  if (!projectRow) notFound();
  const project = toProject(projectRow);

  const chapters = (searchParams.chapter
    ? get("SELECT * FROM chapters WHERE id = ? AND project_id = ?", searchParams.chapter, project.id)
      ? [toChapter(get<Record<string, unknown>>("SELECT * FROM chapters WHERE id = ?", searchParams.chapter, project.id)!)]
      : []
    : all<Record<string, unknown>>("SELECT * FROM chapters WHERE project_id = ? ORDER BY number", project.id).map(toChapter)
  );

  const rendered = chapters.map((ch) => ({
    chapter: ch,
    pages: all<Record<string, unknown>>("SELECT * FROM pages WHERE chapter_id = ? ORDER BY number", ch.id).map((pr) => {
      const page = toPage(pr);
      const panels = all<Record<string, unknown>>("SELECT * FROM panels WHERE page_id = ? ORDER BY order_num, created_at", page.id).map(toPanel);
      return { ...page, panels };
    }),
  }));

  return (
    <div className="min-h-screen bg-ink-950 py-8">
      <style>{`@media print { body { background: white !important; } .no-print{display:none} }`}</style>
      <div className="no-print mx-auto mb-6 flex max-w-3xl items-center justify-between px-4">
        <div>
          <h1 className="font-display text-lg font-bold text-ink-100">{project.title} — print view</h1>
          <p className="text-xs text-ink-500">Use your browser&apos;s Print → Save as PDF. Pages render at B5 ratio.</p>
        </div>
        <PrintButton />
      </div>
      {rendered.map(({ chapter, pages }) => (
        <div key={chapter.id}>
          <div className="no-print mx-auto mb-3 max-w-[620px] px-4 font-display text-sm font-semibold text-ink-300">
            Chapter {chapter.number} — {chapter.title}
          </div>
          {pages.map((page) => (
            <div key={page.id} className="paper print-page relative mx-auto mb-8" style={{ width: "min(92vw, 620px)", aspectRatio: "1000/1414" }}>
              {page.panels.map((panel) => (
                <div key={panel.id} className="absolute overflow-hidden"
                  style={{ left: `${panel.x}%`, top: `${panel.y}%`, width: `${panel.w}%`, height: `${panel.h}%`, border: "1.6pt solid #111", background: "#eee" }}>
                  {panel.imageUrl && <img src={panel.imageUrl} alt="" className="h-full w-full object-cover" />}
                  <div className="absolute inset-0">
                    {panel.bubbles.map((b) => <BubbleView key={b.id} b={b} />)}
                  </div>
                </div>
              ))}
              <span className="absolute bottom-1 right-2 text-[9px] text-black/60">{page.number}</span>
            </div>
          ))}
        </div>
      ))}
      {rendered.every((r) => r.pages.length === 0) && (
        <p className="text-center text-sm text-ink-500">No pages to print yet.</p>
      )}
    </div>
  );
}
