# Jazeel Website — Evidence-Led Build Blueprint

**Phase 2 implementation control document.** Derived from the Phase 1 research dossier and its three
appendices, plus the owner facts confirmed at the start of Phase 2.

Classification labels used throughout: **VERIFIED** (strong public evidence, Phase 1) ·
**OWNER-PROVIDED** (stated by the owner, not independently confirmed) · **INFERRED** (reasoned from
evidence, never published as fact) · **UNKNOWN** (no defensible answer — must not be published).

---

## 1. Business objectives, ranked

| # | Objective | Why this rank — the evidence |
|---|---|---|
| 1 | **Generate qualified wedding and private-celebration enquiries** | OWNER-PROVIDED that Jazeel caters and hosts weddings, private parties and celebrations, with Friday/Saturday nights especially relevant. VERIFIED that Jazeel has the only shisha + outdoor + kids-area + 02:00-close combination in the DSO competitor set, which maps directly to evening social occasions. VERIFIED that **no public channel currently mentions events at all** — this is a service with zero digital footprint, so the site is not competing for share, it is creating the channel. |
| 2 | **Generate corporate catering, meeting and launch enquiries** | OWNER-PROVIDED that Jazeel hosts company meetings, corporate gatherings and product launches. VERIFIED local demand context: DIEZ reported a 106,359-person workforce across its zones (FY2025) and 96% occupancy in H1 2026; Dtec hosts 1,000+ startups; RIT Dubai is mid-way through an AED 313m campus expansion; DSO received an AED 12.8bn expansion in Jan 2026 with retail in Phase 1. Weekday corporate demand is the natural complement to weekend celebration demand. |
| 3 | **Generate external catering enquiries** | OWNER-PROVIDED that Jazeel is a substantial caterer. VERIFIED competitive gap: Khobzah W Fakhaara is the only DSO Arabic rival running catering, reservations and gift cards off its own website; Jazeel has no discoverable catering page, phone line or menu despite already selling 1 kg platters at AED 249–279. |
| 4 | **Convert Sunday brunch interest** | OWNER-PROVIDED service. It is a distinct, datable, weekend-daytime occasion that competes for a different slot from evening events and is easy to search for by name. |
| 5 | **Serve everyday restaurant needs** — menu, hours, call, directions, verified delivery links | VERIFIED that Jazeel's daily trade is real and well rated (Deliveroo 4.7/52, Talabat 4.1/1,000). But delivery is a commodity: rivals out-review Jazeel roughly 10:1 on the same platform page and undercut it on every comparable line. The site should **serve** delivery demand competently without leading with it. |

**Strategic consequence.** Jazeel is VERIFIED to sit at the price ceiling of its DSO segment
(~AED 200 for two against AED 50–140 for most rivals; a 1 kg platter 25–40% above the nearest
comparators). It cannot win a delivery price war and should not try to. Events, catering and hosted
occasions are not price-list commodities — they are the commercial ground where a high price position
is an asset rather than a liability. The site is therefore built as an **enquiry-generation instrument
with a fully competent restaurant layer**, not as a restaurant brochure with a contact form.

---

## 2. Audiences and their evidence standing

| ID | Audience | Standing | Evidence |
|---|---|---|---|
| A1 | **Wedding and celebration planners** (couples, families, party hosts) | Service OWNER-PROVIDED; audience INFERRED | Owner confirms the service and its Fri/Sat concentration. No public evidence of past events exists — so the site describes the *offer*, never a track record. |
| A2 | **Corporate organisers** (office managers, EAs, marketing leads planning launches) | Service OWNER-PROVIDED; audience INFERRED from verified local employment density | See objective 2. |
| A3 | **Catering buyers** (home hosts, offices, community events) | Service OWNER-PROVIDED; latent demand INFERRED | Jazeel already sells 1 kg sharing platters (VERIFIED, Deliveroo) — evidence of group-order capability without a catering funnel. |
| A4 | **Local families and residents** | DEMONSTRATED | Kids area, family hall and outdoor seating VERIFIED on four sources; a 2021 review evidences family use; the venue sits inside a 560-villa community adjacent to Cedre Villas (~1,047 homes), which Talabat treats as a named delivery zone. |
| A5 | **Delivery customers** | DEMONSTRATED | ~1,050 combined platform ratings; two live storefronts; two delivery-area contexts. |
| A6 | **Evening groups and shisha guests** | DEMONSTRATED | Shisha VERIFIED on four sources and described by reviewers in 2023 and 2025; "a great spot to unwind with friends" (Mar 2025); the venue's own `#partytime` tag. |
| A7 | **Sunday brunch guests** | Service OWNER-PROVIDED | — |
| A8 | **Arabic-reading users** | DEMONSTRATED | First-party Arabic social content; Arabic e-menu and Talabat storefront; VERIFIED gap — no first-party asset ranks in Arabic search. |
| A9 | Office workers seeking weekday lunch | Weakly demonstrated (n=1, 2022) | Treated as a secondary use of the restaurant layer, not a dedicated journey. |
| — | Tourists | UNPROVEN | Not designed for. |

