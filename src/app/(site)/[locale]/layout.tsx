import { notFound } from "next/navigation";
import "../../globals.css";
import { isLocale, localeMeta, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SITE_URL } from "@/lib/seo";
import { fontVariables } from "@/lib/fonts";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata = {
  metadataBase: new URL(SITE_URL),
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const t = getDictionary(l);

  return (
    <html lang={localeMeta[l].htmlLang} dir={localeMeta[l].dir} className={fontVariables}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="skip-link">
          {t.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
