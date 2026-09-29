import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

// ─── SQLite via node:sqlite (zero native deps) ──────────────────────────────

const DATA_DIR = process.env.INKLINE_DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "inkline.db");

declare global {
  // eslint-disable-next-line no-var
  var __inklineDb: DatabaseSync | undefined;
}

function createDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

export function db(): DatabaseSync {
  if (!globalThis.__inklineDb) globalThis.__inklineDb = createDb();
  return globalThis.__inklineDb;
}

function migrate(db: DatabaseSync) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    prefs TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    format TEXT DEFAULT 'manga',
    mode TEXT DEFAULT 'ai-assisted',
    status TEXT DEFAULT 'active',
    favorite INTEGER DEFAULT 0,
    cover_url TEXT,
    reading_direction TEXT DEFAULT 'rtl',
    page_w INTEGER DEFAULT 1000,
    page_h INTEGER DEFAULT 1414,
    gutter REAL DEFAULT 1.5,
    border_width REAL DEFAULT 0.55,
    style TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'supporting',
    age TEXT DEFAULT '',
    description TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    history TEXT DEFAULT '',
    abilities TEXT DEFAULT '',
    relationships TEXT DEFAULT '',
    appearance TEXT DEFAULT '{}',
    portrait_url TEXT,
    tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'designing',
    change_log TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    architecture TEXT DEFAULT '',
    environment TEXT DEFAULT 'exterior',
    lighting TEXT DEFAULT '',
    details TEXT DEFAULT '',
    time_of_day TEXT DEFAULT '',
    weather TEXT DEFAULT '',
    image_url TEXT,
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_locations_project ON locations(project_id);
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT DEFAULT 'prop',
    description TEXT DEFAULT '',
    image_url TEXT,
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
  CREATE TABLE IF NOT EXISTS story_blocks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    kind TEXT DEFAULT 'note',
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    order_num INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_story_project ON story_blocks(project_id);
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'planning',
    archived INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);
  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT DEFAULT '',
    description TEXT DEFAULT '',
    location_id TEXT,
    character_ids TEXT DEFAULT '[]',
    script TEXT DEFAULT '',
    objective TEXT DEFAULT '',
    status TEXT DEFAULT 'outline',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_scenes_chapter ON scenes(chapter_id);
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT DEFAULT '',
    status TEXT DEFAULT 'empty',
    template TEXT DEFAULT 'blank',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pages_chapter ON pages(chapter_id);
  CREATE TABLE IF NOT EXISTS panels (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    scene_id TEXT,
    order_num INTEGER DEFAULT 0,
    x REAL DEFAULT 0, y REAL DEFAULT 0, w REAL DEFAULT 100, h REAL DEFAULT 25,
    shape TEXT DEFAULT 'rect',
    prompt TEXT DEFAULT '',
    description TEXT DEFAULT '',
    character_ids TEXT DEFAULT '[]',
    location_id TEXT,
    shot TEXT DEFAULT 'medium',
    camera TEXT DEFAULT 'eye-level',
    expression TEXT DEFAULT '',
    pose TEXT DEFAULT '',
    lighting TEXT DEFAULT '',
    mood TEXT DEFAULT '',
    effects TEXT DEFAULT '',
    focus TEXT DEFAULT '',
    purpose TEXT DEFAULT '',
    image_url TEXT,
    stage TEXT DEFAULT 'planned',
    seed INTEGER,
    negative_prompt TEXT DEFAULT '',
    bubbles TEXT DEFAULT '[]',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_panels_page ON panels(page_id);
  CREATE TABLE IF NOT EXISTS panel_versions (
    id TEXT PRIMARY KEY,
    panel_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    prompt TEXT DEFAULT '',
    seed INTEGER,
    label TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_versions_panel ON panel_versions(panel_id);
  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    panel_id TEXT,
    character_id TEXT,
    kind TEXT DEFAULT 'panel',
    prompt TEXT DEFAULT '',
    settings TEXT DEFAULT '{}',
    status TEXT DEFAULT 'done',
    result_url TEXT,
    result_svg TEXT,
    seed INTEGER,
    error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_generations_project ON generations(project_id);
  CREATE TABLE IF NOT EXISTS assistant_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_assistant_project ON assistant_messages(project_id);
  `);
}

// ─── Row helpers ─────────────────────────────────────────────────────────────

export function rid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function run(sql: string, ...params: unknown[]): { changes: number } {
  const stmt = db().prepare(sql);
  const args = params.map((p) => (p === undefined ? null : p)) as never[];
  const res = stmt.run(...args) as unknown as { changes: number | bigint };
  return { changes: Number(res.changes ?? 0) };
}

export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  const stmt = db().prepare(sql);
  const args = params.map((p) => (p === undefined ? null : p)) as never[];
  return stmt.all(...args) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | null {
  const stmt = db().prepare(sql);
  const args = params.map((p) => (p === undefined ? null : p)) as never[];
  return (stmt.get(...args) as T) ?? null;
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
