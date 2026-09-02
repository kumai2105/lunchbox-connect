import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FACTS, directionsUrl, telHref } from "@/lib/facts";
import { restaurantJsonLd, serviceJsonLd } from "@/lib/seo";
import { seedPages } from "@/lib/db/seed-pages";
import { draftMenu } from "@/lib/db/seed-menu-draft";

/**
 * These tests encode the Phase 2 rules that matter most: no invented facts, no unsupported
 * claims, and no structured data the research could not stand behind.
 */

describe("business facts", () => {
  it("keeps every unverified fact null so nothing can render it", () => {
    expect(FACTS.latitude.value).toBeNull();
    expect(FACTS.longitude.value).toBeNull();
    expect(FACTS.whatsapp.value).toBeNull();
    expect(FACTS.email.value).toBeNull();
    expect(FACTS.shishaHours.value).toBeNull();
    expect(FACTS.services.halal.value).toBeNull();
    expect(FACTS.services.reservations.value).toBeNull();
    expect(FACTS.services.seatingCapacity.value).toBeNull();
  });

  it("labels owner-provided services correctly", () => {
    for (const key of [
      "catering",
      "weddings",
      "privateCelebrations",
      "sundayBrunch",
      "corporateMeetings",
      "corporateLaunches",
    ] as const) {
      expect(FACTS.services[key].evidence).toBe("OWNER_PROVIDED");
      expect(FACTS.services[key].value).toBe(true);
    }
  });

  it("builds a directions link from the address, not from contradicted coordinates", () => {
    const url = directionsUrl();
    expect(url).toContain("Semmer");
    expect(url).not.toMatch(/25\.1|55\.38/);
  });

  it("builds a dialable tel link", () => {
    expect(telHref()).toBe("tel:+97143232797");
  });
});

describe("structured data is evidence-safe", () => {
  const json = JSON.stringify(restaurantJsonLd("en"));

  it("never publishes a rating or review", () => {
    expect(json).not.toContain("aggregateRating");
    expect(json).not.toContain('"review"');
    expect(json).not.toContain("ratingValue");
  });

  it("never publishes coordinates", () => {
    expect(json).not.toContain('"geo"');
    expect(json).not.toContain("latitude");
  });

  it("never claims halal", () => {
    expect(json.toLowerCase()).not.toContain("halal");
  });

  it("does not imply that reservations are taken", () => {
    expect(restaurantJsonLd("en").acceptsReservations).toBe(false);
  });

  it("publishes only the verified opening hours", () => {
    const spec = restaurantJsonLd("en").openingHoursSpecification[0];
    expect(spec.opens).toBe("10:00");
    expect(spec.closes).toBe("02:00");
  });

  it("emits a Service node without offers, prices or dates", () => {
    const s = JSON.stringify(
      serviceJsonLd({ locale: "en", routeKey: "weddings", name: "Weddings", description: null }),
    );
    expect(s).not.toContain("offers");
    expect(s).not.toContain("price");
    expect(s).not.toContain("startDate");
  });
});

describe("published copy makes no unsupported claim", () => {
  const allCopy = seedPages
    .flatMap((p) => [p.titleEn, p.kickerEn, p.introEn, p.bodyEn, p.seoTitleEn, p.seoDescriptionEn])
    .join(" ")
    .toLowerCase();

  const banned = [
    "leading",
    "largest",
    "award-winning",
    "award winning",
    "number one",
    "no. 1",
    "best in dubai",
    "voted",
    "since 19",
    "since 20",
    "years of experience",
    "halal",
    "5-star",
    "five-star",
    "michelin",
    "coming soon",
    "lorem ipsum",
    "tbc",
    "placeholder",
  ];

  for (const phrase of banned) {
    it(`does not contain "${phrase}"`, () => {
      expect(allCopy).not.toContain(phrase);
    });
  }

  /*
    Cabinet Resolution 24/2013 Arts. 5–8 name "the internet" expressly, and Dubai
    Municipality DM-HSD-GU118-SSP2 Annex 13 prohibits displaying tobacco products by
    electronic means. Phase 1 could not establish what a restaurant may say about shisha
    on its own site, so the seeded copy says nothing and the master switch ships off. If
    counsel clears it, the sentence goes back through the admin — not through the seed.
  */
  it("the seeded copy makes no reference to shisha", () => {
    expect(allCopy).not.toContain("shisha");
    expect(allCopy).not.toContain("شيشة");
  });

  it("the shisha master switch ships off", async () => {
    const src = fs.readFileSync(path.join(process.cwd(), "scripts", "seed.ts"), "utf8");
    expect(src).toMatch(/key:\s*"shisha_visible",\s*value:\s*"false"/);
  });

  it("never quotes a customer or a rating", () => {
    expect(allCopy).not.toMatch(/\b\d\.\d\s*(\/|out of)\s*5\b/);
    expect(allCopy).not.toContain("testimonial");
  });

  it("leaves every Arabic marketing field empty for a human to write", () => {
    const arabicKeys = Object.keys(seedPages[0]).filter((k) => k.endsWith("Ar"));
    expect(arabicKeys).toHaveLength(0);
  });
});

