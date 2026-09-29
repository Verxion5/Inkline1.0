import fs from "fs";
import path from "path";
import { get, run, rid, parseJson } from "./db";
import { hashPassword } from "./auth";
import { buildPanelPrompt } from "./ai";
import { panelArt } from "./art";
import type { Character, Location, ProjectStyle } from "./types";

const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

/** Use the static seed image if present; otherwise store procedural art and return its URL. */
function seedArt(projectId: string, staticPath: string, artOpts: Parameters<typeof panelArt>[0] & { prompt: string }): string {
  const abs = path.join(process.cwd(), "public", staticPath);
  if (fs.existsSync(abs)) return staticPath;
  const art = panelArt(artOpts);
  const genId = rid();
  run(`INSERT INTO generations (id,project_id,panel_id,character_id,kind,prompt,settings,status,result_url,result_svg,seed,error,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    genId, projectId, null, null, "panel", artOpts.prompt, JSON.stringify({ seed: art.seed, seeded: true }),
    "done", `/api/art/${genId}`, art.svg, art.seed, null, iso(1));
  return `/api/art/${genId}`;
}

function baseStyle(artMode: string, over: Partial<ProjectStyle> = {}): ProjectStyle {
  return {
    artMode: artMode as ProjectStyle["artMode"],
    lineStyle: "clean confident inking with weighted contours",
    shading: "screentone + hatching",
    rendering: "high-contrast",
    backgroundStyle: "detailed atmospheric",
    mood: "mysterious, heartfelt",
    customNotes: "",
    ...over,
  };
}

export function ensureSeeded(): void {
  const count = get<{ c: number }>("SELECT COUNT(*) as c FROM users");
  if (count && Number(count.c) > 0) return;
  seed();
}

function seed() {
  const userId = rid();
  run("INSERT INTO users (id, email, name, password_hash, prefs, created_at) VALUES (?,?,?,?,?,?)",
    userId, "demo@inkline.app", "Aiko Tanaka", hashPassword("inkline123"),
    JSON.stringify({ experienceMode: "beginner", defaultFormat: "manga", accent: "rose", defaultArtMode: "manga-bw" }), iso(30));

  seedCrimsonPetal(userId);
  seedNeonBloom(userId);
  seedStarDiver(userId);
}

function seedCrimsonPetal(userId: string) {
  const pid = rid();
  const style = baseStyle("manga-bw", { mood: "eerie beauty — festival lights over old ghosts" });
  run(`INSERT INTO projects (id,user_id,title,description,format,mode,status,favorite,cover_url,reading_direction,page_w,page_h,gutter,border_width,style,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    pid, userId, "Crimson Petal",
    "A supernatural manga about Yuki, a shrine keeper's daughter who discovers the lanterns of her city guide more than light — they guide the dead. One spirit has been waiting for her.",
    "manga", "ai-assisted", "active", 1, "/seed/cover-crimson.jpg", "rtl", 1000, 1414, 1.5, 0.55,
    JSON.stringify(style), iso(21), iso(0.05));

  // ── Story blocks ──
  const blocks: [string, string, string, number][] = [
    ["premise", "Story Premise", "In Hakurai City, paper lanterns are released each year to guide the dead home. Yuki Hara, 17, has kept her family's shrine since her mother vanished. This year, one lantern refuses to float away — and the boy trapped inside it remembers her name.", 0],
    ["synopsis", "Synopsis", "Ch1: The Lantern Festival — Yuki meets Ren, a spirit bound to a crimson lantern. Ch2: Whispers in the Dark — the Fox-masked man begins hunting stray spirits; Sora the cat spirit warns Yuki. Ch3: The Pact — Yuki learns her mother's disappearance is tied to the Lantern Pact.", 1],
    ["lore", "Lore — The Lantern Pact", "Every 60 years, the shrine must renew the Lantern Pact: a living keeper binds one great spirit to a crimson lantern to keep the boundary between worlds closed. Breaking the pact lets the 'hungry dark' through.", 2],
    ["event", "Key Event — The Vanishing", "Ten years ago, Yuki's mother Koharu disappeared during the festival. No body was found. Only her sandalled footsteps, leading into the river mist.", 3],
    ["thread", "Plot thread — The Fox Mask", "A man in a fox mask appears in every festival photograph since 1966. He is never the same height twice.", 4],
    ["note", "Visual notes", "Motif: petals that drift upward instead of down. Yuki's hair ribbon turns crimson after Ch2 — continuity flag for later chapters.", 5],
  ];
  blocks.forEach(([kind, title, content, order]) => {
    run("INSERT INTO story_blocks (id,project_id,kind,title,content,order_num,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
      rid(), pid, kind, title, content, order, iso(20), iso(6));
  });

  // ── Characters ──
  const yuki = rid(), ren = rid(), kaede = rid(), sora = rid();
  const chars: Array<[string, string, string, string, string, string, string, Record<string, string>, string, string[], string, string]> = [
    [yuki, "Yuki Hara", "protagonist", "17",
      "The shrine keeper's daughter. Practical, stubborn, quietly brave — she talks to spirits like they're stubborn customers.",
      "Guarded but warm. Dries her tears before anyone can see. Cannot leave a problem unsolved overnight.",
      "Raised inside the shrine walls after her mother vanished. Knows every ritual, fears none of the ghosts — except the polite ones.",
      { hair: "long, straight with blunt bangs", hairColor: "silver", eyes: "large amber, faintly glowing at night", build: "slight, 158cm", clothing: "white shrine maiden robe with crimson hakama, red ribbon", features: "small mole under left eye; mother's pendant", accessories: "ofuda charms tucked in sleeve" },
      "/seed/char-yuki.jpg", ["lead", "shrine"], "final",
      "Cast as the quiet center of the story. Ribbon turns crimson after Chapter 2."],
    [ren, "Ren Kurosawa", "deuteragonist", "18 (appears)",
      "A spirit bound to a crimson lantern for sixty years. Dry humor, old-fashioned manners, and a temper that lights lanterns unattended.",
      "Sarcastic shield for a very old grief. Keeps apologizing for things from 1966.",
      "A student who never made it home from the festival of 1966. Bound by the Pact. Does not remember who bound him.",
      { hair: "short, messy, wind-touched", hairColor: "black", eyes: "dark red, reflective like lantern paper", build: "tall, lean", clothing: "1966 gakuran school uniform, faded; sleeves rolled", features: "faint paper-crease scars across cheek", accessories: "broken watch stopped at 8:14" },
      "/seed/char-ren.jpg", ["lead", "spirit"], "final",
      "Eyes must always catch light like paper. No reflections in mirrors — artists note!"],
    [kaede, "Kaede", "antagonist", "?",
      "The Fox-masked man. Polite, patient, and utterly wrong in the way a smiling mask is wrong.",
      "Unhurried. Speaks like a landlord reminding tenants of rent.",
      "Appears in festival photos since 1966. Height varies. Possibly not one being.",
      { hair: "pale, shoulder-length under the mask", hairColor: "white", eyes: "unblinking fox mask — amber slits", build: "changes between appearances", clothing: "dark kimono, fox mask, tabi socks", features: "the mask never shows a mouth", accessories: "iron bell that makes no sound" },
      "/seed/char-kaede.jpg", ["antagonist", "mystery"], "designing",
      "Keep the mask's proportions subtly wrong in every panel — uncanny valley effect."],
    [sora, "Sora", "sidekick", "ancient",
      "A small cat spirit with two tails and a talent for appearing exactly when food does. Secretly the shrine's oldest guardian.",
      "Bossy, food-motivated, loyal to the bone.",
      "Has guarded the shrine since it was a single pillar. Knew Yuki's grandmother.",
      { hair: "fluffy white fur", hairColor: "white", eyes: "sky blue, slitted", build: "small, round", clothing: "tiny bell collar (cracked)", features: "two tails; left ear notched", accessories: "cracked bell collar" },
      "/seed/char-sora.jpg", ["mascot", "spirit"], "final",
      "Comic relief anchor — but the notch in the ear is a plot point in Ch5."],
  ];
  chars.forEach(([id, name, role, age, description, personality, history, appearance, portrait, tags, status, note]) => {
    run(`INSERT INTO characters (id,project_id,name,role,age,description,personality,history,abilities,relationships,appearance,portrait_url,tags,status,change_log,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, pid, name, role, age, description, personality, history,
      name === "Yuki Hara" ? "Can see spirit threads; learns lantern-binding rituals" : name === "Sora" ? "Spirit-sensing, boundary-walking" : "",
      name === "Yuki Hara" ? "Mother: Koharu (missing). Bound to Ren by an accidental pact." : name === "Ren Kurosawa" ? "Bound to Yuki. Distrusts Kaede." : name === "Kaede" ? "Hunts Ren. Knows Koharu." : "Guardian of Yuki's family for generations",
      JSON.stringify(appearance), portrait, JSON.stringify(tags), status,
      JSON.stringify([{ date: iso(14).slice(0, 10), note }]), iso(18), iso(2));
  });

  // ── Locations ──
  const shrineStreet = rid(), rooftop = rid();
  const locs: Array<[string, string, string, string, string, string, string, string, string, string[]]> = [
    [shrineStreet, "Hakurai Shrine Street", "A stone approach road lined with food stalls and paper lanterns, climbing toward the old shrine. Crowded by day, echoing by night.",
      "Wooden merchant facades, stone steps, torii gate", "exterior", "warm lantern glow against deep blue night", "Lantern strings cross the whole street; petals drift upward here.",
      "night", "clear", ["recurring", "festival"]],
    [rooftop, "Seiran Academy Rooftop", "The school rooftop where the fence has a Yuki-sized gap. The whole city spreads out below — including the shrine hill.",
      "Chain-link fence, water tower, concrete", "exterior", "sunset gold spilling over the city", "Wind is always stronger here. Ren's lantern glows brighter.",
      "sunset", "windy", ["recurring", "school"]],
  ];
  locs.forEach(([id, name, description, architecture, environment, lighting, details, tod, weather, tags]) => {
    run(`INSERT INTO locations (id,project_id,name,description,architecture,environment,lighting,details,time_of_day,weather,image_url,tags,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, pid, name, description, architecture, environment, lighting, details, tod, weather,
      id === shrineStreet ? "/seed/loc-shrine.jpg" : "/seed/loc-rooftop.jpg",
      JSON.stringify(tags), iso(17), iso(3));
  });

  // ── Assets ──
  const assets: Array<[string, string, string, string | null, string[]]> = [
    ["Fox Mask", "prop", "Kaede's mask. Amber slits, no mouth. Never draw it at the same angle twice.", null, ["antagonist", "recurring"]],
    ["Crimson Lantern", "prop", "Ren's prison. Paper glows from inside; characters' names appear on it in old ink.", null, ["key-item"]],
    ["SFX Pack — Impact", "effect", "DOSHIN / GAKIIIN / ZUSHAA — hand-lettered impact set for action pages.", null, ["sfx"]],
  ];
  assets.forEach(([name, kind, description, img, tags]) => {
    run("INSERT INTO assets (id,project_id,name,kind,description,image_url,tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      rid(), pid, name, kind, description, img, JSON.stringify(tags), iso(12), iso(12));
  });

  // ── Chapter 1 + scene + pages/panels ──
  const ch1 = rid();
  run("INSERT INTO chapters (id,project_id,number,title,description,status,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ch1, pid, 1, "The Lantern Festival", "Yuki works the festival night. A lantern refuses to leave.", "in-progress", 0, iso(15), iso(0.2));

  const sc1 = rid();
  run(`INSERT INTO scenes (id,chapter_id,project_id,number,title,description,location_id,character_ids,script,objective,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sc1, ch1, pid, 1, "Festival Streets", "Yuki works the stall row; the last lantern won't float away.",
    shrineStreet, JSON.stringify([yuki, sora]),
    `EXT. HAKRAI SHRINE STREET - NIGHT

The street roars with festival light. Hundreds of paper lanterns drift upward like slow fireworks.

YUKI (weary smile): Two hundred sixteen... two hundred seventeen. Last one.

She lifts the final lantern — crimson, older than the others.

The crowd noise fades. The lantern does not rise. It leans toward her, gently, like a listener.

YUKI (startled): ...You're supposed to go UP.

Behind her, high on the shrine steps, a fox mask catches the light.

SFX: kln...

Sora materializes on the stall roof, tails lashing.

SORA (sharp whisper): Yuki. Do NOT touch it again.`,
    "Introduce Yuki's world + the hook: Ren's lantern.", "scripted", iso(14), iso(1));

  const page1 = rid();
  run("INSERT INTO pages (id,chapter_id,project_id,number,title,status,template,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    page1, ch1, pid, 1, "The festival opens", "lettered", "dynamic-6", "Splash top panel for scope. Keep crowd silhouettes abstract.", iso(10), iso(0.3));

  const mkPanel = (targetPageId: string, o: {
    order: number; x: number; y: number; w: number; h: number; prompt: string; description: string;
    characterIds?: string[]; locationId?: string | null; shot: string; camera: string; expression?: string;
    pose?: string; lighting?: string; mood?: string; effects?: string; purpose?: string; imageUrl?: string | null;
    stage?: "planned" | "generated" | "approved"; seed?: number; bubbles?: unknown[];
  }) => {
    const id = rid();
    run(`INSERT INTO panels (id,page_id,project_id,scene_id,order_num,x,y,w,h,shape,prompt,description,character_ids,location_id,shot,camera,expression,pose,lighting,mood,effects,focus,purpose,image_url,stage,seed,negative_prompt,bubbles,notes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, targetPageId, pid, sc1, o.order, o.x, o.y, o.w, o.h, o.shot === "splash" ? "splash" : "rect", o.prompt, o.description,
      JSON.stringify(o.characterIds ?? []), o.locationId ?? null, o.shot, o.camera, o.expression ?? "", o.pose ?? "",
      o.lighting ?? "", o.mood ?? "", o.effects ?? "", "", o.purpose ?? "", o.imageUrl ?? null, o.stage ?? "planned",
      o.seed ?? null, "text, watermark, blurry, extra fingers", JSON.stringify(o.bubbles ?? []), "", iso(10), iso(0.3));
    return id;
  };

  const yukiChar = get<Record<string, unknown>>("SELECT * FROM characters WHERE id = ?", yuki);
  const renChar = get<Record<string, unknown>>("SELECT * FROM characters WHERE id = ?", ren);
  const locStreet = get<Record<string, unknown>>("SELECT * FROM locations WHERE id = ?", shrineStreet);
  const asChar = (r: Record<string, unknown> | null): Character => ({
    id: r!.id as string, projectId: pid, name: r!.name as string, role: r!.role as string, age: r!.age as string,
    description: r!.description as string, personality: r!.personality as string, history: r!.history as string,
    abilities: r!.abilities as string, relationships: r!.relationships as string,
    appearance: parseJson(r!.appearance, {} as Character["appearance"]), portraitUrl: r!.portrait_url as string | null,
    tags: parseJson(r!.tags, []), status: r!.status as Character["status"], changeLog: parseJson(r!.change_log, []),
    createdAt: r!.created_at as string, updatedAt: r!.updated_at as string,
  });
  const asLoc = (r: Record<string, unknown>) => ({
    id: r.id as string, projectId: pid, name: r.name as string, description: r.description as string,
    architecture: r.architecture as string, environment: r.environment as Location["environment"],
    lighting: r.lighting as string, details: r.details as string, timeOfDay: r.time_of_day as string,
    weather: r.weather as string, imageUrl: r.image_url as string | null, tags: parseJson(r.tags, []),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  });

  const p1prompt = buildPanelPrompt({
    project: { style } as never, characters: [], location: asLoc(locStreet!),
    description: "the festival street packed with drifting lanterns, crowd as distant silhouettes", shot: "establishing", camera: "high",
    lighting: "hundreds of warm lantern points against deep blue night", mood: "wonder with an undertow of unease", effects: "petals drifting upward",
  });
  const imgStreet = seedArt(pid, "/seed/panel-street.jpg", {
    prompt: p1prompt, shot: "establishing", camera: "high", lighting: "hundreds of lanterns festival night",
    mood: "wonder", effects: "rising petals", characterCount: 0, environment: "exterior", mono: true, seed: 1101, label: "establishing",
  });
  mkPanel(page1, {
    order: 1, x: 0, y: 0, w: 100, h: 30, prompt: p1prompt, description: "Establishing: Hakurai Shrine Street flooded with rising lanterns.",
    locationId: shrineStreet, shot: "establishing", camera: "high", lighting: "lantern glow", mood: "wonder",
    effects: "rising petals", purpose: "establishing", imageUrl: imgStreet, stage: "approved", seed: 1101,
    bubbles: [{ id: rid(), kind: "narration", text: "Every year on this night, Hakurai City lets its dead go home by lantern light.", characterId: null, x: 5, y: 6, w: 46, align: "left", size: 1, tail: "none" }],
  });
  const p2prompt = buildPanelPrompt({
    project: { style } as never, characters: [asChar(yukiChar)], location: asLoc(locStreet!),
    description: "Yuki at the stall counter counts lanterns, weary small smile", shot: "medium", camera: "eye-level",
    expression: "weary, fond smile", pose: "leaning on the stall counter, chin on hand",
    lighting: "lantern underlight from below", mood: "end-of-shift tired", effects: "",
  });
  const imgYuki = seedArt(pid, "/seed/panel-yuki.jpg", {
    prompt: p2prompt, shot: "medium", camera: "eye-level", lighting: "lantern underlight",
    mood: "end of shift", effects: "", characterCount: 1, hairColor: "silver", mono: true, seed: 1102, label: "medium",
  });
  mkPanel(page1, {
    order: 2, x: 51.5, y: 31.5, w: 48.5, h: 30, prompt: p2prompt, description: "Yuki counts the last lanterns at the family stall.",
    characterIds: [yuki], locationId: shrineStreet, shot: "medium", camera: "eye-level", expression: "weary smile",
    pose: "leaning on counter", lighting: "lantern underlight", purpose: "dialogue beat", imageUrl: imgYuki, stage: "approved", seed: 1102,
    bubbles: [{ id: rid(), kind: "speech", text: "Two hundred sixteen... two hundred seventeen. Last one.", characterId: yuki, x: 6, y: 8, w: 60, align: "left", size: 1, tail: "bl" }],
  });
  const p3prompt = buildPanelPrompt({
    project: { style } as never, characters: [asChar(yukiChar)], location: asLoc(locStreet!),
    description: "close-up: the final lantern is crimson and ancient; it leans toward Yuki's hand", shot: "close-up", camera: "low",
    expression: "wide-eyed startle", lighting: "the lantern glows from inside, lighting her face from below",
    mood: "hush", effects: "faint glow particles",
  });
  const imgLantern = seedArt(pid, "/seed/panel-lantern.jpg", {
    prompt: p3prompt, shot: "close-up", camera: "low", lighting: "glow from within",
    mood: "hush", effects: "glow particles", characterCount: 1, hairColor: "silver", mono: true, seed: 1103, label: "close-up",
  });
  mkPanel(page1, {
    order: 3, x: 0, y: 31.5, w: 50, h: 30, prompt: p3prompt, description: "The last lantern leans toward her like a listener.",
    characterIds: [yuki], locationId: shrineStreet, shot: "close-up", camera: "low", expression: "startled",
    lighting: "glow from below", mood: "hush", purpose: "reveal", imageUrl: imgLantern, stage: "approved", seed: 1103,
    bubbles: [{ id: rid(), kind: "speech", text: "...You're supposed to go UP.", characterId: yuki, x: 50, y: 8, w: 44, align: "left", size: 1, tail: "br" }],
  });
  const p4prompt = buildPanelPrompt({
    project: { style } as never, characters: [asChar(yukiChar), asChar(renChar)], location: asLoc(locStreet!),
    description: "the crowd parts around Yuki; the crimson lantern floats at her shoulder; a fox mask watches from the shrine steps far above",
    shot: "wide", camera: "dutch", expression: "", pose: "", lighting: "one crimson light among gold", mood: "dread blooms under beauty",
    effects: "crowd bokeh, upward petals",
  });
  const imgWatch = seedArt(pid, "/seed/panel-watch.jpg", {
    prompt: p4prompt, shot: "wide", camera: "high", lighting: "one crimson light among gold",
    mood: "dread under beauty", effects: "bokeh crowd", characterCount: 2, hairColor: "silver", mono: true, seed: 1104, label: "wide",
  });
  mkPanel(page1, {
    order: 4, x: 0, y: 63, w: 100, h: 37, prompt: p4prompt, description: "The crowd noise fades. The lantern stays. Something watches from the steps.",
    characterIds: [yuki, ren], locationId: shrineStreet, shot: "wide", camera: "dutch", mood: "dread under beauty",
    effects: "bokeh crowd", purpose: "act break", imageUrl: imgWatch, stage: "approved", seed: 1104,
    bubbles: [
      { id: rid(), kind: "sfx", text: "kln...", characterId: null, x: 8, y: 62, w: 26, align: "center", size: 1.4, tail: "none" },
      { id: rid(), kind: "speech", text: "Yuki. Do NOT touch it again.", characterId: sora, x: 62, y: 8, w: 34, align: "left", size: 0.9, tail: "tl" },
    ],
  });

  // Page 2 — partially generated (invites the user to finish generating)
  const page2 = rid();
  run("INSERT INTO pages (id,chapter_id,project_id,number,title,status,template,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    page2, ch1, pid, 2, "The lantern stays", "draft", "classic-4", "Two panels still to generate — try the panel engine!", iso(9), iso(0.1));
  const mkPanel2 = (o: Parameters<typeof mkPanel>[1]) => mkPanel(page2, o);
  const gen1 = panelArt({
    prompt: "close-up of a crimson paper lantern leaning toward a girl's outstretched fingers, crowd bokeh", shot: "close-up",
    camera: "eye-level", lighting: "glow from within", mood: "hush", effects: "glow particles", characterCount: 1, mono: true, seed: 4211, label: "close-up",
  });
  run("INSERT INTO generations (id,project_id,panel_id,character_id,kind,prompt,settings,status,result_url,result_svg,seed,error,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    rid(), pid, null, null, "panel", "close-up of a crimson paper lantern leaning toward a girl's outstretched fingers, crowd bokeh | black and white manga ink illustration",
    JSON.stringify({ shot: "close-up", seed: gen1.seed }), "done", null, gen1.svg, gen1.seed, null, iso(0.6));
  mkPanel2({
    order: 1, x: 0, y: 0, w: 100, h: 32, prompt: "The moment the lantern touches her fingertips — everything goes silent.",
    description: "Fingertips touch the paper. Silence.", characterIds: [yuki], locationId: shrineStreet,
    shot: "extreme-close-up", camera: "eye-level", expression: "breath held", lighting: "crimson inner glow on fingers",
    purpose: "punctuation", imageUrl: null, stage: "generated",
  });
  const gen2 = panelArt({
    prompt: "Sora the two-tailed cat spirit lands on a festival stall roof, tails lashing, warning", shot: "medium",
    camera: "low", lighting: "lantern light", mood: "urgent", effects: "dust puff", characterCount: 1, mono: true, seed: 4212, label: "medium",
  });
  mkPanel2({
    order: 2, x: 0, y: 33.5, w: 42, h: 30, prompt: "Sora lands on the stall roof, tails lashing.",
    description: "Sora arrives, furious and scared.", characterIds: [sora], locationId: shrineStreet,
    shot: "medium", camera: "low", expression: "sharp warning", purpose: "reaction", imageUrl: null, stage: "generated",
  });
  mkPanel2({
    order: 3, x: 43.5, y: 33.5, w: 56.5, h: 30,
    prompt: "Ren steps out of the lantern light for the first time in sixty years — school uniform, stopped watch, polite bow.",
    description: "Ren introduces himself. Old-fashioned manners.", characterIds: [ren], locationId: shrineStreet,
    shot: "medium", camera: "eye-level", expression: "polite, tired smile", pose: "formal bow, hand on chest",
    lighting: "crimson glow behind him", purpose: "character intro",
  });
  mkPanel2({
    order: 4, x: 0, y: 65, w: 100, h: 35,
    prompt: "Wide shot: Yuki and Ren face each other in the empty street as the last lanterns rise; the fox mask is gone from the steps.",
    description: "They face each other. The watcher is gone.", characterIds: [yuki, ren], locationId: shrineStreet,
    shot: "wide", camera: "high", mood: "two people, one secret", purpose: "act break",
  });

  // Generation history for the real seed images
  const histPrompt = buildPanelPrompt({
    project: { style } as never, characters: [asChar(yukiChar)], location: asLoc(locStreet!),
    description: "Yuki lifts the final lantern — crimson, ancient, leaning toward her hand", shot: "close-up", camera: "low",
    expression: "wide-eyed startle", lighting: "glow from within the lantern", effects: "glow particles",
  });
  void histPrompt;

  // ── Chapter 2 (planning, no pages yet) ──
  const ch2 = rid();
  run("INSERT INTO chapters (id,project_id,number,title,description,status,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ch2, pid, 2, "Whispers in the Dark", "The fox mask starts hunting stray spirits. Sora tells Yuki about the Pact.", "planning", 0, iso(8), iso(2));
  run(`INSERT INTO scenes (id,chapter_id,project_id,number,title,description,location_id,character_ids,script,objective,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    rid(), ch2, pid, 1, "Rooftop Warning", "Sora explains the Lantern Pact on the school rooftop.",
    rooftop, JSON.stringify([yuki, sora]),
    `EXT. SEIRAN ACADEMY ROOFTOP - SUNSET

The city glows gold. Yuki sits on the fence line like it's a curb.

SORA: Sixty years, kid. That's the rent on this city, and your family has always been the collectors.

YUKI (quiet): And if the collector skips a payment?

Sora doesn't blink. Somewhere below, a fox mask turns toward the roof.`,
    "Deliver Pact lore without a lecture. End on Kaede noticing.", "outline", iso(7), iso(7));

  // ── Assistant history ──
  run("INSERT INTO assistant_messages (id,project_id,role,content,created_at) VALUES (?,?,?,?,?)",
    rid(), pid, "user", "What should I do next with chapter 1?", iso(0.9));
  run("INSERT INTO assistant_messages (id,project_id,role,content,created_at) VALUES (?,?,?,?,?)",
    rid(), pid, "assistant",
    "Chapter 1 is close! Page 2 still has 2 planned panels without artwork — open the Studio and generate them (Ren's intro panel is the emotional beat, take your time with his pose).\n\nAfter that, I'd letter panel 3–4, set the page status to **lettered**, and run a continuity pass before exporting the chapter preview.",
    iso(0.89));

  void page2;
}

function seedNeonBloom(userId: string) {
  const pid = rid();
  run(`INSERT INTO projects (id,user_id,title,description,format,mode,status,favorite,cover_url,reading_direction,page_w,page_h,gutter,border_width,style,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    pid, userId, "Neon Bloom",
    "Full-color vertical-scroll manhwa: a florist in a rain-soaked megacity discovers her hybrid flowers bloom into monsters — or miracles.",
    "manhwa", "storyboard", "active", 0, "/seed/cover-neon.jpg", "ltr", 800, 1280, 1, 0.35,
    JSON.stringify(baseStyle("manhwa-color", { shading: "soft cel", rendering: "vibrant neon-lit", backgroundStyle: "detailed cyberpunk city", mood: "lush, electric, lonely" })),
    iso(5), iso(0.4));

  run("INSERT INTO story_blocks (id,project_id,kind,title,content,order_num,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
    rid(), pid, "premise", "Story Premise", "Mira's flower shop survives in the megacity's shadow because her hybrids shouldn't exist. When one blooms into something with a heartbeat, Jun — corporate courier and terrible liar — becomes the only person she can trust. Or the one person paid to watch her.", 0, iso(5), iso(5));

  const mira = rid(), jun = rid();
  const chars: Array<[string, string, string, string, string, Record<string, string>, string, string]> = [
    [mira, "Mira Park", "protagonist", "24", "Florist. Sweatshirt with rolled sleeves, pruning shears on a belt loop, permanently green-thumbed.",
      { hair: "wavy bob, chin length", hairColor: "pink", eyes: "dark brown, bright", build: "compact, strong hands", clothing: "olive sweatshirt, work apron, shears", features: "leaf-shaped birthmark on wrist", accessories: "wire bracelet (her grandmother's)" },
      "/seed/char-mira.jpg", "final"],
    [jun, "Jun Seo", "deuteragonist", "26", "Courier with a corporate leash. Fast talker, faster runner, allergic to honesty until it matters.",
      { hair: "undercut, pushed back", hairColor: "black, blue sheen", eyes: "grey", build: "long-limbed runner", clothing: "techwear jacket, courier visor around neck", features: "corporate tattoo behind ear", accessories: "delivery drone 'Pod'" },
      "/seed/char-jun.jpg", "designing"],
  ];
  chars.forEach(([id, name, role, age, description, appearance, portrait, status]) => {
    run(`INSERT INTO characters (id,project_id,name,role,age,description,personality,history,abilities,relationships,appearance,portrait_url,tags,status,change_log,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, pid, name, role, age, description, role === "protagonist" ? "Dry humor, endless patience with plants, none with people" : "Charming deflector, secretly dutiful", "", "", "",
      JSON.stringify(appearance), portrait, JSON.stringify([role === "protagonist" ? "lead" : "lead", "neon-city"]), status,
      JSON.stringify([]), iso(4), iso(1));
  });
}

function seedStarDiver(userId: string) {
  const pid = rid();
  run(`INSERT INTO projects (id,user_id,title,description,format,mode,status,favorite,cover_url,reading_direction,page_w,page_h,gutter,border_width,style,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    pid, userId, "Star Diver (pilot)",
    "Sci-fi comic pilot — a salvage diver hears a distress call in a dead star system. Shelved while Crimson Petal is in production.",
    "comic", "manual", "archived", 0, null, "ltr", 1000, 1414, 1.5, 0.55,
    JSON.stringify(baseStyle("cinematic", { mood: "vast, silent, hopeful" })), iso(60), iso(25));
  run("INSERT INTO story_blocks (id,project_id,kind,title,content,order_num,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
    rid(), pid, "premise", "Story Premise", "Every diver knows the Silence: no signals, ever. When Raqi catches one on a dead frequency, answering it means going past the last buoy — and past every rule that kept divers alive.", 0, iso(60), iso(60));
}
