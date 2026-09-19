"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  adminUsers,
  enquiries,
  galleryImages,
  menuCategories,
  menuItems,
  packages,
  pages,
  rateLimits,
  settings,
  venueSpaces,
} from "@/lib/db/schema";
import { hrefFor, locales, routeKeys } from "@/lib/i18n/config";
import {
  assertSameOrigin,
  clientAddress,
  createSession,
  destroySession,
  hashIp,
  hashPassword,
  requireAdmin,
  verifyPassword,
} from "@/lib/auth";
import {
  enquiryUpdateSchema,
  galleryImageSchema,
  loginSchema,
  menuCategorySchema,
  menuItemSchema,
  packageSchema,
  pageSchema,
  venueSpaceSchema,
} from "@/lib/validation";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Every public route is regenerated after a content change so edits appear immediately.
 *
 * Each concrete path is revalidated explicitly rather than relying on a single
 * revalidatePath("/", "layout"): the site uses two root layouts (public and admin) in separate
 * route groups, and a layout-level invalidation from the admin group did not reliably reach the
 * prerendered public pages. Verified by scripts/smoke.ts.
 */
function revalidateSite() {
  for (const locale of locales) {
    for (const key of routeKeys) {
      revalidatePath(hrefFor(key, locale));
    }
  }
  revalidatePath("/sitemap.xml");
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : undefined;
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const list = (fd: FormData, k: string) =>
  (str(fd, k) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/* ------------------------------------------------------------------- auth */

/*
  Login throttling.

  There is one account, and until 2 Sep 2026 nothing counted failed attempts: an attacker
  could guess passwords as fast as the server would answer. Worse, verifyPassword is a
  synchronous scrypt costing ~50ms of blocked event loop, and `npm start` is a single
  process — so a few dozen login POSTs per second took the *public* site down without any
  credential at all.

  Ten failures per address per fifteen minutes, counted before any hashing happens, closes
  both. The window is deliberately short: this protects one owner logging in from a phone,
  not a login page with thousands of users.
*/
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginThrottled(key: string): boolean {
  const row = db.select().from(rateLimits).where(eq(rateLimits.key, key)).all()[0];
  if (!row) return false;
  if (Date.now() - row.windowStart > LOGIN_WINDOW_MS) {
    db.delete(rateLimits).where(eq(rateLimits.key, key)).run();
    return false;
  }
  return row.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const row = db.select().from(rateLimits).where(eq(rateLimits.key, key)).all()[0];
  if (!row || now - row.windowStart > LOGIN_WINDOW_MS) {
    db.insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, windowStart: now } })
      .run();
    return;
  }
  db.update(rateLimits).set({ count: row.count + 1 }).where(eq(rateLimits.key, key)).run();
}

/*
  A dummy hash in the same format, so a miss costs the same scrypt as a hit. The previous
  code skipped verifyPassword entirely when no row matched, and the comment above it
  claimed the opposite — a ~50ms gap that told an attacker which address was real.
*/
const DUMMY_HASH = hashPassword("not-a-real-password-timing-equaliser");

export async function loginAction(_prev: ActionState | null, fd: FormData): Promise<ActionState> {
  await assertSameOrigin();
  const parsed = loginSchema.safeParse({ email: str(fd, "email"), password: str(fd, "password") });
  if (!parsed.success) return { error: "Enter a valid email address and password." };

  const throttleKey = `login:${hashIp(clientAddress(await headers()))}`;
  if (loginThrottled(throttleKey)) {
    return { error: "Too many attempts. Wait fifteen minutes and try again." };
  }

  const user = db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, parsed.data.email.toLowerCase()))
    .all()[0];

  // Hash on both paths, so the response time does not reveal whether the address exists.
  const ok = verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    recordLoginFailure(throttleKey);
    return { error: "Those details were not recognised." };
  }
  db.delete(rateLimits).where(eq(rateLimits.key, throttleKey)).run();

  db.update(adminUsers)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(adminUsers.id, user.id))
    .run();
  await createSession(user.id);
  redirect("/admin");
}

