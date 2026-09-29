"use client";

import { Fragment, useEffect, useRef, useState } from "react";

// ─── Modal ───────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose: () => void; title: React.ReactNode;
  children: React.ReactNode; wide?: boolean; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[88vh] flex flex-col card animate-popIn`}>
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button className="btn-icon text-ink-400 hover:text-ink-100" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="border-t border-ink-800 px-5 py-3 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Dropdown menu ───────────────────────────────────────────────────────────

export function Menu({ trigger, children, align = "right" }: {
  trigger: React.ReactNode; children: React.ReactNode; align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", fn);
    return () => window.removeEventListener("mousedown", fn);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div className={`absolute z-40 mt-1 min-w-[180px] card py-1 animate-popIn ${align === "right" ? "right-0" : "left-0"}`}
          onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ onClick, danger, children, disabled }: {
  onClick?: () => void; danger?: boolean; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2 text-sm transition-colors flex items-center gap-2 disabled:opacity-40
        ${danger ? "text-red-400 hover:bg-red-950/50" : "text-ink-200 hover:bg-ink-800"}`}
    >
      {children}
    </button>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon: string; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-fadeUp">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-ink-850 border border-ink-800 text-4xl shadow-card">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold text-ink-100">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-400 leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

export function SkeletonGrid({ count = 6, height = "h-40" }: { count?: number; height?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${height}`} />
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  );
}

// ─── Progress ────────────────────────────────────────────────────────────────

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-800 ${className}`}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: "var(--accent)" }} />
    </div>
  );
}

// ─── Status badges ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  planning: "bg-ink-800 text-ink-300",
  scripting: "bg-sky-500/15 text-sky-300",
  storyboard: "bg-violet-500/15 text-violet-300",
  "in-progress": "bg-amber-500/15 text-amber-300",
  lettering: "bg-cyan-500/15 text-cyan-300",
  review: "bg-purple-500/15 text-purple-300",
  done: "bg-emerald-500/15 text-emerald-300",
  draft: "bg-amber-500/15 text-amber-300",
  empty: "bg-ink-800 text-ink-400",
  pencils: "bg-orange-500/15 text-orange-300",
  inked: "bg-teal-500/15 text-teal-300",
  lettered: "bg-cyan-500/15 text-cyan-300",
  active: "bg-emerald-500/15 text-emerald-300",
  archived: "bg-ink-800 text-ink-400",
  planned: "bg-ink-800 text-ink-400",
  generated: "bg-emerald-500/15 text-emerald-300",
  approved: "bg-sky-500/15 text-sky-300",
  designing: "bg-amber-500/15 text-amber-300",
  final: "bg-emerald-500/15 text-emerald-300",
  evolved: "bg-violet-500/15 text-violet-300",
  outline: "bg-ink-800 text-ink-400",
  scripted: "bg-sky-500/15 text-sky-300",
  boarded: "bg-violet-500/15 text-violet-300",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? "bg-ink-800 text-ink-300"}`}>{status}</span>;
}

// ─── Segmented control ───────────────────────────────────────────────────────

export function Segmented<T extends string>({ options, value, onChange, size = "md" }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg bg-ink-900 border border-ink-700 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md transition-all ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} font-medium ${
            value === o.value ? "bg-ink-700 text-white shadow-sm" : "text-ink-400 hover:text-ink-200"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Delete" }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </>
      }>
      <p className="text-sm text-ink-300 leading-relaxed">{message}</p>
    </Modal>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} role="status" aria-label="Loading" />
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { value: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-ink-800 overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors ${
            value === t.value ? "text-white" : "text-ink-400 hover:text-ink-200"}`}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className="ml-1.5 rounded-full bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300">{t.badge}</span>
          )}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
        </button>
      ))}
    </div>
  );
}

export { Fragment };
