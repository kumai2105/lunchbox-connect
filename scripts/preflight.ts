/**
 * Refuse to go live with something unsafe or half-finished.
 *
 * Run this before every deployment. It exits non-zero on anything that would embarrass
 * the business or expose it: a development password still in place, a site URL still
 * pointing at localhost, enquiries that would silently go nowhere, or content that the
 * research says must not be published without evidence.
 *
 *   npm run preflight
 *
 * Nothing here talks to the internet or changes anything. It reads configuration and the
 * database and reports.
 */
import { config as loadEnv } from "dotenv";

// Next reads .env.local; dotenv does not, unless told. Load the same file the app will.
for (const f of [".env.local", ".env"]) loadEnv({ path: f, override: false, quiet: true });
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type Level = "block" | "warn";
const findings: { level: Level; title: string; detail: string }[] = [];
const ok: string[] = [];

const block = (title: string, detail: string) => findings.push({ level: "block", title, detail });
const warn = (title: string, detail: string) => findings.push({ level: "warn", title, detail });
const pass = (s: string) => ok.push(s);

/* ------------------------------------------------------------------ secrets */

const password = process.env.ADMIN_PASSWORD ?? "";
const DEV_PASSWORDS = ["changeme", "password", "admin", "jazeel", "test1234", "letmein"];
if (!password) {
  block("No admin password is set", "ADMIN_PASSWORD is empty. The admin would be unreachable.");
} else if (DEV_PASSWORDS.some((p) => password.toLowerCase().includes(p))) {
  block(
    "The admin password is still a development one",
    "It contains a well-known word. Replace ADMIN_PASSWORD before this is reachable from the internet.",
  );
} else if (password.length < 14) {
  block(
    "The admin password is too short",
    `${password.length} characters. Use at least 14 — this is the only thing between the internet and every page of the site.`,
  );
} else {
  pass("Admin password is set and not a development default");
}

const salt = process.env.IP_HASH_SALT ?? "";
if (salt.length < 16) {
  block(
    "IP_HASH_SALT is missing or too short",
    "Enquiry rate limiting hashes the visitor's address with this salt. A short or shared salt makes those hashes reversible.",
  );
} else {
  pass("IP hash salt is set");
}

/* ------------------------------------------------------------------- site URL */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
if (!siteUrl || /localhost|127\.0\.0\.1/.test(siteUrl)) {
  block(
    "NEXT_PUBLIC_SITE_URL still points at localhost",
    "Every canonical URL, hreflang tag, sitemap entry and social card would point at a machine nobody can reach.",
  );
} else if (!siteUrl.startsWith("https://")) {
  block("The site URL is not HTTPS", `Got ${siteUrl}. Certificates are free; there is no reason to launch without one.`);
} else {
  pass(`Site URL is ${siteUrl}`);
}

/* ------------------------------------------------------------------ enquiries */

const transport = process.env.ENQUIRY_TRANSPORT ?? "";
const recipient = process.env.ENQUIRY_RECIPIENT ?? "";
if (transport !== "smtp" || !process.env.SMTP_URL || !recipient) {
  warn(
    "Enquiries will not be emailed to anyone",
    "They are still stored and visible in the admin, and nothing tells the sender otherwise — but somebody has to remember to log in. Set ENQUIRY_TRANSPORT=smtp, SMTP_URL and ENQUIRY_RECIPIENT.",
  );
} else {
  pass(`Enquiries will be emailed to ${recipient}`);
}

/* ------------------------------------------------------------------ database */

