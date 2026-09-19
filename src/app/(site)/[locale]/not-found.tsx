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
    <div className="night-ground grain on-dark flex min-h-dvh flex-col justify-center py-20 text-brand-bone">
      <Container size="narrow">
        <p className="label text-brand-gold">404</p>
        <h1 className="display mt-5 text-4xl sm:text-5xl">
          {en.errors.notFoundTitle}
        </h1>
        <p className="mt-4 text-brand-bone/75">{en.errors.notFoundBody}</p>

        <div className="mt-8 border-t border-brand-bone/20 pt-8" dir="rtl" lang="ar">
          <h2 className="display-ar text-3xl">
            {ar.errors.notFoundTitle}
          </h2>
          <p className="mt-3 text-brand-bone/75">{ar.errors.notFoundBody}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={hrefFor("home", defaultLocale)}
            className="label inline-flex min-h-12 items-center bg-brand-bone px-6 py-3.5 text-brand-night hover:bg-brand-gold"
          >
            {en.actions.backHome}
          </Link>
          <Link
            href={hrefFor("home", "ar")}
            lang="ar"
            className="label inline-flex min-h-12 items-center border border-brand-bone/35 px-6 py-3.5 text-brand-bone hover:border-brand-gold hover:text-brand-gold"
          >
            {ar.actions.backHome}
          </Link>
          <a
            href={telHref()}
            className="label inline-flex min-h-12 items-center border border-brand-bone/35 px-6 py-3.5 text-brand-bone hover:border-brand-gold hover:text-brand-gold"
            dir="ltr"
          >
            {FACTS.phoneDisplay.value}
          </a>
        </div>
      </Container>
    </div>
  );
}
