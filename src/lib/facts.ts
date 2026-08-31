/**
 * Single source of truth for BUSINESS FACTS, each carrying its Phase 1 evidence class.
 *
 * Nothing may be published by this site that is not either:
 *   - VERIFIED       (strong current public evidence, Phase 1 dossier), or
 *   - OWNER_PROVIDED (stated by the owner in the Phase 2 brief).
 *
 * UNVERIFIED / UNKNOWN values are represented as `null` and MUST be supplied by the owner
 * through the admin before anything depending on them renders. See docs/CONTENT-REGISTER.md.
 */

export type Evidence = "VERIFIED" | "OWNER_PROVIDED" | "UNVERIFIED" | "UNKNOWN";

export interface Fact<T> {
  value: T;
  evidence: Evidence;
  /** Where the claim comes from — kept for auditability, never rendered publicly. */
  source: string;
}

const f = <T,>(value: T, evidence: Evidence, source: string): Fact<T> => ({ value, evidence, source });

export const FACTS = {
  /* ---------------------------------------------------------------- identity */
  nameEn: f("Jazeel Restaurant & Café", "VERIFIED", "Dossier §2.1 — HiDubai, BizOnline, Talabat"),
  nameAr: f("مطعم ومقهى جزيل", "VERIFIED", "Dossier §2.1 — BizOnline Arabic listing"),
  shortName: f("Jazeel", "VERIFIED", "Dossier §2.1"),

  /* --------------------------------------------------------------- location */
  addressLine1En: f("Semmer Villas Community Centre", "VERIFIED", "Dossier §2.2 — five sources"),
  addressLine2En: f("A1/2, Semmer A Street, Nadd Hessa", "VERIFIED", "Dossier §2.2 — 2GIS + Yango"),
  cityEn: f("Dubai Silicon Oasis, Dubai", "VERIFIED", "Dossier §2.2"),
  countryEn: f("United Arab Emirates", "VERIFIED", "Dossier §2.2"),

  addressLine1Ar: f("مركز مجتمع سمر فيلاز", "VERIFIED", "Translation of a verified address, not a claim"),
  addressLine2Ar: f("A1/2، شارع سمر A، ند حصة", "VERIFIED", "Translation of a verified address"),
  cityAr: f("واحة دبي للسيليكون، دبي", "VERIFIED", "Translation of a verified address"),
  countryAr: f("الإمارات العربية المتحدة", "VERIFIED", "Translation of a verified address"),

  /**
   * CONTRADICTED in Phase 1 (§16 C-01): two published coordinate pairs ~1.3 km apart.
   * Deliberately null — no geo in structured data, no embedded pin. Directions use the address.
   */
  latitude: f(null as number | null, "UNVERIFIED", "Dossier C-01 — contradicted coordinates"),
  longitude: f(null as number | null, "UNVERIFIED", "Dossier C-01 — contradicted coordinates"),

  /* ---------------------------------------------------------------- contact */
  phone: f("+97143232797", "VERIFIED", "Dossier §2.3 — five independent sources"),
  phoneDisplay: f("+971 4 323 2797", "VERIFIED", "Dossier §2.3"),
  /** Known to exist (2GIS records WhatsApp availability) but the number is not published anywhere. */
  whatsapp: f(null as string | null, "UNKNOWN", "Dossier §17.2 — number not public"),
  /** Present on the first-party Tipz page but redacted at retrieval. */
  email: f(null as string | null, "UNKNOWN", "Dossier §17.2 — redacted at retrieval"),

  /* ------------------------------------------------------------------ hours */
  hoursOpen: f("10:00", "VERIFIED", "Dossier §2.4 — four sources incl. first-party e-menu"),
  hoursClose: f("02:00", "VERIFIED", "Dossier §2.4"),
  /**
   * Per-day variation, Ramadan hours and kitchen close are UNKNOWN (Dossier §17.2).
   * Shisha service hours are a separate open question (C-02) and are not published.
   */
  shishaHours: f(null as string | null, "UNKNOWN", "Dossier C-02 — open legal/operational question"),

  /* --------------------------------------------------------------- services */
  services: {
    dineIn: f(true, "VERIFIED", "Dossier §2.5"),
    indoorFamilyHall: f(true, "VERIFIED", "Dossier §2.5 — BizOnline, TripAdvisor"),
    outdoorSeating: f(true, "VERIFIED", "Dossier §2.5 — HiDubai, TripAdvisor, 2GIS"),
    kidsArea: f(true, "VERIFIED", "Dossier §2.5 — TripAdvisor amenity + 2021 review"),
    shisha: f(true, "VERIFIED", "Dossier §2.5 — four sources + 2025 review"),
    takeaway: f(true, "VERIFIED", "Dossier §2.5 — HiDubai"),
    delivery: f(true, "VERIFIED", "Dossier §2.5 — live Deliveroo and Talabat storefronts"),
    noAlcohol: f(true, "VERIFIED", "Dossier §14 — HiDubai"),

    // Confirmed by the owner at the start of Phase 2. Published as services offered,
    // never as a track record, scale claim or superlative.
    catering: f(true, "OWNER_PROVIDED", "Phase 2 owner brief"),
    weddings: f(true, "OWNER_PROVIDED", "Phase 2 owner brief"),
    privateCelebrations: f(true, "OWNER_PROVIDED", "Phase 2 owner brief"),
    weekendEvents: f(true, "OWNER_PROVIDED", "Phase 2 owner brief — Friday & Saturday nights"),
    sundayBrunch: f(true, "OWNER_PROVIDED", "Phase 2 owner brief"),
    corporateMeetings: f(true, "OWNER_PROVIDED", "Phase 2 owner brief"),
    corporateLaunches: f(true, "OWNER_PROVIDED", "Phase 2 owner brief"),

    // Explicitly NOT claimed anywhere on the site.
    reservations: f(null, "UNVERIFIED", "Dossier §2.5 — claimed by one directory, no mechanism found"),
    halal: f(null, "UNKNOWN", "Dossier §2.7 — no halal claim or evidence exists. DO NOT PUBLISH."),
    liveMusic: f(null, "UNVERIFIED", "Dossier §2.5 — single uncorroborated source"),
    seatingCapacity: f(null as number | null, "UNVERIFIED", "Dossier §14 — single source (160)"),
  },

  /* ---------------------------------------------------------------- cuisine */
  cuisines: f(
    ["Arabic", "Levantine", "Middle Eastern", "International"],
    "VERIFIED",
    "Dossier §2.6 — platform tags + the menu itself",
  ),
  /**
   * The brief and the venue's own hashtags reference Syrian influence, but NO platform tags it
   * Syrian (Dossier C-12). Left out of structured data until the owner confirms positioning.
   */
  syrianInfluence: f(null, "UNVERIFIED", "Dossier C-12 — unresolved cuisine identity"),

  /* ------------------------------------------------------- delivery partners */
  deliveryPartners: f(
    [
      {
        id: "deliveroo",
        name: "Deliveroo",
        url: "https://deliveroo.ae/en/menu/dubai/silicon-oasis/jazeel-restaurant",
      },
      {
        id: "talabat",
        name: "Talabat",
        url: "https://www.talabat.com/uae/restaurant/622958/jazeel-restaurant-and-cafe-dubai-silicon-oasis",
      },
    ],
    "VERIFIED",
    "Dossier §3.1 — live storefronts confirmed 2026-08-31",
  ),

  /* -------------------------------------------------------- social channels */
  social: f(
    [
      { id: "instagram", name: "Instagram", url: "https://www.instagram.com/jazeel.dxb/" },
      { id: "facebook", name: "Facebook", url: "https://www.facebook.com/JAZEEL.UAE/" },
      { id: "tiktok", name: "TikTok", url: "https://www.tiktok.com/@jazeel_restaurent" },
    ],
    "VERIFIED",
    "Dossier §3.1 — all three linked from the first-party Tipz page",
  ),

  /** Price band observed on Deliveroo 2026-08-31. Used only for schema `priceRange`. */
  priceRange: f("$$", "VERIFIED", "Dossier §5.6 / TripAdvisor $$–$$$"),
} as const;

/** Directions link built from the textual address — no coordinates, because they are contradicted. */
export function directionsUrl() {
  const q = encodeURIComponent(
    `${FACTS.nameEn.value}, ${FACTS.addressLine1En.value}, ${FACTS.cityEn.value}, ${FACTS.countryEn.value}`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function telHref() {
  return `tel:${FACTS.phone.value}`;
}
