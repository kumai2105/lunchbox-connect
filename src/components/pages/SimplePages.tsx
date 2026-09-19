import Image from "next/image";
import { PageShell } from "@/components/PageShell";
import { Hero } from "@/components/Hero";
import { EnquiryForm } from "@/components/EnquiryForm";
import {
  Band,
  BandHeading,
  ButtonLink,
  Container,
  MarkedList,
  MediaFrame,
  Prose,
  TextLink,
} from "@/components/ui";
import { fallbackAttrs, getGallery, getPage, getSettings, isFallback, localized } from "@/lib/content";
import { FACTS, directionsUrl, telHref } from "@/lib/facts";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, type Locale } from "@/lib/i18n/config";

type PageRowLike = {
  titleEn: string | null;
  titleAr: string | null;
  kickerEn: string | null;
  kickerAr: string | null;
  introEn: string | null;
  introAr: string | null;
  bodyEn: string | null;
  bodyAr: string | null;
} | null;

/** Language attributes per field, so fallback text renders in its own direction. */
function pageAttrs(locale: Locale, page: PageRowLike) {
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
  const isAr = locale === "ar";
  const [page, settings, restaurantImages, venueImages] = await Promise.all([
    getPage("restaurant"),
    getSettings(),
    getGallery("restaurant"),
    getGallery("venue"),
  ]);
  /*
    The page covers both spaces the owner has: the indoor room and the outdoor terrace.
    The terrace leads, for two reasons — the only photographs of the indoor room as it
    looks today are the ones held back over the shisha question, and the homepage already
    opens on the wide terrace shot, so this page takes the seating view instead of
    repeating the same frame two clicks apart.
  */
  const preferred = ["/media/terrace-tables.jpg", "/media/terrace-umbrellas.jpg"];
  const venueOrdered = [...venueImages].sort(
    (a, b) =>
      (preferred.indexOf(a.filePath) + 1 || 99) - (preferred.indexOf(b.filePath) + 1 || 99),
  );
  const images = [...venueOrdered, ...restaurantImages];

  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.restaurant;
  const attrs = pageAttrs(locale, page);
  const shishaOn = settings.shisha_visible !== "false";
  const hero = images[0]
    ? { src: images[0].filePath, alt: localized(locale, images[0].altEn, images[0].altAr) ?? "" }
    : null;

  const facts = [
    {
      term: t.labels.hours,
      value: `${t.labels.everyDay} ${FACTS.hoursOpen.value} – ${FACTS.hoursClose.value}`,
    },
    { term: t.labels.cuisine, value: FACTS.cuisines.value.join(" · ") },
    {
      term: isAr ? "الجلوس" : "Seating",
      value: isAr
        ? "قاعة عائلية داخلية، جلسات خارجية، ومنطقة أطفال"
        : "Indoor dining room with a family hall, outdoor seating, and a children's area",
    },
    ...(shishaOn
      ? [{ term: isAr ? "الشيشة" : "Shisha", value: isAr ? "متوفرة" : "Served" }]
      : []),
    {
      term: isAr ? "المشروبات الكحولية" : "Alcohol",
      value: isAr ? "لا تُقدَّم" : "Not served",
    },
  ];

  return (
    <PageShell locale={locale} routeKey="restaurant" breadcrumbLabel={title}>
      <Hero
        underSolidHeader
        image={hero}
        label={localized(locale, page?.kickerEn, page?.kickerAr)}
        labelAttrs={attrs.kicker}
        title={title}
        titleAttrs={attrs.title}
        titleAlt={isAr ? null : "المطعم والمقهى"}
        intro={localized(locale, page?.introEn, page?.introAr)}
        introAttrs={attrs.intro}
        actions={
          <>
            <ButtonLink href={hrefFor("menu", locale)} variant="bone">
              {t.actions.viewMenu}
            </ButtonLink>
            <ButtonLink href={directionsUrl()} external variant="outlineDark">
              {t.actions.directions}
            </ButtonLink>
          </>
        }
      />

      <Band tone="linen">
        <Container size="wide">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <Prose text={localized(locale, page?.bodyEn, page?.bodyAr)} attrs={attrs.body} />
            <div>
              <h2 className="label text-brand-teal">{isAr ? "التفاصيل" : "The details"}</h2>
              <div className="mt-5">
                <MarkedList items={facts} />
              </div>
            </div>
          </div>
        </Container>
      </Band>

      <Band tone="ember" size="tight">
        <Container size="wide">
          <BandHeading
            title={isAr ? "أيضاً في جزيل" : "Also at Jazeel"}
            titleAlt={isAr ? null : "أيضاً في جزيل"}
            size="lg"
            onDark
          />
          <ul className="mt-12 divide-y divide-brand-bone/15 border-t border-brand-bone/15">
            {(
              [
                { key: "brunch", label: t.nav.brunch, alt: "برانش الأحد" },
                { key: "weddings", label: t.nav.weddings, alt: "الأعراس والمناسبات" },
                { key: "catering", label: t.nav.catering, alt: "خدمات الضيافة" },
              ] as const
            ).map((l) => (
              <li key={l.key}>
                <a
                  href={hrefFor(l.key, locale)}
                  className="flex flex-wrap items-baseline justify-between gap-4 py-7 hover:text-brand-gold"
                >
                  <span className="display text-2xl sm:text-3xl">{l.label}</span>
                  {!isAr ? (
                    <span lang="ar" dir="rtl" aria-hidden="true" className="script-pair text-xl text-brand-gold/80">
                      {l.alt}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Band>
    </PageShell>
  );
}

/* -------------------------------------------------------------------- about */

export async function AboutPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const isAr = locale === "ar";
  const [page, teamImages] = await Promise.all([getPage("about"), getGallery("restaurant")]);
  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.about;
  const attrs = pageAttrs(locale, page);
  const portrait = teamImages[0]
    ? {
        src: teamImages[0].filePath,
        alt: localized(locale, teamImages[0].altEn, teamImages[0].altAr) ?? "",
      }
    : null;

  return (
    <PageShell locale={locale} routeKey="about" breadcrumbLabel={title}>
      <Hero
        underSolidHeader
        label={localized(locale, page?.kickerEn, page?.kickerAr)}
        labelAttrs={attrs.kicker}
        title={title}
        titleAttrs={attrs.title}
        titleAlt={isAr ? null : "عن جزيل"}
        intro={localized(locale, page?.introEn, page?.introAr)}
        introAttrs={attrs.intro}
      />
      <Band tone="linen">
        <Container size="wide">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <Prose text={localized(locale, page?.bodyEn, page?.bodyAr)} attrs={attrs.body} />
            <MediaFrame ratio="aspect-[4/5]" image={portrait} />
          </div>
          <div className="mt-14 flex flex-wrap gap-3">
            <ButtonLink href={hrefFor("menu", locale)}>{t.actions.viewMenu}</ButtonLink>
            <ButtonLink href={hrefFor("contact", locale)} variant="outline">
              {t.nav.contact}
            </ButtonLink>
          </div>
        </Container>
      </Band>
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
      <Band tone="bone">
        <Container size="narrow">
          <BandHeading
            as="h1"
            title={title}
            intro={localized(locale, page?.introEn, page?.introAr)}
            titleAttrs={attrs.title}
            introAttrs={attrs.intro}
            size="lg"
          />
          <div className="mt-12">
            <Prose text={localized(locale, page?.bodyEn, page?.bodyAr)} attrs={attrs.body} />
          </div>
        </Container>
      </Band>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ gallery */

export async function GalleryPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const isAr = locale === "ar";
  const [page, images] = await Promise.all([getPage("gallery"), getGallery()]);
  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.gallery;
  const attrs = pageAttrs(locale, page);

  return (
    <PageShell locale={locale} routeKey="gallery" breadcrumbLabel={title}>
      <Hero
        underSolidHeader
        title={title}
        titleAttrs={attrs.title}
        titleAlt={isAr ? null : "معرض الصور"}
        intro={localized(locale, page?.introEn, page?.introAr)}
        introAttrs={attrs.intro}
      />
      <Band tone="bone">
        <Container size="wide">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <li key={img.id}>
                <figure>
                  <div className="relative aspect-[4/3] overflow-hidden">
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
      </Band>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ contact */

export async function ContactPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const isAr = locale === "ar";
  const [page, settings] = await Promise.all([getPage("contact"), getSettings()]);
  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav.contact;
  const attrs = pageAttrs(locale, page);

  const whatsapp = settings.whatsapp?.trim();
  const email = settings.email?.trim();
  const hoursNote = localized(locale, settings.hours_note_en, settings.hours_note_ar);

  const details = [
    { term: t.labels.phone, value: FACTS.phoneDisplay.value, valueDir: "ltr" as const },
    ...(whatsapp ? [{ term: "WhatsApp", value: whatsapp }] : []),
    ...(email ? [{ term: "Email", value: email }] : []),
    {
      term: t.labels.address,
      value: (isAr
        ? [FACTS.addressLine1Ar.value, FACTS.addressLine2Ar.value, FACTS.cityAr.value]
        : [FACTS.addressLine1En.value, FACTS.addressLine2En.value, FACTS.cityEn.value]
      ).join(", "),
    },
    {
      term: t.labels.hours,
      value:
        `${t.labels.everyDay} ${FACTS.hoursOpen.value} – ${FACTS.hoursClose.value}` +
        (hoursNote ? ` · ${hoursNote}` : ""),
    },
  ];

  return (
    <PageShell locale={locale} routeKey="contact" breadcrumbLabel={title}>
      <Hero
        underSolidHeader
        label={localized(locale, page?.kickerEn, page?.kickerAr)}
        labelAttrs={attrs.kicker}
        title={title}
        titleAttrs={attrs.title}
        titleAlt={isAr ? null : "اتصل بنا"}
        intro={localized(locale, page?.introEn, page?.introAr)}
        introAttrs={attrs.intro}
        actions={
          <>
            <ButtonLink href={telHref()} variant="bone">
              <span dir="ltr">{FACTS.phoneDisplay.value}</span>
            </ButtonLink>
            <ButtonLink href={directionsUrl()} external variant="outlineDark">
              {t.actions.directions}
            </ButtonLink>
          </>
        }
      />

      <Band tone="bone" id="enquiry">
        <Container size="wide">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <h2 className="label text-brand-teal">{isAr ? "التفاصيل" : "Find us"}</h2>
              <div className="mt-5">
                <MarkedList items={details} />
              </div>
              <p className="mt-6">
                <TextLink href={directionsUrl()} external>
                  {t.actions.directions}
                </TextLink>
              </p>
              <h2 className="label mt-12 text-brand-teal">{t.labels.deliveryPartners}</h2>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {FACTS.deliveryPartners.value.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-brand-gold underline-offset-4 hover:text-brand-teal"
                    >
                      {d.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="rule-gold mb-6" />
              <h2 className="display text-3xl sm:text-4xl">{t.form.heading}</h2>
              <div className="mt-8">
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
      </Band>
    </PageShell>
  );
}
