/**
 * Structured data emitter.
 *
 * JSON is serialised with `<` escaped so a value containing markup can never break out of the
 * script element. See src/lib/seo.ts for what is deliberately NOT emitted and why.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
