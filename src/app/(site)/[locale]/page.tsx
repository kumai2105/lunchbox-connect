import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { ButtonLink, Card, Container, MediaSlot, Section, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, isLocale, type Locale } from "@/lib/i18n/config";
import { fallbackAttrs, getPage, getSettings, isFallback, localized } from "@/lib/content";
import { FACTS, directionsUrl, telHref } from "@/lib/facts";
import { buildMetadata } from "@/lib/seo";

/**
 * Content comes from the database. Pages are prerendered for speed and regenerated on demand:
 * every admin save calls revalidatePath("/", "layout"), so edits appear immediately. The hourly
 * revalidate below is only a safety net if an on-demand revalidation is ever missed.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const page = await getPage("home");
  return buildMetadata({
    routeKey: "home",
    locale,
    title:
      localized(locale, page?.seoTitleEn, page?.seoTitleAr) ??
      (locale === "ar" ? FACTS.nameAr.value : FACTS.nameEn.value),
    description: localized(locale, page?.seoDescriptionEn, page?.seoDescriptionAr),
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getDictionary(locale);
  const [page, settings] = await Promise.all([getPage("home"), getSettings()]);

  const title = localized(locale, page?.titleEn, page?.titleAr);
  const kicker = localized(locale, page?.kickerEn, page?.kickerAr);
  const intro = localized(locale, page?.introEn, page?.introAr);
  const body = localized(locale, page?.bodyEn, page?.bodyAr);
  const attrs = {
    kicker: fallbackAttrs(locale, isFallback(locale, page?.kickerEn, page?.kickerAr)),
    title: fallbackAttrs(locale, isFallback(locale, page?.titleEn, page?.titleAr)),
    intro: fallbackAttrs(locale, isFallback(locale, page?.introEn, page?.introAr)),
    body: fallbackAttrs(locale, isFallback(locale, page?.bodyEn, page?.bodyAr)),
  };
  const shishaOn = settings.shisha_visible !== "false";

  /**
   * Three commercial pillars, given equal structural weight. Events and catering come first
   * in the reading order because they are the primary commercial objective (BLUEPRINT §1);
   * the restaurant is not demoted — it has its own full section immediately below.
   */
  const pillars = [
    {
      key: "weddings" as const,
      label: t.nav.weddings,
      lede:
        locale === "ar"
          ? null
          : "Weddings, engagement parties and family celebrations — hosted here or catered at your venue.",
      cta: t.actions.enquireWeddings,
    },
    {
      key: "corporate" as const,
      label: t.nav.corporate,
      lede:
        locale === "ar"
          ? null
          : "Company meetings, corporate gatherings, and product and company launches.",
      cta: t.actions.enquireCorporate,
    },
    {
      key: "catering" as const,
      label: t.nav.catering,
      lede:
        locale === "ar"
          ? null
          : "Buffets, set menus and finger food — delivered to you or served on site.",
      cta: t.actions.enquireCatering,
    },
  ];

  const facilities = [
    locale === "ar" ? "قاعة عائلية داخلية" : "Indoor family hall",
    locale === "ar" ? "جلسات خارجية" : "Outdoor seating",
    locale === "ar" ? "منطقة أطفال" : "Children's area",
    ...(shishaOn ? [locale === "ar" ? "شيشة" : "Shisha"] : []),
    locale === "ar" ? "طلبات خارجية" : "Takeaway",
    locale === "ar" ? "توصيل" : "Delivery",
  ];

  return (
    <PageShell locale={locale} routeKey="home">
      {/* ---------------------------------------------------------------- hero */}
      <section className="border-b border-brand-line bg-brand-surface">
        <Container size="wide">
          <div className="grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-20">
            <div>
              {kicker ? (
                <p
                  {...attrs.kicker}
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent"
                >
                  {kicker}
                </p>
              ) : null}
              <h1
                {...attrs.title}
                className="mt-3 font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl"
              >
                {title}
              </h1>
              {intro ? (
                <p
                  {...attrs.intro}
                  className="mt-5 max-w-xl text-lg leading-relaxed text-brand-ink-soft"
                >
                  {intro}
                </p>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={hrefFor("menu", locale)}>{t.actions.viewMenu}</ButtonLink>
                <ButtonLink href={hrefFor("contact", locale)} variant="secondary">
                  {t.actions.enquire}
                </ButtonLink>
                <ButtonLink href={telHref()} variant="secondary" external={false}>
                  {t.actions.callShort} <span dir="ltr">{FACTS.phoneDisplay.value}</span>
                </ButtonLink>
              </div>

              <p className="mt-6 text-sm text-brand-ink-soft">
                {t.labels.everyDay}{" "}
                <span dir="ltr" className="font-medium text-brand-ink">
                  {FACTS.hoursOpen.value} – {FACTS.hoursClose.value}
                </span>
                {" · "}
                <a
                  href={directionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-brand-ink"
                >
                  {t.actions.directions}
                </a>
              </p>
            </div>

            <MediaSlot ratio="aspect-[4/3]" className="w-full" />
          </div>
        </Container>
      </section>

      {/* ----------------------------------------------------- three pillars */}
      <Section tone="paper">
        <Container size="wide">
          <SectionHeading
            kicker={t.nav.eventsGroup}
            title={
              locale === "ar"
                ? "المناسبات التي نستضيفها ونقدّم لها الطعام"
                : "Occasions we host and cater"
            }
            intro={body}
            introAttrs={attrs.body}
          />

          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {pillars.map((p) => (
              <Card key={p.key} as="li" className="flex flex-col">
                <h3 className="font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-xl font-semibold">
                  <Link href={hrefFor(p.key, locale)} className="hover:text-brand-accent">
                    {p.label}
                  </Link>
                </h3>
                {p.lede ? (
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-brand-ink-soft">{p.lede}</p>
                ) : (
                  <div className="flex-1" />
                )}
                <p className="mt-5">
                  <Link
                    href={hrefFor(p.key, locale)}
                    className="text-sm font-semibold text-brand-accent underline underline-offset-4"
                  >
                    {p.cta}
                  </Link>
                </p>
              </Card>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ------------------------------------------------------- restaurant */}
      <Section tone="surface">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <MediaSlot ratio="aspect-[5/4]" className="order-last lg:order-first" />
            <div>
              <SectionHeading
                kicker={t.nav.restaurant}
                title={
                  locale === "ar"
                    ? "مطعم ومقهى في واحة دبي للسيليكون"
                    : "A restaurant and café in Dubai Silicon Oasis"
                }
                intro={
                  locale === "ar"
                    ? null
                    : "Charcoal grills, Levantine mezze, manakeesh and fatayer from the oven, and a range of international dishes — every day from 10:00 until 02:00."
                }
              />
              <ul className="mt-6 flex flex-wrap gap-2">
                {facilities.map((f) => (
                  <li
                    key={f}
                    className="rounded-full border border-brand-line bg-brand-paper px-3 py-1 text-sm text-brand-ink-soft"
                  >
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={hrefFor("restaurant", locale)} variant="secondary">
                  {t.nav.restaurant}
                </ButtonLink>
                <ButtonLink href={hrefFor("menu", locale)} variant="secondary">
                  {t.actions.viewMenu}
                </ButtonLink>
                <ButtonLink href={hrefFor("brunch", locale)} variant="secondary">
                  {t.nav.brunch}
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* --------------------------------------------------- find / call / order */}
      <Section tone="deep">
        <Container size="wide">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                {t.labels.address}
              </h2>
              <p className="mt-3 leading-relaxed">
                {locale === "ar" ? FACTS.addressLine1Ar.value : FACTS.addressLine1En.value}
                <br />
                {locale === "ar" ? FACTS.cityAr.value : FACTS.cityEn.value}
              </p>
              <p className="mt-4">
                <a
                  href={directionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold underline underline-offset-4"
                >
                  {t.actions.directions}
                </a>
              </p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                {t.labels.phone}
              </h2>
              <p className="mt-3">
                <a
                  href={telHref()}
                  dir="ltr"
                  className="text-2xl font-semibold underline underline-offset-4"
                >
                  {FACTS.phoneDisplay.value}
                </a>
              </p>
              <p className="mt-3 text-sm text-white/70">
                {t.labels.everyDay}{" "}
                <span dir="ltr">
                  {FACTS.hoursOpen.value} – {FACTS.hoursClose.value}
                </span>
              </p>
            </div>
            <div>
              {/*
                Delivery is deliberately the LAST block on the homepage and rendered as quiet
                secondary links, not primary buttons — BLUEPRINT §3: delivery-platform actions
                must not dominate the higher-value catering and event proposition.
              */}
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                {t.labels.deliveryPartners}
              </h2>
              <ul className="mt-3 space-y-2">
                {FACTS.deliveryPartners.value.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline underline-offset-4 hover:text-white"
                    >
                      {d.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </Section>
    </PageShell>
  );
}
