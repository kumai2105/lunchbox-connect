/**
 * Back up everything that cannot be rebuilt from the repository.
 *
 * That is exactly two things: the SQLite database (menu, page copy, settings, enquiries,
 * gallery records) and public/uploads, where anything added through the admin lands. The
 * seed photographs in public/media are in the repository and need no backup.
 *
 *   npm run backup                  → ./backups/jazeel-YYYY-MM-DD-HHmm.tar.gz
 *   npm run backup -- /mnt/drive    → somewhere else
 *
 * The database is copied with SQLite's own backup API rather than `cp`, so a copy taken
 * while someone is submitting an enquiry is still a valid database rather than a torn
 * file. Old backups are pruned to the most recent 30.
 */
import { config as loadEnv } from "dotenv";

// Next reads .env.local; dotenv does not, unless told. Load the same file the app will.
for (const f of [".env.local", ".env"]) loadEnv({ path: f, override: false, quiet: true });
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

const root = process.cwd();
const dest = process.argv[2] ?? path.join(root, "backups");
const dbPath = process.env.DATABASE_PATH ?? "data/jazeel.db";
const dbAbs = path.isAbsolute(dbPath) ? dbPath : path.join(root, dbPath);
const uploads = path.join(root, "public", "uploads");
const KEEP = 30;

if (!fs.existsSync(dbAbs)) {
  console.error(`No database at ${dbAbs}. Nothing to back up.`);
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });

async function main() {
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const staging = fs.mkdtempSync(path.join(os.tmpdir(), "jazeel-backup-"));

// A consistent snapshot, taken through SQLite rather than the filesystem.
const db = new Database(dbAbs, { readonly: true });
await db.backup(path.join(staging, "jazeel.db"));
db.close();

if (fs.existsSync(uploads)) {
  fs.cpSync(uploads, path.join(staging, "uploads"), { recursive: true });
}

fs.writeFileSync(
  path.join(staging, "MANIFEST.txt"),
  [
    `Jazeel backup`,
    `taken:    ${new Date().toISOString()}`,
    `database: ${dbAbs}`,
    `uploads:  ${uploads}`,
    ``,
    `To restore: stop the site, put jazeel.db back at the DATABASE_PATH in .env.local,`,
    `copy uploads/ into public/uploads/, then start the site. No migration is needed —`,
    `the schema travels with the file.`,
    ``,
  ].join("\n"),
);

const archive = path.join(dest, `jazeel-${stamp}.tar.gz`);
execFileSync("tar", ["-czf", archive, "-C", staging, "."]);
fs.rmSync(staging, { recursive: true, force: true });

const size = fs.statSync(archive).size;
console.log(`${archive}  ${(size / 1e6).toFixed(1)} MB`);

// Prune, keeping the most recent KEEP archives.
const old = fs
  .readdirSync(dest)
  .filter((f) => /^jazeel-.*\.tar\.gz$/.test(f))
  .sort()
  .reverse()
  .slice(KEEP);
for (const f of old) {
  fs.rmSync(path.join(dest, f));
  console.log(`pruned ${f}`);
}
if (old.length === 0) {
  const n = fs.readdirSync(dest).filter((f) => /^jazeel-.*\.tar\.gz$/.test(f)).length;
  console.log(`${n} backup${n === 1 ? "" : "s"} retained`);
}
}

// Top-level await is unavailable once this is transpiled to CommonJS by tsx.
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
