"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Menu, MenuItem } from "@/components/ui";
import type { Project } from "@/lib/types";

const TABS = [
  { seg: "", label: "Overview", icon: "◈" },
  { seg: "story", label: "Story", icon: "✍" },
  { seg: "storyboard", label: "Storyboard", icon: "🎞" },
  { seg: "chapters", label: "Chapters", icon: "🗂" },
  { seg: "studio", label: "Studio", icon: "▭" },
  { seg: "characters", label: "Characters", icon: "🎎" },
  { seg: "locations", label: "Locations", icon: "⛩" },
  { seg: "assets", label: "Assets", icon: "◆" },
  { seg: "assistant", label: "Assistant", icon: "✦" },
  { seg: "continuity", label: "Continuity", icon: "⛓" },
  { seg: "export", label: "Export", icon: "⤓" },
];

export default function ProjectNav(props: { id: string } & Pick<Project, "title" | "format" | "status" | "coverUrl" | "readingDirection">) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const base = `/projects/${props.id}`;
  const currentSeg = pathname.startsWith(base) ? pathname.slice(base.length).split("/")[1] ?? "" : "";
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);

  const fav = useApiData<{ project: Project }>(`/api/projects/${props.id}`);
  const isFavorite = fav.data?.project.favorite ?? false;

  async function toggleFavorite() {
    const next = !isFavorite;
    try {
      await api.patch(`/api/projects/${props.id}`, { favorite: next });
      fav.reload();
      toast.push("success", next ? "Added to favorites." : "Removed from favorites.");
    } catch (e) { toast.push("error", (e as Error).message); }
  }

  return (
    <div className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/95 backdrop-blur no-print">
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
          {props.coverUrl ? <img src={props.coverUrl} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-sm text-ink-600">墨</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={base} className="truncate font-display text-sm font-bold hover:underline">{props.title}</Link>
            <button onClick={toggleFavorite} aria-label="Favorite" className={`text-sm transition-transform hover:scale-110 ${isFavorite ? "" : "opacity-30"}`} style={{ color: "var(--accent)" }}>★</button>
            {props.status === "archived" && <span className="badge bg-ink-800 text-ink-400">archived</span>}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-500">
            {props.format} · reads {props.readingDirection === "rtl" ? "right-to-left" : "left-to-right"}
          </div>
        </div>
        <div className="hidden sm:block">
          <Menu trigger={<button className="btn-secondary btn-sm">Settings ▾</button>}>
            <MenuItem onClick={() => router.push(`${base}?settings=1`)}>⚙ Project settings</MenuItem>
            <MenuItem onClick={() => router.push(`/projects/${props.id}/export`)}>⤓ Export</MenuItem>
          </Menu>
        </div>
        <button className="btn-icon text-ink-300 lg:hidden" onClick={() => setMobileTabsOpen((o) => !o)} aria-label="Toggle tabs">
          {mobileTabsOpen ? "✕" : "▤"}
        </button>
      </div>

      <nav className={`${mobileTabsOpen ? "block" : "hidden"} lg:block border-t border-ink-800/50 lg:border-t-0`}>
        <div className="flex gap-0.5 overflow-x-auto px-3 py-1.5 no-scrollbar">
          {TABS.map((t) => {
            const active = currentSeg === t.seg;
            const href = t.seg ? `${base}/${t.seg}` : base;
            return (
              <Link key={t.seg} href={href} onClick={() => setMobileTabsOpen(false)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active ? "bg-ink-800 text-white" : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"}`}>
                <span className="text-xs" style={active ? { color: "var(--accent)" } : {}}>{t.icon.trim() || "◈"}</span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
