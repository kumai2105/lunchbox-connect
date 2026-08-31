import Image from "next/image";
import { PageShell } from "@/components/PageShell";
import { EnquiryForm } from "@/components/EnquiryForm";
import {
  ButtonLink,
  Card,
  Container,
  DefinitionRow,
  MediaSlot,
  Prose,
  Section,
  SectionHeading,
} from "@/components/ui";
import { fallbackAttrs, getGallery, getPage, getSettings, isFallback, localized } from "@/lib/content";
import { FACTS, directionsUrl, telHref } from "@/lib/facts";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, type Locale } from "@/lib/i18n/config";


/** Language attributes for each CMS field, so fallback text renders in its own direction. */
function pageAttrs(locale: Locale, page: { titleEn: string | null; titleAr: string | null; kickerEn: string | null; kickerAr: string | null; introEn: string | null; introAr: string | null; bodyEn: string | null; bodyAr: string | null } | null) {
  return {
    kicker: fallbackAttrs(locale, isFallback(locale, page?.kickerEn, page?.kickerAr)),
    title: fallbackAttrs(locale, isFallback(locale, page?.titleEn, page?.titleAr)),
    intro: fallbackAttrs(locale, isFallback(locale, page?.introEn, page?.introAr)),
    body: fallbackAttrs(locale, isFallback(locale, page?.bodyEn, page?.bodyAr)),
  };
}

/* --------------------------------------------------------------- restaurant */

export async function RestaurantPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [page, settings, images] = await Promise.all([
    getPage("restaurant"),
    getSettings(),
    getGallery("restaurant"),
  ]);

  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.restaurant;
  const attrs = pageAttrs(locale, page);
  const shishaOn = settings.shisha_visible !== "false";

  const facts: { term: string; value: string }[] = [
    {
      term: t.labels.hours,
      value: `${t.labels.everyDay} ${FACTS.hoursOpen.value} – ${FACTS.hoursClose.value}`,
    },
    { term: t.labels.cuisine, value: FACTS.cuisines.value.join(" · ") },
    {
      term: locale === "ar" ? "الجلوس" : "Seating",
      value:
        locale === "ar"
          ? "قاعة عائلية داخلية وجلسات خارجية ومنطقة أطفال"
          : "Indoor dining room with a family hall, outdoor seating, and a children's area",
    },
    ...(shishaOn
      ? [
          {
            term: locale === "ar" ? "الشيشة" : "Shisha",
            value: locale === "ar" ? "متوفرة" : "Served",
          },
        ]
      : []),
    {
      term: locale === "ar" ? "المشروبات الكحولية" : "Alcohol",
      value: locale === "ar" ? "لا تُقدَّم" : "Not served",
    },
  ];

  return (
    <PageShell locale={locale} routeKey="restaurant" breadcrumbLabel={title}>
      <Section tone="surface" className="!pb-10">
        <Container size="wide">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <SectionHeading
                as="h1"
                kicker={localized(locale, page?.kickerEn, page?.kickerAr)}
                title={title}
                intro={localized(locale, page?.introEn, page?.introAr)}
                kickerAttrs={attrs.kicker}
                titleAttrs={attrs.title}
                introAttrs={attrs.intro}
              />
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={hrefFor("menu", locale)}>{t.actions.viewMenu}</ButtonLink>
                <ButtonLink href={telHref()} variant="secondary">
                  {t.actions.callShort} <span dir="ltr">{FACTS.phoneDisplay.value}</span>
                </ButtonLink>
                <ButtonLink href={directionsUrl()} external variant="secondary">
                  {t.actions.directions}
                </ButtonLink>
              </div>
            </div>
            {images.length > 0 ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-[--radius-card]">
                <Image
                  src={images[0].filePath}
                  alt={localized(locale, images[0].altEn, images[0].altAr) ?? ""}
                  fill
                  sizes="(min-width:1024px) 45vw, 100vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <MediaSlot ratio="aspect-[4/3]" />
            )}
          </div>
        </Container>
      </Section>

      <Section tone="paper">
        <Container size="wide">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <Prose text={localized(locale, page?.bodyEn, page?.bodyAr)} attrs={attrs.body} />
            <dl className="text-sm">
              {facts.map((f) => (
                <DefinitionRow key={f.term} term={f.term}>
                  {f.value}
                </DefinitionRow>
              ))}
            </dl>
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container size="wide">
          <SectionHeading
            title={locale === "ar" ? "أيضاً في جزيل" : "Also at Jazeel"}
            as="h2"
          />
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {(
              [
                { key: "brunch", label: t.nav.brunch },
                { key: "weddings", label: t.nav.weddings },
                { key: "catering", label: t.nav.catering },
              ] as const
            ).map((l) => (
              <Card key={l.key} as="li">
                <h3 className="text-lg font-semibold">
                  <a href={hrefFor(l.key, locale)} className="hover:text-brand-accent">
                    {l.label}
                  </a>
                </h3>
              </Card>
            ))}
          </ul>
        </Container>
      </Section>
    </PageShell>
  );
}

/* -------------------------------------------------------------------- about */

