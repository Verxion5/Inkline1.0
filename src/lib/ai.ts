import type {
  Character, Location, Project, Scene, ShotType, CameraAngle, BubbleKind,
  StoryboardSpec, ContinuityIssue, Panel, Page, Chapter,
} from "./types";
import { all, get, parseJson } from "./db";

// ─── Prompt System: compose a full generation prompt ────────────────────────

const SHOT_TOKENS: Record<string, string> = {
  establishing: "wide establishing shot, sweeping environment",
  wide: "wide shot, full figures visible",
  medium: "medium shot, waist up",
  "close-up": "close-up on the face",
  "extreme-close-up": "extreme close-up, eye level detail",
  "over-the-shoulder": "over-the-shoulder shot",
  action: "dynamic action shot, motion, foreshortening",
  splash: "full-page splash composition, dramatic centerpiece",
  insert: "insert detail shot of object",
};

const CAMERA_TOKENS: Record<string, string> = {
  "eye-level": "eye-level camera",
  high: "high angle looking down",
  low: "low angle looking up, heroic",
  overhead: "top-down overhead view",
  dutch: "dutch tilt, unease",
  "worms-eye": "worm's eye view",
};

export function characterMemoryTokens(c: Character): string {
  const a = c.appearance;
  const bits = [c.name];
  if (a.hair) bits.push(`${a.hair} hair${a.hairColor ? ` (${a.hairColor})` : ""}`);
  if (a.eyes) bits.push(`${a.eyes} eyes`);
  if (a.clothing) bits.push(`wearing ${a.clothing}`);
  if (a.build) bits.push(a.build);
  if (a.features) bits.push(`distinctive: ${a.features}`);
  if (a.accessories) bits.push(a.accessories);
  return bits.join(", ");
}

export function buildPanelPrompt(opts: {
  project: Project;
  characters: Character[];
  location?: Location | null;
  description: string;
  shot: string;
  camera: string;
  expression?: string;
  pose?: string;
  lighting?: string;
  mood?: string;
  effects?: string;
  focus?: string;
}): string {
  const styleTokens: string[] = [];
  switch (opts.project.style.artMode) {
    case "manga-bw": styleTokens.push("black and white manga ink illustration", "bold hatching and screentone", "sharp linework"); break;
    case "manga-gray": styleTokens.push("grayscale manga illustration", "detailed screentones", "soft gradients"); break;
    case "manhwa-color": styleTokens.push("full-color manhwa illustration", "clean cel shading", "vibrant rendering", "webtoon style"); break;
    case "sketch": styleTokens.push("loose pencil sketch", "rough construction lines"); break;
    case "lineart": styleTokens.push("clean line art", "no shading, pure linework"); break;
    case "cinematic": styleTokens.push("cinematic comic art", "dramatic film lighting", "painterly rendering"); break;
    case "stylized": styleTokens.push("stylized comic illustration", "graphic shapes", "bold color blocking"); break;
    default: styleTokens.push(opts.project.style.customNotes || "illustration");
  }
  if (opts.project.style.lineStyle) styleTokens.push(opts.project.style.lineStyle);
  if (opts.project.style.shading) styleTokens.push(`${opts.project.style.shading} shading`);
  if (opts.project.style.backgroundStyle) styleTokens.push(`${opts.project.style.backgroundStyle} backgrounds`);
  if (opts.project.style.mood) styleTokens.push(`overall mood: ${opts.project.style.mood}`);

  const parts: string[] = [];
  parts.push(styleTokens.join(", "));
  parts.push(SHOT_TOKENS[opts.shot] ?? opts.shot);
  if (opts.camera && CAMERA_TOKENS[opts.camera]) parts.push(CAMERA_TOKENS[opts.camera]);
  if (opts.characters.length) {
    parts.push(`featuring ${opts.characters.map((c) => characterMemoryTokens(c)).join("; ")}`);
  }
  if (opts.location) {
    parts.push(`setting: ${opts.location.name} (${opts.location.environment})${opts.location.description ? `, ${opts.location.description}` : ""}`);
    if (opts.location.lighting) parts.push(`location lighting: ${opts.location.lighting}`);
  }
  if (opts.description) parts.push(`scene: ${opts.description}`);
  if (opts.expression) parts.push(`expressions: ${opts.expression}`);
  if (opts.pose) parts.push(`poses: ${opts.pose}`);
  if (opts.lighting) parts.push(`lighting: ${opts.lighting}`);
  if (opts.mood) parts.push(`mood: ${opts.mood}`);
  if (opts.effects) parts.push(`effects: ${opts.effects}`);
  if (opts.focus) parts.push(`focus on: ${opts.focus}`);
  parts.push("manga panel composition, readable silhouette, high detail");
  return parts.filter(Boolean).join(" | ");
}

