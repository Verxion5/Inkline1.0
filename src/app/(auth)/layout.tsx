export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative hidden lg:flex lg:w-[46%] flex-col justify-between overflow-hidden border-r border-ink-800 bg-ink-950 p-10">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px",
        }} />
        <div className="absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full blur-3xl" style={{ background: "var(--accent-soft)" }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl font-black text-white shadow-glow" style={{ background: "var(--accent)" }}>墨</div>
            <div>
              <div className="font-display text-xl font-bold tracking-tight">Inkline</div>
              <div className="text-xs text-ink-400">Manga Production Studio</div>
            </div>
          </div>
        </div>
        <div className="relative space-y-8">
          <h1 className="font-display text-4xl font-bold leading-tight">
            From first idea to<br />
            <span style={{ color: "var(--accent)" }}>finished pages.</span>
          </h1>
          <p className="max-w-md text-ink-400 leading-relaxed">
            Write the story, cast your characters, board the scenes, generate panels, arrange pages, letter the dialogue —
            and export your manga. AI does the repetitive work; you stay the director.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-ink-300">
            {["Story Engine", "Character Memory", "Storyboard AI", "Panel Generator", "Page Builder", "Continuity", "Export"].map((f) => (
              <span key={f} className="chip">{f}</span>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-ink-500">Story → Characters → Chapters → Storyboard → Panels → Pages → Lettering → Export</div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">{children}</div>
    </div>
  );
}
