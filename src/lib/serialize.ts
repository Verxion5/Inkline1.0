import { parseJson } from "./db";
import type {
  Asset, Chapter, Character, Generation, Location, Panel, PanelVersion, Page,
  Project, ProjectStyle, Scene, StoryBlock, AssistantMessage,
} from "./types";

type Row = Record<string, unknown>;

export const toProject = (r: Row): Project => ({
  id: r.id as string,
  userId: r.user_id as string,
  title: r.title as string,
  description: (r.description as string) ?? "",
  format: r.format as Project["format"],
  mode: r.mode as Project["mode"],
  status: r.status as Project["status"],
  favorite: !!r.favorite,
  coverUrl: (r.cover_url as string) ?? null,
  readingDirection: (r.reading_direction as "rtl" | "ltr") ?? "rtl",
  pageSize: { w: Number(r.page_w ?? 1000), h: Number(r.page_h ?? 1414) },
  gutter: Number(r.gutter ?? 1.5),
  borderWidth: Number(r.border_width ?? 0.55),
  style: {
    artMode: "manga-bw", lineStyle: "", shading: "", rendering: "", backgroundStyle: "", mood: "", customNotes: "",
    ...parseJson<Partial<ProjectStyle>>(r.style, {}),
  },
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toCharacter = (r: Row): Character => ({
  id: r.id as string,
  projectId: r.project_id as string,
  name: r.name as string,
  role: r.role as string,
  age: (r.age as string) ?? "",
  description: (r.description as string) ?? "",
  personality: (r.personality as string) ?? "",
  history: (r.history as string) ?? "",
  abilities: (r.abilities as string) ?? "",
  relationships: (r.relationships as string) ?? "",
  appearance: parseJson(r.appearance, { hair: "", hairColor: "", eyes: "", build: "", clothing: "", features: "", accessories: "" }),
  portraitUrl: (r.portrait_url as string) ?? null,
  tags: parseJson<string[]>(r.tags, []),
  status: r.status as Character["status"],
  changeLog: parseJson<Character["changeLog"]>(r.change_log, []),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toLocation = (r: Row): Location => ({
  id: r.id as string,
  projectId: r.project_id as string,
  name: r.name as string,
  description: (r.description as string) ?? "",
  architecture: (r.architecture as string) ?? "",
  environment: r.environment as Location["environment"],
  lighting: (r.lighting as string) ?? "",
  details: (r.details as string) ?? "",
  timeOfDay: (r.time_of_day as string) ?? "",
  weather: (r.weather as string) ?? "",
  imageUrl: (r.image_url as string) ?? null,
  tags: parseJson<string[]>(r.tags, []),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toAsset = (r: Row): Asset => ({
  id: r.id as string,
  projectId: r.project_id as string,
  name: r.name as string,
  kind: r.kind as Asset["kind"],
  description: (r.description as string) ?? "",
  imageUrl: (r.image_url as string) ?? null,
  tags: parseJson<string[]>(r.tags, []),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toStoryBlock = (r: Row): StoryBlock => ({
  id: r.id as string,
  projectId: r.project_id as string,
  kind: r.kind as StoryBlock["kind"],
  title: (r.title as string) ?? "",
  content: (r.content as string) ?? "",
  order: Number(r.order_num ?? 0),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toChapter = (r: Row): Chapter => ({
  id: r.id as string,
  projectId: r.project_id as string,
  number: Number(r.number),
  title: r.title as string,
  description: (r.description as string) ?? "",
  status: r.status as Chapter["status"],
  archived: !!r.archived,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toScene = (r: Row): Scene => ({
  id: r.id as string,
  chapterId: r.chapter_id as string,
  projectId: r.project_id as string,
  number: Number(r.number),
  title: (r.title as string) ?? "",
  description: (r.description as string) ?? "",
  locationId: (r.location_id as string) ?? null,
  characterIds: parseJson<string[]>(r.character_ids, []),
  script: (r.script as string) ?? "",
  objective: (r.objective as string) ?? "",
  status: r.status as Scene["status"],
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toPage = (r: Row): Page => ({
  id: r.id as string,
  chapterId: r.chapter_id as string,
  projectId: r.project_id as string,
  number: Number(r.number),
  title: (r.title as string) ?? "",
  status: r.status as Page["status"],
  template: (r.template as string) ?? "blank",
  notes: (r.notes as string) ?? "",
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toPanel = (r: Row): Panel => ({
  id: r.id as string,
  pageId: r.page_id as string,
  projectId: r.project_id as string,
  sceneId: (r.scene_id as string) ?? null,
  order: Number(r.order_num ?? 0),
  x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h),
  shape: r.shape as Panel["shape"],
  prompt: (r.prompt as string) ?? "",
  description: (r.description as string) ?? "",
  characterIds: parseJson<string[]>(r.character_ids, []),
  locationId: (r.location_id as string) ?? null,
  shot: r.shot as Panel["shot"],
  camera: r.camera as Panel["camera"],
  expression: (r.expression as string) ?? "",
  pose: (r.pose as string) ?? "",
  lighting: (r.lighting as string) ?? "",
  mood: (r.mood as string) ?? "",
  effects: (r.effects as string) ?? "",
  focus: (r.focus as string) ?? "",
  purpose: (r.purpose as string) ?? "",
  imageUrl: (r.image_url as string) ?? null,
  stage: r.stage as Panel["stage"],
  seed: r.seed === null || r.seed === undefined ? null : Number(r.seed),
  negativePrompt: (r.negative_prompt as string) ?? "",
  bubbles: parseJson<Panel["bubbles"]>(r.bubbles, []),
  notes: (r.notes as string) ?? "",
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const toGeneration = (r: Row): Generation => ({
  id: r.id as string,
  projectId: r.project_id as string,
  panelId: (r.panel_id as string) ?? null,
  characterId: (r.character_id as string) ?? null,
  kind: r.kind as Generation["kind"],
  prompt: (r.prompt as string) ?? "",
  settings: parseJson<Record<string, unknown>>(r.settings, {}),
  status: r.status as Generation["status"],
  resultUrl: (r.result_url as string) ?? null,
  resultSvg: (r.result_svg as string) ?? null,
  seed: r.seed === null || r.seed === undefined ? null : Number(r.seed),
  error: (r.error as string) ?? null,
  createdAt: r.created_at as string,
});

export const toPanelVersion = (r: Row): PanelVersion => ({
  id: r.id as string,
  panelId: r.panel_id as string,
  imageUrl: r.image_url as string,
  prompt: (r.prompt as string) ?? "",
  seed: r.seed === null || r.seed === undefined ? null : Number(r.seed),
  label: (r.label as string) ?? "",
  createdAt: r.created_at as string,
});

export const toAssistantMessage = (r: Row): AssistantMessage => ({
  id: r.id as string,
  projectId: r.project_id as string,
  role: r.role as "user" | "assistant",
  content: r.content as string,
  createdAt: r.created_at as string,
});
