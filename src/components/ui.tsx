import Link from "next/link";
import type { ReactNode } from "react";

export type LangAttrs = { lang?: string; dir?: "ltr" | "rtl" };

/* ------------------------------------------------------------------ layout */

export function Container({
  children,
  className = "",
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
}) {
  const max = size === "narrow" ? "max-w-2xl" : size === "wide" ? "max-w-6xl" : "max-w-5xl";
  return <div className={`${max} mx-auto px-6 sm:px-10 ${className}`}>{children}</div>;
}

/**
 * Full-bleed bands, not boxed sections. Dark bands carry `.on-dark` so nested
 * components can pick the right rule and focus colours.
 */
export function Band({
  children,
  tone = "bone",
  className = "",
  id,
  size = "normal",
}: {
  children: ReactNode;
  tone?: "bone" | "linen" | "ember" | "char";
  className?: string;
  id?: string;
  size?: "tight" | "normal" | "tall";
}) {
  const tones = {
    bone: "bg-brand-bone text-brand-ink",
    linen: "bg-brand-linen text-brand-ink",
    ember: "night-ground grain on-dark text-brand-bone",
    char: "pine-ground on-dark text-brand-bone",
  } as const;
  const pad =
    size === "tight" ? "py-14 sm:py-16" : size === "tall" ? "py-24 sm:py-36" : "py-20 sm:py-28";
  return (
    <section id={id} className={`${tones[tone]} ${pad} ${className}`}>
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- typography */

/**
 * A heading that sets the Latin and Arabic forms together — the device Bait Maryam
 * and Al Safadi use, where the two scripts read as one piece of design rather than
 * two separate translations of a page.
 */
export function BandHeading({
  label,
  title,
  titleAlt,
  intro,
  as: As = "h2",
  size = "lg",
  align = "start",
  titleAttrs,
  introAttrs,
  labelAttrs,
  onDark = false,
}: {
  label?: string | null;
  title: string;
  /** The same heading in the other script. Decorative in position, accurate in content. */
  titleAlt?: string | null;
  intro?: string | null;
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "lg" | "xl";
  align?: "start" | "center";
  titleAttrs?: LangAttrs;
  introAttrs?: LangAttrs;
  labelAttrs?: LangAttrs;
  onDark?: boolean;
}) {
  const scale = {
    sm: "text-2xl sm:text-3xl",
    lg: "text-[2.1rem] leading-[1.06] sm:text-5xl",
    xl: "text-[2.6rem] leading-[1.03] sm:text-6xl lg:text-7xl",
  }[size];
  const softInk = onDark ? "text-brand-bone/70" : "text-brand-ink-soft";
  const labelInk = onDark ? "text-brand-gold" : "text-brand-teal";
  const centered = align === "center" ? "items-center text-center mx-auto" : "items-start";

  return (
    <div className={`flex flex-col ${centered} max-w-3xl`}>
      {label ? (
        <p {...labelAttrs} className={`label ${labelInk} mb-4`}>
          {label}
        </p>
      ) : null}
      <div className={align === "center" ? "rule-gold mb-6" : "rule-gold mb-6"} />
      <As {...titleAttrs} className={`display ${scale}`}>
        {title}
      </As>
      {titleAlt ? (
        <p
          lang="ar"
          dir="rtl"
          aria-hidden="true"
          className={`script-pair mt-3 text-xl sm:text-2xl ${onDark ? "text-brand-gold/85" : "text-brand-teal-soft"}`}
        >
          {titleAlt}
        </p>
      ) : null}
      {intro ? (
        <p {...introAttrs} className={`mt-6 text-lg leading-relaxed ${softInk} max-w-2xl`}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}

export function Prose({
  text,
  attrs,
  onDark = false,
}: {
  text: string | null | undefined;
  attrs?: LangAttrs;
  onDark?: boolean;
}) {
  if (!text?.trim()) return null;
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div
      {...attrs}
      className={`prose-jazeel leading-relaxed ${onDark ? "text-brand-bone/75" : "text-brand-ink-soft"}`}
    >
      {blocks.map((block, i) =>
        block.startsWith("## ") ? (
          <h2 key={i} className={onDark ? "text-brand-bone" : "text-brand-ink"}>
            {block.slice(3)}
          </h2>
        ) : (
          <p key={i}>{block}</p>
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ actions */

type ButtonVariant = "solid" | "outline" | "outlineDark" | "bone";

const base =
  "inline-flex items-center justify-center gap-2 px-7 py-3.5 min-h-12 text-center label transition-colors";

const variants: Record<ButtonVariant, string> = {
  solid: "bg-brand-teal text-white hover:bg-brand-ink",
  outline: "border border-brand-ink/25 text-brand-ink hover:border-brand-teal hover:text-brand-teal",
  outlineDark: "border border-brand-bone/35 text-brand-bone hover:border-brand-gold hover:text-brand-gold",
  bone: "bg-brand-bone text-brand-night hover:bg-brand-gold hover:text-brand-night",
};

export function ButtonLink({
  href,
  children,
  variant = "solid",
  external = false,
  className = "",
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  external?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (external) {
    return (
      <a href={href} className={cls} aria-label={ariaLabel} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

export function buttonClass(variant: ButtonVariant = "solid") {
  return `${base} ${variants[variant]}`;
}

/** A quiet inline link with a gold underline — used where a button would shout. */
export function TextLink({
  href,
  children,
  external = false,
  onDark = false,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  onDark?: boolean;
}) {
  const cls = `label underline decoration-brand-gold decoration-2 underline-offset-[6px] ${
    onDark ? "text-brand-bone hover:text-brand-gold" : "text-brand-ink hover:text-brand-teal"
  }`;
  return external ? (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------- parts */

export function Pill({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium ${
        onDark
          ? "border border-brand-bone/25 text-brand-bone/80"
          : "border border-brand-rule text-brand-ink-soft"
      }`}
    >
      {children}
    </span>
  );
}

/** Facility / fact list rendered as gold-marked lines rather than a bordered table. */
export function MarkedList({
  items,
  onDark = false,
  columns = 1,
}: {
  items: { term?: string; value: string }[];
  onDark?: boolean;
  columns?: 1 | 2;
}) {
  return (
    <ul
      className={`${columns === 2 ? "sm:grid sm:grid-cols-2 sm:gap-x-10" : ""} divide-y ${
        onDark ? "divide-brand-bone/15" : "divide-brand-rule"
      }`}
    >
      {items.map((it) => (
        <li key={it.term ? `${it.term}-${it.value}` : it.value} className="py-3.5">
          {it.term ? (
            <span className={`label mb-1 block ${onDark ? "text-brand-gold" : "text-brand-teal"}`}>
              {it.term}
            </span>
          ) : null}
          <span className={onDark ? "text-brand-bone/85" : "text-brand-ink-soft"}>{it.value}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Where a photograph will sit. On dark bands it is the band itself — so when the owner
 * uploads a picture it simply becomes the background and nothing else moves. No stock
 * image, no AI-generated food, no "image coming soon".
 */
export function MediaFrame({
  ratio = "aspect-[4/5]",
  className = "",
}: {
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`night-ground grain ${ratio} ${className} border border-brand-gold/25`}
    />
  );
}

export function Divider({ onDark = false }: { onDark?: boolean }) {
  return <hr className={onDark ? "border-brand-bone/15" : "border-brand-rule"} />;
}
