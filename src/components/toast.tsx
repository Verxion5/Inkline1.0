"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; message: string }

const ToastCtx = createContext<{ push: (kind: ToastKind, message: string) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-4), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 no-print" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-fadeUp flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-pop backdrop-blur-md min-w-[260px] max-w-[380px] ${
              t.kind === "success" ? "border-emerald-500/30 bg-emerald-950/85 text-emerald-100"
              : t.kind === "error" ? "border-red-500/30 bg-red-950/85 text-red-100"
              : "border-ink-600 bg-ink-900/90 text-ink-100"}`}
          >
            <span className="mt-0.5">{t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "✦"}</span>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
