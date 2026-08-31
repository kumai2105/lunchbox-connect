import type { Metadata } from "next";
import { FACTS } from "./facts";
import { alternatesFor, hrefFor, localeMeta, type Locale, type RouteKey } from "./i18n/config";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

interface PageMetaInput {
  routeKey: RouteKey;
  locale: Locale;
  title: string;
  description?: string | null;
  noindex?: boolean;
}

export function buildMetadata({
  routeKey,
  locale,
  title,
  description,
  noindex,
}: PageMetaInput): Metadata {
  const path = hrefFor(routeKey, locale);
  const languages = Object.fromEntries(
    Object.entries(alternatesFor(routeKey)).map(([k, v]) => [k, absoluteUrl(v)]),
  );

  return {
    title,
    description: description ?? undefined,
    alternates: {
      canonical: absoluteUrl(path),
      languages: { ...languages, "x-default": absoluteUrl(hrefFor(routeKey, "en")) },
    },
    openGraph: {
      type: "website",
      siteName: FACTS.nameEn.value,
      title,
      description: description ?? undefined,
      url: absoluteUrl(path),
      locale: localeMeta[locale].htmlLang.replace("-", "_"),
    },
    twitter: { card: "summary", title, description: description ?? undefined },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

/* ------------------------------------------------------------ structured data */

/**
 * EVIDENCE-SAFE STRUCTURED DATA.
 *
 * Deliberately omitted, each for a documented reason from the Phase 1 dossier:
 *   - aggregateRating / review  → Phase 1 §7: platform ratings conflict (Deliveroo 4.7/52 vs
 *                                 Talabat 4.1/1000) and Google could not be inspected. Publishing
 *                                 a rating we cannot verify as the business's own would be false.
 *   - geo (lat/lng)             → Phase 1 C-01: two published coordinate pairs ~1.3 km apart.
 *   - servesCuisine: "Halal"    → Phase 1 §2.7: no halal claim or evidence exists anywhere.
 *   - hasMenu with prices       → Phase 1 §5: the only public menu is a single third-party
 *                                 snapshot; prices are not owner-approved.
 *   - Event                     → No dated event exists in evidence; inventing one is fabrication.
 *   - areaServed                → Delivery geography is UNKNOWN (Phase 1 §17.2).
 *   - acceptsReservations: true → Phase 1 §2.5: reservations are claimed by one directory with
 *                                 no mechanism found. We assert `false` rather than imply booking.
 */
export function restaurantJsonLd(locale: Locale) {
  const isAr = locale === "ar";
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": absoluteUrl("/#restaurant"),
    name: isAr ? FACTS.nameAr.value : FACTS.nameEn.value,
    alternateName: isAr ? FACTS.nameEn.value : FACTS.nameAr.value,
    url: absoluteUrl(hrefFor("home", locale)),
    telephone: FACTS.phone.value,
    priceRange: FACTS.priceRange.value,
    servesCuisine: FACTS.cuisines.value,
    currenciesAccepted: "AED",
    acceptsReservations: false,
    address: {
      "@type": "PostalAddress",
      streetAddress: isAr
        ? `${FACTS.addressLine1Ar.value}، ${FACTS.addressLine2Ar.value}`
        : `${FACTS.addressLine1En.value}, ${FACTS.addressLine2En.value}`,
      addressLocality: isAr ? FACTS.cityAr.value : FACTS.cityEn.value,
      addressCountry: "AE",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: FACTS.hoursOpen.value,
        closes: FACTS.hoursClose.value,
      },
    ],
    sameAs: [
      ...FACTS.social.value.map((s) => s.url),
      ...FACTS.deliveryPartners.value.map((d) => d.url),
    ],
  };
}

export function websiteJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: locale === "ar" ? FACTS.nameAr.value : FACTS.nameEn.value,
    url: absoluteUrl(hrefFor("home", locale)),
    inLanguage: localeMeta[locale].htmlLang,
  };
}

export function breadcrumbJsonLd(
  locale: Locale,
  trail: { name: string; routeKey: RouteKey }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: absoluteUrl(hrefFor(t.routeKey, locale)),
    })),
  };
}

/**
 * A `Service` node for the three commercial pillars. Uses only the fact that the service is
 * offered (OWNER-PROVIDED) — no offers, no prices, no capacities, no event dates.
 */
export function serviceJsonLd(opts: {
  locale: Locale;
  routeKey: RouteKey;
  name: string;
  description?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url: absoluteUrl(hrefFor(opts.routeKey, opts.locale)),
    provider: { "@id": absoluteUrl("/#restaurant") },
    areaServed: { "@type": "City", name: "Dubai" },
  };
}
