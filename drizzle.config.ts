import type { Config } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_PATH ?? "./data/jazeel.db";

// src/lib/db/index.ts and scripts/seed.ts both do this before opening the database; drizzle-kit
// needs it too. `npm run setup` runs `db:push` first, and on a fresh clone there is no data/
// directory yet — better-sqlite3 will not create one, so the push failed with "Cannot open
// database because the directory does not exist". drizzle-kit still exits 0 after that, so the
// `&&` let the seed run on a database with no tables in it.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: DB_PATH,
  },
} satisfies Config;
