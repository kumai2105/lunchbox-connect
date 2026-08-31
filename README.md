# Jazeel Restaurant & Café — website

A bilingual (English / Arabic) website for Jazeel Restaurant & Café, Semmer Villas Community
Centre, Dubai Silicon Oasis.

Built as **Phase 2** of an evidence-led engagement. Phase 1 was a public-record research dossier;
this site is derived from it. The governing rule throughout: **nothing is published that the
research verified as unknown, and nothing is invented to fill a gap.**

```bash
npm install
npm run setup     # database + seed
npm run dev       # http://localhost:3000  ·  admin at /admin
```

## Documentation

| Document | What it covers |
|---|---|
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) | Objectives, audiences, journeys, information architecture, content model, publication gates, SEO, accessibility, architecture decisions, risks |
| [`docs/CONTENT-REGISTER.md`](docs/CONTENT-REGISTER.md) | Everything the owner must supply, what it unlocks, and whether it blocks launch |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Environment, enquiry email activation, hosting, pre-deployment checklist |

## What it does

Three commercial pillars, each with its own top-level route, metadata and enquiry type:

- **Restaurant & Café** — daily dining, menu, facilities, delivery partners
- **Weddings & Celebrations** — hosted or catered
- **Corporate Events** — meetings, gatherings, product and company launches

plus **Catering**, **Sunday Brunch**, **Gallery** (hidden until real photographs exist),
**About**, **Contact** and a **Privacy notice**.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · SQLite via Drizzle ORM · Zod ·
Vitest + a Playwright-driven end-to-end suite. Reasoning for each choice is in the blueprint.

## Conventions worth knowing before editing

- **`src/lib/facts.ts` is the only place business facts live.** Every entry carries its evidence
  class and source. Anything unverified is `null`, and nothing renders from a null.
- **Arabic is never machine-translated.** `src/lib/i18n/dictionaries.ts` holds interface strings
  only; all marketing copy lives in the database with separate English and Arabic columns. Empty
  Arabic falls back to English, tagged with the correct `lang`/`dir`, and the admin flags the gap.
- **Publication gates are enforced in code, not by editorial discipline.** Empty optional content
  removes its block entirely; there is no "TBC", no placeholder and no empty state pretending to
  be content.
- **No stock photography and no generated imagery.** `MediaSlot` is a composed surface, not a
  picture of food. `tests/evidence.test.ts` fails the build if an image is ever bundled.
- **Structured data omissions are deliberate and commented.** See the block comment in
  `src/lib/seo.ts` for what is left out and why.

## Verification

```bash
npm test        # 61 unit tests
npm run build   # production build
npm start &     # then, against the running server:
npm run smoke   # 72 end-to-end checks in a real browser
```

## Status

**Not deployed.** The site has only run locally. See `docs/DEPLOYMENT.md`.
