import { Fraunces, Karla, Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";

/**
 * Four faces, two scripts, treated as equals — see docs/VISUAL-DIRECTION.md.
 *
 * Self-hosted through next/font: no third-party request at runtime, no layout shift,
 * and the Arabic is genuinely typeset rather than falling back to a system face.
 */

export const displayLatin = Fraunces({
  subsets: ["latin"],
  // Variable across weight, with the SOFT and WONK axes exposed so the display face can be
  // tuned in CSS (see `.display` in globals.css) rather than shipping several static cuts.
  weight: "variable",
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-display",
  display: "swap",
});

export const bodyLatin = Karla({
  subsets: ["latin"],
  // 400 body, 500 for the few font-medium spots, 600 headings, 700 for `.label`.
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

/*
  Both Arabic faces are declared in the shared root layout, so without this they would be
  preloaded on every English page too. Arabic type is heavy — these two are the largest
  files the site ships — and an English page needs at most one of them, for the decorative
  Arabic line beside a heading.

  preload: false does not stop them loading where they are used. It stops the browser
  fetching them before it knows whether anything on the page needs them. On an Arabic page
  the CSS references them immediately and they load immediately; on an English page the
  body face is never referenced at all and never arrives.
*/
export const displayArabic = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-display-ar",
  display: "swap",
  preload: false,
});

export const bodyArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-body-ar",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  displayLatin.variable,
  bodyLatin.variable,
  displayArabic.variable,
  bodyArabic.variable,
].join(" ");
