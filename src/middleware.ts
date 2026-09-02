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
    pathname.startsWith("/media") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return withSecurityHeaders(NextResponse.next(), request);
  }

  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocale) {
    const accept = request.headers.get("accept-language") ?? "";
    const preferred = /(^|,|\s)ar\b/i.test(accept) ? "ar" : defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;
    return withSecurityHeaders(NextResponse.redirect(url), request);
  }

  return withSecurityHeaders(NextResponse.next(), request);
}

/*
  The site loads nothing from anywhere else: fonts are self-hosted through next/font, there
  is no analytics, no tag manager, no embedded map, no external stylesheet. That makes a
  restrictive policy cheap to hold, and it means an injected <script src="evil.com"> simply
  does not execute.

  script-src keeps 'unsafe-inline' because the App Router emits inline bootstrap scripts on
  every page. The alternative is a per-request nonce, which forces every statically
  generated page to become dynamic — a real cost for a site that is almost entirely static
  content. The exposure that buys is small here: nothing user-supplied is ever rendered as
  HTML (React escapes all of it), there is no rich-text field, and the admin is behind
  authentication. If a nonce becomes worthwhile, generate it here and read it in the root
  layout; nothing else needs to change.
*/
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

function withSecurityHeaders(res: NextResponse, request?: NextRequest) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");

  /*
    HSTS is only sent over a genuine HTTPS request. Sending it over plain HTTP is at best
    ignored and at worst locks a developer out of http://localhost for six months. The
    proxy header is what a hosting platform sets in front of the app.
  */
  const proto = request?.headers.get("x-forwarded-proto") ?? request?.nextUrl.protocol;
  if (proto === "https" || proto === "https:") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
