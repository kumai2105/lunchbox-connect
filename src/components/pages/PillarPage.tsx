import Image from "next/image";
import { EnquiryForm } from "@/components/EnquiryForm";
import { PageShell } from "@/components/PageShell";
import { Hero } from "@/components/Hero";
import { Band, BandHeading, ButtonLink, Container, MarkedList, Prose } from "@/components/ui";
import {
  fallbackAttrs,
  formatPrice,
  getGallery,
  getPackages,
  getPage,
  getSettings,
  getVenueSpaces,
  isFallback,
  localized,
  parseList,
  type Pillar,
} from "@/lib/content";
import { FACTS, directionsUrl, telHref } from "@/lib/facts";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, type Locale, type RouteKey } from "@/lib/i18n/config";
import { serviceJsonLd } from "@/lib/seo";
import type { EnquiryType } from "@/lib/validation";

const ALT_TITLE: Record<string, string> = {
  weddings: "الأعراس والمناسبات",
  corporate: "فعاليات الشركات",
  catering: "خدمات الضيافة",
  brunch: "برانش الأحد",
};

/**
 * Shared composition for the four commercial pillar pages.
 *
 * Publication gates are enforced here, not by editorial discipline: packages, spaces and
 * gallery blocks render only when published rows exist, a price line appears only when a
 * price exists, and the page remains a finished composition when none of them do.
 */
