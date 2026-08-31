import { describe, expect, it } from "vitest";
import { enquirySchema, menuItemSchema, packageSchema, priceToFils } from "@/lib/validation";

const base = {
  type: "wedding" as const,
  name: "Layla Hassan",
  phone: "+971 50 123 4567",
  consent: true as const,
  locale: "en" as const,
};

describe("enquiry validation", () => {
  it("accepts a minimal valid enquiry", () => {
    const r = enquirySchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const r = enquirySchema.safeParse({ ...base, name: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("rejects an implausible phone number", () => {
    const r = enquirySchema.safeParse({ ...base, phone: "abc" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "phone")).toBe(true);
  });

  it("rejects a submission without consent", () => {
    const r = enquirySchema.safeParse({ ...base, consent: false });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "consent")).toBe(true);
  });

  it("rejects a malformed email but allows an empty one", () => {
    expect(enquirySchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, email: "" }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...base, email: "a@b.co" }).success).toBe(true);
  });

  it("rejects guest counts outside 1–5000", () => {
    expect(enquirySchema.safeParse({ ...base, guests: 0 }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, guests: 5001 }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, guests: 120 }).success).toBe(true);
  });

  it("rejects a filled honeypot", () => {
    const r = enquirySchema.safeParse({ ...base, website: "http://spam.example" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "website")).toBe(true);
  });

  it("rejects a date that is not ISO-formatted", () => {
    expect(enquirySchema.safeParse({ ...base, eventDate: "31/12/2026" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, eventDate: "2026-12-31" }).success).toBe(true);
  });

  it("caps an oversized message", () => {
    const r = enquirySchema.safeParse({ ...base, message: "x".repeat(4001) });
    expect(r.success).toBe(false);
  });
});

describe("money handling", () => {
  it("stores prices as integer fils, never floats", () => {
    expect(priceToFils.parse("89")).toBe(8900);
    expect(priceToFils.parse("89.50")).toBe(8950);
    expect(priceToFils.parse("0.05")).toBe(5);
  });

  it("treats an empty price as absent rather than zero", () => {
    expect(priceToFils.parse("")).toBeNull();
    expect(priceToFils.parse(undefined)).toBeNull();
  });
});

describe("admin schemas", () => {
  it("requires a menu item name and a category", () => {
    expect(menuItemSchema.safeParse({ categoryId: 1, nameEn: "" }).success).toBe(false);
    expect(menuItemSchema.safeParse({ categoryId: 1, nameEn: "Hommous" }).success).toBe(true);
  });

  it("defaults a new menu item to unpublished", () => {
    const r = menuItemSchema.parse({ categoryId: 1, nameEn: "Hommous" });
    expect(r.published).toBe(false);
  });

  it("defaults a new package to unpublished with no price", () => {
    const r = packageSchema.parse({ pillar: "wedding", nameEn: "Test" });
    expect(r.published).toBe(false);
    expect(r.priceFrom).toBeNull();
  });

  it("rejects an unknown pillar", () => {
    expect(packageSchema.safeParse({ pillar: "nonsense", nameEn: "x" }).success).toBe(false);
  });
});
