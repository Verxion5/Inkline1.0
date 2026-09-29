// ─── Inkline shared types ────────────────────────────────────────────────────

export type ProjectFormat = "manga" | "manhwa" | "webtoon" | "comic";
export type ProjectMode = "manual" | "ai-assisted" | "storyboard" | "production";
export type ProjectStatus = "active" | "archived";
export type ChapterStatus = "planning" | "scripting" | "storyboard" | "in-progress" | "lettering" | "review" | "done";
export type PageStatus = "empty" | "draft" | "pencils" | "inked" | "lettered" | "done";
export type PanelStage = "planned" | "generated" | "approved";
export type ShotType = "establishing" | "wide" | "medium" | "close-up" | "extreme-close-up" | "over-the-shoulder" | "action" | "splash" | "insert";
export type CameraAngle = "eye-level" | "high" | "low" | "overhead" | "dutch" | "worms-eye";
export type BubbleKind = "speech" | "thought" | "narration" | "sfx" | "caption" | "whisper" | "shout";
export type ArtMode = "manga-bw" | "manga-gray" | "manhwa-color" | "sketch" | "lineart" | "cinematic" | "stylized" | "custom";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  prefs: UserPrefs;
  createdAt: string;
}

export interface UserPrefs {
  experienceMode: "beginner" | "advanced";
  defaultFormat: ProjectFormat;
  accent: "rose" | "violet" | "cyan";
  defaultArtMode: ArtMode;
}

export interface ProjectStyle {
  artMode: ArtMode;
  lineStyle: string;
  shading: string;
  rendering: string;
  backgroundStyle: string;
  mood: string;
  customNotes: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string;
  format: ProjectFormat;
  mode: ProjectMode;
  status: ProjectStatus;
  favorite: boolean;
  coverUrl: string | null;
  readingDirection: "rtl" | "ltr";
  pageSize: { w: number; h: number };
  gutter: number;
  borderWidth: number;
  style: ProjectStyle;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  role: string;
  age: string;
  description: string;
  personality: string;
  history: string;
  abilities: string;
  relationships: string;
  appearance: {
    hair: string;
    hairColor: string;
    eyes: string;
    build: string;
    clothing: string;
    features: string;
    accessories: string;
  };
  portraitUrl: string | null;
  tags: string[];
  status: "designing" | "final" | "evolved";
  changeLog: { date: string; note: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  projectId: string;
  name: string;
  description: string;
  architecture: string;
  environment: "interior" | "exterior" | "mixed";
  lighting: string;
  details: string;
  timeOfDay: string;
  weather: string;
  imageUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type AssetKind = "prop" | "vehicle" | "weapon" | "clothing" | "background" | "reference" | "effect" | "logo" | "panel" | "other";

export interface Asset {
  id: string;
  projectId: string;
  name: string;
  kind: AssetKind;
  description: string;
  imageUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type StoryKind = "premise" | "synopsis" | "note" | "event" | "thread" | "lore" | "theme" | "conflict" | "timeline";

export interface StoryBlock {
  id: string;
  projectId: string;
  kind: StoryKind;
  title: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string;
  status: ChapterStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  chapterId: string;
  projectId: string;
  number: number;
  title: string;
  description: string;
  locationId: string | null;
  characterIds: string[];
  script: string;
  objective: string;
  status: "outline" | "scripted" | "boarded" | "done";
  createdAt: string;
  updatedAt: string;
}

export interface Bubble {
  id: string;
  kind: BubbleKind;
  text: string;
  characterId: string | null;
  x: number; // % within panel
  y: number;
  w: number; // % width within panel
  align: "left" | "center" | "right";
  size: number; // font scale
  tail: "none" | "bl" | "br" | "tl" | "tr";
}

export interface Panel {
  id: string;
  pageId: string;
  projectId: string;
  sceneId: string | null;
  order: number;
  x: number; // % of page
  y: number;
  w: number;
  h: number;
  shape: "rect" | "splash" | "wide" | "tall" | "inset";
  prompt: string;
  description: string;
  characterIds: string[];
  locationId: string | null;
  shot: ShotType;
  camera: CameraAngle;
  expression: string;
  pose: string;
  lighting: string;
  mood: string;
  effects: string;
  focus: string;
  purpose: string;
  imageUrl: string | null;
  stage: PanelStage;
  seed: number | null;
  negativePrompt: string;
  bubbles: Bubble[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PanelVersion {
  id: string;
  panelId: string;
  imageUrl: string;
  prompt: string;
  seed: number | null;
  label: string;
  createdAt: string;
}

export interface Page {
  id: string;
  chapterId: string;
  projectId: string;
  number: number;
  title: string;
  status: PageStatus;
  template: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type GenerationKind = "panel" | "portrait" | "location" | "cover" | "asset";

export interface Generation {
  id: string;
  projectId: string;
  panelId: string | null;
  characterId: string | null;
  kind: GenerationKind;
  prompt: string;
  settings: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  resultUrl: string | null;
  resultSvg: string | null;
  seed: number | null;
  error: string | null;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  projectId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ProjectStats {
  chapters: number;
  scenes: number;
  pages: number;
  panels: number;
  panelsGenerated: number;
  characters: number;
  locations: number;
  assets: number;
  bubbles: number;
  generations: number;
  donePages: number;
}

export interface ContinuityIssue {
  id: string;
  severity: "error" | "warning" | "info";
  area: string;
  message: string;
  link?: string;
}

// ─── API payloads ────────────────────────────────────────────────────────────

export interface StoryboardSpec {
  description: string;
  shot: ShotType;
  camera: CameraAngle;
  expression: string;
  pose: string;
  lighting: string;
  mood: string;
  effects: string;
  purpose: string;
  characterNames: string[];
  size: "splash" | "large" | "medium" | "small" | "strip";
  dialogue: { character: string; text: string; kind: BubbleKind }[];
}
