import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, localeMeta, locales, routeSlugs, type Locale, type RouteKey } from "@/lib/i18n/config";
import { FACTS, telHref } from "@/lib/facts";
import { Container } from "./ui";

/**
 * Restaurant-site navigation: uppercase, letterspaced, seven items, one loud action.
 *
 * About and Gallery live in the footer so the bar carries only what a visitor is actually
 * choosing between — the pattern on Ninive (5 items) and Al Safadi (7). Weddings, Corporate
 * and Catering each keep their own slot; none is folded into a "Services" item.
 *
 * The small-screen menu is a native <details> disclosure, so the header ships with zero
 * client JavaScript and works with scripting disabled.
 */
export function SiteHeader({
  locale,
  currentRoute,
  onDark = false,
}: {
  locale: Locale;
  currentRoute: RouteKey;
  /** Transparent over a dark hero (homepage) rather than a solid bar. */
  onDark?: boolean;
}) {
  const t = getDictionary(locale);

  const primary: { key: RouteKey; label: string }[] = [
    { key: "menu", label: t.nav.menu },
    { key: "restaurant", label: t.nav.restaurant },
    { key: "weddings", label: t.nav.weddings },
    { key: "corporate", label: t.nav.corporate },
    { key: "catering", label: t.nav.catering },
    { key: "brunch", label: t.nav.brunch },
    { key: "contact", label: t.nav.contact },
  ];

  const other = locales.find((l) => l !== locale) as Locale;
  const otherSlug = routeSlugs[currentRoute][other];
  const otherHref = otherSlug ? `/${other}/${otherSlug}` : `/${other}`;

  const shell = onDark
    ? "on-dark text-brand-bone"
    : "bg-brand-bone/95 backdrop-blur border-b border-brand-rule text-brand-ink";
  const linkIdle = onDark ? "text-brand-bone hover:text-brand-gold" : "text-brand-ink-soft hover:text-brand-teal";
  const linkOn = onDark
    ? "text-brand-gold underline decoration-2 underline-offset-[7px]"
    : "text-brand-teal underline decoration-2 underline-offset-[7px]";
  const chip = onDark
    ? "border border-brand-bone/35 text-brand-bone hover:border-brand-gold hover:text-brand-gold"
    : "border border-brand-ink/20 text-brand-ink hover:border-brand-teal hover:text-brand-teal";

  return (
    <header className={`${onDark ? "absolute inset-x-0 top-0 z-40" : "sticky top-0 z-40"} ${shell}`}>
      <Container size="wide">
        <div>
          <div className="flex items-center justify-between gap-4 py-5">
            {/*
              The supplied logo already carries both scripts and the "Restaurant & cafe"
              line, so nothing is set typographically beside it. Two files rather than one
              filter: the mark's petrol teal disappears on the dark hero, so that ground
              gets the reversed lockup.
            */}
            <Link href={hrefFor("home", locale)} className="block shrink-0">
              <Image
                src={onDark ? "/brand/logo-reversed.png" : "/brand/logo.png"}
                alt={locale === "ar" ? FACTS.nameAr.value : FACTS.nameEn.value}
                width={1600}
                height={811}
                priority
                sizes="(min-width: 640px) 178px, 106px"
                className="h-[54px] w-auto sm:h-[90px]"
              />
            </Link>

            <div className="flex items-center gap-2.5">
              {/* Teal on teal disappears, so the dark header takes the gold. */}
              <a
                href={telHref()}
                className={`hidden px-5 py-2.5 label sm:inline-flex ${
                  onDark
                    ? "bg-brand-gold text-brand-night hover:bg-brand-bone"
                    : "bg-brand-teal text-white hover:bg-brand-ink"
                }`}
              >
                <span dir="ltr">{FACTS.phoneDisplay.value}</span>
              </a>
              <a
                href={telHref()}
                aria-label={`${t.actions.call} ${FACTS.phoneDisplay.value}`}
                className={`px-4 py-2.5 label sm:hidden ${
                  onDark ? "bg-brand-gold text-brand-night" : "bg-brand-teal text-white"
                }`}
              >
                {t.actions.callShort}
              </a>
              <Link
                href={otherHref}
                hrefLang={localeMeta[other].htmlLang}
                lang={other}
                className={`px-3.5 py-2.5 text-sm font-semibold ${chip}`}
              >
                {localeMeta[other].label}
              </Link>
            </div>
          </div>

          {/*
            Two renderings of one link list, each removed from the DOM at the other's
            breakpoint. Chrome hides a closed <details>'s content through an internal slot,
            so a single element cannot be both the mobile disclosure and the desktop bar —
            this keeps the markup honest and needs no JavaScript.
          */}
          <nav aria-label={t.nav.primaryLabel} className="hidden lg:block">
            {/* justify-between spreads the seven items, but the gap is still a minimum, and
                at 1280px the row sat about six pixels from wrapping — a very common laptop
                width to be that close to. A smaller minimum gap gives it real headroom. */}
            <ul className="flex flex-wrap items-center justify-between gap-x-4 whitespace-nowrap border-t pb-5 pt-4 xl:gap-x-6"
                style={{ borderColor: onDark ? "rgba(246,241,232,0.2)" : "var(--color-brand-rule)" }}>
              {primary.map(({ key, label }) => {
                const active = currentRoute === key;
                return (
                  <li key={key}>
                    <Link
                      href={hrefFor(key, locale)}
                      aria-current={active ? "page" : undefined}
                      className={`label transition-colors ${active ? linkOn : linkIdle}`}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <details className="lg:hidden">
            <summary
              className={`label cursor-pointer list-none border-t py-4 ${
                onDark ? "border-brand-bone/20 text-brand-bone" : "border-brand-rule text-brand-ink"
              }`}
            >
              {t.nav.openMenu}
            </summary>
            <ul
              className={`flex flex-col gap-0.5 border-t pb-4 pt-2 ${
                onDark ? "border-brand-bone/20" : "border-brand-rule"
              }`}
            >
              {primary.map(({ key, label }) => {
                const active = currentRoute === key;
                return (
                  <li key={key}>
                    <Link
                      href={hrefFor(key, locale)}
                      aria-current={active ? "page" : undefined}
                      className={`label block py-3 transition-colors ${active ? linkOn : linkIdle}`}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      </Container>
    </header>
  );
}
