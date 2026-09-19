import type { MetadataRoute } from "next";
import { galleryHasContent } from "@/lib/content";
import { hrefFor, locales, routeKeys, type RouteKey } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/seo";

/**
 * Only routes that actually render are listed. The gallery is excluded until real images
 * exist, because until then the route deliberately 404s.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const showGallery = await galleryHasContent();
  const keys = routeKeys.filter((k) => (k === "gallery" ? showGallery : true)) as RouteKey[];

  const priority: Partial<Record<RouteKey, number>> = {
    home: 1,
    weddings: 0.9,
    corporate: 0.9,
    catering: 0.9,
    menu: 0.8,
    restaurant: 0.8,
    brunch: 0.8,
    contact: 0.7,
    about: 0.5,
    gallery: 0.5,
    privacy: 0.2,
  };

  const now = new Date();
  return locales.flatMap((locale) =>
    keys.map((key) => ({
      url: absoluteUrl(hrefFor(key, locale)),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: priority[key] ?? 0.5,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, absoluteUrl(hrefFor(key, l))])),
      },
    })),
  );
}
