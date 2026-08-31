import Link from "next/link";
import type { ReactNode } from "react";

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
  const max =
    size === "narrow" ? "max-w-3xl" : size === "wide" ? "max-w-7xl" : "max-w-6xl";
  return <div className={`${max} mx-auto px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Section({
  children,
  className = "",
  tone = "paper",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "surface" | "deep" | "accent";
  id?: string;
}) {
  const tones = {
    paper: "bg-brand-paper text-brand-ink",
    surface: "bg-brand-surface text-brand-ink",
    deep: "bg-brand-deep text-white",
    accent: "bg-brand-accent-soft text-brand-ink",
  } as const;
  return (
    <section id={id} className={`${tones[tone]} py-14 sm:py-20 ${className}`}>
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- typography */

type LangAttrs = { lang?: string; dir?: "ltr" | "rtl" };

export function SectionHeading({
  kicker,
  title,
  intro,
  align = "start",
  as: As = "h2",
  titleAttrs,
  introAttrs,
  kickerAttrs,
}: {
  kicker?: string | null;
  title: string;
  intro?: string | null;
  align?: "start" | "center";
  as?: "h1" | "h2" | "h3";
  /** Set when the text fell back to the other language, so it renders with the right direction. */
  titleAttrs?: LangAttrs;
  introAttrs?: LangAttrs;
  kickerAttrs?: LangAttrs;
}) {
  const alignment = align === "center" ? "text-center mx-auto" : "";
  return (
    <div className={`${alignment} max-w-2xl`}>
      {kicker ? (
        <p
          {...kickerAttrs}
          className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent mb-3"
        >
          {kicker}
        </p>
      ) : null}
      <As
        {...titleAttrs}
        className={`font-[family-name:var(--font-display)] rtl:font-[family-name:var(--font-arabic)] text-3xl sm:text-4xl leading-tight tracking-tight text-balance`}
      >
        {title}
      </As>
      {intro ? (
        <p {...introAttrs} className="mt-4 text-lg leading-relaxed text-brand-ink-soft">
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/** Renders CMS body copy. Supports blank-line paragraphs and `## ` subheadings only. */
export function Prose({
  text,
  attrs,
}: {
  text: string | null | undefined;
  attrs?: LangAttrs;
}) {
  if (!text?.trim()) return null;
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div {...attrs} className="prose-jazeel text-brand-ink-soft leading-relaxed">
      {blocks.map((block, i) =>
        block.startsWith("## ") ? (
          <h2 key={i} className="text-brand-ink font-semibold">
            {block.slice(3)}
          </h2>
        ) : (
          <p key={i}>{block}</p>
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ buttons */

type ButtonVariant = "primary" | "secondary" | "quiet" | "onDark";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[--radius-card] px-5 py-3 text-sm font-semibold transition-colors min-h-11 text-center";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-accent text-white hover:bg-brand-deep",
  secondary: "border border-brand-line bg-brand-surface text-brand-ink hover:border-brand-accent",
  quiet: "text-brand-accent underline underline-offset-4 hover:text-brand-deep px-0 py-1",
  onDark: "bg-white text-brand-deep hover:bg-brand-accent-soft",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
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
  const cls = `${buttonBase} ${buttonVariants[variant]} ${className}`;
  if (external) {
    return (
      <a
        href={href}
        className={cls}
        aria-label={ariaLabel}
        target="_blank"
        rel="noopener noreferrer"
      >
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

export function buttonClass(variant: ButtonVariant = "primary") {
  return `${buttonBase} ${buttonVariants[variant]}`;
}

/* -------------------------------------------------------------------- cards */

export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  return (
    <As
      className={`rounded-[--radius-card] border border-brand-line bg-brand-surface p-6 ${className}`}
    >
      {children}
    </As>
  );
}

/**
 * A composed surface standing in for a photograph that does not yet exist.
 * It is intentionally abstract: no stock image, no AI-generated food or venue picture, and
 * no "image coming soon" text. If a real image is supplied it replaces this entirely.
 */
export function MediaSlot({
  className = "",
  ratio = "aspect-[4/3]",
  label,
}: {
  className?: string;
  ratio?: string;
  label?: string;
}) {
  return (
    <div
      className={`media-slot rounded-[--radius-card] ${ratio} ${className}`}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/* ------------------------------------------------------------------- pieces */

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-surface px-3 py-1 text-xs font-medium text-brand-ink-soft">
      {children}
    </span>
  );
}

export function DefinitionRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-t border-brand-line-soft py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-semibold text-brand-ink">{term}</dt>
      <dd className="mt-1 text-sm text-brand-ink-soft sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  );
}

export function Divider() {
  return <hr className="border-brand-line-soft" />;
}