export async function AboutPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const page = await getPage("about");
  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.about;
  const attrs = pageAttrs(locale, page);

  return (
    <PageShell locale={locale} routeKey="about" breadcrumbLabel={title}>
      <Section tone="surface" className="!pb-10">
        <Container size="narrow">
          <SectionHeading
            as="h1"
            kicker={localized(locale, page?.kickerEn, page?.kickerAr)}
            title={title}
            intro={localized(locale, page?.introEn, page?.introAr)}
            kickerAttrs={attrs.kicker}
            titleAttrs={attrs.title}
            introAttrs={attrs.intro}
          />
        </Container>
      </Section>
      <Section tone="paper">
        <Container size="narrow">
          <Prose text={localized(locale, page?.bodyEn, page?.bodyAr)} attrs={attrs.body} />
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href={hrefFor("contact", locale)}>{t.nav.contact}</ButtonLink>
            <ButtonLink href={hrefFor("menu", locale)} variant="secondary">
              {t.actions.viewMenu}
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ privacy */

export async function PrivacyPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const page = await getPage("privacy");
  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.privacy;
  const attrs = pageAttrs(locale, page);
  return (
    <PageShell locale={locale} routeKey="privacy" breadcrumbLabel={title}>
      <Section tone="paper">
        <Container size="narrow">
          <SectionHeading
            as="h1"
            title={title}
            intro={localized(locale, page?.introEn, page?.introAr)}
            titleAttrs={attrs.title}
            introAttrs={attrs.intro}
          />
          <div className="mt-8">
            <Prose text={localized(locale, page?.bodyEn, page?.bodyAr)} attrs={attrs.body} />
          </div>
        </Container>
      </Section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ gallery */

export async function GalleryPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [page, images] = await Promise.all([getPage("gallery"), getGallery()]);
  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.gallery;
  const attrs = pageAttrs(locale, page);

  return (
    <PageShell locale={locale} routeKey="gallery" breadcrumbLabel={title}>
      <Section tone="surface" className="!pb-10">
        <Container size="wide">
          <SectionHeading
            as="h1"
            title={title}
            intro={localized(locale, page?.introEn, page?.introAr)}
            titleAttrs={attrs.title}
            introAttrs={attrs.intro}
          />
        </Container>
      </Section>
      <Section tone="paper">
        <Container size="wide">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <li key={img.id}>
                <figure>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[--radius-card]">
                    <Image
                      src={img.filePath}
                      alt={localized(locale, img.altEn, img.altAr) ?? ""}
                      fill
                      sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                  {localized(locale, img.captionEn, img.captionAr) ? (
                    <figcaption className="mt-2 text-sm text-brand-ink-soft">
                      {localized(locale, img.captionEn, img.captionAr)}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ contact */

export async function ContactPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [page, settings] = await Promise.all([getPage("contact"), getSettings()]);
  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.contact;
  const attrs = pageAttrs(locale, page);

  const whatsapp = settings.whatsapp?.trim();
  const email = settings.email?.trim();
  const hoursNote = localized(locale, settings.hours_note_en, settings.hours_note_ar);

  return (
    <PageShell locale={locale} routeKey="contact" breadcrumbLabel={title}>
      <Section tone="surface" className="!pb-10">
        <Container size="wide">
          <SectionHeading
            as="h1"
            kicker={localized(locale, page?.kickerEn, page?.kickerAr)}
            title={title}
            intro={localized(locale, page?.introEn, page?.introAr)}
            kickerAttrs={attrs.kicker}
            titleAttrs={attrs.title}
            introAttrs={attrs.intro}
          />
        </Container>
      </Section>

      <Section tone="paper">
        <Container size="wide">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <dl className="text-sm">
                <DefinitionRow term={t.labels.phone}>
                  <a href={telHref()} dir="ltr" className="font-semibold underline underline-offset-4">
                    {FACTS.phoneDisplay.value}
                  </a>
                </DefinitionRow>
                {whatsapp ? (
                  <DefinitionRow term="WhatsApp">
                    <a
                      href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      <span dir="ltr">{whatsapp}</span>
                    </a>
                  </DefinitionRow>
                ) : null}
                {email ? (
                  <DefinitionRow term="Email">
                    <a href={`mailto:${email}`} className="underline underline-offset-4" dir="ltr">
                      {email}
                    </a>
                  </DefinitionRow>
                ) : null}
                <DefinitionRow term={t.labels.address}>
                  <address className="not-italic">
                    {(locale === "ar"
                      ? [
                          FACTS.addressLine1Ar.value,
                          FACTS.addressLine2Ar.value,
                          FACTS.cityAr.value,
                          FACTS.countryAr.value,
                        ]
                      : [
                          FACTS.addressLine1En.value,
                          FACTS.addressLine2En.value,
                          FACTS.cityEn.value,
                          FACTS.countryEn.value,
                        ]
                    ).map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                  <a
                    href={directionsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block underline underline-offset-4"
                  >
                    {t.actions.directions}
                  </a>
                </DefinitionRow>
                <DefinitionRow term={t.labels.hours}>
                  {t.labels.everyDay}{" "}
                  <span dir="ltr">
                    {FACTS.hoursOpen.value} – {FACTS.hoursClose.value}
                  </span>
                  {hoursNote ? <span className="mt-1 block">{hoursNote}</span> : null}
                </DefinitionRow>
                <DefinitionRow term={t.labels.deliveryPartners}>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {FACTS.deliveryPartners.value.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4"
                        >
                          {d.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </DefinitionRow>
              </dl>
            </div>

            <div id="enquiry">
              <h2 className="font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-2xl font-semibold">
                {t.form.heading}
              </h2>
              <div className="mt-6">
                <EnquiryForm
                  locale={locale}
                  defaultType="general"
                  allowTypeChange
                  sourcePage="contact"
                  phoneDisplay={FACTS.phoneDisplay.value}
                  phoneHref={telHref()}
                  compact
                />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </PageShell>
  );
}
