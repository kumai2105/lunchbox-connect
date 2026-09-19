import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales, routeKeyFromSlug, routeSlugs, type Locale, type RouteKey } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { galleryHasContent, getPage, localized } from "@/lib/content";
import { buildMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/pages/PillarPage";
import { MenuPage } from "@/components/pages/MenuPage";
import {
  AboutPage,
  ContactPage,
  GalleryPage,
  PrivacyPage,
  RestaurantPage,
} from "@/components/pages/SimplePages";

/**
 * Content comes from the database. Pages are prerendered for speed and regenerated on demand:
 * every admin save calls revalidatePath("/", "layout"), so edits appear immediately. The hourly
 * revalidate below is only a safety net if an on-demand revalidation is ever missed.
 */
export const revalidate = 3600;

/**
 * One catch-all resolves every content route.
 *
 * Why: the URL slug differs per language (`/en/weddings` vs `/ar/الأعراس`). A catch-all keeps
 * a single canonical `RouteKey` behind both, so navigation, breadcrumbs, hreflang alternates
 * and metadata are all generated from one source instead of duplicated per locale.
 */

export function generateStaticParams() {
  const params: { locale: string; slug: string[] }[] = [];
  for (const locale of locales) {
    for (const key of Object.keys(routeSlugs) as RouteKey[]) {
      const slug = routeSlugs[key][locale];
      if (slug) params.push({ locale, slug: [slug] });
    }
  }
  return params;
}

async function resolve(params: Promise<{ locale: string; slug: string[] }>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return null;
  if (!slug || slug.length !== 1) return null;
  const key = routeKeyFromSlug(locale, slug[0]);
  if (!key || key === "home") return null;
  return { locale: locale as Locale, key };
}

const PAGE_SLUG: Record<Exclude<RouteKey, "home">, string> = {
  restaurant: "restaurant",
  menu: "menu",
  weddings: "weddings",
  corporate: "corporate",
  catering: "catering",
  brunch: "brunch",
  gallery: "gallery",
  about: "about",
  contact: "contact",
  privacy: "privacy",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}): Promise<Metadata> {
  const resolved = await resolve(params);
  if (!resolved) return {};
  const { locale, key } = resolved;
  const t = getDictionary(locale);
  const page = await getPage(PAGE_SLUG[key as Exclude<RouteKey, "home">]);

  const fallbackTitle = t.nav[key as keyof typeof t.nav] as string;
  return buildMetadata({
    routeKey: key,
    locale,
    title: localized(locale, page?.seoTitleEn, page?.seoTitleAr) ?? fallbackTitle,
    description: localized(locale, page?.seoDescriptionEn, page?.seoDescriptionAr),
  });
}

export default async function ContentRoute({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  const { locale, key } = resolved;

  switch (key) {
    case "restaurant":
      return <RestaurantPage locale={locale} />;
    case "menu":
      return <MenuPage locale={locale} />;
    case "weddings":
      return (
        <PillarPage
          locale={locale}
          routeKey="weddings"
          pillar="wedding"
          enquiryType="wedding"
          slug="weddings"
        />
      );
    case "corporate":
      return (
        <PillarPage
          locale={locale}
          routeKey="corporate"
          pillar="corporate"
          enquiryType="corporate"
          slug="corporate"
        />
      );
    case "catering":
      return (
        <PillarPage
          locale={locale}
          routeKey="catering"
          pillar="catering"
          enquiryType="catering"
          slug="catering"
        />
      );
    case "brunch":
      return (
        <PillarPage
          locale={locale}
          routeKey="brunch"
          pillar="brunch"
          enquiryType="brunch"
          slug="brunch"
          showBrunchTimes
        />
      );
    case "gallery": {
      // Hidden until the owner uploads at least one real photograph.
      if (!(await galleryHasContent())) notFound();
      return <GalleryPage locale={locale} />;
    }
    case "about":
      return <AboutPage locale={locale} />;
    case "contact":
      return <ContactPage locale={locale} />;
    case "privacy":
      return <PrivacyPage locale={locale} />;
    default:
      notFound();
  }
}
