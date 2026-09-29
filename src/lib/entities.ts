import { get, all, now, run } from "./db";
import { toAsset, toCharacter, toChapter, toLocation, toPage, toPanel, toScene, toStoryBlock } from "./serialize";
import type { EntityDef } from "./crud";

/** Keep parent project timestamps fresh on any change. */
function touchProject(projectId: string) {
  run("UPDATE projects SET updated_at = ? WHERE id = ?", now(), projectId);
}

export const characterDef: EntityDef = {
  table: "characters",
  projectCol: "project_id",
  required: ["name"],
  order: "created_at",
  serialize: toCharacter,
  patchable: ["name", "role", "age", "description", "personality", "history", "abilities", "relationships", "appearance", "portrait_url", "tags", "status", "change_log"],
  create: (body) => ({
    name: body.name, role: body.role ?? "supporting", age: body.age ?? "",
    description: body.description ?? "", personality: body.personality ?? "", history: body.history ?? "",
    abilities: body.abilities ?? "", relationships: body.relationships ?? "",
    appearance: body.appearance ?? { hair: "", hairColor: "", eyes: "", build: "", clothing: "", features: "", accessories: "" },
    portrait_url: body.portraitUrl ?? null, tags: body.tags ?? [], status: body.status ?? "designing",
    change_log: body.changeLog ?? [],
  }),
  afterChange: (row) => touchProject(String(row.project_id)),
};

export const locationDef: EntityDef = {
  table: "locations",
  projectCol: "project_id",
  required: ["name"],
  order: "created_at",
  serialize: toLocation,
  patchable: ["name", "description", "architecture", "environment", "lighting", "details", "time_of_day", "weather", "image_url", "tags"],
  create: (body) => ({
    name: body.name, description: body.description ?? "", architecture: body.architecture ?? "",
    environment: body.environment ?? "exterior", lighting: body.lighting ?? "", details: body.details ?? "",
    time_of_day: body.timeOfDay ?? "", weather: body.weather ?? "", image_url: body.imageUrl ?? null,
    tags: body.tags ?? [],
  }),
  afterChange: (row) => touchProject(String(row.project_id)),
};

export const assetDef: EntityDef = {
  table: "assets",
  projectCol: "project_id",
  required: ["name"],
  order: "created_at",
  serialize: toAsset,
  patchable: ["name", "kind", "description", "image_url", "tags"],
  create: (body) => ({
    name: body.name, kind: body.kind ?? "prop", description: body.description ?? "",
    image_url: body.imageUrl ?? null, tags: body.tags ?? [],
  }),
  afterChange: (row) => touchProject(String(row.project_id)),
};

export const storyDef: EntityDef = {
  table: "story_blocks",
  projectCol: "project_id",
  required: [],
  order: "order_num, created_at",
  serialize: toStoryBlock,
  patchable: ["kind", "title", "content", "order_num"],
  create: (body, { projectId }) => {
    const max = get<{ c: number }>("SELECT COALESCE(MAX(order_num),-1) as c FROM story_blocks WHERE project_id = ?", projectId);
    return {
      kind: body.kind ?? "note", title: body.title ?? "", content: body.content ?? "",
      order_num: Number(body.order ?? (Number(max?.c ?? -1) + 1)),
    };
  },
  afterChange: (row) => touchProject(String(row.project_id)),
};

export const chapterDef: EntityDef = {
  table: "chapters",
  projectCol: "project_id",
  required: [],
  order: "number",
  serialize: toChapter,
  patchable: ["number", "title", "description", "status", "archived"],
  create: (body, { projectId }) => {
    const max = get<{ c: number }>("SELECT COALESCE(MAX(number),0) as c FROM chapters WHERE project_id = ?", projectId);
    return {
      number: Number(body.number ?? (Number(max?.c ?? 0) + 1)),
      title: (body.title as string) ?? `Chapter ${Number(max?.c ?? 0) + 1}`,
      description: body.description ?? "", status: body.status ?? "planning", archived: 0,
    };
  },
  afterChange: (row) => touchProject(String(row.project_id)),
  cascade: (chapterId) => {
    run("DELETE FROM panel_versions WHERE panel_id IN (SELECT id FROM panels WHERE page_id IN (SELECT id FROM pages WHERE chapter_id = ?))", chapterId);
    run("DELETE FROM panels WHERE page_id IN (SELECT id FROM pages WHERE chapter_id = ?)", chapterId);
    run("DELETE FROM pages WHERE chapter_id = ?", chapterId);
  },
};

