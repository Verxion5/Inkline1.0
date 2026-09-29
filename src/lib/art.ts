// ─── Procedural manga-style SVG art engine ──────────────────────────────────
// Deterministic, seeded generators that produce stylish panel art, portraits,
// location thumbnails and covers. Used by the AI panel engine at runtime.

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 2147483647;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Mood = "night" | "sunset" | "day" | "dark" | "bright" | "storm" | "dawn";

function detectMood(text: string): Mood {
  const t = text.toLowerCase();
  if (/night|moon|stars|dark sky|midnight|lantern/.test(t)) return "night";
  if (/sunset|dusk|evening|amber|golden/.test(t)) return "sunset";
  if (/dawn|sunrise|morning/.test(t)) return "dawn";
  if (/storm|rain|thunder|lightning/.test(t)) return "storm";
  if (/dark|shadow|dread|horror|underground|cave/.test(t)) return "dark";
  if (/bright|sunny|cheer|festival|daylight/.test(t)) return "bright";
  return "day";
}

interface Palette {
  sky: [string, string];
  far: string;
  mid: string;
  near: string;
  fg: string;
  accent: string;
  mono: boolean;
}

function paletteFor(mood: Mood, mono: boolean): Palette {
  const M: Record<Mood, Palette> = {
    night: { sky: ["#1a1c2e", "#33305a"], far: "#2b2b45", mid: "#232338", near: "#17171f", fg: "#0c0c12", accent: "#f4d58d", mono: false },
    sunset: { sky: ["#3d2645", "#c96f4a"], far: "#5a3a52", mid: "#3c2b40", near: "#241a28", fg: "#120c14", accent: "#ffd9a0", mono: false },
    dawn: { sky: ["#5a5a8a", "#e8b4b8"], far: "#7a759f", mid: "#544f77", near: "#332f4d", fg: "#1a1830", accent: "#ffe9e0", mono: false },
    storm: { sky: ["#2a2d34", "#4b5261"], far: "#3a3f49", mid: "#2c3038", near: "#1c1f26", fg: "#101216", accent: "#cfd8e3", mono: false },
    dark: { sky: ["#0d0e12", "#1f2027"], far: "#1a1b22", mid: "#131419", near: "#0b0c10", fg: "#060608", accent: "#8f9fb8", mono: false },
    bright: { sky: ["#7ec8e3", "#e8f4f8"], far: "#a8c8d8", mid: "#7aa8bc", near: "#4a7890", fg: "#1c2c34", accent: "#fff6d5", mono: false },
    day: { sky: ["#9db8d2", "#e6eef5"], far: "#8fa8c0", mid: "#6a86a0", near: "#42586e", fg: "#1a2530", accent: "#fff2cc", mono: false },
  };
  const p = { ...M[mood] };
  if (mono) {
    // Manga B/W: grayscale ramp, keep slight warm tint in highlights
    p.sky = mood === "dark" || mood === "night" ? ["#141414", "#3a3a3a"] : ["#d8d8d8", "#f4f4f4"];
    p.far = "#b8b8b8"; p.mid = "#7a7a7a"; p.near = "#3a3a3a"; p.fg = "#141414"; p.accent = "#ffffff";
  }
  return p;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function speedLines(rand: () => number, w: number, h: number, color: string, cx: number, cy: number, count: number, opacity: number): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const r0 = Math.min(w, h) * (0.28 + rand() * 0.3);
    const len = Math.min(w, h) * (0.3 + rand() * 0.55);
    const x1 = cx + Math.cos(angle) * r0, y1 = cy + Math.sin(angle) * r0;
    const x2 = cx + Math.cos(angle) * (r0 + len), y2 = cy + Math.sin(angle) * (r0 + len);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${(0.6 + rand() * 1.8).toFixed(1)}" opacity="${opacity}"/>`;
  }
  return out;
}

