import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { saveSettingsAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton, inputClass, labelClass } from "@/components/admin/AdminUI";

const LABELS: Record<string, { label: string; hint?: string; dir?: "ltr" | "rtl" }> = {
  phone: { label: "Telephone (for the call button)", dir: "ltr", hint: "International format, e.g. +97143232797" },
  phone_display: { label: "Telephone as shown", dir: "ltr" },
  whatsapp: { label: "WhatsApp number", dir: "ltr", hint: "Leave empty and no WhatsApp link appears anywhere." },
  email: { label: "Public email address", dir: "ltr", hint: "Leave empty and no email link appears anywhere." },
  enquiry_recipient: { label: "Send enquiry notifications to", dir: "ltr", hint: "Recorded here for reference. Delivery is switched on in the server configuration." },
  hours_open: { label: "Opening time", dir: "ltr" },
  hours_close: { label: "Closing time", dir: "ltr" },
  hours_note_en: { label: "Note about hours (English)", hint: "e.g. different hours during Ramadan. Leave empty and nothing shows." },
  hours_note_ar: { label: "Note about hours (Arabic)", dir: "rtl" },
  shisha_hours: { label: "Shisha service hours", hint: "Not published anywhere yet — see the note below." },
  shisha_visible: { label: "Mention shisha on the site", hint: 'Type "false" to remove every mention of shisha from the public site at once. Anything else keeps it.' },
  map_url: { label: "Map link", dir: "ltr", hint: "Optional. Directions currently use the written address." },
  brunch_time_en: { label: "Sunday brunch times (English)", hint: "e.g. Every Sunday, 12:00–16:00" },
  brunch_time_ar: { label: "Sunday brunch times (Arabic)", dir: "rtl" },
  brunch_price_note_en: { label: "Sunday brunch price note (English)" },
  brunch_price_note_ar: { label: "Sunday brunch price note (Arabic)", dir: "rtl" },
};

const EVIDENCE_NOTE: Record<string, string> = {
  VERIFIED: "Confirmed by public sources during research.",
  OWNER_PROVIDED: "Provided by you.",
  UNVERIFIED: "Found during research but not confirmed — please check.",
  UNKNOWN: "Not known. Nothing that needs this value is shown until you fill it in.",
};

export default async function AdminSettings() {
  if (!(await getAdmin())) redirect("/admin/login");
  const rows = db.select().from(settings).orderBy(asc(settings.key)).all();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Business details &amp; hours</h1>
        <p className="mt-2 text-sm text-brand-ink-soft">
          Anything left empty simply does not appear on the site. Nothing is invented to fill a gap.
        </p>
      </div>

      <div className="rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3 text-sm">
        <strong>About shisha.</strong> UAE tobacco-control rules place real limits on advertising and
        on displaying tobacco products online, and the research could not establish what is permitted
        for a restaurant&rsquo;s own website. Shisha is therefore described on the site only as a
        factual amenity, is kept out of all search metadata, and can be removed everywhere with the
        single switch below. Take legal advice before promoting it.
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <ActionForm action={saveSettingsAction}>
          <div className="space-y-5">
            {rows.map((r) => {
              const meta = LABELS[r.key] ?? { label: r.key };
              return (
                <div key={r.key}>
                  <label htmlFor={`f-${r.key}`} className={labelClass}>
                    {meta.label}
                  </label>
                  <input
                    id={`f-${r.key}`}
                    name={r.key}
                    dir={meta.dir}
                    defaultValue={r.value ?? ""}
                    className={inputClass}
                    aria-describedby={`f-${r.key}-hint`}
                  />
                  <p id={`f-${r.key}-hint`} className="mt-1 text-xs text-brand-ink-soft">
                    {meta.hint ? `${meta.hint} ` : ""}
                    <span className="italic">{EVIDENCE_NOTE[r.evidence] ?? ""}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-6">
            <SubmitButton>Save details</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