---

## 3. Priority user journeys

| # | Journey | Entry | Path | Success |
|---|---|---|---|---|
| J1 | Plan a wedding | Search "wedding venue Dubai Silicon Oasis" / homepage | Home or landing → **Weddings & Celebrations** → what is offered → enquiry form (date, guests, venue vs catering) | Wedding enquiry stored + routed |
| J2 | Plan a corporate event or launch | Search / homepage | Home → **Corporate Events** → formats → enquiry (company, date, headcount, format) | Corporate enquiry stored + routed |
| J3 | Order catering | Search / homepage / menu page | Home or Menu → **Catering** → how it works → enquiry (date, guests, service style, delivery vs on-site) | Catering enquiry stored + routed |
| J4 | Book Sunday brunch | Search "Sunday brunch Dubai Silicon Oasis" | Home → **Sunday Brunch** → what it is → enquiry (date, party size) | Brunch enquiry stored + routed |
| J5 | Decide where to eat tonight | Search brand / maps | Home → **Menu** → filter by category → **Call** or **Directions** | Tap-to-call or map opened |
| J6 | Order delivery | Home / Menu | Verified partner links (Deliveroo, Talabat) — clearly secondary in the visual hierarchy | Outbound to a verified storefront |
| J7 | Check hours / find the place | Any page | Persistent header call + footer hours and address; **Contact & Location** | Directions or call |
| J8 | Read in Arabic | Language switch or `/ar` entry | Full RTL mirror of the current route | Same journey completed in Arabic |

**Conversion hierarchy on every page:** primary = the relevant enquiry action; secondary = call;
tertiary = directions and menu; quaternary = delivery partners. Delivery buttons never occupy a primary
slot above the fold on the homepage.

---

## 4. Information architecture

```
/                          Home  (redirects to /en)
/[locale]/                 Home
/[locale]/restaurant       Restaurant & Café — dining, seating, kids area, shisha, takeaway
/[locale]/menu             Menu — content-managed, filterable, daypart-aware
/[locale]/weddings         Weddings & Celebrations
/[locale]/corporate        Corporate Events & Launches
/[locale]/catering         Catering
/[locale]/brunch           Sunday Brunch
/[locale]/gallery          Gallery (renders only when real media exists)
/[locale]/about            About Jazeel
/[locale]/contact          Contact, Location & Enquiries
/[locale]/privacy          Privacy Notice
/[locale]/*                Custom 404
/admin/**                  Authenticated admin (noindex, not localised)
/sitemap.xml  /robots.txt
```

Weddings, Corporate and Catering are **three top-level destinations**, never children of a generic
"Services" page — that is the explicit strategic point of the site. Navigation groups them under an
"Events & Catering" menu heading for scanning, but each has its own top-level route, its own metadata
and its own enquiry type.

---

## 5. Page purposes and publication gates

| Route | Purpose | Publishes only if |
|---|---|---|
| Home | Establish all three pillars in one screen; route each audience | Always (built from verified + owner-provided facts) |
| /restaurant | Convert daily dining intent; state verified facilities | Always |
| /menu | Serve real menu data | Renders categories/items that are `published`. If no items are published, the page shows the menu-request/contact route and the verified delivery links — never an empty grid |
| /weddings | Convert J1 | Always (offer exists, OWNER-PROVIDED). Packages, capacities, prices, galleries render **only when populated** |
| /corporate | Convert J2 | Same gate |
| /catering | Convert J3 | Same gate |
| /brunch | Convert J4 | Always. Timing, price and inclusions render only when populated |
| /gallery | Show real work | **Page is hidden from navigation and returns 404 until at least one real image is uploaded.** No stock, no AI imagery |
| /about | Explain what Jazeel is, from verified facts only | Always. No founder story, no history, no awards — none exist in evidence |
| /contact | Location, hours, call, enquiry | Always |
| /privacy | Legal baseline | Always |

**Global rule enforced in code:** any optional field that is null/empty causes its block to be omitted
entirely. There is no "TBC", no "coming soon", no placeholder pricing, no lorem ipsum, and no layout
that looks broken when optional content is absent.

---

## 6. Content model

