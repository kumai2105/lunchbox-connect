import Image from "next/image";
import type { ReactNode } from "react";
import { Container } from "./ui";

/**
 * The opening frame.
 *
 * Dubai restaurant sites open on a full-height image (Ninive), a carousel (Al Safadi) or a
 * looping video (Bait Maryam). Jazeel has no photography yet, so this frame builds the same
 * presence from an ember ground, a charcoal glow, a fine geometric motif and grain.
 *
 * When the owner uploads a hero photograph it renders behind the identical lockup with a
 * scrim over it, and nothing else about the composition moves.
 */
export function Hero({
  image,
  label,
  labelAttrs,
  title,
  titleAttrs,
  titleAlt,
  intro,
  introAttrs,
  actions,
  meta,
  full = false,
  underSolidHeader = false,
}: {
  image?: { src: string; alt: string } | null;
  label?: string | null;
  labelAttrs?: { lang?: string; dir?: "ltr" | "rtl" };
  title: string;
  titleAttrs?: { lang?: string; dir?: "ltr" | "rtl" };
  titleAlt?: string | null;
  intro?: string | null;
  introAttrs?: { lang?: string; dir?: "ltr" | "rtl" };
  actions?: ReactNode;
  meta?: ReactNode;
  /** Homepage uses the full viewport height; inner pages use a shorter frame. */
  full?: boolean;
  /** Inner pages sit under a solid sticky header, so they need far less top padding. */
  underSolidHeader?: boolean;
}) {
  const height = full
    ? "min-h-[min(94svh,860px)] pt-40 pb-20 sm:pt-48"
    : underSolidHeader
      ? "min-h-[clamp(360px,46svh,540px)] py-20 sm:py-24"
      : "min-h-[clamp(420px,58svh,620px)] pt-40 pb-16 sm:pt-44";

  return (
    <section className={`night-ground grain on-dark relative flex items-end ${height} ${image ? "has-photo" : ""}`}>
      {image ? (
        <>
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="100vw"
            priority
            className="-z-20 object-cover"
          />
          {/* Bottom scrim carries the headline; the top one keeps the header and the
              navigation readable, since the picture is brightest exactly where they sit. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-night via-brand-night/70 to-brand-night/25"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-brand-night/95 via-brand-night/70 to-transparent"
          />
        </>
      ) : null}

      <Container size="wide" className="w-full">
        <div className="max-w-3xl">
          {/* Gold measures as low as 1.6:1 where a bright photograph sits behind it.
              Over a picture the eyebrow takes bone, which holds against anything. */}
          {label ? (
            <p {...labelAttrs} className={`label ${image ? "text-brand-bone" : "text-brand-gold"}`}>
              {label}
            </p>
          ) : null}
          <div className="rule-gold mt-5 mb-7" />
          <h1
            {...titleAttrs}
            className={`display text-brand-bone ${
              full
                ? "text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[4.6rem]"
                : "text-[2.4rem] leading-[1.04] sm:text-5xl lg:text-6xl"
            }`}
          >
            {title}
          </h1>
          {titleAlt ? (
            <p
              lang="ar"
              dir="rtl"
              aria-hidden="true"
              className={`script-pair mt-4 text-2xl sm:text-3xl ${image ? "text-brand-bone/90" : "text-brand-gold"}`}
            >
              {titleAlt}
            </p>
          ) : null}
          {intro ? (
            <p {...introAttrs} className="mt-7 max-w-xl text-lg leading-relaxed text-brand-bone/80">
              {intro}
            </p>
          ) : null}
          {actions ? <div className="mt-10 flex flex-wrap gap-3">{actions}</div> : null}
          {meta ? <div className="mt-10 border-t border-brand-bone/20 pt-6">{meta}</div> : null}
        </div>
      </Container>
    </section>
  );
}
