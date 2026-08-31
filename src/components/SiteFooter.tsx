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
    ? [FACTS.addressLine1Ar.value, FACTS.addressLine2Ar.value, FACTS.cityAr.value, FACTS.countryAr.value]
    : [FACTS.addressLine1En.value, FACTS.addressLine2En.value, FACTS.cityEn.value, FACTS.countryEn.value];

  const cols: { heading: string; links: { key: RouteKey; label: string }[] }[] = [
    {
      heading: t.nav.restaurant,
      links: [
        { key: "restaurant", label: t.nav.restaurant },
        { key: "menu", label: t.nav.menu },
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
      heading: t.brand,
      links: [
        { key: "about", label: t.nav.about },
        ...(showGallery ? [{ key: "gallery" as RouteKey, label: t.nav.gallery }] : []),
        { key: "contact", label: t.nav.contact },
        { key: "privacy", label: t.nav.privacy },
      ],
    },
  ];

  // Only render optional contact rows when the value actually exists.
  const whatsapp = settings.whatsapp?.trim();
  const email = settings.email?.trim();
  const hoursNote = (isAr ? settings.hours_note_ar : settings.hours_note_en)?.trim();

  return (
    <footer className="bg-brand-deep text-white/85">
      <Container size="wide">
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-lg font-semibold text-white">
              {isAr ? FACTS.nameAr.value : FACTS.nameEn.value}
            </p>
            <address className="mt-3 not-italic text-sm leading-relaxed">
              {addr.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <p className="mt-4 text-sm">
              <a href={telHref()} className="font-semibold text-white underline underline-offset-4">
                <span dir="ltr">{FACTS.phoneDisplay.value}</span>
              </a>
            </p>
            {whatsapp ? (
              <p className="mt-1 text-sm">
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  WhatsApp
                </a>
              </p>
            ) : null}
            {email ? (
              <p className="mt-1 text-sm">
                <a href={`mailto:${email}`} className="underline underline-offset-4">
                  {email}
                </a>
              </p>
            ) : null}
            <p className="mt-4 text-sm">
              <a
                href={directionsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {t.actions.directions}
              </a>
            </p>
          </div>

          {cols.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                {col.heading}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.key}>
                    <Link href={hrefFor(l.key, locale)} className="hover:text-white hover:underline underline-offset-4">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-t border-white/15 py-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                {t.labels.hours}
              </h2>
              <p className="mt-2 text-sm">
                {t.labels.everyDay}{" "}
                <span dir="ltr">
                  {FACTS.hoursOpen.value} – {FACTS.hoursClose.value}
                </span>
              </p>
              {hoursNote ? <p className="mt-1 text-sm text-white/70">{hoursNote}</p> : null}
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                {t.labels.deliveryPartners}
              </h2>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
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
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/15 py-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {isAr ? FACTS.nameAr.value : FACTS.nameEn.value}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {FACTS.social.value.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
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
