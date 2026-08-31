import Link from "next/link";
import { Container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, defaultLocale } from "@/lib/i18n/config";
import { FACTS, telHref } from "@/lib/facts";

/**
 * Locale-segment 404.
 *
 * `notFound()` is rendered outside the dynamic params scope, so the locale is not readable
 * here. The page is therefore bilingual on its face: both languages are shown, and both
 * escape routes work. No dead ends.
 */
export default function LocaleNotFound() {
  const en = getDictionary("en");
  const ar = getDictionary("ar");

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-brand-paper py-20">
      <Container size="narrow">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">404</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
          {en.errors.notFoundTitle}
        </h1>
        <p className="mt-3 text-brand-ink-soft">{en.errors.notFoundBody}</p>

        <div className="mt-6 border-t border-brand-line pt-6" dir="rtl" lang="ar">
          <h2 className="font-[family-name:var(--font-arabic)] text-2xl font-semibold">
            {ar.errors.notFoundTitle}
          </h2>
          <p className="mt-2 text-brand-ink-soft">{ar.errors.notFoundBody}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={hrefFor("home", defaultLocale)}
            className="inline-flex min-h-11 items-center rounded-[--radius-card] bg-brand-accent px-5 py-3 text-sm font-semibold text-white"
          >
            {en.actions.backHome}
          </Link>
          <Link
            href={hrefFor("home", "ar")}
            lang="ar"
            className="inline-flex min-h-11 items-center rounded-[--radius-card] border border-brand-line bg-brand-surface px-5 py-3 text-sm font-semibold"
          >
            {ar.actions.backHome}
          </Link>
          <a
            href={telHref()}
            className="inline-flex min-h-11 items-center rounded-[--radius-card] border border-brand-line bg-brand-surface px-5 py-3 text-sm font-semibold"
            dir="ltr"
          >
            {FACTS.phoneDisplay.value}
          </a>
        </div>
      </Container>
    </div>
  );
}
