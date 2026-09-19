import { describe, expect, it } from "vitest";
import {
  alternatesFor,
  hrefFor,
  isLocale,
  locales,
  routeKeys,
  routeKeyFromSlug,
  routeSlugs,
} from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

describe("locale routing", () => {
  it("recognises only the supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("builds a locale-prefixed href for every route in both languages", () => {
    for (const key of routeKeys) {
      for (const locale of locales) {
        const href = hrefFor(key, locale);
        expect(href.startsWith(`/${locale}`)).toBe(true);
      }
    }
  });

  it("round-trips every localised slug back to its route key", () => {
    for (const key of routeKeys) {
      if (key === "home") continue;
      for (const locale of locales) {
        const slug = routeSlugs[key][locale];
        expect(routeKeyFromSlug(locale, slug)).toBe(key);
      }
    }
  });

  it("decodes percent-encoded Arabic slugs", () => {
    const slug = routeSlugs.weddings.ar;
    expect(routeKeyFromSlug("ar", encodeURIComponent(slug))).toBe("weddings");
  });

  it("returns null for an unknown slug", () => {
    expect(routeKeyFromSlug("en", "not-a-page")).toBeNull();
  });

  it("gives every route an alternate in each language", () => {
    for (const key of routeKeys) {
      const alt = alternatesFor(key);
      expect(Object.keys(alt)).toHaveLength(locales.length);
    }
  });

  it("uses distinct slugs per language so URLs are indexable separately", () => {
    for (const key of routeKeys) {
      if (key === "home") continue;
      expect(routeSlugs[key].en).not.toBe(routeSlugs[key].ar);
    }
  });
});

describe("dictionaries", () => {
  it("has the same key structure in both languages", () => {
    const walk = (o: unknown, prefix = ""): string[] =>
      typeof o === "object" && o !== null
        ? Object.entries(o).flatMap(([k, v]) =>
            typeof v === "object" && v !== null ? walk(v, `${prefix}${k}.`) : [`${prefix}${k}`],
          )
        : [];
    expect(walk(getDictionary("ar")).sort()).toEqual(walk(getDictionary("en")).sort());
  });

  it("has no empty Arabic interface string where English has text", () => {
    const en = getDictionary("en");
    const ar = getDictionary("ar");
    const compare = (a: unknown, b: unknown, path = "") => {
      if (typeof a === "string") {
        if (a.length > 0 && path !== "labels.switchToEnglish") {
          expect(String(b).length, `empty Arabic for ${path}`).toBeGreaterThan(0);
        }
        return;
      }
      if (typeof a === "object" && a !== null) {
        for (const [k, v] of Object.entries(a)) {
          compare(v, (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
        }
      }
    };
    compare(en, ar);
  });
});