function skyline(rand: () => number, w: number, horizonY: number, color: string, scale: number, opacity: number): string {
  let x = -10;
  let out = `<g opacity="${opacity}">`;
  while (x < w + 10) {
    const bw = (18 + rand() * 46) * scale;
    const bh = (40 + rand() * 120) * scale;
    const y = horizonY - bh;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(bh + 10).toFixed(1)}" fill="${color}"/>`;
    // windows
    const cols = Math.max(1, Math.floor(bw / (8 * scale)));
    const rows = Math.max(1, Math.floor(bh / (14 * scale)));
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      if (rand() > 0.62) out += `<rect x="${(x + 4 * scale + c * 8 * scale).toFixed(1)}" y="${(y + 6 * scale + r * 14 * scale).toFixed(1)}" width="${(2.6 * scale).toFixed(1)}" height="${(4 * scale).toFixed(1)}" fill="${color}" stroke="rgba(255,255,255,0.25)" stroke-width="0.4"/>`;
    }
    // roof details
    if (rand() > 0.6) out += `<line x1="${(x + bw / 2).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + bw / 2).toFixed(1)}" y2="${(y - 10 * scale).toFixed(1)}" stroke="${color}" stroke-width="${1.4 * scale}"/>`;
    x += bw + rand() * 14 * scale;
  }
  return out + "</g>";
}

function trees(rand: () => number, w: number, horizonY: number, color: string, opacity: number): string {
  let out = `<g opacity="${opacity}" fill="${color}">`;
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const tx = rand() * w;
    const th = 60 + rand() * 90;
    out += `<rect x="${(tx - 2).toFixed(1)}" y="${(horizonY - th * 0.4).toFixed(1)}" width="4.5" height="${(th * 0.45).toFixed(1)}"/>`;
    for (let b = 0; b < 5; b++) {
      const r = 16 + rand() * 26;
      out += `<circle cx="${(tx + (rand() - 0.5) * 40).toFixed(1)}" cy="${(horizonY - th * 0.45 - rand() * 40).toFixed(1)}" r="${r.toFixed(1)}"/>`;
    }
  }
  return out + "</g>";
}

/** Stylized anime character silhouette. cy = head center y, s = head radius. */
function figure(rand: () => number, cx: number, cy: number, s: number, color: string, hairSpiky: boolean, flip: boolean): string {
  const f = flip ? -1 : 1;
  const head = `<circle cx="${cx}" cy="${cy}" r="${s}" fill="${color}"/>`;
  // hair: cap over head with spikes
  let hair = `<path d="M ${cx - s * 1.12} ${cy + s * 0.1} Q ${cx - s * 1.05} ${cy - s * 1.15} ${cx} ${cy - s * 1.2} Q ${cx + s * 1.05} ${cy - s * 1.15} ${cx + s * 1.12} ${cy + s * 0.1} `;
  if (hairSpiky) {
    hair += `L ${cx + s * (0.9 * f)} ${cy - s * 0.5} L ${cx + s * (0.55 * f)} ${cy - s * 0.95} L ${cx + s * (0.2 * f)} ${cy - s * 0.6} L ${cx - s * (0.2 * f)} ${cy - s * 1.0} L ${cx - s * (0.6 * f)} ${cy - s * 0.55} Z" fill="${color}"/>`;
  } else {
    hair += `Q ${cx + s * 0.9} ${cy - s * 1.45} ${cx - s * 0.2} ${cy - s * 1.35} Z" fill="${color}"/>`;
    hair += `<path d="M ${cx - s * 1.1} ${cy + s * 0.05} Q ${cx - s * 1.5} ${cy + s * 1.8} ${cx - s * 0.9} ${cy + s * 2.6} L ${cx - s * 0.55} ${cy + s * 1.2} Z" fill="${color}"/>`;
  }
  // eyes as highlight slits (negative space)
  const eyes = `<rect x="${cx - s * 0.52}" y="${cy + s * 0.02}" width="${s * 0.32}" height="${s * 0.12}" rx="${s * 0.06}" fill="rgba(255,255,255,0.85)"/><rect x="${cx + s * 0.2}" y="${cy + s * 0.02}" width="${s * 0.32}" height="${s * 0.12}" rx="${s * 0.06}" fill="rgba(255,255,255,0.85)"/>`;
  // shoulders / bust
  const body = `<path d="M ${cx - s * 2.1} ${cy + s * 4.6} Q ${cx - s * 1.9} ${cy + s * 2.0} ${cx - s * 0.7} ${cy + s * 1.55} L ${cx + s * 0.7} ${cy + s * 1.55} Q ${cx + s * 1.9} ${cy + s * 2.0} ${cx + s * 2.1} ${cy + s * 4.6} Z" fill="${color}"/>`;
  // collar highlight
  const collar = `<path d="M ${cx - s * 0.42} ${cy + s * 1.55} L ${cx} ${cy + s * 2.15} L ${cx + s * 0.42} ${cy + s * 1.55}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="${s * 0.09}"/>`;
  return head + hair + body + collar + eyes;
}

