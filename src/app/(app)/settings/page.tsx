"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApiData } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Segmented, Spinner } from "@/components/ui";
import type { UserPrefs } from "@/lib/types";

interface Me { user: { id: string; email: string; name: string; prefs: UserPrefs; createdAt: string } }

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, reload } = useApiData<Me>("/api/auth/me");
  const me = data?.user;
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);

  const activePrefs = prefs ?? me?.prefs ?? null;

  async function saveProfile() {
    setBusy(true);
    try {
      await api.patch("/api/auth/me", { name: name || me?.name, prefs: activePrefs ?? undefined });
      toast.push("success", "Settings saved.");
      reload();
      router.refresh();
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  async function changePassword() {
    if (!pw.current || !pw.next) { toast.push("error", "Fill in both password fields."); return; }
    setBusy(true);
    try {
      await api.patch("/api/auth/me", { currentPassword: pw.current, newPassword: pw.next });
      toast.push("success", "Password changed.");
      setPw({ current: "", next: "" });
    } catch (e) { toast.push("error", (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-ink-400">Your studio, your rules.</p>

      {!me ? <div className="mt-8 skeleton h-64" /> : (
        <div className="mt-8 space-y-6">
          <section className="card px-5 py-4">
            <h2 className="section-title mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Display name</label>
                <input className="input" placeholder={me.name} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input opacity-60" value={me.email} disabled />
              </div>
              <div>
                <label className="label">Member since</label>
                <p className="text-sm text-ink-300">{new Date(me.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}</p>
              </div>
            </div>
          </section>

          <section className="card px-5 py-4">
            <h2 className="section-title mb-4">Editor preferences</h2>
            <div className="space-y-5">
              <div>
                <label className="label">Interface mode</label>
                <Segmented value={activePrefs?.experienceMode ?? "beginner"}
                  onChange={(v) => setPrefs(activePrefs ? { ...activePrefs, experienceMode: v } : null)}
                  options={[{ value: "beginner", label: "Beginner — essential controls" }, { value: "advanced", label: "Advanced — everything" }]} />
                <p className="mt-1.5 text-xs text-ink-500">Advanced reveals detailed generation settings and technical controls.</p>
              </div>
              <div>
                <label className="label">Default project format</label>
                <select className="select max-w-xs capitalize" value={activePrefs?.defaultFormat ?? "manga"}
                  onChange={(e) => setPrefs(activePrefs ? { ...activePrefs, defaultFormat: e.target.value as UserPrefs["defaultFormat"] } : null)}>
                  {["manga", "manhwa", "webtoon", "comic"].map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Default art mode</label>
                <select className="select max-w-xs" value={activePrefs?.defaultArtMode ?? "manga-bw"}
                  onChange={(e) => setPrefs(activePrefs ? { ...activePrefs, defaultArtMode: e.target.value as UserPrefs["defaultArtMode"] } : null)}>
                  {["manga-bw", "manga-gray", "manhwa-color", "sketch", "lineart", "cinematic", "stylized"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Accent color</label>
                <div className="flex gap-2">
                  {(["rose", "violet", "cyan"] as const).map((a) => (
                    <button key={a} onClick={() => setPrefs(activePrefs ? { ...activePrefs, accent: a } : null)}
                      className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${activePrefs?.accent === a ? "border-white" : "border-transparent"}`}
                      style={{ background: a === "rose" ? "#f43f5e" : a === "violet" ? "#8b5cf6" : "#06b6d4" }}
                      aria-label={a} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button className="btn-primary" onClick={saveProfile} disabled={busy}>{busy ? <Spinner /> : "Save settings"}</button>
          </div>

          <section className="card px-5 py-4">
            <h2 className="section-title mb-4">Change password</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Current password</label>
                <input type="password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
              </div>
              <div>
                <label className="label">New password</label>
                <input type="password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
              </div>
              <button className="btn-secondary" onClick={changePassword} disabled={busy}>Update password</button>
            </div>
          </section>

          <section className="card px-5 py-4">
            <h2 className="section-title mb-2">About autosave & storage</h2>
            <p className="text-xs leading-relaxed text-ink-400">
              Everything in Inkline autosaves — projects, chapters, pages, panel prompts, lettering and generated art live in your studio&apos;s database.
              Refresh the browser freely; your work is already stored. Use Export → Project archive for portable backups.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