| Entity | Key fields | Notes |
|---|---|---|
| `settings` | key/value singletons: phone, whatsapp, email, address lines (en/ar), map URL, coordinates, hours JSON, shisha hours, delivery links, social links, booking note | Coordinates and shisha hours ship **empty** — UNVERIFIED in Phase 1 |
| `menu_categories` | slug, name_en/ar, description_en/ar, daypart, sort, published | |
| `menu_items` | category, name_en/ar, description_en/ar, price, currency, size/weight, availability, dietary[], allergens[], image, featured, dine_in, delivery, platform links, sort, published, source_note | `source_note` records provenance, e.g. "Deliveroo snapshot 2026-08-31 — draft import, unverified" |
| `pages` | slug, locale-aware hero/intro/body blocks, seo_title, seo_description, published | Editable marketing copy for the eight content pages |
| `packages` | pillar (wedding/corporate/catering/brunch), name_en/ar, summary_en/ar, inclusions[], min_guests, max_guests, price_from, price_note, published | **Ships empty and unpublished** |
| `venue_spaces` | name_en/ar, description, seated_capacity, standing_capacity, features[], published | **Ships empty and unpublished** |
| `gallery_images` | pillar, file, alt_en/ar, caption_en/ar, credit, sort, published | **Ships empty** |
| `enquiries` | type, name, phone, email, event_date, guests, company, venue_required, catering_required, message, consent, locale, source_page, ip_hash, status, admin_notes, created_at | Real storage, real statuses |
| `admin_users` | email, password_hash (scrypt), role, created_at | Seeded from env at first run |

Every public-facing text field exists **twice** (`_en`, `_ar`) and each language has its own publish
flag behaviour: if the Arabic value is empty, the Arabic page falls back to the English value **and the
admin flags it as unapproved** — it never machine-translates.

---

## 7. Admin model

Authenticated at `/admin`, `noindex`, session cookie (HttpOnly, SameSite=Lax, signed), scrypt password
hashing, CSRF-protected mutations via server actions with origin checks.

Owner can, without touching code: edit all page copy in both languages; create/edit/reorder/hide menu
categories and items including prices, availability, dietary and allergen data; upload images with alt
text; create and publish packages, venue spaces and gallery items; edit hours, contact details, delivery
and social links; edit SEO metadata per page; read, triage and annotate enquiries; and toggle
draft/published on everything.

---

## 8. Confirmed vs missing content

**Publishable now — VERIFIED:** name; address (Semmer Villas Community Centre; A1/2 Semmer A Street,
Nadd Hessa); phone +971 4 323 2797; hours 10:00–02:00 daily; dine-in, indoor family hall, outdoor
seating, kids area, shisha, takeaway; Deliveroo and Talabat storefront URLs; cuisine (Arabic/Levantine
grills, mezze, manakeesh, fatayer, international dishes); no alcohol served.

**Publishable now — OWNER-PROVIDED (labelled as offer, never as track record):** catering; weddings;
private parties and celebrations; Friday/Saturday event relevance; Sunday brunch; corporate meetings;
corporate and product launches.

**Must not be published until supplied:** logo, brand colours, typography; any photograph; menu prices
as final; shisha menu; capacities; package prices and inclusions; WhatsApp number; email address; map
pin coordinates; halal claim; approved Arabic marketing copy; ratings or testimonials of any kind.

---

## 9. SEO and local discovery

Per-page bilingual titles and descriptions (editable); canonical URLs; `hreflang` en/ar/x-default;
Open Graph and Twitter cards; semantic heading order; descriptive internal linking between the three
pillars; XML sitemap generated from published routes only; `robots.txt` disallowing `/admin`.

**Structured data — evidence-safe only.** `Restaurant` (name, address, telephone, openingHours, servesCuisine,
priceRange, acceptsReservations:false) and `WebSite`/`BreadcrumbList`. **Deliberately omitted:**
`aggregateRating`, `review`, `geo` coordinates, `hasMenu` prices until confirmed, `Event` schema (no dated
events exist), `servesCuisine: halal`, `areaServed`. Each omission is enforced in `lib/seo.ts` with a
comment stating why.

Target query families the pages are structured for (from the Phase 1 finding that Jazeel appears in
**none** of the tested non-branded categories): wedding venue / wedding catering Dubai Silicon Oasis;
corporate catering / event catering DSO; private party venue DSO; Sunday brunch Dubai Silicon Oasis;
Arabic / Lebanese restaurant DSO; shisha DSO; family restaurant DSO; restaurant near Semmer Villas.

---

## 10. Accessibility, performance, security

