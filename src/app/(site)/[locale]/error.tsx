"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui";
import { FACTS, telHref } from "@/lib/facts";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[site] render error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-brand-paper py-20">
      <Container size="narrow">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Something went wrong
        </h1>
        <p className="mt-3 text-brand-ink-soft">
          Please try again. If the problem continues, please call the restaurant.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-[--radius-card] bg-brand-accent px-5 py-3 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <a
            href={telHref()}
            dir="ltr"
            className="inline-flex min-h-11 items-center rounded-[--radius-card] border border-brand-line bg-brand-surface px-5 py-3 text-sm font-semibold"
          >
            {FACTS.phoneDisplay.value}
          </a>
        </div>
      </Container>
    </div>
  );
}
