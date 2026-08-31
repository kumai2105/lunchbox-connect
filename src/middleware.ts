import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/lib/i18n/config";

const PUBLIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|css|js|woff2?)$/i;

/**
 * Locale routing + security headers.
 *
 * `/` and any unprefixed public path are redirected to a locale prefix so that every public
 * URL is unambiguous, canonical and indexable in exactly one language. The visitor's
 * Accept-Language is used only to choose between the two supported locales — it never
 * produces an unprefixed URL.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/uploads") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return withSecurityHeaders(NextResponse.next());
  }

  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocale) {
    const accept = request.headers.get("accept-language") ?? "";
    const preferred = /(^|,|\s)ar\b/i.test(accept) ? "ar" : defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(NextResponse.next());
}

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