export const sceneDef: EntityDef = {
  table: "scenes",
  projectCol: "project_id",
  parentCol: "chapter_id",
  order: "number",
  serialize: toScene,
  patchable: ["number", "title", "description", "location_id", "character_ids", "script", "objective", "status"],
  create: (body, { projectId, parentId }) => {
    const max = get<{ c: number }>("SELECT COALESCE(MAX(number),0) as c FROM scenes WHERE chapter_id = ?", parentId);
    return {
      project_id: projectId,
      number: Number(body.number ?? (Number(max?.c ?? 0) + 1)),
      title: body.title ?? `Scene ${Number(max?.c ?? 0) + 1}`,
      description: body.description ?? "", location_id: body.locationId ?? null,
      character_ids: body.characterIds ?? [], script: body.script ?? "",
      objective: body.objective ?? "", status: body.status ?? "outline",
    };
  },
  afterChange: (row) => touchProject(String(row.project_id)),
  cascade: (sceneId) => {
    run("UPDATE panels SET scene_id = NULL WHERE scene_id = ?", sceneId);
  },
};

export const pageDef: EntityDef = {
  table: "pages",
  projectCol: "project_id",
  parentCol: "chapter_id",
  order: "number",
  serialize: toPage,
  patchable: ["number", "title", "status", "template", "notes"],
  create: (body, { projectId, parentId }) => {
    const max = get<{ c: number }>("SELECT COALESCE(MAX(number),0) as c FROM pages WHERE chapter_id = ?", parentId);
    return {
      project_id: projectId,
      number: Number(body.number ?? (Number(max?.c ?? 0) + 1)),
      title: body.title ?? "", status: body.status ?? "empty",
      template: body.template ?? "blank", notes: body.notes ?? "",
    };
  },
  afterChange: (row) => touchProject(String(row.project_id)),
  cascade: (pageId) => {
    run("DELETE FROM panel_versions WHERE panel_id IN (SELECT id FROM panels WHERE page_id = ?)", pageId);
    run("DELETE FROM panels WHERE page_id = ?", pageId);
  },
};

export const panelDef: EntityDef = {
  table: "panels",
  projectCol: "project_id",
  parentCol: "page_id",
  order: "order_num, created_at",
  serialize: toPanel,
  patchable: ["order_num", "x", "y", "w", "h", "shape", "prompt", "description", "character_ids", "location_id",
    "shot", "camera", "expression", "pose", "lighting", "mood", "effects", "focus", "purpose", "image_url",
    "stage", "seed", "negative_prompt", "bubbles", "notes", "scene_id"],
  create: (body, { projectId, parentId }) => {
    const max = get<{ c: number }>("SELECT COALESCE(MAX(order_num),0) as c FROM panels WHERE page_id = ?", parentId);
    const tpl = (body.templateRect ?? null) as { x: number; y: number; w: number; h: number } | null;
    return {
      project_id: projectId,
      order_num: Number(body.order ?? (Number(max?.c ?? 0) + 1)),
      x: tpl?.x ?? 10, y: tpl?.y ?? 10, w: tpl?.w ?? 80, h: tpl?.h ?? 35,
      shape: body.shape ?? "rect", prompt: body.prompt ?? "", description: body.description ?? "",
      character_ids: body.characterIds ?? [], location_id: body.locationId ?? null,
      shot: body.shot ?? "medium", camera: body.camera ?? "eye-level",
      expression: body.expression ?? "", pose: body.pose ?? "", lighting: body.lighting ?? "",
      mood: body.mood ?? "", effects: body.effects ?? "", focus: body.focus ?? "", purpose: body.purpose ?? "",
      image_url: body.imageUrl ?? null, stage: body.stage ?? "planned", seed: body.seed ?? null,
      negative_prompt: body.negativePrompt ?? "", bubbles: body.bubbles ?? [], notes: body.notes ?? "",
      scene_id: body.sceneId ?? null,
    };
  },
  afterChange: (row) => touchProject(String(row.project_id)),
  cascade: (panelId) => {
    run("DELETE FROM panel_versions WHERE panel_id = ?", panelId);
  },
};

export { toPage, toPanel };
