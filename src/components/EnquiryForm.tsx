"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitEnquiry, type EnquiryState } from "@/app/actions/enquiry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { EnquiryType } from "@/lib/validation";

const FIELDSETS: Record<
  EnquiryType,
  { date: boolean; guests: boolean; company: boolean; venue: boolean; service: boolean }
> = {
  wedding: { date: true, guests: true, company: false, venue: true, service: true },
  celebration: { date: true, guests: true, company: false, venue: true, service: true },
  corporate: { date: true, guests: true, company: true, venue: true, service: true },
  catering: { date: true, guests: true, company: true, venue: false, service: true },
  brunch: { date: true, guests: true, company: false, venue: false, service: false },
  general: { date: false, guests: false, company: false, venue: false, service: false },
};

const field =
  "w-full border border-brand-rule bg-brand-linen px-4 py-3 text-base text-brand-ink focus:border-brand-teal";

function SubmitButton({ label, busyLabel }: { label: string; busyLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="label inline-flex min-h-12 items-center justify-center bg-brand-teal px-8 py-3.5 text-white transition-colors hover:bg-brand-ink disabled:cursor-progress disabled:opacity-70"
    >
      {pending ? busyLabel : label}
    </button>
  );
}

export function EnquiryForm({
  locale,
  defaultType,
  allowTypeChange = false,
  sourcePage,
  phoneDisplay,
  phoneHref,
  compact = false,
}: {
  locale: Locale;
  defaultType: EnquiryType;
  allowTypeChange?: boolean;
  sourcePage: string;
  phoneDisplay: string;
  phoneHref: string;
  compact?: boolean;
}) {
  const t = getDictionary(locale);
  const [state, formAction] = useActionState<EnquiryState | null, FormData>(submitEnquiry, null);
  const [type, setType] = useState<EnquiryType>(defaultType);
  const uid = useId();
  const headingRef = useRef<HTMLDivElement>(null);
  const renderedAt = useMemo(() => Date.now(), []);

  const shape = FIELDSETS[type];
  const err = state?.errors ?? {};
  const messages = t.form.validation as Record<string, string>;
  const msg = (key?: string) => (key ? (messages[key] ?? messages.tooLong) : undefined);

  // Move focus to the outcome so screen-reader and keyboard users are not stranded.
  useEffect(() => {
    if (state) headingRef.current?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      <div
        ref={headingRef}
        tabIndex={-1}
        role="status"
        className="border-s-4 border-state-success bg-state-success-bg p-7"
      >
        <h3 className="display text-2xl text-state-success">{t.form.successTitle}</h3>
        <p className="mt-2 text-sm text-brand-ink">
          {t.form.successBody}{" "}
          <strong className="font-semibold" dir="ltr">
            {state.reference}
          </strong>
        </p>
        <p className="mt-2 text-sm text-brand-ink-soft">{t.form.successNext}</p>
      </div>
    );
  }

  const id = (n: string) => `${uid}-${n}`;
  const describedBy = (n: string, hint?: string) =>
    [err[n] ? `${id(n)}-error` : null, hint ? `${id(n)}-hint` : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <form action={formAction} noValidate className={compact ? "" : "max-w-2xl"}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="sourcePage" value={sourcePage} />
      <input type="hidden" name="ts" value={renderedAt} />
      {/* Honeypot — hidden from people, harvested by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={id("website")}>Website</label>
        <input id={id("website")} type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state && !state.ok ? (
        <div
          ref={headingRef}
          tabIndex={-1}
          role="alert"
          className="mb-7 border-s-4 border-state-error bg-state-error-bg p-5"
        >
          <p className="font-semibold text-state-error">{t.form.errorTitle}</p>
          <p className="mt-1 text-sm text-brand-ink">
            {state.formError === "rateLimited"
              ? t.form.validation.rateLimited
              : state.formError
                ? `${t.form.errorGeneric} `
                : null}
            {state.formError === "generic" || (!state.formError && state.errors) ? null : null}
            {state.formError && state.formError !== "rateLimited" ? (
              <a href={phoneHref} className="font-semibold underline underline-offset-4" dir="ltr">
                {phoneDisplay}
              </a>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {allowTypeChange ? (
          <div className="sm:col-span-2">
            <label htmlFor={id("type")} className="label mb-2 block text-brand-ink-soft">
              {t.form.eventType}
            </label>
            <select
              id={id("type")}
              name="type"
              className={field}
              value={type}
              onChange={(e) => setType(e.target.value as EnquiryType)}
            >
              {(Object.keys(t.form.enquiryTypes) as EnquiryType[]).map((k) => (
                <option key={k} value={k}>
                  {t.form.enquiryTypes[k]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="type" value={type} />
        )}

        <div>
          <label htmlFor={id("name")} className="label mb-2 block text-brand-ink-soft">
            {t.form.name} <span className="text-brand-teal">*</span>
          </label>
          <input
            id={id("name")}
            name="name"
            type="text"
            required
            autoComplete="name"
            maxLength={120}
            className={field}
            aria-invalid={err.name ? true : undefined}
            aria-describedby={describedBy("name")}
          />
          {err.name ? (
            <p id={`${id("name")}-error`} className="mt-1.5 text-sm text-state-error">
              {msg(err.name)}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={id("phone")} className="label mb-2 block text-brand-ink-soft">
            {t.form.phone} <span className="text-brand-teal">*</span>
          </label>
          <input
            id={id("phone")}
            name="phone"
            type="tel"
            required
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            maxLength={40}
            className={field}
            aria-invalid={err.phone ? true : undefined}
            aria-describedby={describedBy("phone")}
          />
          {err.phone ? (
            <p id={`${id("phone")}-error`} className="mt-1.5 text-sm text-state-error">
              {msg(err.phone)}
            </p>
          ) : null}
        </div>

        <div className={shape.company ? "" : "sm:col-span-2"}>
          <label htmlFor={id("email")} className="label mb-2 block text-brand-ink-soft">
            {t.form.emailOptional}
          </label>
          <input
            id={id("email")}
            name="email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            maxLength={180}
            className={field}
            aria-invalid={err.email ? true : undefined}
            aria-describedby={describedBy("email")}
          />
          {err.email ? (
            <p id={`${id("email")}-error`} className="mt-1.5 text-sm text-state-error">
              {msg(err.email)}
            </p>
          ) : null}
        </div>

        {shape.company ? (
          <div>
            <label htmlFor={id("company")} className="label mb-2 block text-brand-ink-soft">
              {t.form.company}
            </label>
            <input
              id={id("company")}
              name="company"
              type="text"
              autoComplete="organization"
              maxLength={160}
              className={field}
            />
          </div>
        ) : null}

        {shape.date ? (
          <div>
            <label htmlFor={id("eventDate")} className="label mb-2 block text-brand-ink-soft">
              {t.form.eventDate}
            </label>
            <input
              id={id("eventDate")}
              name="eventDate"
              type="date"
              dir="ltr"
              className={field}
              aria-invalid={err.eventDate ? true : undefined}
              aria-describedby={describedBy("eventDate", t.form.eventDateHint)}
            />
            <p id={`${id("eventDate")}-hint`} className="mt-1.5 text-sm text-brand-ink-soft">
              {t.form.eventDateHint}
            </p>
            {err.eventDate ? (
              <p id={`${id("eventDate")}-error`} className="mt-1.5 text-sm text-state-error">
                {msg(err.eventDate)}
              </p>
            ) : null}
          </div>
        ) : null}

        {shape.guests ? (
          <div>
            <label htmlFor={id("guests")} className="label mb-2 block text-brand-ink-soft">
              {t.form.guests}
            </label>
            <input
              id={id("guests")}
              name="guests"
              type="number"
              min={1}
              max={5000}
              inputMode="numeric"
              dir="ltr"
              className={field}
              aria-invalid={err.guests ? true : undefined}
              aria-describedby={describedBy("guests")}
            />
            {err.guests ? (
              <p id={`${id("guests")}-error`} className="mt-1.5 text-sm text-state-error">
                {msg(err.guests)}
              </p>
            ) : null}
          </div>
        ) : null}

        {shape.service ? (
          <div className="sm:col-span-2">
            <label htmlFor={id("serviceStyle")} className="label mb-2 block text-brand-ink-soft">
              {t.form.serviceStyle}
            </label>
            <select id={id("serviceStyle")} name="serviceStyle" className={field} defaultValue="unset">
              {(
                Object.keys(t.form.serviceStyleOptions) as (keyof typeof t.form.serviceStyleOptions)[]
              ).map((k) => (
                <option key={k} value={k}>
                  {t.form.serviceStyleOptions[k]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {shape.venue ? (
          <fieldset className="sm:col-span-2">
            <legend className="sr-only">{t.form.eventType}</legend>
            <div className="space-y-2">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="venueRequired"
                  className="mt-1 size-4 accent-[--color-brand-teal]"
                />
                <span>{t.form.venueRequired}</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="cateringRequired"
                  className="mt-1 size-4 accent-[--color-brand-teal]"
                />
                <span>{t.form.cateringRequired}</span>
              </label>
            </div>
          </fieldset>
        ) : null}

        <div className="sm:col-span-2">
          <label htmlFor={id("message")} className="label mb-2 block text-brand-ink-soft">
            {t.form.message}
          </label>
          <textarea id={id("message")} name="message" rows={4} maxLength={4000} className={field} />
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-1 size-4 accent-[--color-brand-teal]"
              aria-invalid={err.consent ? true : undefined}
              aria-describedby={err.consent ? `${id("consent")}-error` : undefined}
            />
            <span>{t.form.consent}</span>
          </label>
          {err.consent ? (
            <p id={`${id("consent")}-error`} className="mt-1.5 text-sm text-state-error">
              {msg(err.consent)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-7">
        <SubmitButton label={t.form.submit} busyLabel={t.form.submitting} />
      </div>
    </form>
  );
}