export async function PillarPage({
  locale,
  routeKey,
  pillar,
  enquiryType,
  slug,
  showBrunchTimes = false,
}: {
  locale: Locale;
  routeKey: RouteKey;
  pillar: Pillar;
  enquiryType: EnquiryType;
  slug: string;
  showBrunchTimes?: boolean;
}) {
  const t = getDictionary(locale);
  const isAr = locale === "ar";
  const [page, pkgs, spaces, pillarImages, venueImages, roomImages, settings] = await Promise.all([
    getPage(slug),
    getPackages(pillar),
    getVenueSpaces(),
    getGallery(pillar),
    getGallery("venue"),
    getGallery("restaurant"),
    getSettings(),
  ]);

  /*
    Corporate and brunch have no photographs of their own — no corporate event and no
    brunch has ever been shot. Rather than leave those pages bare, they fall back to
    pictures of the spaces themselves: the terrace, and the room on a full evening. That
    is honest, because the claim a venue photograph makes is "this is the room", not
    "this was a corporate event". Nothing here implies an event that did not happen, and
    the alt text on each image says what it actually shows.
  */
  const images = pillarImages.length > 0 ? pillarImages : [...venueImages, ...roomImages];

  const title = localized(locale, page?.titleEn, page?.titleAr) ?? t.nav[routeKey as "weddings"];
  const kicker = localized(locale, page?.kickerEn, page?.kickerAr);
  const intro = localized(locale, page?.introEn, page?.introAr);
  const body = localized(locale, page?.bodyEn, page?.bodyAr);
  const attrs = {
    kicker: fallbackAttrs(locale, isFallback(locale, page?.kickerEn, page?.kickerAr)),
    title: fallbackAttrs(locale, isFallback(locale, page?.titleEn, page?.titleAr)),
    intro: fallbackAttrs(locale, isFallback(locale, page?.introEn, page?.introAr)),
    body: fallbackAttrs(locale, isFallback(locale, page?.bodyEn, page?.bodyAr)),
  };

  const brunchTime = showBrunchTimes
    ? localized(locale, settings.brunch_time_en, settings.brunch_time_ar)
    : null;
  const brunchPriceNote = showBrunchTimes
    ? localized(locale, settings.brunch_price_note_en, settings.brunch_price_note_ar)
    : null;

  const enquireLabel =
    routeKey === "weddings"
      ? t.actions.enquireWeddings
      : routeKey === "corporate"
        ? t.actions.enquireCorporate
        : routeKey === "brunch"
          ? t.actions.enquireBrunch
          : t.actions.enquireCatering;

  const hero = images[0]
    ? { src: images[0].filePath, alt: localized(locale, images[0].altEn, images[0].altAr) ?? "" }
    : null;

  return (
    <PageShell
      locale={locale}
      routeKey={routeKey}
      breadcrumbLabel={title}
      extraJsonLd={[serviceJsonLd({ locale, routeKey, name: title, description: intro })]}
    >
      <Hero
        underSolidHeader
        image={hero}
        label={kicker}
        labelAttrs={attrs.kicker}
        title={title}
        titleAttrs={attrs.title}
        titleAlt={isAr ? null : ALT_TITLE[slug]}
        intro={intro}
        introAttrs={attrs.intro}
        actions={
          <>
            <ButtonLink href="#enquiry" variant="bone">
              {enquireLabel}
            </ButtonLink>
            <ButtonLink href={telHref()} variant="outlineDark">
              {t.actions.callShort} <span dir="ltr">{FACTS.phoneDisplay.value}</span>
            </ButtonLink>
          </>
        }
        meta={
          brunchTime ? (
            <p className="text-brand-bone/80">
              <span className="display text-2xl text-brand-bone">{brunchTime}</span>
              {brunchPriceNote ? <span className="ms-4 text-sm">{brunchPriceNote}</span> : null}
            </p>
          ) : null
        }
      />

      {body ? (
        <Band tone="linen">
          <Container size="wide">
            <div className="grid gap-14 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-20">
              <Prose text={body} attrs={attrs.body} />
              <div className="lg:w-64">
                <h2 className="label text-brand-teal">{isAr ? "تواصل معنا" : "Talk to us"}</h2>
                <p className="mt-4">
                  <a
                    href={telHref()}
                    dir="ltr"
                    className="display text-2xl hover:text-brand-teal"
                  >
                    {FACTS.phoneDisplay.value}
                  </a>
                </p>
                <p className="mt-3 text-sm text-brand-ink-soft">
                  {t.labels.everyDay}{" "}
                  <span dir="ltr">
                    {FACTS.hoursOpen.value} – {FACTS.hoursClose.value}
                  </span>
                </p>
                <address className="mt-6 not-italic text-sm leading-relaxed text-brand-ink-soft">
                  {isAr ? FACTS.addressLine1Ar.value : FACTS.addressLine1En.value}
                  <br />
                  {isAr ? FACTS.cityAr.value : FACTS.cityEn.value}
                </address>
                <p className="mt-3 text-sm">
                  <a
                    href={directionsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-brand-gold underline-offset-4 hover:text-brand-teal"
                  >
                    {t.actions.directions}
                  </a>
                </p>
              </div>
            </div>
          </Container>
        </Band>
      ) : null}

      {/* Packages — only real, published ones. No "POA", no empty price line. */}
      {pkgs.length > 0 ? (
        <Band tone="ember">
          <Container size="wide">
            <BandHeading
              title={isAr ? "الباقات" : "Packages"}
              titleAlt={isAr ? null : "الباقات"}
              size="lg"
              onDark
            />
            <ul className="mt-14 divide-y divide-brand-bone/15 border-t border-brand-bone/15">
              {pkgs.map((p) => {
                const inclusions = parseList(isAr ? p.inclusionsAr : p.inclusionsEn);
                const price = formatPrice(p.priceFromFils, "AED", locale);
                const priceNote = localized(locale, p.priceNoteEn, p.priceNoteAr);
                return (
                  <li key={p.id} className="grid gap-6 py-10 lg:grid-cols-[1fr_1fr_auto] lg:gap-12">
                    <div>
                      <h3 className="display text-2xl text-brand-bone">
                        {localized(locale, p.nameEn, p.nameAr)}
                      </h3>
                      {localized(locale, p.summaryEn, p.summaryAr) ? (
                        <p className="mt-3 text-brand-bone/75">
                          {localized(locale, p.summaryEn, p.summaryAr)}
                        </p>
                      ) : null}
                      {p.minGuests || p.maxGuests ? (
                        <p className="label mt-4 text-brand-gold">
                          {p.minGuests && p.maxGuests
                            ? `${p.minGuests}–${p.maxGuests} ${t.labels.guests}`
                            : p.maxGuests
                              ? `${t.labels.upTo} ${p.maxGuests} ${t.labels.guests}`
                              : `${t.labels.from} ${p.minGuests} ${t.labels.guests}`}
                        </p>
                      ) : null}
                    </div>
                    {inclusions.length > 0 ? (
                      <ul className="space-y-2 text-sm text-brand-bone/75">
                        {inclusions.map((inc) => (
                          <li key={inc} className="flex gap-3">
                            <span aria-hidden="true" className="text-brand-gold">
                              ✦
                            </span>
                            <span>{inc}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div />
                    )}
                    <div className="lg:text-end">
                      {price ? (
                        <>
                          <span className="label block text-brand-gold">{t.labels.from}</span>
                          <span className="display mt-1 block text-2xl text-brand-bone" dir="ltr">
                            {price}
                          </span>
                          {p.priceUnit === "per_person" ? (
                            <span className="text-sm text-brand-bone/60">{t.labels.perPerson}</span>
                          ) : p.priceUnit === "per_event" ? (
                            <span className="text-sm text-brand-bone/60">{t.labels.perEvent}</span>
                          ) : null}
                        </>
                      ) : null}
                      {priceNote ? (
                        <p className="mt-2 text-xs text-brand-bone/60">{priceNote}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Container>
        </Band>
      ) : null}

      {/* Spaces — capacities are never invented; the band is absent until supplied. */}
      {spaces.length > 0 && pillar !== "catering" ? (
        <Band tone="linen">
          <Container size="wide">
            <BandHeading
              title={isAr ? "المساحات" : "The spaces"}
              titleAlt={isAr ? null : "المساحات"}
              size="lg"
            />
            <ul className="mt-12 divide-y divide-brand-rule border-t border-brand-rule">
              {spaces.map((s) => (
                <li key={s.id} className="grid gap-4 py-8 sm:grid-cols-[1fr_auto] sm:gap-10">
                  <div>
                    <h3 className="display text-2xl">{localized(locale, s.nameEn, s.nameAr)}</h3>
                    {localized(locale, s.descriptionEn, s.descriptionAr) ? (
                      <p className="mt-2 text-brand-ink-soft">
                        {localized(locale, s.descriptionEn, s.descriptionAr)}
                      </p>
                    ) : null}
                  </div>
                  {s.seatedCapacity || s.standingCapacity ? (
                    <p className="label text-brand-teal sm:text-end">
                      {[
                        s.seatedCapacity ? `${s.seatedCapacity} ${t.labels.seated}` : null,
                        s.standingCapacity ? `${s.standingCapacity} ${t.labels.standing}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Container>
        </Band>
      ) : null}

      {/* Gallery strip — only real, owner-uploaded photographs. */}
      {images.length > 1 ? (
        <Band tone="char" size="tight">
          <Container size="wide">
            <BandHeading title={t.nav.gallery} size="sm" onDark />
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.slice(1, 7).map((img) => (
                <li key={img.id} className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={img.filePath}
                    alt={localized(locale, img.altEn, img.altAr) ?? ""}
                    fill
                    sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw"
                    className="object-cover"
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
            <p className="mt-8">
              <ButtonLink href={hrefFor("gallery", locale)} variant="outlineDark">
                {t.nav.gallery}
              </ButtonLink>
            </p>
          </Container>
        </Band>
      ) : null}

      {/* ------------------------------------------------------------ enquiry */}
      <Band tone="bone" id="enquiry">
        <Container size="wide">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <BandHeading
                title={t.form.heading}
                titleAlt={isAr ? null : "إرسال طلب"}
                intro={
                  isAr
                    ? "أخبرنا بالتفاصيل الأساسية وسيعاود الفريق التواصل معك."
                    : "Tell us the essentials and the team will come back to you."
                }
                size="lg"
              />
              <div className="mt-10">
                <MarkedList
                  items={[
                    { term: t.labels.phone, value: FACTS.phoneDisplay.value },
                    {
                      term: t.labels.hours,
                      value: `${t.labels.everyDay} ${FACTS.hoursOpen.value} – ${FACTS.hoursClose.value}`,
                    },
                    {
                      term: t.labels.address,
                      value: `${isAr ? FACTS.addressLine1Ar.value : FACTS.addressLine1En.value}, ${
                        isAr ? FACTS.cityAr.value : FACTS.cityEn.value
                      }`,
                    },
                  ]}
                />
              </div>
            </div>
            <EnquiryForm
              locale={locale}
              defaultType={enquiryType}
              sourcePage={routeKey}
              phoneDisplay={FACTS.phoneDisplay.value}
              phoneHref={telHref()}
              compact
            />
          </div>
        </Container>
      </Band>
    </PageShell>
  );
}
