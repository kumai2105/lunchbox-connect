import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  galleryImages,
  menuCategories,
  menuItems,
  packages,
  pages,
  settings,
  venueSpaces,
  type GalleryImage,
  type MenuCategory,
  type MenuItem,
  type PackageRow,
  type PageRow,
  type VenueSpace,
} from "./db/schema";
import type { Locale } from "./i18n/config";

/**
 * Bilingual field resolution.
 *
 * Rule (docs/BLUEPRINT.md §6): Arabic is NEVER machine-generated. If the Arabic value is empty
 * we fall back to the approved English value rather than inventing Arabic marketing copy, and
 * the admin surfaces the gap. `localized` returns null when BOTH are empty so the caller can
 * omit the block entirely instead of rendering an empty heading.
 */
export function localized(
  locale: Locale,
  en: string | null | undefined,
  ar: string | null | undefined,
): string | null {
  const enV = en?.trim() || null;
  const arV = ar?.trim() || null;
  if (locale === "ar") return arV ?? enV;
  return enV ?? arV;
}


/**
 * True when the value shown for `locale` actually came from the other language.
 *
 * Used to tag fallback text with the correct `lang`/`dir` so that English copy sitting inside an
 * Arabic page renders and is announced correctly, instead of inheriting RTL and pushing its
 * punctuation to the wrong side.
 */
export function isFallback(
  locale: Locale,
  en: string | null | undefined,
  ar: string | null | undefined,
): boolean {
  const enV = en?.trim() || null;
  const arV = ar?.trim() || null;
  if (locale === "ar") return !arV && !!enV;
  return !enV && !!arV;
}

/** Attributes to spread onto an element holding fallback text. */
export function fallbackAttrs(locale: Locale, fallback: boolean) {
  if (!fallback) return {};
  const other = locale === "ar" ? "en" : "ar";
  return { lang: other, dir: other === "ar" ? ("rtl" as const) : ("ltr" as const) };
}

/** True when the Arabic column is genuinely missing — used by admin warnings only. */
export function arabicMissing(ar: string | null | undefined) {
  return !(ar?.trim());
}

export function parseList(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function formatPrice(fils: number | null | undefined, currency = "AED", locale: Locale = "en") {
  if (fils == null) return null;
  const amount = fils / 100;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${nf.format(amount)}`;
}

/* ------------------------------------------------------------------ settings */

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  const out: Record<string, string> = {};
  for (const r of rows) if (r.value != null && r.value !== "") out[r.key] = r.value;
  return out;
}

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value?.trim() || null;
}

/* --------------------------------------------------------------- page copy */

export async function getPage(slug: string): Promise<PageRow | null> {
  /*
    `published` is honoured here. It was not until 2 Sep 2026: the admin showed a
    Published checkbox, saved it, reported success, and the page kept rendering to the
    public regardless. A control that silently does nothing is worse than no control,
    and this one is how the owner would withdraw a page whose copy turned out to be
    wrong. Unpublishing now yields null, and the route renders a 404.
  */
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug), eq(pages.published, true)))
    .limit(1);
  return row ?? null;
}

/* -------------------------------------------------------------------- menu */

export interface MenuCategoryWithItems {
  category: MenuCategory;
  items: MenuItem[];
}

/** Published categories with their published, in-scope items. Empty array is a valid answer. */
export async function getPublishedMenu(): Promise<MenuCategoryWithItems[]> {
  const cats = await db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.published, true))
    .orderBy(asc(menuCategories.sort), asc(menuCategories.id));

  if (cats.length === 0) return [];

  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.published, true))
    .orderBy(asc(menuItems.sort), asc(menuItems.id));

  return cats
    .map((category) => ({ category, items: items.filter((i) => i.categoryId === category.id) }))
    .filter((g) => g.items.length > 0);
}

export async function getFeaturedItems(limit = 6): Promise<MenuItem[]> {
  const rows = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.published, true), eq(menuItems.featured, true)))
    .orderBy(asc(menuItems.sort), asc(menuItems.id));
  return rows.slice(0, limit);
}

/* --------------------------------------------------------------- packages */

export type Pillar = "wedding" | "corporate" | "catering" | "brunch";

export async function getPackages(pillar: Pillar): Promise<PackageRow[]> {
  return db
    .select()
    .from(packages)
    .where(and(eq(packages.pillar, pillar), eq(packages.published, true)))
    .orderBy(asc(packages.sort), asc(packages.id));
}

export async function getVenueSpaces(): Promise<VenueSpace[]> {
  return db
    .select()
    .from(venueSpaces)
    .where(eq(venueSpaces.published, true))
    .orderBy(asc(venueSpaces.sort), asc(venueSpaces.id));
}

/* ---------------------------------------------------------------- gallery */

export async function getGallery(pillar?: string): Promise<GalleryImage[]> {
  const where = pillar
    ? and(eq(galleryImages.published, true), eq(galleryImages.pillar, pillar))
    : eq(galleryImages.published, true);
  return db
    .select()
    .from(galleryImages)
    .where(where)
    .orderBy(asc(galleryImages.sort), asc(galleryImages.id));
}

/**
 * The gallery route is hidden from navigation and 404s until at least one real, owner-supplied
 * image exists. No stock photography, no AI imagery — see docs/BLUEPRINT.md §5.
 */
export async function galleryHasContent(): Promise<boolean> {
  const rows = await db
    .select({ id: galleryImages.id })
    .from(galleryImages)
    .where(eq(galleryImages.published, true))
    .limit(1);
  return rows.length > 0;
}
