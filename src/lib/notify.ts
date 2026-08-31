import "server-only";
import type { Enquiry } from "./db/schema";

/**
 * Enquiry notification transport.
 *
 * There are no production email credentials, so this ships with a LOGGING adapter.
 *
 * What that means in practice, and why it is honest:
 *   - every enquiry is genuinely written to the database and appears in the admin;
 *   - the notification attempt is recorded on the row as `logged` or `not_configured`;
 *   - the visitor is told their enquiry has been RECEIVED — never that an email was sent.
 *
 * To activate real delivery: set ENQUIRY_TRANSPORT=smtp, SMTP_URL and ENQUIRY_RECIPIENT,
 * then `npm i nodemailer` and fill in the marked block below. Nothing else changes.
 */

export type NotifyResult = {
  status: "logged" | "sent" | "failed" | "not_configured";
  detail: string;
};

function summarise(e: Enquiry): string {
  const lines = [
    `New ${e.type} enquiry — ${e.reference}`,
    `Name: ${e.name}`,
    `Phone: ${e.phone}`,
    e.email ? `Email: ${e.email}` : null,
    e.company ? `Company: ${e.company}` : null,
    e.eventDate ? `Preferred date: ${e.eventDate}` : null,
    e.guests ? `Guests: ${e.guests}` : null,
    e.venueRequired != null ? `Venue at Jazeel: ${e.venueRequired ? "yes" : "no"}` : null,
    e.cateringRequired != null ? `Catering required: ${e.cateringRequired ? "yes" : "no"}` : null,
    e.serviceStyle && e.serviceStyle !== "unset" ? `Service style: ${e.serviceStyle}` : null,
    e.message ? `Message: ${e.message}` : null,
    `Language: ${e.locale}`,
    e.sourcePage ? `From page: ${e.sourcePage}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function notifyEnquiry(enquiry: Enquiry): Promise<NotifyResult> {
  const transport = process.env.ENQUIRY_TRANSPORT;
  const recipient = process.env.ENQUIRY_RECIPIENT;

  if (!transport) {
    // Development / pre-launch default. The enquiry is stored; nobody is emailed; we say so.
    console.info(`[enquiry] stored, no transport configured\n${summarise(enquiry)}`);
    return {
      status: "not_configured",
      detail: "Stored only — no notification transport configured (ENQUIRY_TRANSPORT unset).",
    };
  }

  if (transport === "log") {
    console.info(`[enquiry] ${summarise(enquiry)}`);
    return { status: "logged", detail: "Written to the server log." };
  }

  if (transport === "smtp") {
    if (!process.env.SMTP_URL || !recipient) {
      return {
        status: "failed",
        detail: "ENQUIRY_TRANSPORT=smtp but SMTP_URL or ENQUIRY_RECIPIENT is missing.",
      };
    }
    // --- ACTIVATION BLOCK -------------------------------------------------
    // npm i nodemailer, then replace the return below with:
    //
    //   const nodemailer = (await import("nodemailer")).default;
    //   const t = nodemailer.createTransport(process.env.SMTP_URL!);
    //   await t.sendMail({
    //     to: recipient,
    //     from: process.env.SMTP_FROM ?? recipient,
    //     replyTo: enquiry.email ?? undefined,
    //     subject: `Jazeel enquiry ${enquiry.reference} — ${enquiry.type}`,
    //     text: summarise(enquiry),
    //   });
    //   return { status: "sent", detail: `Emailed to ${recipient}` };
    // ----------------------------------------------------------------------
    return {
      status: "failed",
      detail: "SMTP transport selected but the nodemailer activation block has not been enabled.",
    };
  }

  return { status: "failed", detail: `Unknown ENQUIRY_TRANSPORT "${transport}".` };
}
