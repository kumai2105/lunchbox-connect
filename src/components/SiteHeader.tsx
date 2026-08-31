import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, localeMeta, locales, routeSlugs, type Locale, type RouteKey } from "@/lib/i18n/config";
import { FACTS, telHref } from "@/lib/facts";
import { Container } from "./ui";

/**
 * Header navigation.
 *
 * The mobile menu is a native <details>/<summary> disclosure, so the header ships with zero
 * client JavaScript: it works with JS disabled, is keyboard operable and screen-reader
 * announced by the browser itself, and cannot cause layout shift. On large screens the
 * summary is hidden and the panel is forced open by CSS, giving a normal horizontal bar.
 */
export function SiteHeader({
  locale,
  currentRoute,
  showGallery,
}: {
  locale: Locale;
  currentRoute: RouteKey;
  showGallery: boolean;
}) {
  const t = getDictionary(locale);

  const primary: { key: RouteKey; label: string }[] = [
    { key: "restaurant", label: t.nav.restaurant },
    { key: "menu", label: t.nav.menu },
    { key: "weddings", label: t.nav.weddings },
    { key: "corporate", label: t.nav.corporate },
    { key: "catering", label: t.nav.catering },
    { key: "brunch", label: t.nav.brunch },
    ...(showGallery ? [{ key: "gallery" as RouteKey, label: t.nav.gallery }] : []),
    { key: "about", label: t.nav.about },
    { key: "contact", label: t.nav.contact },
  ];

  const other = locales.find((l) => l !== locale) as Locale;
  const otherSlug = routeSlugs[currentRoute][other];
  const otherHref = otherSlug ? `/${other}/${otherSlug}` : `/${other}`;

  return (
    <header className="sticky top-0 z-40 border-b border-brand-line bg-brand-paper/95 backdrop-blur">
      <Container size="wide">
        <div>
          <div className="flex items-center justify-between gap-3 py-3">
            <Link
              href={hrefFor("home", locale)}
              className="font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-xl font-semibold tracking-tight"
            >
              {locale === "ar" ? FACTS.nameAr.value : FACTS.shortName.value}
              {locale !== "ar" ? <span className="sr-only"> — {FACTS.nameEn.value}</span> : null}
            </Link>

            <div className="flex items-center gap-2">
              <a
                href={telHref()}
                className="hidden rounded-[--radius-card] bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep sm:inline-flex"
              >
                <span dir="ltr">{FACTS.phoneDisplay.value}</span>
              </a>
              <a
                href={telHref()}
                aria-label={`${t.actions.call} ${FACTS.phoneDisplay.value}`}
                className="rounded-[--radius-card] bg-brand-accent px-3 py-2 text-sm font-semibold text-white sm:hidden"
              >
                {t.actions.callShort}
              </a>
              <Link
                href={otherHref}
                hrefLang={localeMeta[other].htmlLang}
                lang={other}
                className="rounded-[--radius-card] border border-brand-line px-3 py-2 text-sm font-medium hover:border-brand-accent"
              >
                {localeMeta[other].label}
              </Link>
            </div>
          </div>

          {/*
            Native disclosure. It contains ONLY the summary and the panel, so nothing else in the
            header can be hidden by the browser's built-in <details> behaviour. On large screens
            the summary is hidden and the panel is displayed permanently.
          */}
          <details className="nav-disclosure">
            <summary className="nav-summary -mx-5 cursor-pointer list-none border-t border-brand-line-soft px-5 py-3 text-sm font-medium sm:-mx-8 sm:px-8">
              {t.nav.openMenu}
            </summary>
            <nav
              aria-label={t.nav.primaryLabel}
              className="nav-panel border-t border-brand-line-soft py-2 lg:border-0"
            >
            <ul className="flex flex-col gap-1 pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6 lg:pb-2">
              {primary.map(({ key, label }) => {
                const active = currentRoute === key;
                return (
                  <li key={key}>
                    <Link
                      href={hrefFor(key, locale)}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded py-2 text-sm transition-colors lg:py-1 ${
                        active
                          ? "font-semibold text-brand-accent"
                          : "text-brand-ink-soft hover:text-brand-ink"
                      }`}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
              </ul>
            </nav>
          </details>
        </div>
      </Container>
    </header>
  );
}