const dbPath = process.env.DATABASE_PATH ?? "data/jazeel.db";
const abs = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
if (!fs.existsSync(abs)) {
  block("The database file does not exist", `Looked for ${abs}. Run npm run setup.`);
} else {
  const db = new Database(abs, { readonly: true });
  const one = <T,>(sql: string): T => db.prepare(sql).get() as T;

  const { n: publishedItems } = one<{ n: number }>(
    "select count(*) as n from menu_items where published = 1",
  );
  if (publishedItems === 0) {
    warn(
      "No menu item is published",
      "The menu page falls back to the verified kitchen categories and the delivery links. That is a finished page, but it is not your menu.",
    );
  } else {
    pass(`${publishedItems} menu items published`);
  }

  const { n: pricelessPublished } = one<{ n: number }>(
    "select count(*) as n from menu_items where published = 1 and price_fils is null",
  );
  if (pricelessPublished > 0) {
    warn(`${pricelessPublished} published menu items have no price`, "They will show a name with no price.");
  }

  const { n: draftSourced } = one<{ n: number }>(
    "select count(*) as n from menu_items where published = 1 and source_note like '%unverified%'",
  );
  if (draftSourced > 0) {
    block(
      `${draftSourced} published menu items are still the unverified delivery snapshot`,
      "These prices were read off a third-party platform on 31 Aug 2026 and never confirmed. Publishing a wrong price is a consumer-protection exposure. Approve them in Admin → Menu, which clears the note.",
    );
  }

  const settings = db.prepare("select key, value from settings").all() as {
    key: string;
    value: string | null;
  }[];
  const setting = (k: string) => settings.find((s) => s.key === k)?.value?.trim() ?? "";

  if (setting("shisha_visible") !== "false") {
    block(
      "Shisha is switched on",
      "Four instruments bear on referring to tobacco online, one naming the internet expressly, and Phase 1 could not establish what a restaurant may say. Only turn this on with a written position from UAE counsel. Register item 10.",
    );
  } else {
    pass("Shisha references are off");
  }

  const { n: shishaPhotos } = one<{ n: number }>(
    "select count(*) as n from gallery_images where published = 1 and file_path in " +
      "('/media/room-full-stage.jpg','/media/room-band-crowd.jpg','/media/room-wide.jpg'," +
      "'/media/room-dancing.jpg','/media/dabke-drummer.jpg','/media/guests-portrait.jpg'," +
      "'/media/room-arches-wide.jpg','/media/long-table-guests.jpg','/media/couple-celebrating.jpg')",
  );
  if (shishaPhotos > 0) {
    block(
      `${shishaPhotos} published photographs show a shisha pipe`,
      "Same question as the copy, and a photograph is the more literal display. Hold them until counsel answers.",
    );
  } else {
    pass("No published photograph shows shisha");
  }

  if (!setting("whatsapp")) warn("No WhatsApp number", "No WhatsApp link is shown anywhere.");
  if (!setting("email")) warn("No public email address", "The contact page shows a phone number only.");

  const { n: images } = one<{ n: number }>("select count(*) as n from gallery_images where published = 1");
  pass(`${images} photographs published`);

  const { n: enquiries } = one<{ n: number }>("select count(*) as n from enquiries");
  if (enquiries > 0) {
    warn(
      `${enquiries} enquiries are in the database`,
      "If any are test submissions from development, delete them before launch so the admin starts clean.",
    );
  }

  db.close();
}

/* ------------------------------------------------------------------- report */

const line = "─".repeat(74);
console.log(`\n${line}\nPre-flight — Jazeel\n${line}`);
for (const s of ok) console.log(`  ok      ${s}`);
const warns = findings.filter((f) => f.level === "warn");
const blocks = findings.filter((f) => f.level === "block");
for (const f of warns) console.log(`\n  WARN    ${f.title}\n          ${f.detail}`);
for (const f of blocks) console.log(`\n  BLOCK   ${f.title}\n          ${f.detail}`);
console.log(`\n${line}`);
if (blocks.length) {
  console.log(`${blocks.length} blocking, ${warns.length} warnings. Do not deploy.\n`);
  process.exit(1);
}
console.log(
  warns.length
    ? `No blockers. ${warns.length} warnings — read them, then deploy if they are expected.\n`
    : "Clear to deploy.\n",
);
