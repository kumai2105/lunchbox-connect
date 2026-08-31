import Image from "next/image";
import { EnquiryForm } from "@/components/EnquiryForm";
import { PageShell } from "@/components/PageShell";
import {
  ButtonLink,
  Card,
  Container,
  MediaSlot,
  Prose,
  Section,
  SectionHeading,
} from "@/components/ui";
import {
  fallbackAttrs,
  isFallback,
  formatPrice,
  getGallery,
  getPackages,
  getPage,
  getSettings,
  getVenueSpaces,
  localized,
  parseList,
  type Pillar,
} from "@/lib/content";
import { FACTS, directionsUrl, telHref } from "@/lib/facts";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, type Locale, type RouteKey } from "@/lib/i18n/config";
import { serviceJsonLd } from "@/lib/seo";
import type { EnquiryType } from "@/lib/validation";

/**
 * Shared layout for the four commercial pillar pages (weddings, corporate, catering, brunch).
 *
 * Publication gates, enforced here rather than by editorial discipline:
 *   - packages, venue spaces and gallery blocks render ONLY when rows exist and are published;
 *   - a package price renders only when a price exists — otherwise the card is still complete,
 *     it simply has no price line. No "POA", no "from AED —", no "TBC".
 *   - the page is a finished, intentional layout whether or not any of them are present.
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
  const [page, pkgs, spaces, images, settings] = await Promise.all([
    getPage(slug),
    getPackages(pillar),
    getVenueSpaces(),
    getGallery(pillar),
    getSettings(),
  ]);

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

  return (
    <PageShell
      locale={locale}
      routeKey={routeKey}
      breadcrumbLabel={title}
      extraJsonLd={[serviceJsonLd({ locale, routeKey, name: title, description: intro })]}
    >
      <Section tone="surface" className="!py-0">
        <Container size="wide">
          <div className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-16">
            <div>
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
                <ButtonLink href="#enquiry">{enquireLabel}</ButtonLink>
                <ButtonLink href={telHref()} variant="secondary">
                  {t.actions.callShort} <span dir="ltr">{FACTS.phoneDisplay.value}</span>
                </ButtonLink>
              </div>
              {brunchTime ? (
                <p className="mt-6 text-sm text-brand-ink-soft">
                  <span className="font-medium text-brand-ink">{brunchTime}</span>
                  {brunchPriceNote ? ` · ${brunchPriceNote}` : null}
                </p>
              ) : null}
            </div>
            {images.length > 0 ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[--radius-card]">
                <Image
                  src={images[0].filePath}
                  alt={localized(locale, images[0].altEn, images[0].altAr) ?? ""}
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
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

      {body ? (
        <Section tone="paper">
          {/* Narrow measure: the body is a single column of prose, so a full-width container
              would leave an unbalanced empty half at desktop widths. */}
          <Container size="narrow">
            <Prose text={body} attrs={attrs.body} />
          </Container>
        </Section>
      ) : null}

      {/* Packages — rendered only when the owner has created and published real ones. */}
      {pkgs.length > 0 ? (
        <Section tone="surface">
          <Container size="wide">
            <SectionHeading
              title={locale === "ar" ? "الباقات" : "Packages"}
              as="h2"
            />
            <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {pkgs.map((p) => {
                const name = localized(locale, p.nameEn, p.nameAr);
                const summary = localized(locale, p.summaryEn, p.summaryAr);
                const inclusions = parseList(locale === "ar" ? p.inclusionsAr : p.inclusionsEn);
                const price = formatPrice(p.priceFromFils, "AED", locale);
                const priceNote = localized(locale, p.priceNoteEn, p.priceNoteAr);
                return (
                  <Card key={p.id} as="li" className="flex flex-col">
                    <h3 className="font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-lg font-semibold">
                      {name}
                    </h3>
                    {summary ? (
                      <p className="mt-2 text-sm leading-relaxed text-brand-ink-soft">{summary}</p>
                    ) : null}

                    {p.minGuests || p.maxGuests ? (
                      <p className="mt-3 text-sm text-brand-ink-soft">
                        {p.minGuests && p.maxGuests
                          ? `${p.minGuests}–${p.maxGuests} ${t.labels.guests}`
                          : p.maxGuests
                            ? `${t.labels.upTo} ${p.maxGuests} ${t.labels.guests}`
                            : `${t.labels.from} ${p.minGuests} ${t.labels.guests}`}
                      </p>
                    ) : null}

                    {inclusions.length > 0 ? (
                      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-brand-ink-soft">
                        {inclusions.map((inc) => (
                          <li key={inc} className="flex gap-2">
                            <span aria-hidden="true" className="text-brand-accent">
                              ·
                            </span>
                            <span>{inc}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex-1" />
                    )}

                    {price ? (
                      <p className="mt-5 border-t border-brand-line-soft pt-4 text-sm">
                        <span className="text-brand-ink-soft">{t.labels.from} </span>
                        <span className="font-semibold" dir="ltr">
                          {price}
                        </span>
                        {p.priceUnit === "per_person" ? (
                          <span className="text-brand-ink-soft"> {t.labels.perPerson}</span>
                        ) : p.priceUnit === "per_event" ? (
                          <span className="text-brand-ink-soft"> {t.labels.perEvent}</span>
                        ) : null}
                      </p>
                    ) : null}
                    {priceNote ? (
                      <p className="mt-1 text-xs text-brand-ink-soft">{priceNote}</p>
                    ) : null}
                  </Card>
                );
              })}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* Venue spaces — capacities are never invented; the block is absent until supplied. */}
      {spaces.length > 0 && pillar !== "catering" ? (
        <Section tone="paper">
          <Container size="wide">
            <SectionHeading title={locale === "ar" ? "المساحات" : "Spaces"} as="h2" />
            <ul className="mt-8 grid gap-5 md:grid-cols-2">
              {spaces.map((s) => (
                <Card key={s.id} as="li">
                  <h3 className="text-lg font-semibold">{localized(locale, s.nameEn, s.nameAr)}</h3>
                  {localized(locale, s.descriptionEn, s.descriptionAr) ? (
                    <p className="mt-2 text-sm leading-relaxed text-brand-ink-soft">
                      {localized(locale, s.descriptionEn, s.descriptionAr)}
                    </p>
                  ) : null}
                  {s.seatedCapacity || s.standingCapacity ? (
                    <p className="mt-3 text-sm text-brand-ink-soft">
                      {[
                        s.seatedCapacity ? `${s.seatedCapacity} ${t.labels.seated}` : null,
                        s.standingCapacity ? `${s.standingCapacity} ${t.labels.standing}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </Card>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* Gallery strip — only real, owner-uploaded images. */}
      {images.length > 1 ? (
        <Section tone="surface">
          <Container size="wide">
            <SectionHeading title={t.nav.gallery} as="h2" />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.slice(1, 7).map((img) => (
                <li key={img.id} className="relative aspect-[4/3] overflow-hidden rounded-[--radius-card]">
                  <Image
                    src={img.filePath}
                    alt={localized(locale, img.altEn, img.altAr) ?? ""}
                    fill
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                    className="object-cover"
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
            <p className="mt-6">
              <ButtonLink href={hrefFor("gallery", locale)} variant="secondary">
                {t.nav.gallery}
              </ButtonLink>
            </p>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ enquiry */}
      <Section tone="paper" id="enquiry">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <SectionHeading title={t.form.heading} as="h2" />
              <p className="mt-4 text-sm leading-relaxed text-brand-ink-soft">
                {locale === "ar"
                  ? "أخبرنا بالتفاصيل الأساسية وسيعاود الفريق التواصل معك."
                  : "Tell us the essentials and the team will come back to you."}
              </p>
              <dl className="mt-8 text-sm">
                <div className="border-t border-brand-line-soft py-3">
                  <dt className="font-semibold">{t.labels.phone}</dt>
                  <dd className="mt-1">
                    <a href={telHref()} dir="ltr" className="underline underline-offset-4">
                      {FACTS.phoneDisplay.value}
                    </a>
                  </dd>
                </div>
                <div className="border-t border-brand-line-soft py-3">
                  <dt className="font-semibold">{t.labels.address}</dt>
                  <dd className="mt-1 text-brand-ink-soft">
                    {locale === "ar" ? FACTS.addressLine1Ar.value : FACTS.addressLine1En.value},{" "}
                    {locale === "ar" ? FACTS.cityAr.value : FACTS.cityEn.value}
                    <br />
                    <a
                      href={directionsUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      {t.actions.directions}
                    </a>
                  </dd>
                </div>
              </dl>
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
      </Section>
    </PageShell>
  );
}