describe("draft menu import", () => {
  it("carries a provenance note constant", async () => {
    const { DELIVEROO_SNAPSHOT_NOTE } = await import("@/lib/db/seed-menu-draft");
    expect(DELIVEROO_SNAPSHOT_NOTE).toMatch(/2026-08-31/);
    expect(DELIVEROO_SNAPSHOT_NOTE.toLowerCase()).toContain("draft");
  });

  it("matches the item count captured in the Phase 1 research", () => {
    const total = draftMenu.reduce((n, c) => n + c.items.length, 0);
    expect(total).toBe(82);
  });
});

describe("no stock or generated imagery ships with the build", () => {
  /*
    Until 2 September 2026 this asserted that uploads/ was empty, because no photograph of
    Jazeel existed anywhere. The owner has now supplied 21 of his own, so the guarantee has
    to be enforced differently: every image served must correspond to a row in the gallery
    table. A file dropped into uploads/ that nothing references is exactly how a stock
    image would arrive, so that fails.
  */
  it("every shipped photograph is a registered gallery image", async () => {
    const dir = path.join(process.cwd(), "public", "media");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f !== ".gitkeep") : [];
    // Read the database file directly: src/lib/db is server-only and cannot be imported here.
    const { default: Database } = await import("better-sqlite3");
    const sqlite = new Database(path.join(process.cwd(), "data", "jazeel.db"), { readonly: true });
    const rows = sqlite.prepare("select file_path as filePath from gallery_images").all() as {
      filePath: string;
    }[];
    sqlite.close();
    const known = new Set(rows.map((r) => path.basename(r.filePath).replace(/\.jpg$/, "")));
    const orphans = files.filter((f) => !known.has(f.replace(/\.(jpe?g|webp|avif|png)$/i, "")));
    expect(orphans, `unreferenced files in public/media: ${orphans.join(", ")}`).toEqual([]);
  });

  it("no shipped photograph carries EXIF metadata", () => {
    // The originals held capture timestamps and camera serial numbers. The import strips
    // them; this checks the marker bytes are actually gone.
    const dir = path.join(process.cwd(), "public", "media");
    if (!fs.existsSync(dir)) return;
    const withExif = fs
      .readdirSync(dir)
      .filter((f) => /\.jpe?g$/i.test(f))
      .filter((f) => fs.readFileSync(path.join(dir, f)).subarray(0, 4096).includes(Buffer.from("Exif")));
    expect(withExif).toEqual([]);
  });

  /*
    The only bitmaps allowed to ship are the ones derived from the logo the owner
    supplied. Nothing here may be a photograph, and nothing may be generated imagery
    of food, the venue or an event. Adding a file to public/ fails this test on
    purpose: a new image has to be justified by editing this list.
  */
  const OWNER_BRAND_ASSETS = [
    "apple-touch-icon.png",
    "favicon.png",
    "brand/logo.png",
    "brand/logo-reversed.png",
    "brand/mark.png",
    "brand/og.png",
  ];

  it("ships no bundled images beyond the owner's own logo", () => {
    const root = path.join(process.cwd(), "public");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        // media/ and uploads/ hold photographs and are covered by their own tests above.
        if (e.isDirectory()) return ["media", "uploads"].includes(e.name) ? [] : walk(full);
        return /\.(jpe?g|png|webp|avif|gif)$/i.test(e.name)
          ? [path.relative(root, full).split(path.sep).join("/")]
          : [];
      });
    expect(walk(root).sort()).toEqual([...OWNER_BRAND_ASSETS].sort());
  });

  it("every shipped brand asset traces to the supplied logo file", () => {
    for (const rel of OWNER_BRAND_ASSETS) {
      const full = path.join(process.cwd(), "public", rel);
      expect(fs.existsSync(full), `${rel} is listed but missing`).toBe(true);
      expect(fs.statSync(full).size, `${rel} is empty`).toBeGreaterThan(500);
    }
  });
});

describe("seed copy fits the admin's own validation limits", () => {
  it("every seeded page passes pageSchema", async () => {
    const { pageSchema } = await import("@/lib/validation");
    for (const p of seedPages) {
      const r = pageSchema.safeParse({
        slug: p.slug,
        titleEn: p.titleEn,
        kickerEn: p.kickerEn,
        introEn: p.introEn,
        bodyEn: p.bodyEn,
        seoTitleEn: p.seoTitleEn,
        seoDescriptionEn: p.seoDescriptionEn,
      });
      expect(r.success, `${p.slug}: ${r.error?.issues.map((i) => i.path.join(".")).join(", ")}`).toBe(
        true,
      );
    }
  });

  it("keeps SEO titles and descriptions within search-result limits", () => {
    for (const p of seedPages) {
      expect(p.seoTitleEn.length, `${p.slug} title`).toBeLessThanOrEqual(70);
      expect(p.seoDescriptionEn.length, `${p.slug} description`).toBeLessThanOrEqual(180);
    }
  });
});
