import { get, now, rid, run, all } from "./db";
import { fail, json, readBody } from "./api-helpers";

export interface EntityDef {
  table: string;
  projectCol?: string; // column linking to project
  parentCol?: string;  // column linking to a parent (chapters/pages)
  required?: string[];
  order?: string;
  serialize: (row: Record<string, unknown>) => unknown;
  /** columns allowed via PATCH, mapped from body keys; JSON-typed cols auto-encoded */
  patchable: string[];
  /** defaults on create: bodyKey -> column, or column -> value fn */
  create: (body: Record<string, unknown>, ctx: { projectId: string; parentId?: string }) => Record<string, unknown>;
  /** called after PATCH with row — e.g. to maintain updated_at parents */
  afterChange?: (row: Record<string, unknown>) => void;
  /** delete child rows before the item itself (referential cleanup, no FK cascades in schema) */
  cascade?: (itemId: string) => void;
}

const enc = (v: unknown) => (typeof v === "object" && v !== null ? JSON.stringify(v) : v);

/** reading_direction -> readingDirection */
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function pickPatchValue(body: Record<string, unknown>, col: string): unknown {
  if (body[col] !== undefined) return body[col];
  const camel = toCamel(col);
  if (body[camel] !== undefined) return body[camel];
  return undefined;
}

export function makeCollectionHandlers(def: EntityDef) {
  const owns = (userId: string, projectId: string) =>
    !!get("SELECT id FROM projects WHERE id = ? AND user_id = ?", projectId, userId);

  return {
    async GET(_req: Request, projectId: string, parentId?: string) {
      const rows = def.parentCol && parentId
        ? all(`SELECT * FROM ${def.table} WHERE ${def.parentCol} = ? ORDER BY ${def.order ?? "created_at"}`, parentId)
        : all(`SELECT * FROM ${def.table} WHERE ${def.projectCol} = ? ORDER BY ${def.order ?? "created_at"}`, projectId);
      return json({ items: rows.map(def.serialize) });
    },
    async POST(req: Request, projectId: string, parentId?: string) {
      const body = await readBody<Record<string, unknown>>(req);
      for (const r of def.required ?? []) {
        if (typeof body[r] !== "string" || !(body[r] as string).trim()) return fail(`Missing field: ${r}`);
      }
      const cols = def.create(body, { projectId, parentId });
      const id = rid();
      const t = now();
      const finalCols: Record<string, unknown> = { id, created_at: t, updated_at: t, ...cols };
      if (def.projectCol) finalCols[def.projectCol] = projectId;
      if (def.parentCol && parentId) finalCols[def.parentCol] = parentId;
      const keys = Object.keys(finalCols);
      run(`INSERT INTO ${def.table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        ...keys.map((k) => enc(finalCols[k])));
      const row = get(`SELECT * FROM ${def.table} WHERE id = ?`, id)!;
      def.afterChange?.(row);
      return json({ item: def.serialize(row) }, 201);
    },
  };
}

export function makeItemHandlers(def: EntityDef) {
  return {
    async GET(itemId: string) {
      const row = get(`SELECT * FROM ${def.table} WHERE id = ?`, itemId);
      if (!row) return fail("Not found", 404);
      return json({ item: def.serialize(row) });
    },
    async PATCH(req: Request, itemId: string) {
      const row = get(`SELECT * FROM ${def.table} WHERE id = ?`, itemId);
      if (!row) return fail("Not found", 404);
      const body = await readBody<Record<string, unknown>>(req);
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const col of def.patchable) {
        const val = pickPatchValue(body, col);
        if (val !== undefined) {
          sets.push(`${col} = ?`);
          params.push(enc(val));
        }
      }
      if (!sets.length) return json({ item: def.serialize(row) });
      sets.push("updated_at = ?");
      params.push(now(), itemId);
      run(`UPDATE ${def.table} SET ${sets.join(", ")} WHERE id = ?`, ...params);
      const fresh = get(`SELECT * FROM ${def.table} WHERE id = ?`, itemId)!;
      def.afterChange?.(fresh);
      return json({ item: def.serialize(fresh) });
    },
    async DELETE(itemId: string) {
      const row = get(`SELECT * FROM ${def.table} WHERE id = ?`, itemId);
      if (!row) return fail("Not found", 404);
      def.cascade?.(itemId);
      run(`DELETE FROM ${def.table} WHERE id = ?`, itemId);
      def.afterChange?.(row);
      return json({ ok: true });
    },
  };
}
