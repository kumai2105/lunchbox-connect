import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { galleryHasContent, getSettings } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { type Locale, type RouteKey } from "@/lib/i18n/config";
import { breadcrumbJsonLd, restaurantJsonLd, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "./JsonLd";

export async function PageShell({
  locale,
  routeKey,
  breadcrumbLabel,
  children,
  extraJsonLd,
  transparentHeader = false,
}: {
  locale: Locale;
  routeKey: RouteKey;
  breadcrumbLabel?: string;
  children: ReactNode;
  extraJsonLd?: object[];
  transparentHeader?: boolean;
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
      <SiteHeader locale={locale} currentRoute={routeKey} onDark={transparentHeader} />
      {/*
        tabIndex={-1} is what makes the skip link actually work. Without it the browser
        scrolls to #main but leaves focus on the link, so the next Tab goes back into the
        header the visitor just asked to skip — the control looks like it fired and did
        nothing. A negative tabindex makes <main> programmatically focusable without
        putting it in the tab order.
      */}
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter locale={locale} showGallery={showGallery} settings={settings} />
    </div>
  );
}
