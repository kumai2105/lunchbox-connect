import Image from "next/image";
import { PageShell } from "@/components/PageShell";
import { Hero } from "@/components/Hero";
import { Band, BandHeading, ButtonLink, Container, Pill } from "@/components/ui";
import {
  fallbackAttrs,
  formatPrice,
  getPage,
  getPublishedMenu,
  isFallback,
  localized,
  parseList,
} from "@/lib/content";
import { FACTS, telHref } from "@/lib/facts";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, type Locale } from "@/lib/i18n/config";

/**
 * The menu, set as a printed menu: large category headings, dotted leaders, prices in
 * tabular figures on the right. Not bordered item cards.
 *
 * When nothing is published this page does not show an empty grid or a "coming soon"
 * panel. It shows what the kitchen cooks (verified in Phase 1) and sends the visitor to
 * the live delivery menus — a finished, honest page rather than a placeholder.
 */
export async function MenuPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const isAr = locale === "ar";
  const [page, groups] = await Promise.all([getPage("menu"), getPublishedMenu()]);

  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.menu;
  const kicker = localized(locale, page?.kickerEn, page?.kickerAr);
  const intro = localized(locale, page?.introEn, page?.introAr);
  const hasMenu = groups.length > 0;
  const attrs = {
    kicker: fallbackAttrs(locale, isFallback(locale, page?.kickerEn, page?.kickerAr)),
    title: fallbackAttrs(locale, isFallback(locale, page?.titleEn, page?.titleAr)),
    intro: fallbackAttrs(locale, isFallback(locale, page?.introEn, page?.introAr)),
  };

  const kitchen = isAr
    ? [
        "مشاوي على الفحم — مشاوي مشكلة، كباب، شيش طاووق، ريش غنم",
        "مقبلات باردة وساخنة وسلطات",
        "مناقيش وفطائر من الفرن",
        "أطباق عالمية وباستا",
        "أرز وأطباق جانبية",
      ]
    : [
        "Charcoal grills — mixed grills, kebab, shish taouk, lamb chops",
        "Cold and hot mezze, and salads",
        "Manakeesh and fatayer from the oven",
        "International dishes and pasta",
        "Rice and sides",
      ];

  return (
    <PageShell locale={locale} routeKey="menu" breadcrumbLabel={title}>
      <Hero
        underSolidHeader
        label={kicker}
        labelAttrs={attrs.kicker}
        title={title}
        titleAttrs={attrs.title}
        titleAlt={isAr ? null : "قائمة الطعام"}
        intro={intro}
        introAttrs={attrs.intro}
        actions={
          <>
            <ButtonLink href={telHref()} variant="bone">
              {t.actions.callShort} <span dir="ltr">{FACTS.phoneDisplay.value}</span>
            </ButtonLink>
            {FACTS.deliveryPartners.value.map((d) => (
              <ButtonLink key={d.id} href={d.url} external variant="outlineDark">
                {d.name}
              </ButtonLink>
            ))}
          </>
        }
      />

      {hasMenu ? (
        <>
          <div className="sticky top-0 z-30 border-b border-brand-rule bg-brand-bone/95 backdrop-blur">
            <Container size="wide">
              <nav aria-label={t.labels.category} className="overflow-x-auto py-4">
                <ul className="flex gap-x-7 whitespace-nowrap">
                  {groups.map(({ category }) => (
                    <li key={category.id}>
                      <a
                        href={`#cat-${category.slug}`}
                        className="label text-brand-ink-soft hover:text-brand-teal"
                      >
                        {localized(locale, category.nameEn, category.nameAr)}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </Container>
          </div>

          <Band tone="bone">
            <Container>
              <div className="space-y-20">
                {groups.map(({ category, items }) => (
                  <section key={category.id} id={`cat-${category.slug}`} aria-labelledby={`h-${category.slug}`}>
                    <div className="rule-gold mb-5" />
                    <h2 id={`h-${category.slug}`} className="display text-3xl sm:text-4xl">
                      {localized(locale, category.nameEn, category.nameAr)}
                    </h2>
                    {localized(locale, category.descriptionEn, category.descriptionAr) ? (
                      <p className="mt-3 max-w-xl text-brand-ink-soft">
                        {localized(locale, category.descriptionEn, category.descriptionAr)}
                      </p>
                    ) : null}

                    <ul className="mt-9 space-y-7">
                      {items.map((item) => {
                        const desc = localized(locale, item.descriptionEn, item.descriptionAr);
                        const portion = localized(locale, item.portionEn, item.portionAr);
                        const price = formatPrice(item.priceFils, item.currency, locale);
                        const dietary = parseList(item.dietary);
                        const allergens = parseList(item.allergens);
                        return (
                          <li key={item.id} className="flex gap-5">
                            {item.imagePath ? (
                              <div className="relative size-20 shrink-0 overflow-hidden">
                                <Image
                                  src={item.imagePath}
                                  alt={localized(locale, item.imageAltEn, item.imageAltAr) ?? ""}
                                  fill
                                  sizes="80px"
                                  className="object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <p className="menu-row">
                                <span className="text-lg font-semibold">
                                  {localized(locale, item.nameEn, item.nameAr)}
                                </span>
                                <span className="menu-leader" aria-hidden="true" />
                                {price ? (
                                  <span className="menu-price text-lg font-semibold" dir="ltr">
                                    {price}
                                  </span>
                                ) : (
                                  <span />
                                )}
                              </p>
                              {portion ? (
                                <p className="mt-0.5 text-sm text-brand-ink-soft">{portion}</p>
                              ) : null}
                              {desc ? (
                                <p className="mt-1.5 max-w-xl text-brand-ink-soft">{desc}</p>
                              ) : null}
                              {dietary.length > 0 ||
                              !item.inStock ||
                              !item.availableDelivery ||
                              !item.availableDineIn ? (
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  {!item.inStock ? <Pill>{t.labels.unavailable}</Pill> : null}
                                  {item.inStock && !item.availableDelivery ? (
                                    <Pill>{t.labels.dineInOnly}</Pill>
                                  ) : null}
                                  {item.inStock && !item.availableDineIn ? (
                                    <Pill>{t.labels.deliveryOnly}</Pill>
                                  ) : null}
                                  {dietary.map((d) => (
                                    <Pill key={d}>{d}</Pill>
                                  ))}
                                </div>
                              ) : null}
                              {allergens.length > 0 ? (
                                <p className="mt-2 text-xs text-brand-ink-soft">
                                  {t.labels.contains}: {allergens.join(", ")}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </Container>
          </Band>
        </>
      ) : (
        <Band tone="bone">
          <Container size="wide">
            <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
              <div>
                <BandHeading
                  title={isAr ? "ماذا يقدّم المطبخ" : "What the kitchen cooks"}
                  titleAlt={isAr ? null : "ماذا يقدّم المطبخ"}
                  size="lg"
                />
                <ul className="mt-9 divide-y divide-brand-rule border-t border-brand-rule">
                  {kitchen.map((line) => (
                    <li key={line} className="py-4 text-lg">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="night-ground grain on-dark p-10 sm:p-12">
                <h2 className="label text-brand-gold">{isAr ? "اطلب الآن" : "Order now"}</h2>
                <p className="mt-5 text-lg leading-relaxed text-brand-bone/85">
                  {isAr
                    ? "قائمة التوصيل الكاملة والأسعار الحالية متاحة لدى شركاء التوصيل. ولتناول الطعام في المطعم أو للضيافة، الاتصال هو الأسرع."
                    : "The full delivery menu and current prices are live with our delivery partners. For dine-in, catering or anything else, calling is the quickest route."}
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <ButtonLink href={telHref()} variant="bone">
                    {t.actions.callShort} <span dir="ltr">{FACTS.phoneDisplay.value}</span>
                  </ButtonLink>
                  {FACTS.deliveryPartners.value.map((d) => (
                    <ButtonLink key={d.id} href={d.url} external variant="outlineDark">
                      {d.name}
                    </ButtonLink>
                  ))}
                </div>
                <p className="mt-9 border-t border-brand-bone/20 pt-6">
                  <a
                    href={hrefFor("catering", locale)}
                    className="label text-brand-gold underline decoration-brand-gold underline-offset-[6px]"
                  >
                    {t.actions.enquireCatering}
                  </a>
                </p>
              </div>
            </div>
          </Container>
        </Band>
      )}
    </PageShell>
  );
}
