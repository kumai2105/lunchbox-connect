import { z } from "zod";

export const ENQUIRY_TYPES = [
  "wedding",
  "celebration",
  "corporate",
  "catering",
  "brunch",
  "general",
] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

export const SERVICE_STYLES = ["unset", "buffet", "set_menu", "canapes", "delivered"] as const;

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * One schema, used by the server action for real validation and by the client for the same
 * field rules — so client and server can never drift. Error *messages* are resolved from the
 * locale dictionary by key, not hard-coded here, so Arabic errors are real Arabic.
 */
export const enquirySchema = z
  .object({
    type: z.enum(ENQUIRY_TYPES),
    name: trimmed(120).min(2, "name"),
    phone: trimmed(40).min(6, "phone").regex(/^[+()\d\s.\-]{6,40}$/, "phone"),
    email: z.union([z.literal(""), z.string().trim().email("email").max(180)]).optional(),
    company: trimmed(160).optional(),
    eventDate: z
      .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date")])
      .optional(),
    guests: z
      .union([z.literal(""), z.coerce.number().int().min(1, "guests").max(5000, "guests")])
      .optional(),
    venueRequired: z.coerce.boolean().optional(),
    cateringRequired: z.coerce.boolean().optional(),
    serviceStyle: z.enum(SERVICE_STYLES).optional(),
    message: trimmed(4000).optional(),
    consent: z.literal(true, { message: "consent" }),
    locale: z.enum(["en", "ar"]).default("en"),
    sourcePage: trimmed(200).optional(),
    // Spam controls — never rendered to real users.
    website: z.string().max(0, "spam").optional(), // honeypot
    ts: z.coerce.number().optional(), // render timestamp
  })
  .superRefine((val, ctx) => {
    if (val.eventDate) {
      const d = new Date(val.eventDate);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", path: ["eventDate"], message: "date" });
      }
    }
  });

export type EnquiryInput = z.infer<typeof enquirySchema>;

/* ------------------------------------------------------------ admin schemas */

export const loginSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(200),
});

export const menuCategorySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only"),
  nameEn: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(120).optional(),
  descriptionEn: z.string().trim().max(600).optional(),
  descriptionAr: z.string().trim().max(600).optional(),
  daypart: z.enum(["all_day", "breakfast", "lunch", "dinner", "late_night"]).default("all_day"),
  sort: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.coerce.boolean().default(false),
  arabicApproved: z.coerce.boolean().default(false),
});

/** Accepts "89", "89.50", "" — returns fils or null. Never a float in the database. */
export const priceToFils = z
  .union([z.literal(""), z.coerce.number().min(0).max(1_000_000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : Math.round(Number(v) * 100)));

export const menuItemSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().max(160).optional(),
  descriptionEn: z.string().trim().max(800).optional(),
  descriptionAr: z.string().trim().max(800).optional(),
  price: priceToFils,
  portionEn: z.string().trim().max(80).optional(),
  portionAr: z.string().trim().max(80).optional(),
  dietary: z.array(z.string().trim().max(40)).max(12).default([]),
  allergens: z.array(z.string().trim().max(40)).max(20).default([]),
  imagePath: z.string().trim().max(300).optional(),
  imageAltEn: z.string().trim().max(200).optional(),
  imageAltAr: z.string().trim().max(200).optional(),
  featured: z.coerce.boolean().default(false),
  availableDineIn: z.coerce.boolean().default(true),
  availableDelivery: z.coerce.boolean().default(true),
  inStock: z.coerce.boolean().default(true),
  sort: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.coerce.boolean().default(false),
  arabicApproved: z.coerce.boolean().default(false),
  sourceNote: z.string().trim().max(300).optional(),
});

export const packageSchema = z.object({
  pillar: z.enum(["wedding", "corporate", "catering", "brunch"]),
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().max(160).optional(),
  summaryEn: z.string().trim().max(800).optional(),
  summaryAr: z.string().trim().max(800).optional(),
  inclusionsEn: z.array(z.string().trim().max(200)).max(30).default([]),
  inclusionsAr: z.array(z.string().trim().max(200)).max(30).default([]),
  minGuests: z.union([z.literal(""), z.coerce.number().int().min(1).max(5000)]).optional(),
  maxGuests: z.union([z.literal(""), z.coerce.number().int().min(1).max(5000)]).optional(),
  priceFrom: priceToFils,
  priceUnit: z.enum(["", "per_person", "per_event"]).optional(),
  priceNoteEn: z.string().trim().max(300).optional(),
  priceNoteAr: z.string().trim().max(300).optional(),
  sort: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.coerce.boolean().default(false),
});

export const venueSpaceSchema = z.object({
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().max(160).optional(),
  descriptionEn: z.string().trim().max(800).optional(),
  descriptionAr: z.string().trim().max(800).optional(),
  seatedCapacity: z.union([z.literal(""), z.coerce.number().int().min(1).max(5000)]).optional(),
  standingCapacity: z.union([z.literal(""), z.coerce.number().int().min(1).max(5000)]).optional(),
  featuresEn: z.array(z.string().trim().max(160)).max(20).default([]),
  featuresAr: z.array(z.string().trim().max(160)).max(20).default([]),
  sort: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.coerce.boolean().default(false),
});

export const pageSchema = z.object({
  slug: z.string().trim().min(1).max(60),
  titleEn: z.string().trim().max(200).optional(),
  titleAr: z.string().trim().max(200).optional(),
  kickerEn: z.string().trim().max(160).optional(),
  kickerAr: z.string().trim().max(160).optional(),
  introEn: z.string().trim().max(1200).optional(),
  introAr: z.string().trim().max(1200).optional(),
  bodyEn: z.string().trim().max(20000).optional(),
  bodyAr: z.string().trim().max(20000).optional(),
  seoTitleEn: z.string().trim().max(70).optional(),
  seoTitleAr: z.string().trim().max(70).optional(),
  seoDescriptionEn: z.string().trim().max(180).optional(),
  seoDescriptionAr: z.string().trim().max(180).optional(),
  arabicApproved: z.coerce.boolean().default(false),
  published: z.coerce.boolean().default(true),
});

export const settingsSchema = z.record(z.string().max(80), z.string().max(2000));

export const galleryImageSchema = z.object({
  pillar: z.enum(["restaurant", "wedding", "corporate", "catering", "brunch", "venue"]),
  altEn: z.string().trim().min(1, "Alt text is required for accessibility").max(200),
  altAr: z.string().trim().max(200).optional(),
  captionEn: z.string().trim().max(300).optional(),
  captionAr: z.string().trim().max(300).optional(),
  credit: z.string().trim().max(160).optional(),
  sort: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.coerce.boolean().default(false),
});

export const enquiryUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["new", "in_progress", "quoted", "won", "lost", "spam"]),
  adminNotes: z.string().trim().max(4000).optional(),
});