function runningFigure(rand: () => number, cx: number, cy: number, s: number, color: string): string {
  const legA = `<path d="M ${cx} ${cy + s * 0.6} L ${cx + s * 1.4} ${cy + s * 2.2} L ${cx + s * 1.1} ${cy + s * 3.4}" stroke="${color}" stroke-width="${s * 0.42}" fill="none" stroke-linecap="round"/>`;
  const legB = `<path d="M ${cx} ${cy + s * 0.6} L ${cx - s * 1.2} ${cy + s * 1.8} L ${cx - s * 2.0} ${cy + s * 2.6}" stroke="${color}" stroke-width="${s * 0.42}" fill="none" stroke-linecap="round"/>`;
  const torso = `<path d="M ${cx - s * 0.5} ${cy + s * 0.7} Q ${cx - s * 0.3} ${cy - s * 0.2} ${cx + s * 0.1} ${cy - s * 0.5} L ${cx + s * 0.5} ${cy + s * 0.4} Q ${cx} ${cy + s * 0.9} ${cx - s * 0.5} ${cy + s * 0.7} Z" fill="${color}"/>`;
  const armA = `<path d="M ${cx + s * 0.2} ${cy - s * 0.3} L ${cx + s * 1.6} ${cy - s * 1.1} L ${cx + s * 1.9} ${cy - s * 0.5}" stroke="${color}" stroke-width="${s * 0.34}" fill="none" stroke-linecap="round"/>`;
  const armB = `<path d="M ${cx} ${cy - s * 0.2} L ${cx - s * 1.3} ${cy + s * 0.5} L ${cx - s * 1.8} ${cy + s * 0.1}" stroke="${color}" stroke-width="${s * 0.34}" fill="none" stroke-linecap="round"/>`;
  const head = `<circle cx="${cx + s * 0.35}" cy="${cy - s * 1.15}" r="${s * 0.72}" fill="${color}"/>`;
  const hair = `<path d="M ${cx - s * 0.35} ${cy - s * 1.1} Q ${cx + s * 0.1} ${cy - s * 2.2} ${cx + s * 1.1} ${cy - s * 1.7} L ${cx + s * 0.7} ${cy - s * 1.15} Z" fill="${color}"/>`;
  return legA + legB + torso + armA + armB + head + hair;
}

function halftoneDefs(id: string, color: string): string {
  return `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.15" fill="${color}"/><circle cx="5.5" cy="5.5" r="1.15" fill="${color}"/></pattern>`;
}

export interface PanelArtInput {
  prompt: string;
  shot: string;
  camera: string;
  lighting: string;
  mood: string;
  effects: string;
  characterCount: number;
  hairColor?: string;
  environment?: string;
  mono: boolean;
  seed?: number | null;
  label?: string;
}

