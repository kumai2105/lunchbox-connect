import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Container } from "./ui";
import { galleryHasContent, getSettings } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, type Locale, type RouteKey } from "@/lib/i18n/config";
import { breadcrumbJsonLd, restaurantJsonLd, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "./JsonLd";

export async function PageShell({
  locale,
  routeKey,
  breadcrumbLabel,
  children,
  extraJsonLd,
}: {
  locale: Locale;
  routeKey: RouteKey;
  breadcrumbLabel?: string;
  children: ReactNode;
  extraJsonLd?: object[];
}) {
  const [showGallery, settings] = await Promise.all([galleryHasContent(), getSettings()]);
  const t = getDictionary(locale);

  const graph = [
    restaurantJsonLd(locale),
    websiteJsonLd(locale),
    ...(routeKey !== "home" && breadcrumbLabel
      ? [
          breadcrumbJsonLd(locale, [
            { name: t.nav.home, routeKey: "home" },
            { name: breadcrumbLabel, routeKey },
          ]),
        ]
      : []),
    ...(extraJsonLd ?? []),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={graph} />
      <SiteHeader locale={locale} currentRoute={routeKey} showGallery={showGallery} />

      {routeKey !== "home" && breadcrumbLabel ? (
        <Container size="wide">
          <nav aria-label={t.labels.breadcrumb} className="py-3 text-xs text-brand-ink-soft">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href={hrefFor("home", locale)} className="hover:text-brand-ink underline-offset-4 hover:underline">
                  {t.nav.home}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-brand-ink">
                {breadcrumbLabel}
              </li>
            </ol>
          </nav>
        </Container>
      ) : null}

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter locale={locale} showGallery={showGallery} settings={settings} />
    </div>
  );
}