export async function logoutAction() {
  await assertSameOrigin();
  await destroySession();
  redirect("/admin/login");
}

/* ---------------------------------------------------------------- settings */

export async function saveSettingsAction(
  _prev: ActionState | null,
  fd: FormData,
): Promise<ActionState> {
  await requireAdmin();
  await assertSameOrigin();

  const keys = db.select({ key: settings.key }).from(settings).all();
  for (const { key } of keys) {
    if (!fd.has(key)) continue;
    const value = (str(fd, key) ?? "").trim();
    db.update(settings)
      .set({ value: value === "" ? null : value, updatedAt: new Date().toISOString() })
      .where(eq(settings.key, key))
      .run();
  }
  revalidateSite();
  return { ok: true, message: "Settings saved." };
}

/* ------------------------------------------------------------------- pages */

export async function savePageAction(_prev: ActionState | null, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  await assertSameOrigin();

  const parsed = pageSchema.safeParse({
    slug: str(fd, "slug"),
    titleEn: str(fd, "titleEn"),
    titleAr: str(fd, "titleAr"),
    kickerEn: str(fd, "kickerEn"),
    kickerAr: str(fd, "kickerAr"),
    introEn: str(fd, "introEn"),
    introAr: str(fd, "introAr"),
    bodyEn: str(fd, "bodyEn"),
    bodyAr: str(fd, "bodyAr"),
    seoTitleEn: str(fd, "seoTitleEn"),
    seoTitleAr: str(fd, "seoTitleAr"),
    seoDescriptionEn: str(fd, "seoDescriptionEn"),
    seoDescriptionAr: str(fd, "seoDescriptionAr"),
    arabicApproved: bool(fd, "arabicApproved"),
    published: bool(fd, "published"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const d = parsed.data;
  const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
  db.update(pages)
    .set({
      titleEn: nn(d.titleEn),
      titleAr: nn(d.titleAr),
      kickerEn: nn(d.kickerEn),
      kickerAr: nn(d.kickerAr),
      introEn: nn(d.introEn),
      introAr: nn(d.introAr),
      bodyEn: nn(d.bodyEn),
      bodyAr: nn(d.bodyAr),
      seoTitleEn: nn(d.seoTitleEn),
      seoTitleAr: nn(d.seoTitleAr),
      seoDescriptionEn: nn(d.seoDescriptionEn),
      seoDescriptionAr: nn(d.seoDescriptionAr),
      arabicApproved: d.arabicApproved,
      published: d.published,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(pages.slug, d.slug))
    .run();

  revalidateSite();
  return { ok: true, message: "Page saved." };
}

/* -------------------------------------------------------------------- menu */

export async function saveMenuCategoryAction(
  _prev: ActionState | null,
  fd: FormData,
): Promise<ActionState> {
  await requireAdmin();
  await assertSameOrigin();

  const id = str(fd, "id");
  const parsed = menuCategorySchema.safeParse({
    slug: str(fd, "slug"),
    nameEn: str(fd, "nameEn"),
    nameAr: str(fd, "nameAr"),
    descriptionEn: str(fd, "descriptionEn"),
    descriptionAr: str(fd, "descriptionAr"),
    daypart: str(fd, "daypart") || "all_day",
    sort: str(fd, "sort") || 0,
    published: bool(fd, "published"),
    arabicApproved: bool(fd, "arabicApproved"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

  const values = {
    slug: d.slug,
    nameEn: d.nameEn,
    nameAr: nn(d.nameAr),
    descriptionEn: nn(d.descriptionEn),
    descriptionAr: nn(d.descriptionAr),
    daypart: d.daypart,
    sort: d.sort,
    published: d.published,
    arabicApproved: d.arabicApproved,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (id) db.update(menuCategories).set(values).where(eq(menuCategories.id, Number(id))).run();
    else db.insert(menuCategories).values(values).run();
  } catch {
    return { error: "That category slug is already in use." };
  }
  revalidateSite();
  return { ok: true, message: "Category saved." };
}

export async function deleteMenuCategoryAction(fd: FormData) {
  await requireAdmin();
  await assertSameOrigin();
  const id = Number(str(fd, "id"));
  if (id) db.delete(menuCategories).where(eq(menuCategories.id, id)).run();
  revalidateSite();
  redirect("/admin/menu");
}

export async function saveMenuItemAction(
  _prev: ActionState | null,
  fd: FormData,
): Promise<ActionState> {
  await requireAdmin();
  await assertSameOrigin();

  const id = str(fd, "id");
  const parsed = menuItemSchema.safeParse({
    categoryId: str(fd, "categoryId"),
    nameEn: str(fd, "nameEn"),
    nameAr: str(fd, "nameAr"),
    descriptionEn: str(fd, "descriptionEn"),
    descriptionAr: str(fd, "descriptionAr"),
    price: str(fd, "price") ?? "",
    portionEn: str(fd, "portionEn"),
    portionAr: str(fd, "portionAr"),
    dietary: list(fd, "dietary"),
    allergens: list(fd, "allergens"),
    imagePath: str(fd, "imagePath"),
    imageAltEn: str(fd, "imageAltEn"),
    imageAltAr: str(fd, "imageAltAr"),
    featured: bool(fd, "featured"),
    availableDineIn: bool(fd, "availableDineIn"),
    availableDelivery: bool(fd, "availableDelivery"),
    inStock: bool(fd, "inStock"),
    sort: str(fd, "sort") || 0,
    published: bool(fd, "published"),
    arabicApproved: bool(fd, "arabicApproved"),
    sourceNote: str(fd, "sourceNote"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

  const values = {
    categoryId: d.categoryId,
    nameEn: d.nameEn,
    nameAr: nn(d.nameAr),
    descriptionEn: nn(d.descriptionEn),
    descriptionAr: nn(d.descriptionAr),
    priceFils: d.price,
    portionEn: nn(d.portionEn),
    portionAr: nn(d.portionAr),
    dietary: JSON.stringify(d.dietary),
    allergens: JSON.stringify(d.allergens),
    imagePath: nn(d.imagePath),
    imageAltEn: nn(d.imageAltEn),
    imageAltAr: nn(d.imageAltAr),
    featured: d.featured,
    availableDineIn: d.availableDineIn,
    availableDelivery: d.availableDelivery,
    inStock: d.inStock,
    sort: d.sort,
    published: d.published,
    arabicApproved: d.arabicApproved,
    sourceNote: nn(d.sourceNote),
    updatedAt: new Date().toISOString(),
  };

  if (id) db.update(menuItems).set(values).where(eq(menuItems.id, Number(id))).run();
  else db.insert(menuItems).values(values).run();

  revalidateSite();
  return { ok: true, message: "Item saved." };
}

export async function deleteMenuItemAction(fd: FormData) {
  await requireAdmin();
  await assertSameOrigin();
  const id = Number(str(fd, "id"));
  if (id) db.delete(menuItems).where(eq(menuItems.id, id)).run();
  revalidateSite();
  redirect("/admin/menu");
}

/** Publish / unpublish without opening the editor. */
export async function toggleMenuItemAction(fd: FormData) {
  await requireAdmin();
  await assertSameOrigin();
  const id = Number(str(fd, "id"));
  const row = db.select().from(menuItems).where(eq(menuItems.id, id)).all()[0];
  if (row) {
    db.update(menuItems)
      .set({ published: !row.published, updatedAt: new Date().toISOString() })
      .where(eq(menuItems.id, id))
      .run();
  }
  revalidateSite();
}

export async function toggleMenuCategoryAction(fd: FormData) {
  await requireAdmin();
  await assertSameOrigin();
  const id = Number(str(fd, "id"));
  const row = db.select().from(menuCategories).where(eq(menuCategories.id, id)).all()[0];
  if (row) {
    db.update(menuCategories)
      .set({ published: !row.published, updatedAt: new Date().toISOString() })
      .where(eq(menuCategories.id, id))
      .run();
  }
  revalidateSite();
}

/* ---------------------------------------------------------------- packages */

export async function savePackageAction(
  _prev: ActionState | null,
  fd: FormData,
): Promise<ActionState> {
  await requireAdmin();
  await assertSameOrigin();

  const id = str(fd, "id");
  const parsed = packageSchema.safeParse({
    pillar: str(fd, "pillar"),
    nameEn: str(fd, "nameEn"),
    nameAr: str(fd, "nameAr"),
    summaryEn: str(fd, "summaryEn"),
    summaryAr: str(fd, "summaryAr"),
    inclusionsEn: list(fd, "inclusionsEn"),
    inclusionsAr: list(fd, "inclusionsAr"),
    minGuests: str(fd, "minGuests") ?? "",
    maxGuests: str(fd, "maxGuests") ?? "",
    priceFrom: str(fd, "priceFrom") ?? "",
    priceUnit: str(fd, "priceUnit") ?? "",
    priceNoteEn: str(fd, "priceNoteEn"),
    priceNoteAr: str(fd, "priceNoteAr"),
    sort: str(fd, "sort") || 0,
    published: bool(fd, "published"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" ? v : null);

  const values = {
    pillar: d.pillar,
    nameEn: d.nameEn,
    nameAr: nn(d.nameAr),
    summaryEn: nn(d.summaryEn),
    summaryAr: nn(d.summaryAr),
    inclusionsEn: JSON.stringify(d.inclusionsEn),
    inclusionsAr: JSON.stringify(d.inclusionsAr),
    minGuests: num(d.minGuests),
    maxGuests: num(d.maxGuests),
    priceFromFils: d.priceFrom,
    priceUnit: d.priceUnit ? d.priceUnit : null,
    priceNoteEn: nn(d.priceNoteEn),
    priceNoteAr: nn(d.priceNoteAr),
    sort: d.sort,
    published: d.published,
    updatedAt: new Date().toISOString(),
  };

  if (id) db.update(packages).set(values).where(eq(packages.id, Number(id))).run();
  else db.insert(packages).values(values).run();

  revalidateSite();
  return { ok: true, message: "Package saved." };
}

export async function deletePackageAction(fd: FormData) {
  await requireAdmin();
  await assertSameOrigin();
  const id = Number(str(fd, "id"));
  if (id) db.delete(packages).where(eq(packages.id, id)).run();
  revalidateSite();
  redirect("/admin/packages");
}

/* ------------------------------------------------------------ venue spaces */

export async function saveVenueSpaceAction(
  _prev: ActionState | null,
  fd: FormData,
): Promise<ActionState> {
  await requireAdmin();
  await assertSameOrigin();

  const id = str(fd, "id");
  const parsed = venueSpaceSchema.safeParse({
    nameEn: str(fd, "nameEn"),
    nameAr: str(fd, "nameAr"),
    descriptionEn: str(fd, "descriptionEn"),
    descriptionAr: str(fd, "descriptionAr"),
    seatedCapacity: str(fd, "seatedCapacity") ?? "",
    standingCapacity: str(fd, "standingCapacity") ?? "",
    featuresEn: list(fd, "featuresEn"),
    featuresAr: list(fd, "featuresAr"),
    sort: str(fd, "sort") || 0,
    published: bool(fd, "published"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" ? v : null);

  const values = {
    nameEn: d.nameEn,
    nameAr: nn(d.nameAr),
    descriptionEn: nn(d.descriptionEn),
    descriptionAr: nn(d.descriptionAr),
    seatedCapacity: num(d.seatedCapacity),
    standingCapacity: num(d.standingCapacity),
    featuresEn: JSON.stringify(d.featuresEn),
    featuresAr: JSON.stringify(d.featuresAr),
    sort: d.sort,
    published: d.published,
    updatedAt: new Date().toISOString(),
  };

  if (id) db.update(venueSpaces).set(values).where(eq(venueSpaces.id, Number(id))).run();
  else db.insert(venueSpaces).values(values).run();

  revalidateSite();
  return { ok: true, message: "Space saved." };
}

export async function deleteVenueSpaceAction(fd: FormData) {
  await requireAdmin();
  await assertSameOrigin();
  const id = Number(str(fd, "id"));
  if (id) db.delete(venueSpaces).where(eq(venueSpaces.id, id)).run();
  revalidateSite();
  redirect("/admin/spaces");
}

/* ----------------------------------------------------------------- gallery */

const ALLOWED_IMAGE = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function uploadGalleryImageAction(
  _prev: ActionState | null,
  fd: FormData,
): Promise<ActionState> {
  await requireAdmin();
  await assertSameOrigin();

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That image is larger than 8 MB." };

  const ext = ALLOWED_IMAGE.get(file.type);
  if (!ext) return { error: "Images must be JPEG, PNG, WebP or AVIF." };

  const parsed = galleryImageSchema.safeParse({
    pillar: str(fd, "pillar") || "restaurant",
    altEn: str(fd, "altEn"),
    altAr: str(fd, "altAr"),
    captionEn: str(fd, "captionEn"),
    captionAr: str(fd, "captionAr"),
    credit: str(fd, "credit"),
    sort: str(fd, "sort") || 0,
    published: bool(fd, "published"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  // Filename is generated, never taken from the upload — no path traversal, no collisions.
  const name = `${crypto.randomBytes(12).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
  db.insert(galleryImages)
    .values({
      pillar: d.pillar,
      filePath: `/uploads/${name}`,
      altEn: d.altEn,
      altAr: nn(d.altAr),
      captionEn: nn(d.captionEn),
      captionAr: nn(d.captionAr),
      credit: nn(d.credit),
      sort: d.sort,
      published: d.published,
    })
    .run();

  revalidateSite();
  return { ok: true, message: "Image uploaded." };
}

export async function deleteGalleryImageAction(fd: FormData) {
  await requireAdmin();
  await assertSameOrigin();
  const id = Number(str(fd, "id"));
  const row = db.select().from(galleryImages).where(eq(galleryImages.id, id)).all()[0];
  if (row) {
    db.delete(galleryImages).where(eq(galleryImages.id, id)).run();
    // Only ever unlink inside public/uploads.
    const base = path.join(process.cwd(), "public", "uploads");
    const target = path.join(base, path.basename(row.filePath));
    if (target.startsWith(base)) await fs.unlink(target).catch(() => {});
  }
  revalidateSite();
  redirect("/admin/gallery");
}

export async function toggleGalleryImageAction(fd: FormData) {
  await requireAdmin();
  await assertSameOrigin();
  const id = Number(str(fd, "id"));
  const row = db.select().from(galleryImages).where(eq(galleryImages.id, id)).all()[0];
  if (row) {
    db.update(galleryImages).set({ published: !row.published }).where(eq(galleryImages.id, id)).run();
  }
  revalidateSite();
}

/* --------------------------------------------------------------- enquiries */

export async function updateEnquiryAction(
  _prev: ActionState | null,
  fd: FormData,
): Promise<ActionState> {
  await requireAdmin();
  await assertSameOrigin();
  const parsed = enquiryUpdateSchema.safeParse({
    id: str(fd, "id"),
    status: str(fd, "status"),
    adminNotes: str(fd, "adminNotes"),
  });
  if (!parsed.success) return { error: "Invalid input." };
  db.update(enquiries)
    .set({
      status: parsed.data.status,
      adminNotes: parsed.data.adminNotes?.trim() || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(enquiries.id, parsed.data.id))
    .run();
  return { ok: true, message: "Enquiry updated." };
}