/** Generate a full manga panel as SVG markup. */
export function panelArt(input: PanelArtInput): { svg: string; seed: number } {
  const W = 800, H = Math.round(800 * (input.shot === "splash" ? 1.2 : 0.75));
  const seed = input.seed ?? hashSeed(input.prompt + input.shot + input.effects);
  const rand = mulberry32(seed);
  const text = `${input.prompt} ${input.shot} ${input.mood} ${input.effects} ${input.environment ?? ""}`.toLowerCase();
  const mood = detectMood(text);
  const pal = paletteFor(mood, input.mono);
  const horizon = H * (input.camera === "high" || input.camera === "overhead" ? 0.42 : 0.62);

  const defs = [
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.sky[0]}"/><stop offset="1" stop-color="${pal.sky[1]}"/></linearGradient>`,
    halftoneDefs("ht", input.mono ? "#111" : "#000"),
    halftoneDefs("htw", "rgba(255,255,255,0.5)"),
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${pal.accent}" stop-opacity="0.9"/><stop offset="1" stop-color="${pal.accent}" stop-opacity="0"/></radialGradient>`,
  ].join("");

  let body = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;

  // moon / sun
  if (mood === "night" || mood === "dark") {
    body += `<circle cx="${(W * 0.78).toFixed(0)}" cy="${(H * 0.2).toFixed(0)}" r="${H * 0.09}" fill="${pal.accent}" opacity="0.9"/><circle cx="${(W * 0.78).toFixed(0)}" cy="${(H * 0.2).toFixed(0)}" r="${H * 0.16}" fill="url(#glow)"/>`;
  } else if (mood === "sunset" || mood === "dawn") {
    body += `<circle cx="${(W * 0.3).toFixed(0)}" cy="${(horizon - H * 0.08).toFixed(0)}" r="${H * 0.11}" fill="#ffe9c9" opacity="0.95"/><circle cx="${(W * 0.3).toFixed(0)}" cy="${(horizon - H * 0.08).toFixed(0)}" r="${H * 0.24}" fill="url(#glow)"/>`;
  }

  // environment layers
  const interior = /interior|room|class|indoors|cafe|lab|library|hall/.test(text);
  if (interior) {
    // window frames + floor
    body += `<rect x="${W * 0.08}" y="${H * 0.12}" width="${W * 0.36}" height="${H * 0.42}" fill="${pal.mid}" opacity="0.55"/><rect x="${W * 0.08}" y="${H * 0.12}" width="${W * 0.36}" height="${H * 0.42}" fill="url(#htw)" opacity="0.25"/><line x1="${W * 0.26}" y1="${H * 0.12}" x2="${W * 0.26}" y2="${H * 0.54}" stroke="${pal.fg}" stroke-width="3"/><line x1="${W * 0.08}" y1="${H * 0.33}" x2="${W * 0.44}" y2="${H * 0.33}" stroke="${pal.fg}" stroke-width="3"/><rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="${pal.near}"/><line x1="0" y1="${horizon}" x2="${W}" y2="${horizon}" stroke="${pal.fg}" stroke-width="2.5"/>`;
    for (let i = 0; i < 5; i++) body += `<line x1="${(i * W / 4).toFixed(0)}" y1="${horizon}" x2="${(W / 2 + (i - 2) * W * 0.22).toFixed(0)}" y2="${H}" stroke="${pal.fg}" stroke-width="1" opacity="0.35"/>`;
  } else {
    body += skyline(rand, W, horizon, pal.far, 1, 0.85);
    body += skyline(rand, W, horizon, pal.mid, 1.35, 0.95);
    body += trees(rand, W, horizon, pal.near, 0.9);
    body += `<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="${pal.near}"/>`;
  }

  // rain / storm
  if (mood === "storm" || /rain/.test(text)) {
    for (let i = 0; i < 46; i++) {
      const rx = rand() * W, ry = rand() * H, l = 14 + rand() * 22;
      body += `<line x1="${rx.toFixed(0)}" y1="${ry.toFixed(0)}" x2="${(rx - l * 0.35).toFixed(0)}" y2="${(ry + l).toFixed(0)}" stroke="rgba(200,220,255,0.5)" stroke-width="1"/>`;
    }
  }

  // figures depend on shot
  const count = Math.max(0, Math.min(3, input.characterCount || 1));
  const hairSpiky = rand() > 0.5;
  const action = /run|dash|leap|jump|fight|attack|swing|charge|block|dodge|slash|punch/.test(text) || input.shot === "action";
  if (input.shot === "close-up" || input.shot === "extreme-close-up") {
    const s = input.shot === "extreme-close-up" ? H * 0.62 : H * 0.38;
    const cy = input.shot === "extreme-close-up" ? H * 0.42 : H * 0.52;
    body += figure(rand, W / 2, cy, s, pal.fg, hairSpiky, false);
    body += `<rect x="${W * 0.28}" y="${cy + s * 0.05}" width="${s * 0.62}" height="${s * 0.3}" fill="url(#ht)" opacity="0.12"/>`;
    // focus lines from edges
    body += speedLines(rand, W, H, input.mono ? "#fff" : pal.accent, W / 2, cy, 26, 0.25);
  } else if (action) {
    const s = H * 0.09;
    const cx = W * 0.42, cy = H * 0.48;
    body += runningFigure(rand, cx, cy, s, pal.fg);
    for (let i = 1; i < count; i++) body += runningFigure(rand, cx - i * W * 0.16, cy + i * H * 0.02, s * 0.85, pal.mid);
    body += speedLines(rand, W, H, input.mono ? "#111" : "#fff", cx, cy, 40, 0.5);
    body += `<polygon points="${cx - W * 0.06},${cy - s * 2.4} ${cx + W * 0.01},${cy - s * 1.7} ${cx - W * 0.02},${cy - s * 1.7} ${cx + W * 0.05},${cy - s * 3.1} ${cx - W * 0.01},${cy - s * 2.2} ${cx - W * 0.08},${cy - s * 2.2}" fill="#fff" opacity="0.9"/>`;
  } else if (input.shot === "establishing" || input.shot === "splash" || count === 0) {
    // crowd silhouettes small
    for (let i = 0; i < 6; i++) {
      const s = H * 0.028, cx = rand() * W, cy = horizon + (H - horizon) * (0.15 + rand() * 0.6);
      body += `<circle cx="${cx}" cy="${cy - s * 2.1}" r="${s}" fill="${pal.fg}"/><rect x="${(cx - s * 0.8).toFixed(1)}" y="${(cy - s * 1.1).toFixed(1)}" width="${(s * 1.6).toFixed(1)}" height="${(s * 2.2).toFixed(1)}" rx="${s * 0.5}" fill="${pal.fg}"/>`;
    }
  } else {
    // medium shots, 1-3 characters
    for (let i = 0; i < count; i++) {
      const s = H * (input.shot === "wide" ? 0.075 : 0.13);
      const cx = W * (count === 1 ? 0.5 : 0.32 + (i * 0.36)) + (rand() - 0.5) * 20;
      const cy = horizon - s * (input.camera === "low" ? 0.4 : 1.1);
      body += figure(rand, cx, cy, s, i === 0 ? pal.fg : pal.mid, rand() > 0.4, i % 2 === 1);
    }
  }

  // effects
  const fx = input.effects.toLowerCase();
  if (/speed/.test(fx) && !action) body += speedLines(rand, W, H, input.mono ? "#111" : "#fff", W / 2, H / 2, 24, 0.4);
  if (/spark|energy|magic|glow/.test(fx)) {
    for (let i = 0; i < 8; i++) {
      const sx = rand() * W, sy = rand() * H * 0.7, r = 2 + rand() * 5;
      body += `<path d="M ${sx} ${sy - r * 2} L ${sx + r * 0.5} ${sy - r * 0.5} L ${sx + r * 2} ${sy} L ${sx + r * 0.5} ${sy + r * 0.5} L ${sx} ${sy + r * 2} L ${sx - r * 0.5} ${sy + r * 0.5} L ${sx - r * 2} ${sy} L ${sx - r * 0.5} ${sy - r * 0.5} Z" fill="${pal.accent}" opacity="${0.5 + rand() * 0.5}"/>`;
    }
  }
  if (/smoke|dust|steam/.test(fx)) {
    for (let i = 0; i < 6; i++) {
      const sx = W * (0.15 + rand() * 0.7), sy = H * (0.55 + rand() * 0.35), r = 20 + rand() * 46;
      body += `<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="${r.toFixed(0)}" fill="${input.mono ? "#fff" : "#cfd4dc"}" opacity="0.16"/>`;
    }
  }
  if (/impact|explosion|burst/.test(fx)) {
    body += `<g transform="translate(${W / 2},${H * 0.45})">${speedLines(rand, W, H, input.mono ? "#111" : "#ffd166", 0, 0, 36, 0.6)}</g>`;
  }

  // halftone vignette
  body += `<rect width="${W}" height="${H}" fill="url(#ht)" opacity="0.05"/>`;
  body += `<rect width="${W}" height="${H}" fill="url(#htw)" opacity="0.04"/>`;

  // label chip
  const label = input.label || input.shot;
  const chipW = 12 + label.length * 7.2;
  body += `<g transform="translate(${W - chipW - 10},${H - 26})"><rect width="${chipW}" height="18" rx="4" fill="rgba(10,10,14,0.72)"/><text x="${chipW / 2}" y="12.5" font-family="monospace" font-size="9.5" fill="#fff" text-anchor="middle" letter-spacing="1">${esc(label.toUpperCase())} · #${String(seed).slice(0, 4)}</text></g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs>${body}<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="#0a0a0e" stroke-width="3"/></svg>`;
  return { svg, seed };
}

