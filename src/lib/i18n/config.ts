export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeMeta: Record<Locale, { label: string; dir: "ltr" | "rtl"; htmlLang: string }> = {
  en: { label: "English", dir: "ltr", htmlLang: "en-AE" },
  ar: { label: "العربية", dir: "rtl", htmlLang: "ar-AE" },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function dirFor(locale: Locale) {
  return localeMeta[locale].dir;
}

/**
 * Route slugs are localised per locale so Arabic URLs are meaningful and indexable
 * separately, while a single canonical route key drives navigation and metadata.
 */
export const routeKeys = [
  "home",
  "restaurant",
  "menu",
  "weddings",
  "corporate",
  "catering",
  "brunch",
  "gallery",
  "about",
  "contact",
  "privacy",
] as const;
export type RouteKey = (typeof routeKeys)[number];

export const routeSlugs: Record<RouteKey, Record<Locale, string>> = {
  home: { en: "", ar: "" },
  restaurant: { en: "restaurant", ar: "المطعم" },
  menu: { en: "menu", ar: "قائمة-الطعام" },
  weddings: { en: "weddings", ar: "الأعراس" },
  corporate: { en: "corporate", ar: "فعاليات-الشركات" },
  catering: { en: "catering", ar: "خدمات-الضيافة" },
  brunch: { en: "brunch", ar: "برانش-الأحد" },
  gallery: { en: "gallery", ar: "معرض-الصور" },
  about: { en: "about", ar: "عن-جزيل" },
  contact: { en: "contact", ar: "اتصل-بنا" },
  privacy: { en: "privacy", ar: "سياسة-الخصوصية" },
};

export function hrefFor(key: RouteKey, locale: Locale) {
  const slug = routeSlugs[key][locale];
  return slug ? `/${locale}/${slug}` : `/${locale}`;
}

/** Reverse lookup: given a locale and a URL slug, which route key is it? */
export function routeKeyFromSlug(locale: Locale, slug: string): RouteKey | null {
  const decoded = decodeURIComponent(slug);
  for (const key of routeKeys) {
    if (routeSlugs[key][locale] === decoded) return key;
  }
  return null;
}

/** Every localised path for a route key — used for hreflang alternates. */
export function alternatesFor(key: RouteKey) {
  return Object.fromEntries(locales.map((l) => [localeMeta[l].htmlLang, hrefFor(key, l)])) as Record<
    string,
    string
  >;
}
