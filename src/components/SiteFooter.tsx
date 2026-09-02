import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hrefFor, type Locale, type RouteKey } from "@/lib/i18n/config";
import { FACTS, directionsUrl, telHref } from "@/lib/facts";
import { Container } from "./ui";

export function SiteFooter({
  locale,
  showGallery,
  settings,
}: {
  locale: Locale;
  showGallery: boolean;
  settings: Record<string, string>;
}) {
  const t = getDictionary(locale);
  const isAr = locale === "ar";

  const addr = isAr
    ? [FACTS.addressLine1Ar.value, FACTS.addressLine2Ar.value, FACTS.cityAr.value]
    : [FACTS.addressLine1En.value, FACTS.addressLine2En.value, FACTS.cityEn.value];

  const whatsapp = settings.whatsapp?.trim();
  const email = settings.email?.trim();
  const hoursNote = (isAr ? settings.hours_note_ar : settings.hours_note_en)?.trim();

  const cols: { heading: string; links: { key: RouteKey; label: string }[] }[] = [
    {
      heading: isAr ? "تناول الطعام" : "Dining",
      links: [
        { key: "menu", label: t.nav.menu },
        { key: "restaurant", label: t.nav.restaurant },
        { key: "brunch", label: t.nav.brunch },
      ],
    },
    {
      heading: t.nav.eventsGroup,
      links: [
        { key: "weddings", label: t.nav.weddings },
        { key: "corporate", label: t.nav.corporate },
        { key: "catering", label: t.nav.catering },
      ],
    },
    {
      heading: isAr ? "المزيد" : "More",
      links: [
        { key: "about", label: t.nav.about },
        ...(showGallery ? [{ key: "gallery" as RouteKey, label: t.nav.gallery }] : []),
        { key: "contact", label: t.nav.contact },
        { key: "privacy", label: t.nav.privacy },
      ],
    },
  ];

  return (
    <footer className="pine-ground on-dark text-brand-bone/75">
      <Container size="wide">
        <div className="grid gap-12 py-20 lg:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))]">
          <div>
            <Image
              src="/brand/logo-reversed.png"
              alt={isAr ? FACTS.nameAr.value : FACTS.nameEn.value}
              width={1600}
              height={811}
              sizes="228px"
              className="h-[116px] w-auto"
            />
            {!isAr ? (
              <p lang="ar" dir="rtl" aria-hidden="true" className="script-pair mt-4 text-xl text-brand-gold">
                مطعم ومقهى جزيل
              </p>
            ) : null}
            <address className="mt-6 not-italic leading-relaxed">
              {addr.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
            <p className="mt-5">
              <a
                href={telHref()}
                dir="ltr"
                className="display text-2xl text-brand-bone hover:text-brand-gold"
              >
                {FACTS.phoneDisplay.value}
              </a>
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <li>
                <a
                  href={directionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-brand-gold underline-offset-4 hover:text-brand-bone"
                >
                  {t.actions.directions}
                </a>
              </li>
              {whatsapp ? (
                <li>
                  <a
                    href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-brand-gold underline-offset-4 hover:text-brand-bone"
                  >
                    WhatsApp
                  </a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="underline decoration-brand-gold underline-offset-4 hover:text-brand-bone"
                  >
                    {email}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          {cols.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="label text-brand-gold">{col.heading}</h2>
              <ul className="mt-5 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.key}>
                    <Link href={hrefFor(l.key, locale)} className="hover:text-brand-bone">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="grid gap-8 border-t border-brand-bone/15 py-10 sm:grid-cols-2">
          <div>
            <h2 className="label text-brand-gold">{t.labels.hours}</h2>
            <p className="mt-3 text-lg text-brand-bone">
              {t.labels.everyDay}{" "}
              <span dir="ltr" className="font-semibold">
                {FACTS.hoursOpen.value} – {FACTS.hoursClose.value}
              </span>
            </p>
            {hoursNote ? <p className="mt-1 text-sm">{hoursNote}</p> : null}
          </div>
          <div>
            <h2 className="label text-brand-gold">{t.labels.deliveryPartners}</h2>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {FACTS.deliveryPartners.value.map((d) => (
                <li key={d.id}>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-brand-gold underline-offset-4 hover:text-brand-bone"
                  >
                    {d.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-brand-bone/15 py-8 text-xs text-brand-bone/75 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {isAr ? FACTS.nameAr.value : FACTS.nameEn.value}
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {FACTS.social.value.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-bone">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
