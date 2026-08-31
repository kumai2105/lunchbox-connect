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
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const displayArabic = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-display-ar",
  display: "swap",
});

export const bodyArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-body-ar",
  display: "swap",
});

export const fontVariables = [
  displayLatin.variable,
  bodyLatin.variable,
  displayArabic.variable,
  bodyArabic.variable,
].join(" ");
