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
    <div className="night-ground grain on-dark flex min-h-dvh flex-col justify-center py-20 text-brand-bone">
      <Container size="narrow">
        <h1 className="display text-4xl">
          Something went wrong
        </h1>
        <p className="mt-4 text-brand-bone/75">
          Please try again. If the problem continues, please call the restaurant.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="label inline-flex min-h-12 items-center bg-brand-bone px-6 py-3.5 text-brand-night hover:bg-brand-gold"
          >
            Try again
          </button>
          <a
            href={telHref()}
            dir="ltr"
            className="label inline-flex min-h-12 items-center border border-brand-bone/35 px-6 py-3.5 text-brand-bone hover:border-brand-gold hover:text-brand-gold"
          >
            {FACTS.phoneDisplay.value}
          </a>
        </div>
      </Container>
    </div>
  );
}