/** Character portrait SVG (bust) honoring hair color / gender-ish hints. */
export function portraitArt(opts: { name: string; hairColor?: string; hair?: string; eyes?: string; mono: boolean; seed?: number | null }): { svg: string; seed: number } {
  const W = 600, H = 760;
  const seed = opts.seed ?? hashSeed(opts.name + (opts.hairColor ?? "") + (opts.hair ?? ""));
  const rand = mulberry32(seed);
  const pal = paletteFor(detectMood(opts.hair + " " + opts.eyes), opts.mono);
  const HAIR_HEX: Record<string, string> = {
    black: "#17141a", brown: "#5a3a26", blonde: "#d9b45b", silver: "#cfd3dc", white: "#e8e8ee",
    red: "#a83232", crimson: "#8a1f2b", pink: "#d97ba0", blue: "#3a5a9a", green: "#3a7a52",
    purple: "#6a4a9a", orange: "#d97b3a", gray: "#8a8f99", grey: "#8a8f99", dark: "#1c1a22", azure: "#4a7ac2",
  };
  const hairColor = opts.mono
    ? "#1a1a1a"
    : opts.hairColor && HAIR_HEX[opts.hairColor]
      ? HAIR_HEX[opts.hairColor]
      : "#2a2a34";
  const longHair = /long|flowing|ponytail|twin/.test((opts.hair || "").toLowerCase());
  const spiky = /spik|short|messy|wild/.test((opts.hair || "").toLowerCase());
  const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.sky[0]}"/><stop offset="1" stop-color="${pal.sky[1]}"/></linearGradient>${halftoneDefs("htp", opts.mono ? "#111" : "#fff")}</defs>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
  body += `<circle cx="${W / 2}" cy="${H * 0.42}" r="${W * 0.34}" fill="url(#htp)" opacity="0.1"/>`;
  body += `<circle cx="${W / 2}" cy="${H * 0.34}" r="${W * 0.3}" fill="none" stroke="${pal.accent}" stroke-width="2" opacity="0.35"/>`;
  const cx = W / 2, cy = H * 0.44, s = W * 0.155;
  if (longHair) body += `<path d="M ${cx - s * 1.5} ${cy + s * 2.6} Q ${cx - s * 1.9} ${cy - s * 0.6} ${cx} ${cy - s * 1.28} Q ${cx + s * 1.9} ${cy - s * 0.6} ${cx + s * 1.5} ${cy + s * 2.6} Q ${cx + s * 0.6} ${cy + s * 1.7} ${cx} ${cy + s * 1.9} Q ${cx - s * 0.6} ${cy + s * 1.7} ${cx - s * 1.5} ${cy + s * 2.6} Z" fill="${hairColor}"/>`;
  // face
  body += `<ellipse cx="${cx}" cy="${cy}" rx="${s * 0.82}" ry="${s * 0.95}" fill="${opts.mono ? "#f2f2f0" : "#ffe8d5"}"/>`;
  // hair cap
  const capPath = spiky
    ? `M ${cx - s * 0.95} ${cy + s * 0.05} Q ${cx - s * 1.0} ${cy - s * 1.25} ${cx} ${cy - s * 1.22} Q ${cx + s * 1.0} ${cy - s * 1.25} ${cx + s * 0.95} ${cy + s * 0.05} L ${cx + s * 0.75} ${cy - s * 0.55} L ${cx + s * 0.45} ${cy - s * 0.85} L ${cx + s * 0.1} ${cy - s * 0.7} L ${cx - s * 0.25} ${cy - s * 0.95} L ${cx - s * 0.6} ${cy - s * 0.6} Z`
    : `M ${cx - s * 0.95} ${cy + s * 0.05} Q ${cx - s * 1.0} ${cy - s * 1.25} ${cx} ${cy - s * 1.22} Q ${cx + s * 1.0} ${cy - s * 1.25} ${cx + s * 0.95} ${cy + s * 0.05} Q ${cx + s * 0.7} ${cy - s * 1.05} ${cx - s * 0.3} ${cy - s * 1.0} Z`;
  body += `<path d="${capPath}" fill="${hairColor}"/>`;
  if (!spiky) {
    body += `<path d="M ${cx + s * 0.92} ${cy} Q ${cx + s * 1.15} ${cy + s * 0.7} ${cx + s * 0.7} ${cy + s * 0.95} L ${cx + s * 0.82} ${cy + s * 0.1} Z" fill="${hairColor}"/>`;
  }
  // eyes
  const eyeColor = opts.mono ? "#1a1a1a" : "#2a3550";
  body += `<path d="M ${cx - s * 0.55} ${cy + s * 0.05} Q ${cx - s * 0.35} ${cy - s * 0.12} ${cx - s * 0.15} ${cy + s * 0.05}" stroke="${eyeColor}" stroke-width="${s * 0.09}" fill="none"/><ellipse cx="${cx - s * 0.35}" cy="${cy + s * 0.22}" rx="${s * 0.16}" ry="${s * 0.2}" fill="${eyeColor}"/><ellipse cx="${cx - s * 0.35}" cy="${cy + s * 0.22}" rx="${s * 0.06}" ry="${s * 0.08}" fill="#fff"/>`;
  body += `<path d="M ${cx + s * 0.15} ${cy + s * 0.05} Q ${cx + s * 0.35} ${cy - s * 0.12} ${cx + s * 0.55} ${cy + s * 0.05}" stroke="${eyeColor}" stroke-width="${s * 0.09}" fill="none"/><ellipse cx="${cx + s * 0.35}" cy="${cy + s * 0.22}" rx="${s * 0.16}" ry="${s * 0.2}" fill="${eyeColor}"/><ellipse cx="${cx + s * 0.35}" cy="${cy + s * 0.22}" rx="${s * 0.06}" ry="${s * 0.08}" fill="#fff"/>`;
  // nose + mouth
  body += `<line x1="${cx}" y1="${cy + s * 0.38}" x2="${cx - s * 0.05}" y2="${cy + s * 0.5}" stroke="rgba(0,0,0,0.35)" stroke-width="${s * 0.05}"/>`;
  body += `<path d="M ${cx - s * 0.14} ${cy + s * 0.62} Q ${cx} ${cy + s * 0.7} ${cx + s * 0.14} ${cy + s * 0.62}" stroke="#7a3b3b" stroke-width="${s * 0.06}" fill="none"/>`;
  // shoulders + collar
  body += `<path d="M ${cx - s * 2.3} ${H} Q ${cx - s * 2.0} ${cy + s * 2.3} ${cx - s * 0.8} ${cy + s * 1.75} L ${cx + s * 0.8} ${cy + s * 1.75} Q ${cx + s * 2.0} ${cy + s * 2.3} ${cx + s * 2.3} ${H} Z" fill="${pal.fg}"/>`;
  body += `<path d="M ${cx - s * 0.5} ${cy + s * 1.75} L ${cx} ${cy + s * 2.45} L ${cx + s * 0.5} ${cy + s * 1.75} L ${cx + s * 0.3} ${cy + s * 1.7} L ${cx} ${cy + s * 2.2} L ${cx - s * 0.3} ${cy + s * 1.7} Z" fill="${opts.mono ? "#e8e8e4" : "#f4f2ee"}"/>`;
  body += `<rect width="${W}" height="${H}" fill="url(#htp)" opacity="0.05"/>`;
  body += `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="#0a0a0e" stroke-width="3"/>`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs>${body}</svg>`, seed };
}

/** Location thumbnail SVG. */
export function locationArt(opts: { name: string; description: string; environment: string; lighting: string; mono: boolean; seed?: number | null }): { svg: string; seed: number } {
  const fake: PanelArtInput = {
    prompt: `${opts.name} ${opts.description} ${opts.environment} ${opts.lighting}`,
    shot: "establishing",
    camera: "eye-level",
    lighting: opts.lighting,
    mood: opts.lighting + " " + opts.description,
    effects: "",
    characterCount: 0,
    environment: opts.environment,
    mono: opts.mono,
    seed: opts.seed,
    label: opts.name.slice(0, 14),
  };
  return panelArt(fake);
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
