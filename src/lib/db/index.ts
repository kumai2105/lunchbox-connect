import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * File-backed SQLite. Chosen deliberately (see docs/BLUEPRINT.md §12): the admin has to be
 * genuinely functional and enquiries have to be genuinely stored, and no production database
 * credentials exist. Drizzle keeps the schema portable to Postgres when they do.
 */

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "jazeel.db");

function connect() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

// Reuse across HMR reloads in dev.
const globalForDb = globalThis as unknown as { __jazeelDb?: ReturnType<typeof connect> };
export const db = globalForDb.__jazeelDb ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__jazeelDb = db;

export { schema, DB_PATH };