// ─── Script → Storyboard parsing ────────────────────────────────────────────

interface Beat {
  kind: "action" | "dialogue" | "slug";
  text: string;
  speaker?: string;
  paren?: string;
  slug?: string;
}

const ACTION_VERBS = /(run|sprint|dash|leap|jump|charge|attack|swing|slam|crash|explode|block|dodge|slash|punch|kick|grab|throw|spin|fall|stumble|burst|reach|pull|shove)/i;
const REVEAL_WORDS = /(reveal|appears|suddenly|behold|emerges|stands there|materialize|transformation)/i;
const EXPRESSION_MAP: [RegExp, string][] = [
  [/angry|furious|rage|snarl|scowl|glare/i, "furious, gritted teeth"],
  [/sad|cry|tears|sob|weep|grief/i, "tearful, pained expression"],
  [/smile|grin|laugh|happy|cheer/i, "warm smile"],
  [/shock|surprise|gasp|startled|stunned/i, "wide-eyed shock"],
  [/afraid|fear|terror|trembl/i, "fearful, trembling"],
  [/smirk|sly|smug/i, "sly smirk"],
  [/determined|resolve|serious|stern/i, "determined, focused"],
  [/tired|exhaust|weary/i, "weary expression"],
  [/blush|embarrass/i, "flustered, blushing"],
];
const FX_MAP: [RegExp, string][] = [
  [/speed|dash|sprint|rush|blur/i, "speed lines, motion blur"],
  [/impact|slam|crash|explosion|boom/i, "impact burst, debris"],
  [/spark|electric|energy|magic|aura|glow/i, "energy sparks, glowing particles"],
  [/smoke|dust|steam|cloud/i, "drifting smoke and dust"],
  [/rain|storm/i, "rain streaks"],
];

function detectFirst(list: [RegExp, string][], text: string): string {
  for (const [re, v] of list) if (re.test(text)) return v;
  return "";
}

