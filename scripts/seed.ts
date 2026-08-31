/* eslint-disable no-console */
import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as schema from "../src/lib/db/schema";
import { seedPages } from "../src/lib/db/seed-pages";
import { draftMenu, DELIVEROO_SNAPSHOT_NOTE } from "../src/lib/db/seed-menu-draft";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "jazeel.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

/* ------------------------------------------------------------------ settings */

// value === null means: NOT KNOWN from Phase 1 research. It ships empty and the owner
// supplies it through the admin. Nothing that depends on it renders until then.
const settingRows: { key: string; value: string | null; evidence: string; note: string }[] = [
  { key: "phone", value: "+97143232797", evidence: "VERIFIED", note: "Dossier §2.3 — five sources" },
  { key: "phone_display", value: "+971 4 323 2797", evidence: "VERIFIED", note: "Dossier §2.3" },
  { key: "whatsapp", value: null, evidence: "UNKNOWN", note: "Exists per 2GIS; number not public. Owner to supply." },
  { key: "email", value: null, evidence: "UNKNOWN", note: "Redacted at retrieval. Owner to supply." },
  { key: "enquiry_recipient", value: null, evidence: "UNKNOWN", note: "Where enquiry notifications should be sent." },
  { key: "hours_open", value: "10:00", evidence: "VERIFIED", note: "Dossier §2.4 — four sources" },
  { key: "hours_close", value: "02:00", evidence: "VERIFIED", note: "Dossier §2.4" },
  { key: "hours_note_en", value: null, evidence: "UNKNOWN", note: "Per-day / Ramadan variation unknown." },
  { key: "hours_note_ar", value: null, evidence: "UNKNOWN", note: "" },
  { key: "shisha_hours", value: null, evidence: "UNKNOWN", note: "Dossier C-02 — open legal question. Do not publish without advice." },
  { key: "shisha_visible", value: "true", evidence: "VERIFIED", note: "Master switch: hides every shisha mention site-wide when set to false." },
  { key: "map_url", value: null, evidence: "UNVERIFIED", note: "Coordinates contradicted (C-01). Directions currently use the textual address." },
  { key: "brunch_time_en", value: null, evidence: "UNKNOWN", note: "Owner to supply brunch service times." },
  { key: "brunch_time_ar", value: null, evidence: "UNKNOWN", note: "" },
  { key: "brunch_price_note_en", value: null, evidence: "UNKNOWN", note: "Owner to supply." },
  { key: "brunch_price_note_ar", value: null, evidence: "UNKNOWN", note: "" },
];

for (const row of settingRows) {
  const existing = db.select().from(schema.settings).where(eq(schema.settings.key, row.key)).all();
  if (existing.length === 0) {
    db.insert(schema.settings)
      .values({ key: row.key, value: row.value, evidence: row.evidence, note: row.note })
      .run();
  }
}
console.log(`✓ settings: ${settingRows.length} keys ensured`);

/* -------------------------------------------------------------- admin user */

const adminEmail = process.env.ADMIN_EMAIL ?? "owner@jazeel.local";
const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe!Jazeel2026";
const existingAdmin = db
  .select()
  .from(schema.adminUsers)
  .where(eq(schema.adminUsers.email, adminEmail))
  .all();

if (existingAdmin.length === 0) {
  db.insert(schema.adminUsers)
    .values({ email: adminEmail, passwordHash: hashPassword(adminPassword), name: "Jazeel Owner" })
    .run();
  console.log(`✓ admin user created: ${adminEmail}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log("  ! Using the default development password. Set ADMIN_PASSWORD before any deployment.");
  }
} else {
  console.log(`· admin user already present: ${adminEmail}`);
}

/* ------------------------------------------------------------------- pages */

for (const p of seedPages) {
  const existing = db.select().from(schema.pages).where(eq(schema.pages.slug, p.slug)).all();
  if (existing.length === 0) {
    db.insert(schema.pages)
      .values({
        slug: p.slug,
        titleEn: p.titleEn,
        kickerEn: p.kickerEn || null,
        introEn: p.introEn || null,
        bodyEn: p.bodyEn || null,
        seoTitleEn: p.seoTitleEn,
        seoDescriptionEn: p.seoDescriptionEn,
        // Arabic intentionally empty — a person writes or approves it. Never machine-translated.
        titleAr: null,
        kickerAr: null,
        introAr: null,
        bodyAr: null,
        seoTitleAr: null,
        seoDescriptionAr: null,
        arabicApproved: false,
        published: true,
      })
      .run();
  }
}
console.log(`✓ pages: ${seedPages.length} ensured (Arabic columns intentionally empty)`);

/* ------------------------------------------------- draft menu (unpublished) */

const existingCats = db.select().from(schema.menuCategories).all();
if (existingCats.length === 0) {
  let itemCount = 0;
  for (const cat of draftMenu) {
    const res = db
      .insert(schema.menuCategories)
      .values({
        slug: cat.slug,
        nameEn: cat.nameEn,
        nameAr: null,
        daypart: "all_day",
        sort: cat.sort,
        published: false, // draft import — owner reviews and publishes
        arabicApproved: false,
      })
      .run();
    const categoryId = Number(res.lastInsertRowid);

    cat.items.forEach((item, i) => {
      db.insert(schema.menuItems)
        .values({
          categoryId,
          nameEn: item.nameEn,
          nameAr: null,
          priceFils: Math.round(item.price * 100),
          currency: "AED",
          portionEn: item.portionEn ?? null,
          featured: item.featured ?? false,
          sort: (i + 1) * 10,
          published: false, // NOTHING from the research snapshot is published
          arabicApproved: false,
          sourceNote: DELIVEROO_SNAPSHOT_NOTE,
        })
        .run();
      itemCount += 1;
    });
  }
  console.log(
    `✓ draft menu imported: ${draftMenu.length} categories, ${itemCount} items — ALL UNPUBLISHED, each tagged with its research source`,
  );
} else {
  console.log(`· menu already has ${existingCats.length} categories — left untouched`);
}

/* --------------------------------------------------------------- reminders */

console.log("");
console.log("Seed complete. Deliberately EMPTY and awaiting real content:");
console.log("  · packages (weddings / corporate / catering / brunch) — no invented prices or inclusions");
console.log("  · venue spaces — no invented capacities");
console.log("  · gallery — no stock or AI imagery; the gallery route stays hidden until real files exist");
console.log("  · WhatsApp number, email address, map pin, shisha hours, Arabic copy");
console.log("See docs/CONTENT-REGISTER.md for the full list.");

sqlite.close();
