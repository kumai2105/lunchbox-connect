import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Jazeel content schema.
 *
 * Design rules enforced here:
 *  - Every public-facing string exists twice (_en / _ar). Arabic is never machine-filled.
 *  - Anything the Phase 1 research could NOT verify is nullable and ships empty
 *    (prices, capacities, coordinates, package inclusions, images, WhatsApp, email).
 *  - `published` gates rendering. Nothing half-known reaches a public page.
 *  - `sourceNote` records provenance for imported research data so a draft menu row
 *    can never be mistaken for owner-approved truth.
 */

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ settings */

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  /** VERIFIED | OWNER_PROVIDED | UNVERIFIED | UNKNOWN — shown in admin, never public */
  evidence: text("evidence").notNull().default("UNKNOWN"),
  note: text("note"),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

/* --------------------------------------------------------------- admin users */

export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default("Owner"),
  role: text("role").notNull().default("owner"),
  createdAt: text("created_at").notNull().$defaultFn(now),
  lastLoginAt: text("last_login_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ---------------------------------------------------------------- page copy */

export const pages = sqliteTable("pages", {
  slug: text("slug").primaryKey(),

  titleEn: text("title_en"),
  titleAr: text("title_ar"),
  kickerEn: text("kicker_en"),
  kickerAr: text("kicker_ar"),
  introEn: text("intro_en"),
  introAr: text("intro_ar"),
  bodyEn: text("body_en"),
  bodyAr: text("body_ar"),

  seoTitleEn: text("seo_title_en"),
  seoTitleAr: text("seo_title_ar"),
  seoDescriptionEn: text("seo_description_en"),
  seoDescriptionAr: text("seo_description_ar"),

  /** true once a human has approved the Arabic column. Never set by import. */
  arabicApproved: integer("arabic_approved", { mode: "boolean" }).notNull().default(false),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

/* -------------------------------------------------------------------- menu */

export const menuCategories = sqliteTable(
  "menu_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar"),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    /** all_day | breakfast | lunch | dinner | late_night */
    daypart: text("daypart").notNull().default("all_day"),
    sort: integer("sort").notNull().default(0),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    arabicApproved: integer("arabic_approved", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("menu_categories_sort_idx").on(t.sort)],
);

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),

    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar"),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),

    /** stored in fils (AED * 100) to avoid float money. null = price not published. */
    priceFils: integer("price_fils"),
    currency: text("currency").notNull().default("AED"),
    /** free text: "800g", "1 kg", "serves 2" — bilingual */
    portionEn: text("portion_en"),
    portionAr: text("portion_ar"),

    /** JSON string arrays */
    dietary: text("dietary").notNull().default("[]"),
    allergens: text("allergens").notNull().default("[]"),

    imagePath: text("image_path"),
    imageAltEn: text("image_alt_en"),
    imageAltAr: text("image_alt_ar"),

    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    availableDineIn: integer("available_dine_in", { mode: "boolean" }).notNull().default(true),
    availableDelivery: integer("available_delivery", { mode: "boolean" }).notNull().default(true),
    /** temporarily unavailable without deleting the row */
    inStock: integer("in_stock", { mode: "boolean" }).notNull().default(true),

    sort: integer("sort").notNull().default(0),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    arabicApproved: integer("arabic_approved", { mode: "boolean" }).notNull().default(false),

    /** provenance — e.g. "Deliveroo storefront snapshot 2026-08-31 (research draft)" */
    sourceNote: text("source_note"),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("menu_items_category_idx").on(t.categoryId), index("menu_items_sort_idx").on(t.sort)],
);

/* ------------------------------------------------------- packages & spaces */

/** pillar: wedding | corporate | catering | brunch */
export const packages = sqliteTable(
  "packages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pillar: text("pillar").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar"),
    summaryEn: text("summary_en"),
    summaryAr: text("summary_ar"),
    /** JSON string arrays of bullet strings */
    inclusionsEn: text("inclusions_en").notNull().default("[]"),
    inclusionsAr: text("inclusions_ar").notNull().default("[]"),
    minGuests: integer("min_guests"),
    maxGuests: integer("max_guests"),
    priceFromFils: integer("price_from_fils"),
    priceUnit: text("price_unit"), // "per person" | "per event"
    priceNoteEn: text("price_note_en"),
    priceNoteAr: text("price_note_ar"),
    sort: integer("sort").notNull().default(0),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("packages_pillar_idx").on(t.pillar)],
);

export const venueSpaces = sqliteTable("venue_spaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar"),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  seatedCapacity: integer("seated_capacity"),
  standingCapacity: integer("standing_capacity"),
  featuresEn: text("features_en").notNull().default("[]"),
  featuresAr: text("features_ar").notNull().default("[]"),
  sort: integer("sort").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

/* ----------------------------------------------------------------- gallery */

export const galleryImages = sqliteTable(
  "gallery_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** restaurant | wedding | corporate | catering | brunch | venue */
    pillar: text("pillar").notNull().default("restaurant"),
    filePath: text("file_path").notNull(),
    width: integer("width"),
    height: integer("height"),
    altEn: text("alt_en").notNull(),
    altAr: text("alt_ar"),
    captionEn: text("caption_en"),
    captionAr: text("caption_ar"),
    credit: text("credit"),
    sort: integer("sort").notNull().default(0),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("gallery_pillar_idx").on(t.pillar)],
);

/* --------------------------------------------------------------- enquiries */

export const enquiries = sqliteTable(
  "enquiries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reference: text("reference").notNull().unique(),
    /** wedding | celebration | corporate | catering | brunch | general */
    type: text("type").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    company: text("company"),
    eventDate: text("event_date"),
    guests: integer("guests"),
    venueRequired: integer("venue_required", { mode: "boolean" }),
    cateringRequired: integer("catering_required", { mode: "boolean" }),
    serviceStyle: text("service_style"),
    message: text("message"),
    consent: integer("consent", { mode: "boolean" }).notNull().default(false),
    locale: text("locale").notNull().default("en"),
    sourcePage: text("source_page"),
    /** salted hash only — never the raw IP */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    /** new | in_progress | quoted | won | lost | spam */
    status: text("status").notNull().default("new"),
    adminNotes: text("admin_notes"),
    /** logged | sent | failed | not_configured */
    notificationStatus: text("notification_status").notNull().default("not_configured"),
    notificationDetail: text("notification_detail"),
    createdAt: text("created_at").notNull().$defaultFn(now),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("enquiries_type_idx").on(t.type), index("enquiries_status_idx").on(t.status)],
);

/* --------------------------------------------------------- rate limiting */

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start").notNull(),
});

export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type PageRow = typeof pages.$inferSelect;
export type PackageRow = typeof packages.$inferSelect;
export type VenueSpace = typeof venueSpaces.$inferSelect;
export type GalleryImage = typeof galleryImages.$inferSelect;
export type Enquiry = typeof enquiries.$inferSelect;
export type Setting = typeof settings.$inferSelect;
