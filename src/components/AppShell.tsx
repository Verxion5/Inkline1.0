"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, useApiData, useDebouncedCallback, timeAgo } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Menu, MenuItem, Modal, Spinner } from "@/components/ui";
import type { UserPrefs } from "@/lib/types";

interface ShellUser { id: string; name: string; email: string; prefs: UserPrefs }
interface SearchResults { results: { id: string; type: string; title: string; projectId: string; projectTitle: string; chapterId?: string | null; pageId?: string | null }[] }

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/projects", label: "Projects", icon: "📚" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults["results"]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useDebouncedCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    try {
      const data = await api.get<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(data.results);
    } catch { setResults([]); } finally { setSearching(false); }
  }, 250);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function signOut() {
    await api.post("/api/auth/logout");
    toast.push("info", "Signed out. The ink will wait for you.");
    router.push("/login");
    router.refresh();
  }

  function go(r: SearchResults["results"][number]) {
    setSearchOpen(false);
    setQuery("");
    const base = `/projects/${r.projectId}`;
    switch (r.type) {
      case "project": router.push(base); break;
      case "chapter": router.push(`${base}/chapters`); break;
      case "character": router.push(`${base}/characters`); break;
      case "location": router.push(`${base}/locations`); break;
      case "story": router.push(`${base}/story`); break;
      case "page": case "panel": router.push(`${base}/studio${r.pageId ? `?page=${r.pageId}` : ""}`); break;
      default: router.push(base);
    }
  }

  const recentProjects = (useApiData<{ projects: { id: string; title: string; coverUrl: string | null }[] }>("/api/projects").data?.projects ?? []).slice(0, 4);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black text-white shadow-glow" style={{ background: "var(--accent)" }}>墨</div>
        <div>
          <div className="font-display text-base font-bold leading-none tracking-tight">Inkline</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-ink-500">Production Studio</div>
        </div>
      </Link>

      <button
        onClick={() => setSearchOpen(true)}
        className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-sm text-ink-500 hover:border-ink-600 hover:text-ink-300 transition-colors"
      >
        <span>⌕</span> Search…
        <kbd className="ml-auto rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-500">⌘K</kbd>
      </button>

      <nav className="space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-ink-800 text-white" : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"}`}>
              <span className={`text-base ${active ? "" : "opacity-80"}`} style={active ? { color: "var(--accent)" } : {}}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {recentProjects.length > 0 && (
        <div className="mt-6 px-3">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-600">Recent projects</div>
          <div className="space-y-0.5">
            {recentProjects.map((p) => {
              const active = pathname.startsWith(`/projects/${p.id}`);
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm truncate transition-colors ${
                    active ? "bg-ink-800 text-white" : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"}`}>
                  <span className="h-5 w-5 shrink-0 overflow-hidden rounded-md border border-ink-700 bg-ink-800">
                    {p.coverUrl ? <img src={p.coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[9px] text-ink-500">欠</span>}
                  </span>
                  <span className="truncate">{p.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-ink-800 p-3">
        <Menu align="left" trigger={
          <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ink-900 transition-colors">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-ink-100">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-100">{user.name}</span>
              <span className="block truncate text-xs text-ink-500">{user.email}</span>
            </span>
            <span className="text-ink-500">⋯</span>
          </button>
        }>
          <MenuItem onClick={() => router.push("/settings")}>⚙ Settings</MenuItem>
          <MenuItem onClick={signOut} danger>↩ Sign out</MenuItem>
        </Menu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-ink-800 bg-ink-950 lg:block no-print">
        {sidebar}
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-800 bg-ink-950/95 px-4 py-3 backdrop-blur lg:hidden no-print">
        <button className="btn-icon text-ink-300" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black text-white" style={{ background: "var(--accent)" }}>墨</span>
          <span className="font-display font-bold">Inkline</span>
        </Link>
        <button className="btn-icon ml-auto text-ink-300" onClick={() => setSearchOpen(true)} aria-label="Search">⌕</button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-ink-800 bg-ink-950 animate-fadeUp">{sidebar}</aside>
        </div>
      )}

      <main className="lg:pl-60 min-h-screen">{children}</main>

      {/* Global search */}
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title={<span className="flex items-center gap-2">⌕ Global search</span>}>
        <input
          autoFocus
          className="input"
          placeholder="Search projects, chapters, characters, pages…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); searchRef(e.target.value); }}
        />
        <div className="mt-3 max-h-80 overflow-y-auto">
          {searching && <div className="flex items-center gap-2 p-3 text-sm text-ink-400"><Spinner /> Searching…</div>}
          {!searching && query.length >= 2 && results.length === 0 && (
            <div className="p-3 text-sm text-ink-500">No matches for “{query}”.</div>
          )}
          <div className="space-y-1">
            {results.map((r) => (
              <button key={`${r.type}-${r.id}`} onClick={() => go(r)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-ink-800 transition-colors">
                <span className="chip w-20 justify-center">{r.type}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-100">{r.title}</span>
                  <span className="block truncate text-xs text-ink-500">{r.projectTitle}</span>
                </span>
                <span className="text-ink-600">↵</span>
              </button>
            ))}
          </div>
          {query.length < 2 && <div className="p-3 text-sm text-ink-500">Type at least 2 characters — search covers projects, chapters, characters, locations, pages, panels and story notes.</div>}
        </div>
      </Modal>
    </div>
  );
}
