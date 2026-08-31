import Image from "next/image";
import { PageShell } from "@/components/PageShell";
import { ButtonLink, Card, Container, Pill, Section, SectionHeading } from "@/components/ui";
import {
  fallbackAttrs,
  formatPrice,
  getPage,
  getPublishedMenu,
  getSettings,
  isFallback,
  localized,
  parseList,
} from "@/lib/content";
import { FACTS, telHref } from "@/lib/facts";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, type Locale } from "@/lib/i18n/config";

/**
 * The menu page.
 *
 * When no menu item has been published, this page does NOT show an empty grid or a
 * "coming soon" panel. It shows a complete, purposeful page: what the kitchen cooks
 * (VERIFIED from Phase 1), how to call, and the verified delivery storefronts where a
 * live menu genuinely exists today. That is an honest, finished state — not a placeholder.
 */
export async function MenuPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
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

  return (
    <PageShell locale={locale} routeKey="menu" breadcrumbLabel={title}>
      <Section tone="surface" className="!pb-10">
        <Container size="wide">
          <SectionHeading
            as="h1"
            kicker={kicker}
            title={title}
            intro={intro}
            kickerAttrs={attrs.kicker}
            titleAttrs={attrs.title}
            introAttrs={attrs.intro}
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={telHref()}>
              {t.actions.callShort} <span dir="ltr">{FACTS.phoneDisplay.value}</span>
            </ButtonLink>
            {FACTS.deliveryPartners.value.map((d) => (
              <ButtonLink key={d.id} href={d.url} external variant="secondary">
                {d.name}
              </ButtonLink>
            ))}
          </div>
        </Container>
      </Section>

      {hasMenu ? (
        <>
          {/* In-page category jump list — no JavaScript required. */}
          <div className="sticky top-[57px] z-30 border-y border-brand-line bg-brand-paper/95 backdrop-blur">
            <Container size="wide">
              <nav aria-label={t.labels.category} className="overflow-x-auto py-3">
                <ul className="flex gap-x-5 gap-y-2 whitespace-nowrap text-sm">
                  {groups.map(({ category }) => (
                    <li key={category.id}>
                      <a
                        href={`#cat-${category.slug}`}
                        className="text-brand-ink-soft underline-offset-4 hover:text-brand-ink hover:underline"
                      >
                        {localized(locale, category.nameEn, category.nameAr)}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </Container>
          </div>

          <Section tone="paper">
            <Container size="wide">
              <div className="space-y-14">
                {groups.map(({ category, items }) => (
                  <section key={category.id} id={`cat-${category.slug}`} aria-labelledby={`h-${category.slug}`}>
                    <h2
                      id={`h-${category.slug}`}
                      className="font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-2xl font-semibold"
                    >
                      {localized(locale, category.nameEn, category.nameAr)}
                    </h2>
                    {localized(locale, category.descriptionEn, category.descriptionAr) ? (
                      <p className="mt-2 max-w-2xl text-sm text-brand-ink-soft">
                        {localized(locale, category.descriptionEn, category.descriptionAr)}
                      </p>
                    ) : null}

                    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((item) => {
                        const name = localized(locale, item.nameEn, item.nameAr);
                        const desc = localized(locale, item.descriptionEn, item.descriptionAr);
                        const portion = localized(locale, item.portionEn, item.portionAr);
                        const price = formatPrice(item.priceFils, item.currency, locale);
                        const dietary = parseList(item.dietary);
                        const allergens = parseList(item.allergens);
                        return (
                          <Card key={item.id} as="li" className="flex gap-4 p-4">
                            {item.imagePath ? (
                              <div className="relative size-20 shrink-0 overflow-hidden rounded">
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
                              <div className="flex items-baseline justify-between gap-3">
                                <h3 className="font-medium leading-snug">{name}</h3>
                                {price ? (
                                  <span className="shrink-0 text-sm font-semibold" dir="ltr">
                                    {price}
                                  </span>
                                ) : null}
                              </div>
                              {portion ? (
                                <p className="mt-0.5 text-xs text-brand-ink-soft">{portion}</p>
                              ) : null}
                              {desc ? (
                                <p className="mt-1.5 text-sm leading-relaxed text-brand-ink-soft">
                                  {desc}
                                </p>
                              ) : null}
                              {(dietary.length > 0 || !item.inStock || !item.availableDelivery || !item.availableDineIn) && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
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
                              )}
                              {allergens.length > 0 ? (
                                <p className="mt-2 text-xs text-brand-ink-soft">
                                  {t.labels.contains}: {allergens.join(", ")}
                                </p>
                              ) : null}
                            </div>
                          </Card>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </Container>
          </Section>
        </>
      ) : (
        <Section tone="paper">
          <Container size="wide">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <h2 className="font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-2xl font-semibold">
                  {locale === "ar" ? "ماذا يقدّم المطبخ" : "What the kitchen cooks"}
                </h2>
                <ul className="mt-5 space-y-2.5 text-brand-ink-soft">
                  {(locale === "ar"
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
                      ]
                  ).map((line) => (
                    <li key={line} className="flex gap-3">
                      <span aria-hidden="true" className="text-brand-accent">
                        ·
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Card>
                <h2 className="text-lg font-semibold">
                  {locale === "ar" ? "اطلب الآن" : "Order now"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-ink-soft">
                  {locale === "ar"
                    ? "قائمة التوصيل الكاملة والأسعار الحالية متاحة لدى شركاء التوصيل، أو اتصل بنا مباشرة."
                    : "Our full delivery menu and current prices are live with our delivery partners. For dine-in, catering or anything else, calling is the quickest route."}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {FACTS.deliveryPartners.value.map((d) => (
                    <ButtonLink key={d.id} href={d.url} external variant="secondary">
                      {d.name}
                    </ButtonLink>
                  ))}
                  <ButtonLink href={telHref()}>
                    {t.actions.callShort} <span dir="ltr">{FACTS.phoneDisplay.value}</span>
                  </ButtonLink>
                </div>
                <p className="mt-6 border-t border-brand-line-soft pt-4 text-sm">
                  <a
                    href={hrefFor("catering", locale)}
                    className="font-semibold text-brand-accent underline underline-offset-4"
                  >
                    {t.actions.enquireCatering}
                  </a>
                </p>
              </Card>
            </div>
          </Container>
        </Section>
      )}
    </PageShell>
  );
}
