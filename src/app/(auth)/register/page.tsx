"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/register", { name, email, password });
      toast.push("success", "Your studio is ready. Welcome to Inkline!");
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
      <h1 className="font-display text-2xl font-bold">Create your studio</h1>
      <p className="mt-1 text-sm text-ink-400">Every great manga starts with a blank page.</p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" placeholder="Your pen name" value={name}
            onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" placeholder="8+ characters" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
          <p className="mt-1 text-xs text-ink-500">At least 8 characters. Everything you make autosaves to your studio.</p>
        </div>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-400">
        Already have an account? <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>Sign in</Link>
      </p>
    </div>
  );
}
