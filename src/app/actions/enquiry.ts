"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { enquiries, rateLimits } from "@/lib/db/schema";
import { enquirySchema } from "@/lib/validation";
import { clientAddress, hashIp } from "@/lib/auth";
import { notifyEnquiry } from "@/lib/notify";

export interface EnquiryState {
  ok: boolean;
  reference?: string;
  /** field name -> message KEY, resolved into the visitor's language on the client */
  errors?: Record<string, string>;
  formError?: string;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 6;

async function clientKey(): Promise<string> {
  return hashIp(clientAddress(await headers()));
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const row = db.select().from(rateLimits).where(eq(rateLimits.key, key)).all()[0];

  if (!row || now - row.windowStart > WINDOW_MS) {
    db.insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, windowStart: now } })
      .run();
    return false;
  }
  if (row.count >= MAX_PER_WINDOW) return true;
  db.update(rateLimits).set({ count: row.count + 1 }).where(eq(rateLimits.key, key)).run();
  return false;
}

function reference(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `JZ-${stamp}-${rand}`;
}

export async function submitEnquiry(
  _prev: EnquiryState | null,
  formData: FormData,
): Promise<EnquiryState> {
  const raw = Object.fromEntries(formData.entries());

  // Unticked checkboxes are simply absent from FormData; normalise before validating.
  const normalised = {
    ...raw,
    consent: raw.consent === "on" || raw.consent === "true",
    venueRequired: raw.venueRequired === "on" || raw.venueRequired === "true",
    cateringRequired: raw.cateringRequired === "on" || raw.cateringRequired === "true",
  };

  const parsed = enquirySchema.safeParse(normalised);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!errors[field]) errors[field] = issue.message;
    }
    // The honeypot is never shown to a person; a filled one means a bot.
    if (errors.website) return { ok: false, formError: "generic" };
    return { ok: false, errors };
  }

  const data = parsed.data;

  // Submitted implausibly fast after render → automated.
  if (data.ts && Date.now() - data.ts < 1500) {
    return { ok: false, formError: "generic" };
  }

  const key = await clientKey();
  if (rateLimited(key)) return { ok: false, formError: "rateLimited" };

  const h = await headers();
  const ref = reference();

  try {
    const row = db
      .insert(enquiries)
      .values({
        reference: ref,
        type: data.type,
        name: data.name,
        phone: data.phone,
        email: data.email?.trim() ? data.email.trim() : null,
        company: data.company?.trim() ? data.company.trim() : null,
        eventDate: data.eventDate ? String(data.eventDate) : null,
        guests: typeof data.guests === "number" ? data.guests : null,
        venueRequired: data.venueRequired ?? null,
        cateringRequired: data.cateringRequired ?? null,
        serviceStyle: data.serviceStyle && data.serviceStyle !== "unset" ? data.serviceStyle : null,
        message: data.message?.trim() ? data.message.trim() : null,
        consent: true,
        locale: data.locale ?? "en",
        sourcePage: data.sourcePage ?? null,
        ipHash: key,
        userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
        status: "new",
      })
      .returning()
      .all()[0];

    const result = await notifyEnquiry(row);

    db.update(enquiries)
      .set({ notificationStatus: result.status, notificationDetail: result.detail })
      .where(eq(enquiries.id, row.id))
      .run();

    return { ok: true, reference: ref };
  } catch (err) {
    console.error("[enquiry] failed to store", err);
    // Never report success when nothing was stored.
    return { ok: false, formError: "generic" };
  }
}