**Accessibility:** semantic landmarks; visible focus rings; labelled form controls with programmatic
error association (`aria-describedby`, `aria-invalid`); `prefers-reduced-motion` respected; ≥4.5:1 body
contrast; keyboard-operable navigation and language switch; `lang` and `dir` set per locale; skip link.

**Performance:** server components by default; no client JS on purely static pages; system font stack
until real brand typography is supplied (zero webfont cost, no layout shift); `next/image` with explicit
dimensions; CSS-only mobile navigation where possible; no carousel libraries.

**Security:** Zod validation on every input, server-side; parameterised queries via Drizzle; scrypt
password hashing; signed HttpOnly session cookies; origin-checked mutations; honeypot + timing check +
per-IP rate limit on public forms; secrets only via env; `/admin` excluded from sitemap and robots;
security headers set in `next.config`.

---

## 11. Analytics event plan (structure only — no vendor wired, no tracking without consent)

`enquiry_start`, `enquiry_submit_success`, `enquiry_submit_error` (all with `enquiry_type`),
`call_click`, `directions_click`, `delivery_click` (with `platform`), `menu_category_view`,
`language_switch`, `pillar_cta_click` (with `pillar`). Implemented as a thin `track()` seam that is a
no-op until a vendor and a consent mechanism are chosen — so no third-party script ships and no personal
data leaves the site by default.

---

## 12. Technical architecture and why

| Choice | Reason |
|---|---|
| **Next.js 16, App Router, TypeScript** | Server rendering for a site whose whole point is discoverability; first-class metadata, sitemap and robots APIs; `[locale]` segment routing gives clean bilingual URLs; server actions remove the need for a separate API layer for forms and admin; large maintenance pool in the region. |
| **SQLite (better-sqlite3) + Drizzle ORM** | The site must be genuinely content-managed, but **no production database credentials exist**. A file-backed database means the admin is real, the enquiries are really stored, and nothing is faked — while remaining a single-file backup and a one-line swap to Postgres later (Drizzle keeps the schema portable). Choosing a hosted DB here would have meant either fake credentials or a non-functional admin. |
| **Tailwind CSS v4 with logical properties** | `ps-/pe-/ms-/me-/start-/end-` mirror automatically under `dir="rtl"`, which makes the Arabic layout a genuine mirror rather than a second stylesheet to maintain. |
| **Custom scrypt + signed-cookie auth** | No third-party auth provider is available or needed for a single-owner admin; avoids shipping credentials to an external service. Node's built-in `crypto` only — no extra dependency surface. |
| **Zod** | One schema shared by client hints and server validation; prevents client/server drift. |
| **Vitest** | Fast, no browser needed for the logic and validation suites; paired with a Node route-smoke script against a real production server. |
| **No CMS SaaS, no headless vendor** | Would require accounts and credentials the owner has not supplied, and would put content behind a third-party bill for a single-site business. |

---

## 13. Risks and assumptions

| Risk | Handling |
|---|---|
| Owner facts (catering, weddings, brunch, corporate) are unverified externally | Published as descriptions of services offered. No superlatives, no scale claims, no history, no client names. Copy is written so it stays true whether Jazeel has hosted three weddings or three hundred. |
| The Deliveroo menu snapshot is not the real menu | Imported as **draft, unpublished**, every item carrying a `source_note` naming the source and date. The menu page publishes nothing until the owner approves. |
| Shisha references carry regulatory risk (Phase 1 §15) | Shisha appears as a factual amenity statement only, is excluded from all metadata, structured data and promotional copy, and is controlled by a single admin toggle so it can be removed site-wide in one action pending legal review. |
| No brand assets exist | Wordmark is set typographically, no invented logo mark. A neutral, documented palette is used and explicitly labelled provisional in the design tokens file, not presented as Jazeel's official identity. |
| No photography exists | Media slots render as composed, intentional layouts without images. Zero stock and zero AI imagery. Gallery route is hidden until real files exist. |
| Arabic copy is not approved | Arabic system is fully built and tested; Arabic fields ship empty and fall back to English with an admin warning. No machine translation is presented as approved copy. |
| Enquiry email delivery has no credentials | Enquiries are **really stored** in the database and visible in admin. A logging transport is used for notification until SMTP is configured; the UI never claims an email was sent. Activation is one env var. |
| Coordinates are CONTRADICTED in Phase 1 | No `geo` in structured data, no embedded map pin. Directions link uses the textual address until the owner confirms the pin. |

---

## 14. What this blueprint deliberately does not do

No reservation system (Phase 1 could not verify that reservations are actually taken). No online ordering
(no first-party ordering capability is evidenced). No ratings, review widgets or testimonials. No halal
badge. No delivery-area map. No event calendar. Each of these becomes possible the moment the
corresponding item in the completion register is supplied.
