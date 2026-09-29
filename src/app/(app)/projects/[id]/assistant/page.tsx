"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, renderMarkdownLite, useApiData } from "@/lib/client";
import { Spinner } from "@/components/ui";
import type { AssistantMessage } from "@/lib/types";

const QUICK = [
  "What should I do next?",
  "Help me write dialogue",
  "Build me a generation prompt",
  "Check continuity",
  "How does storyboarding work?",
  "Suggest page layouts",
];

export default function AssistantPage() {
  const { id } = useParams<{ id: string }>();
  const { data, setData, loading } = useApiData<{ messages: AssistantMessage[] }>(`/api/projects/${id}/assistant`);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages ?? [];
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, sending]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    // optimistic user message
    setData((d) => d ? { messages: [...d.messages, { id: `tmp-${Date.now()}`, projectId: id, role: "user", content: message, createdAt: new Date().toISOString() }] } : d);
    try {
      const res = await api.post<{ messages: AssistantMessage[] }>(`/api/projects/${id}/assistant`, { message });
      setData({ messages: res.messages });
    } catch {
      setData((d) => d ? { messages: [...d.messages, { id: `err-${Date.now()}`, projectId: id, role: "assistant", content: "I hit a snag reaching my notes — try again in a moment.", createdAt: new Date().toISOString() }] } : d);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-100px)] max-w-3xl flex-col px-4 py-6 sm:px-8">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold sm:text-2xl">Creative assistant</h1>
        <p className="mt-0.5 text-sm text-ink-400">Knows your project — chapters, cast, panels and story. It assists; you direct.</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-ink-800 bg-ink-950 p-4">
        {loading && <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-16" />)}</div>}
        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="text-4xl">✦</span>
            <p className="max-w-sm text-sm text-ink-400">Ask about your story, cast, panels or what to do next. I read your project as we go.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm text-white" style={{ background: "var(--accent)" }}>✦</span>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user"
              ? "rounded-br-sm text-white" : "rounded-bl-sm border border-ink-800 bg-ink-900 text-ink-200"}`}
              style={m.role === "user" ? { background: "var(--accent)" } : {}}>
              <span dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm text-white" style={{ background: "var(--accent)" }}>✦</span>
            <div className="rounded-2xl rounded-bl-sm border border-ink-800 bg-ink-900 px-4 py-3"><Spinner className="text-ink-400" /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} className="chip hover:!border-ink-400 hover:!text-ink-100" onClick={() => send(q)}>{q}</button>
        ))}
      </div>

      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input className="input flex-1" placeholder="Ask your assistant…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn-primary" disabled={sending || !input.trim()}>{sending ? <Spinner /> : "Send"}</button>
      </form>
    </div>
  );
}
