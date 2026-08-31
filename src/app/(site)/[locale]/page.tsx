import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { Hero } from "@/components/Hero";
import { Band, BandHeading, ButtonLink, Container, MarkedList, TextLink } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, isLocale, type Locale, type RouteKey } from "@/lib/i18n/config";
import {
  fallbackAttrs,
  getGallery,
  getPage,
  getSettings,
  isFallback,
  localized,
} from "@/lib/content";
import { FACTS, directionsUrl, telHref } from "@/lib/facts";
import { buildMetadata } from "@/lib/seo";

/**
 * Content comes from the database. Pages are prerendered for speed and regenerated on demand:
 * every admin save revalidates each public path, so edits appear immediately. The hourly
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
  const isAr = locale === "ar";

  const [page, settings, heroImages] = await Promise.all([
    getPage("home"),
    getSettings(),
    getGallery("restaurant"),
  ]);

  const title = localized(locale, page?.titleEn, page?.titleAr) ?? FACTS.nameEn.value;
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
  const hero = heroImages[0]
    ? { src: heroImages[0].filePath, alt: localized(locale, heroImages[0].altEn, heroImages[0].altAr) ?? "" }
    : null;

  /**
   * The three commercial pillars as full-bleed bands — the treatment Ninive gives private
   * events — rather than a three-up card grid. Events come first because they are the
   * primary commercial objective (BLUEPRINT §1); the restaurant has its own band below.
   */
  const pillars: {
    key: RouteKey;
    label: string;
    alt: string;
    line: string;
    cta: string;
    tone: "ember" | "bone" | "char";
  }[] = [
    {
      key: "weddings",
      label: t.nav.weddings,
      alt: "الأعراس والمناسبات",
      line: isAr
        ? "حفلات الزفاف والخطوبة والمناسبات العائلية — في جزيل أو في المكان الذي تختاره. ليالي الجمعة والسبت هي الأكثر ازدحاماً لدينا."
        : "Weddings, engagement parties and family celebrations — held here, or catered at your venue. Friday and Saturday evenings are our busiest.",
      cta: t.actions.enquireWeddings,
      tone: "ember",
    },
    {
      key: "corporate",
      label: t.nav.corporate,
      alt: "فعاليات الشركات",
      line: isAr
        ? "اجتماعات الشركات واللقاءات وإطلاق المنتجات — نستضيفها هنا أو نوصل الضيافة إلى مكتبك."
        : "Company meetings, corporate gatherings and product launches — hosted here, or brought to your office.",
      cta: t.actions.enquireCorporate,
      tone: "bone",
    },
    {
      key: "catering",
      label: t.nav.catering,
      alt: "خدمات الضيافة",
      line: isAr
        ? "بوفيه أو قائمة محددة أو مقبلات خفيفة — تُقدَّم في موقعك أو في المطعم. المطبخ نفسه، على نطاق أكبر."
        : "Buffet, set menu or finger food — delivered to you or served on site. The same kitchen, at a larger scale.",
      cta: t.actions.enquireCatering,
      tone: "char",
    },
  ];

  const facilities = [
    { value: isAr ? "قاعة عائلية داخلية" : "Indoor family hall" },
    { value: isAr ? "جلسات خارجية" : "Outdoor seating" },
    { value: isAr ? "منطقة أطفال" : "Children's area" },
    ...(shishaOn ? [{ value: isAr ? "شيشة" : "Shisha" }] : []),
    { value: isAr ? "طلبات خارجية وتوصيل" : "Takeaway and delivery" },
    { value: isAr ? "المشروبات الكحولية غير متوفرة" : "Alcohol not served" },
  ];

  return (
    <PageShell locale={locale} routeKey="home" transparentHeader>
      <Hero
        full
        image={hero}
        label={kicker}
        labelAttrs={attrs.kicker}
        title={title}
        titleAttrs={attrs.title}
        titleAlt={isAr ? null : "مطعم ومقهى جزيل"}
        intro={intro}
        introAttrs={attrs.intro}
        actions={
          <>
            <ButtonLink href={hrefFor("menu", locale)} variant="bone">
              {t.actions.viewMenu}
            </ButtonLink>
            <ButtonLink href={hrefFor("weddings", locale)} variant="outlineDark">
              {t.nav.eventsGroup}
            </ButtonLink>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-brand-bone/75">
            <span>
              <span className="label me-2 text-brand-gold">{t.labels.hours}</span>
              <span dir="ltr">
                {FACTS.hoursOpen.value} – {FACTS.hoursClose.value}
              </span>
            </span>
            <span>
              <span className="label me-2 text-brand-gold">{t.labels.address}</span>
              {isAr ? FACTS.addressLine1Ar.value : FACTS.addressLine1En.value}
            </span>
            <a
              href={directionsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-brand-gold underline-offset-4 hover:text-brand-bone"
            >
              {t.actions.directions}
            </a>
          </div>
        }
      />

      {/* ------------------------------------------------------ the three pillars */}
      {body ? (
        <Band tone="linen" size="tight">
          <Container size="wide">
            <BandHeading
              label={t.nav.eventsGroup}
              title={isAr ? "المناسبات التي نستضيفها ونقدّم لها الطعام" : "Occasions we host and cater"}
              titleAlt={isAr ? null : "المناسبات التي نستضيفها"}
              intro={body}
              introAttrs={attrs.body}
              size="lg"
            />
          </Container>
        </Band>
      ) : null}

      {pillars.map((p) => {
        const onDark = p.tone !== "bone";
        return (
          <Band key={p.key} tone={p.tone}>
            <Container size="wide">
              <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
                <BandHeading
                  label={isAr ? null : p.alt}
                  labelAttrs={{ lang: "ar", dir: "rtl" }}
                  title={p.label}
                  intro={p.line}
                  size="lg"
                  onDark={onDark}
                />
                <div className="flex flex-wrap gap-3">
                  <ButtonLink
                    href={hrefFor(p.key, locale)}
                    variant={onDark ? "bone" : "solid"}
                  >
                    {p.cta}
                  </ButtonLink>
                </div>
              </div>
            </Container>
          </Band>
        );
      })}

      {/* --------------------------------------------------------- the restaurant */}
      <Band tone="linen">
        <Container size="wide">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
            <div>
              <BandHeading
                label={t.nav.restaurant}
                title={
                  isAr
                    ? "المطبخ يعمل على الفحم"
                    : "The kitchen works over charcoal"
                }
                titleAlt={isAr ? null : "المطبخ يعمل على الفحم"}
                intro={
                  isAr
                    ? "مشاوي مشكلة وكباب وشيش طاووق وريش غنم، إلى جانب المقبلات الباردة والساخنة والسلطات والمناقيش والفطائر من الفرن، ومجموعة من الأطباق العالمية."
                    : "Mixed grills, kebab, shish taouk and lamb chops, alongside cold and hot mezze, salads, manakeesh and fatayer from the oven, and a set of international dishes."
                }
                size="lg"
              />
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href={hrefFor("menu", locale)}>{t.actions.viewMenu}</ButtonLink>
                <ButtonLink href={hrefFor("brunch", locale)} variant="outline">
                  {t.nav.brunch}
                </ButtonLink>
              </div>
            </div>
            <div>
              <h3 className="label text-brand-teal">{isAr ? "في المطعم" : "In the restaurant"}</h3>
              <div className="mt-5">
                <MarkedList items={facilities} />
              </div>
              <p className="mt-8">
                <TextLink href={hrefFor("restaurant", locale)}>{t.nav.restaurant}</TextLink>
              </p>
            </div>
          </div>
        </Container>
      </Band>

      {/* --------------------------------------------------------- find / order */}
      <Band tone="ember" size="tight">
        <Container size="wide">
          <div className="grid gap-12 md:grid-cols-3">
            <div>
              <h2 className="label text-brand-gold">{t.labels.phone}</h2>
              <p className="mt-4">
                <a
                  href={telHref()}
                  dir="ltr"
                  className="display text-3xl text-brand-bone hover:text-brand-gold sm:text-4xl"
                >
                  {FACTS.phoneDisplay.value}
                </a>
              </p>
              <p className="mt-3 text-sm text-brand-bone/70">
                {t.labels.everyDay}{" "}
                <span dir="ltr">
                  {FACTS.hoursOpen.value} – {FACTS.hoursClose.value}
                </span>
              </p>
            </div>
            <div>
              <h2 className="label text-brand-gold">{t.labels.address}</h2>
              <address className="mt-4 not-italic leading-relaxed text-brand-bone/85">
                {(isAr
                  ? [FACTS.addressLine1Ar.value, FACTS.addressLine2Ar.value, FACTS.cityAr.value]
                  : [FACTS.addressLine1En.value, FACTS.addressLine2En.value, FACTS.cityEn.value]
                ).map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
              <p className="mt-4">
                <TextLink href={directionsUrl()} external onDark>
                  {t.actions.directions}
                </TextLink>
              </p>
            </div>
            <div>
              {/*
                Delivery sits last and reads as quiet links, never as a primary button —
                BLUEPRINT §3: delivery must not dominate the catering and event proposition.
              */}
              <h2 className="label text-brand-gold">{t.labels.deliveryPartners}</h2>
              <ul className="mt-4 space-y-3">
                {FACTS.deliveryPartners.value.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-bone/85 underline decoration-brand-bone/30 underline-offset-4 hover:text-brand-gold hover:decoration-brand-gold"
                    >
                      {d.name}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm">
                <Link
                  href={hrefFor("contact", locale)}
                  className="text-brand-bone/70 underline decoration-brand-gold underline-offset-4 hover:text-brand-bone"
                >
                  {t.actions.enquire}
                </Link>
              </p>
            </div>
          </div>
        </Container>
      </Band>
    </PageShell>
  );
}