function parseBeats(script: string): Beat[] {
  const beats: Beat[] = [];
  const lines = script.split("\n").map((l) => l.trim()).filter(Boolean);
  let actionBuf: string[] = [];
  const flush = () => {
    if (actionBuf.length) {
      beats.push({ kind: "action", text: actionBuf.join(" ") });
      actionBuf = [];
    }
  };
  for (const line of lines) {
    const slug = line.match(/^(INT\.|EXT\.|I\.|E\.)\s*([^-]+)(?:-\s*(.+))?$/i);
    if (slug) { flush(); beats.push({ kind: "slug", slug: `${slug[2].trim()}${slug[3] ? ` — ${slug[3].trim()}` : ""}`, text: slug[2].trim() }); continue; }
    const dlg = line.match(/^([A-Z][A-Z' .-]{1,24})(\s*\(([^)]+)\))?\s*:\s*(.+)$/);
    if (dlg) {
      flush();
      if (/^SFX$/i.test(dlg[1].trim())) {
        beats.push({ kind: "action", paren: "sound effect", text: `Sound effect lettering “${dlg[4].trim()}” echoes through the panel.` });
      } else {
        beats.push({ kind: "dialogue", speaker: dlg[1].trim(), paren: dlg[3]?.trim(), text: dlg[4].trim() });
      }
      continue;
    }
    if (/^\(.*\)$/.test(line)) { flush(); beats.push({ kind: "action", paren: line.slice(1, -1), text: line.slice(1, -1) }); continue; }
    actionBuf.push(line.replace(/^[-*•]\s*/, ""));
    if (actionBuf.join(" ").length > 220) flush();
  }
  flush();
  return beats;
}

function shotFor(beat: Beat, index: number, total: number): ShotType {
  const t = beat.text;
  if (beat.kind === "slug") return "establishing";
  if (index === 0) return "establishing";
  if (beat.kind === "dialogue") {
    if (/whisper|quiet|mutter/i.test(beat.paren ?? "")) return "close-up";
    if (total <= 3) return "medium";
    return index % 3 === 0 ? "close-up" : "medium";
  }
  if (ACTION_VERBS.test(t)) return "action";
  if (/\b(eyes|hand|fist|blade|letter|photo|phone|ring|locket|scar|mark|blood|tear)\b/i.test(t)) return "insert";
  if (REVEAL_WORDS.test(t) && (index === total - 1 || index === 0)) return "splash";
  if (REVEAL_WORDS.test(t)) return "close-up";
  return "wide";
}

function cameraFor(shot: ShotType, beat: Beat): CameraAngle {
  if (/above|overhead|below them|towering|looking down/i.test(beat.text)) return "high";
  if (shot === "action") return /fall|drop/i.test(beat.text) ? "dutch" : "low";
  if (shot === "establishing") return /tower|city|sky/i.test(beat.text) ? "low" : "eye-level";
  if (shot === "splash") return "low";
  return "eye-level";
}

function sizeFor(shot: ShotType, index: number, total: number): StoryboardSpec["size"] {
  if (shot === "splash") return "splash";
  if (shot === "establishing") return index === 0 ? "large" : "medium";
  if (shot === "action") return index === total - 1 ? "large" : "medium";
  if (shot === "insert") return "strip";
  if (shot === "close-up" || shot === "extreme-close-up") return "small";
  return "medium";
}

function purposeFor(shot: ShotType, beat: Beat): string {
  if (beat.kind === "slug") return "establishing";
  if (shot === "splash") return "important reveal";
  if (shot === "action") return "action";
  if (shot === "insert") return "detail insert";
  if (shot === "close-up") return REVEAL_WORDS.test(beat.text) ? "reveal" : "reaction / emphasis";
  if (beat.kind === "dialogue") return "dialogue beat";
  return "story beat";
}

/** Convert a screenplay-style script into a panel plan (storyboard). */
export function scriptToStoryboard(script: string, characters: Character[]): StoryboardSpec[] {
  const beats = parseBeats(script).slice(0, 12);
  const specs: StoryboardSpec[] = [];
  let currentBeatAction = "";
  beats.forEach((beat, i) => {
    if (beat.kind === "slug") {
      currentBeatAction = beat.text;
      specs.push({
        description: `Establishing shot: ${beat.slug}`,
        shot: "establishing", camera: "eye-level",
        expression: "", pose: "",
        lighting: /night/i.test(beat.slug ?? "") ? "moonlit, lantern glow" : "natural daylight",
        mood: /night/i.test(beat.slug ?? "") ? "quiet, mysterious" : "open, lively",
        effects: "", purpose: "establishing", characterNames: [], size: "large", dialogue: [],
      });
      return;
    }
    const searchText = `${beat.text} ${currentBeatAction}`;
    const names = characters.filter((c) => {
      const first = c.name.split(" ")[0];
      return new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(searchText)
        || new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(searchText);
    }).map((c) => c.name);
    const shot = shotFor(beat, i, beats.length);
    const dialogue: StoryboardSpec["dialogue"] = [];
    if (beat.kind === "dialogue") {
      dialogue.push({
        character: beat.speaker ?? "",
        text: beat.text,
        kind: /think|thought/i.test(beat.paren ?? "") ? "thought" : /whisper/i.test(beat.paren ?? "") ? "whisper" : /shout|yell|scream/i.test(beat.paren ?? "") ? "shout" : "speech",
      });
    }
    specs.push({
      description: beat.kind === "dialogue"
        ? `${beat.speaker ?? "The speaker"} speaks${names.length ? "" : ` (match: ${beat.speaker ?? "?"})`}: ${currentBeatAction || "framed on the speaker"}`
        : beat.text,
      shot,
      camera: cameraFor(shot, beat),
      expression: beat.paren ?? detectFirst(EXPRESSION_MAP, searchText),
      pose: ACTION_VERBS.test(searchText) ? "dynamic, mid-motion" : "",
      lighting: detectMoodLight(searchText),
      mood: "",
      effects: detectFirst(FX_MAP, searchText),
      purpose: purposeFor(shot, beat),
      characterNames: beat.kind === "dialogue" && !names.length ? [beat.speaker ?? ""].filter(Boolean) : names,
      size: sizeFor(shot, i, beats.length),
      dialogue,
    });
    if (beat.kind === "action") currentBeatAction = beat.text;
  });
  return specs;
}

function detectMoodLight(text: string): string {
  if (/night|moon|lantern|dark/i.test(text)) return "moody night lighting, lantern glow";
  if (/sunset|dusk|evening/i.test(text)) return "warm sunset light, long shadows";
  if (/dawn|sunrise|morning/i.test(text)) return "soft dawn light";
  if (/storm|rain|thunder/i.test(text)) return "storm light, flash highlights";
  return "";
}

// ─── Page Layout Intelligence ───────────────────────────────────────────────

type Rect = { x: number; y: number; w: number; h: number };
const TEMPLATES: Record<number, Rect[]> = {
  1: [{ x: 0, y: 0, w: 100, h: 100 }],
  2: [{ x: 0, y: 0, w: 100, h: 58 }, { x: 0, y: 59.5, w: 100, h: 40.5 }],
  3: [{ x: 0, y: 0, w: 100, h: 46 }, { x: 0, y: 47.5, w: 55, h: 52.5 }, { x: 56.5, y: 47.5, w: 43.5, h: 52.5 }],
  4: [{ x: 0, y: 0, w: 100, h: 34 }, { x: 0, y: 35.5, w: 48, h: 30 }, { x: 49.5, y: 35.5, w: 50.5, h: 30 }, { x: 0, y: 67, w: 100, h: 33 }],
  5: [{ x: 0, y: 0, w: 60, h: 38 }, { x: 61.5, y: 0, w: 38.5, h: 38 }, { x: 0, y: 39.5, w: 100, h: 27 }, { x: 0, y: 68, w: 48, h: 32 }, { x: 49.5, y: 68, w: 50.5, h: 32 }],
  6: [{ x: 0, y: 0, w: 100, h: 28 }, { x: 0, y: 29.5, w: 48, h: 24 }, { x: 49.5, y: 29.5, w: 50.5, h: 24 }, { x: 0, y: 55, w: 31, h: 45 }, { x: 32.5, y: 55, w: 34, h: 45 }, { x: 68, y: 55, w: 32, h: 45 }],
  7: [{ x: 0, y: 0, w: 100, h: 26 }, { x: 0, y: 27.5, w: 64, h: 22 }, { x: 65.5, y: 27.5, w: 34.5, h: 22 }, { x: 0, y: 51, w: 34.5, h: 22 }, { x: 36, y: 51, w: 64, h: 22 }, { x: 0, y: 74.5, w: 48, h: 25.5 }, { x: 49.5, y: 74.5, w: 50.5, h: 25.5 }],
};

/** Suggest a page layout for panels based on their size hints & rhythm. */
export function suggestLayout(count: number, sizeHints: string[]): Rect[] {
  if (count <= 0) return [];
  if (sizeHints[0] === "splash" || count === 1) return TEMPLATES[1].map((r) => r);
  const n = Math.min(count, 7);
  let rects = (TEMPLATES[n] ?? TEMPLATES[6]).map((r) => ({ ...r }));
  // Large hints make the first panel a band
  if (sizeHints[0] === "large" && n >= 3) { rects[0] = { x: 0, y: 0, w: 100, h: 34 }; }
  if (count > 7) {
    // squeeze extras as strips at bottom by shrinking everything
    rects = (TEMPLATES[6]).map((r) => ({ ...r, h: r.h * (100 / 100) }));
  }
  return rects.slice(0, count).concat(count > 7 ? TEMPLATES[6].slice(count - 7) : []);
}

// ─── Continuity Engine ──────────────────────────────────────────────────────

export function continuityCheck(projectId: string): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const chars = all<Record<string, unknown>>("SELECT * FROM characters WHERE project_id = ?", projectId);
  const locs = all<Record<string, unknown>>("SELECT * FROM locations WHERE project_id = ?", projectId);
  const locIds = new Set(locs.map((l) => l.id as string));
  const charIds = new Set(chars.map((c) => c.id as string));
  const pages = all<Record<string, unknown>>("SELECT * FROM pages WHERE project_id = ?", projectId);
  const panels = all<Record<string, unknown>>("SELECT * FROM panels WHERE project_id = ?", projectId);
  const chapters = all<Record<string, unknown>>("SELECT * FROM chapters WHERE project_id = ?", projectId);
  const scenes = all<Record<string, unknown>>("SELECT * FROM scenes WHERE project_id = ?", projectId);
  const premise = get("SELECT id FROM story_blocks WHERE project_id = ? AND kind = 'premise'", projectId);

  if (!premise) issues.push({ id: "no-premise", severity: "info", area: "Story", message: "No story premise written yet. Add one so the AI can align generations with your story." });
  chars.forEach((c) => {
    if (!c.portrait_url) issues.push({ id: `char-noportrait-${c.id}`, severity: "info", area: "Characters", message: `${c.name} has no reference portrait — generate one to anchor visual consistency.` });
    const ap = JSON.parse((c.appearance as string) || "{}");
    if (!ap.hair || !ap.clothing) issues.push({ id: `char-memory-${c.id}`, severity: "warning", area: "Character memory", message: `${c.name}'s identity profile is incomplete (hair/clothing). Fill the profile for better consistency.` });
  });
  chapters.forEach((ch) => {
    const chPages = pages.filter((p) => p.chapter_id === ch.id);
    if (!chPages.length) issues.push({ id: `ch-empty-${ch.id}`, severity: "info", area: "Chapters", message: `Chapter ${ch.number} “${ch.title}” has no pages yet.` });
  });
  scenes.forEach((s) => {
    if (!s.location_id) issues.push({ id: `scene-noloc-${s.id}`, severity: "info", area: "Scenes", message: `Scene “${s.title}” has no location assigned.` });
  });
  pages.forEach((p) => {
    const pp = panels.filter((pl) => pl.page_id === p.id);
    if (!pp.length && p.status !== "empty") {
      issues.push({ id: `page-empty-${p.id}`, severity: "error", area: "Pages", message: `Page ${p.number} is marked “${p.status}” but has no panels.`, link: `/projects/${projectId}/studio?page=${p.id}` });
    }
    pp.forEach((pl) => {
      if (!pl.prompt && !pl.description) issues.push({ id: `panel-noprompt-${pl.id}`, severity: "warning", area: "Panels", message: `A panel on page ${p.number} has no description or prompt — it can't be generated yet.`, link: `/projects/${projectId}/studio?page=${p.id}` });
      parseJson<string[]>(pl.character_ids, []).forEach((cid) => {
        if (!charIds.has(cid)) issues.push({ id: `panel-badchar-${pl.id}-${cid}`, severity: "error", area: "Continuity", message: `Panel on page ${p.number} references a deleted character. Clean up the cast.`, link: `/projects/${projectId}/studio?page=${p.id}` });
      });
      if (pl.location_id && !locIds.has(String(pl.location_id))) issues.push({ id: `panel-badloc-${pl.id}`, severity: "warning", area: "Continuity", message: `Panel on page ${p.number} references a removed location.`, link: `/projects/${projectId}/studio?page=${p.id}` });
      if (pl.stage === "planned" && p.status === "done") issues.push({ id: `panel-unplanned-${pl.id}`, severity: "error", area: "Production", message: `Page ${p.number} is done but still has unplanned (un-generated) panels.`, link: `/projects/${projectId}/studio?page=${p.id}` });
    });
  });
  // duplicate page numbers
  const byChapter: Record<string, number[]> = {};
  pages.forEach((p) => { (byChapter[p.chapter_id as string] ??= []).push(p.number as number); });
  Object.entries(byChapter).forEach(([chId, nums]) => {
    const seen = new Set<number>();
    nums.forEach((n) => {
      if (seen.has(n)) {
        const ch = chapters.find((c) => c.id === chId);
        issues.push({ id: `page-dup-${chId}-${n}`, severity: "warning", area: "Order", message: `Duplicate page number ${n} in “${ch?.title ?? "chapter"}”. Renumber to fix ordering.` });
      }
      seen.add(n);
    });
  });
  return issues;
}

// ─── Creative Assistant (project-aware, rule-based) ─────────────────────────

export interface ProjectContextSummary {
  project: Project;
  characters: Character[];
  stats: { chapters: number; pages: number; panels: number; generated: number; scenes: number };
  lastChapterTitle?: string;
  premise?: string;
}

export function assistantReply(question: string, ctx: ProjectContextSummary): string {
  const q = question.toLowerCase();
  const { project, characters, stats } = ctx;
  const castList = characters.slice(0, 6).map((c) => `**${c.name}** (${c.role})`).join(", ") || "*(no characters yet)*";

  const nextSteps = () => {
    const steps: string[] = [];
    if (!ctx.premise) steps.push("Write your **story premise** in the Story tab — everything else gets sharper once the AI knows your story.");
    if (!characters.length) steps.push("Create your **main characters** with full appearance profiles (hair, eyes, clothing) — this powers character consistency.");
    if (!stats.chapters) steps.push("Create **Chapter 1** and add a scene with a script.");
    if (stats.chapters && !stats.panels) steps.push("Open the **Storyboard** tab, paste a scene script, and generate a panel plan.");
    if (stats.panels && stats.generated < stats.panels) steps.push(`Generate artwork for your ${stats.panels - stats.generated} planned **panels** in the Studio.`);
    if (stats.generated && stats.panels) steps.push("Review your page in the **Studio**, adjust panel layout, and add **dialogue bubbles**.");
    if (stats.panels && stats.generated >= stats.panels && stats.panels > 0) steps.push("You're production-ready — run **Continuity checks** and **export** the chapter.");
    return steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join("\n");
  };

  if (/^(hi|hello|hey|yo)\b/.test(q))
    return `Hey! I'm your Inkline assistant for **${project.title}**.\n\nCurrent state: ${stats.chapters} chapters · ${stats.pages} pages · ${stats.panels} panels (${stats.generated} generated) · cast: ${castList}\n\nAsk me for *next steps*, help with *dialogue*, *prompts*, *storyboarding*, or *continuity*.`;

  if (/next|what should i|where.*(start|go)|stuck|todo|to do/.test(q))
    return `Here's where **${project.title}** stands and what I'd do next:\n\n${nextSteps()}\n\nYou're the director — pick what feels right and I'll help with the details.`;

  if (/continuity|consisten|remember|forgot/.test(q)) {
    const issues = continuityCheck(project.id);
    const errors = issues.filter((i) => i.severity === "error").length;
    const warns = issues.filter((i) => i.severity === "warning").length;
    return `I ran a quick continuity sweep:\n\n- ❌ ${errors} blocking issue(s)\n- ⚠️ ${warns} warning(s)\n\n${issues.slice(0, 3).map((i) => `• ${i.message}`).join("\n") || "• All clear!"}\n\nOpen the **Continuity** tab for the full report. My character memory keeps each character's hair, eyes, clothing and features attached to every generation, so designs stay stable across chapters.`;
  }

  if (/prompt|generate|image|art command/.test(q)) {
    const c = characters[0];
    const example = c ? buildPanelPrompt({
      project, characters: [c], location: null,
      description: "a tense rooftop confrontation at dusk", shot: "close-up", camera: "low",
      expression: "determined, wind in hair", lighting: "warm sunset rim light", effects: "speed lines",
    }) : "Create a character first and I'll build you a complete generation prompt automatically.";
    return `Inkline builds generation prompts for you from character memory + location + style + shot data. Here's an example prompt for ${c ? `**${c.name}**` : "a character"}:\n\n> ${example}\n\nYou can inspect and edit any prompt in the Studio's panel inspector before generating.`;
  }

  if (/dialogue|line|write|rewrite|script/.test(q)) {
    const a = characters[0]?.name ?? "AKIRA";
    const b = characters[1]?.name ?? "MIRA";
    return `Dialogue tips for ${project.title}:\n\n1. **Keep bubbles short** — 1–2 lines per bubble reads best in panels.\n2. **Let art carry emotion**, let words carry intent.\n3. Use *(parentheticals)* in scripts to steer expressions.\n\nQuick example in your cast's voice:\n\n> **${a}**: You shouldn't have followed me.\n> **${b}** *(smirking)*: Good thing I don't listen.\n\nPaste a script into the Storyboard tab and I'll board it panel by panel.`;
  }

  if (/storyboard|board|panel plan|script to/.test(q))
    return `Storyboarding turns scripts into panel plans — planning before pixels.\n\n1. Open **Storyboard**, pick a chapter + scene.\n2. Paste or write your script (\`INT.Location - NIGHT\`, \`NAME: line\`, plain action lines).\n3. Hit **Generate storyboard** — I'll assign shots, cameras, expressions, effects and pacing.\n4. Tweak anything, then **push it to a new page** and generate artwork in the Studio.`;

  if (/character|cast|design/.test(q))
    return `Your current cast: ${castList}.\n\nFor each character I keep an **identity profile** (hair, eyes, build, clothing, features, accessories) that's injected into every panel they appear in — that's how Chapter 1 and Chapter 80 stay the same person.\n\nTip: when a design changes mid-story (new scar, new outfit), hit **Update design** on the character — the change is logged into their memory timeline.`;

  if (/page|layout|arrange|compose/.test(q))
    return `Page composition tips:\n\n- Open with a **large establishing panel**, end on a **punch panel**.\n- Close-ups slow time; wides speed it up.\n- Keep reading order obvious — ${project.readingDirection === "rtl" ? "right-to-left for manga" : "left-to-right"}.\n\nIn the Studio, press **Suggest layout** and I'll arrange the page's panels by story importance, then you can drag anything.`;

  if (/export|publish|pdf/.test(q))
    return `When you're ready to ship: the **Export** tab gives you a print-ready view per chapter (Ctrl/Cmd+P → save as PDF), page PNG downloads from the Studio, and a full JSON project archive for backup or moving between machines.`;

  if (/style|art mode|visual/.test(q))
    return `**${project.title}** is set to *${project.style.artMode}* with a ${project.format} format. The style profile (line, shading, backgrounds, mood) is baked into every generation prompt. Tune it in **Project Settings → Visual Style**.`;

  if (/idea|title|name/.test(q)) {
    const seeds = ["Ashen Choir", "Paper Lantern", "The Last Bloom", "Midnight Signal", "Glass Waltz", "Hollow Sun"];
    return `Some title seeds riffing off your project's mood: ${seeds.map((s) => `*${s}*`).join(", ")}. For character names, tell me the vibe (e.g. “stoic swordswoman”) and I'll riff.`;
  }

  return `I'm your project assistant for **${project.title}** — I can see ${stats.chapters} chapters, ${stats.pages} pages, ${stats.panels} panels and your cast (${castList}).\n\nTry asking:\n- *"What should I do next?"*\n- *"Help me write dialogue"*\n- *"Build me a generation prompt"*\n- *"Check continuity"*\n- *"How does storyboarding work?"*\n\nThe AI does the repetitive work — you stay the director.`;
}
