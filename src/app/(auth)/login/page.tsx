"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent, demo = false) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/login", demo
        ? { email: "demo@inkline.app", password: "inkline123" }
        : { email, password });
      toast.push("success", demo ? "Welcome back! Signed in to the demo studio." : "Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm animate-fadeUp">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black text-white" style={{ background: "var(--accent)" }}>墨</div>
        <div className="font-display text-lg font-bold">Inkline</div>
      </div>
      <h1 className="font-display text-2xl font-bold">Sign in to your studio</h1>
      <p className="mt-1 text-sm text-ink-400">Pick up right where the ink dried.</p>

      <form onSubmit={(e) => submit(e)} className="mt-7 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" placeholder="••••••••" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : "Sign in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-500">
        <div className="h-px flex-1 bg-ink-800" /> or <div className="h-px flex-1 bg-ink-800" />
      </div>

      <button className="btn-secondary w-full" onClick={() => submit(undefined, true)} disabled={busy}>
        ⚡ Explore the demo studio
      </button>
      <p className="mt-2 text-center text-xs text-ink-500">Seeded with a live manga project — Crimson Petal.</p>

      <p className="mt-8 text-center text-sm text-ink-400">
        New to Inkline? <Link href="/register" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>Create an account</Link>
      </p>
    </div>
  );
}
