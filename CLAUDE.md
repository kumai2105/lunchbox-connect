# Jazeel website — read this first

You are working on the website for **Jazeel Restaurant & Café**, Semmer Villas Community
Centre, Dubai Silicon Oasis. The owner is **Kumai Dawarah**.

This file exists because the work was started elsewhere and the rules below are not
obvious from the code. Breaking them does real commercial damage, so they are not
stylistic preferences.

**Status as of 19 September 2026: built, tested, never deployed.** No public URL. No
customer has seen it. `npm run preflight` reports **0 blockers, 2 warnings**.

---

## The rules that must not be broken

**1. Nothing gets published, deployed, or sent to a customer or supplier without Kumai's
explicit authorisation.** The site is offline and stays offline until he says otherwise.

**2. No commercial claim can be made from this build.** It has never been live: there is
no traffic, no enquiry volume, no conversion rate, no attributable revenue. Any statement
otherwise is fabricated.

**3. The site says nothing it cannot evidence.** Specifically absent, by decision:

- No testimonials, customer names, client logos, awards, star ratings or review quotations
- No venue capacity figure, no catering package inclusions, no event prices
- **No halal claim** — no documentary confirmation has ever been supplied
- No reservation, ordering or delivery functionality, because none is confirmed to exist
- JSON-LD is restricted to `Restaurant`, `WebSite`, `BreadcrumbList`, `Service`. No
  `aggregateRating`, `review`, `geo`, `Event` or menu-price markup.

`tests/evidence.test.ts` fails the build if forbidden claims appear in content.
**Do not weaken that guard to make a page pass.** If it fires, the content is wrong.

**4. `src/lib/facts.ts` is the single source of truth for business facts**, and every one
carries its evidence class — `VERIFIED`, `OWNER_PROVIDED`, `UNVERIFIED`, `UNKNOWN`.
Anything unverified is `null` and must stay `null` until the owner supplies it. Do not
invent a value to make a component render. Read the comments; several record contradictions
found in the research (two published coordinate pairs 1.3 km apart, for instance, which is
why there is no map pin).

**5. Never invent a person's name, an email address, a job title or a phone number.**
Where only a general switchboard exists, say so.

**6. Shisha references and the nine shisha photographs are on by owner decision**, recorded
2 September 2026: Kumai stated it was cleared by his counsel and that Jazeel holds the
licence. It was noted once that a licence to serve is not automatically permission to
depict online, and he confirmed. That is **an owner decision on record, not an independent
legal verification** — do not restate it as one, and do not re-litigate it.

**7. Guest consent is unresolved.** Several of the 21 photographs show identifiable guests
in close-up. Publishing them is a consent question, not a design one. It gates which frames
may be published at all. **Keep the repository private.**

---

## Commands

```bash
npm install
npm run setup      # db:push --force + seed. First run only.
npm run dev        # localhost:3000, admin at /admin

npm run test       # 65 unit tests
npm run build && npm start
npm run smoke      # 76 end-to-end checks against a running build
npm run preflight  # refuses to bless a deploy while anything is unsafe
npm run backup     # sqlite .backup into backups/
```

Run `preflight`, `test` and `smoke` before claiming anything works. `smoke` needs a
production build already running on :3000.

## How it is built

Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · SQLite through Drizzle
(prices stored as integer fils, never floats) · Zod schemas shared client and server ·
scrypt password hashing with opaque server-side sessions · self-hosted fonts.

**No third parties at all** — no analytics, no tag manager, no embedded map, no external
scripts, no cookies beyond the admin session. That is what lets it ship a strict CSP. Do
not add a dependency that loads something at runtime without saying so explicitly.

11 routes × 2 languages = 22 public URLs. Arabic URLs are genuinely Arabic
(`/ar/الأعراس`, not `/ar/weddings`), driven by one canonical `RouteKey` in
`src/lib/i18n/config.ts`.

`docs/BLUEPRINT.md` has the architecture decisions. `docs/DEPLOYMENT.md` and
`docs/LAUNCH.md` cover hosting. `scripts/deploy/` has provisioning, deploy and DNS.

## Hosting

The database and uploaded photographs live on disk, which rules out Vercel **as built**.
A small VPS is the straightforward answer and `scripts/deploy/provision.sh` sets one up.
Moving to a serverless host means Postgres plus object storage — roughly half a day.

`jazeeluae.com` is live and currently serves a **GoDaddy Website Builder landing page**
that has been collecting email addresses. See `scripts/deploy/DNS.md` before touching DNS
— the MX, DKIM, DMARC and Microsoft 365 tenant records must be left alone or the owner's
mail stops working.

---

## Open decisions — do not resolve these by guessing

These are the owner's, informed by a separate commercial analysis. If the code needs an
answer, ask; do not pick one.

| # | Decision | Why it matters |
|---|---|---|
| 1 | Consent for photographs of identifiable guests | Gates which frames publish at all |
| 2 | The menu — 82 draft items loaded, none published | With none published, the menu page hands the highest-intent visitor to Deliveroo and Talabat, the two commissioned channels. That is a margin decision made by a fallback panel. The POS shows 207 SKUs earning under 0.1% of revenue each; approving the spreadsheet as a transcription republishes that tail permanently. |
| 3 | The daily dish | 4,818 units, AED 275,948, **7.1% of revenue**, sold verbally, with no name, no price, no category and no mention anywhere on the site. Largest content gap there is. |
| 4 | Corporate photography | 0 of 21 frames show anything corporate. The corporate page's gallery is singers, terrace and a birthday cake, so its evidence argues against its own copy. Cannot be fixed in copy. |
| 5 | The morning | The site says 09:00 (owner statement, 19 Sep 2026; every platform listing still says 10:00 or 09:30). Breakfast runs at 6.3 covers a day. Publishing an hour does not create trade in it. |
| 6 | Arabic copy | Every Arabic route, layout and font works; the text falls back to English where none is written. **Publishing an Arabic URL that serves English is worse than not publishing it. Do not machine-translate it into place and call it done.** |
| 7 | SMTP | Enquiries are stored and shown in the admin but emailed to nobody. Jazeel is on Microsoft 365, so this needs Exchange credentials, not a new mail account. |

## Measurement

If anyone later claims the site raised enquiries or revenue, it measures against this dated
baseline and nothing else:

- Revenue **AED 16,087/day across 243 observed days** (AED 3,909,032 total)
- Break-even **AED 11,296/day**; 66 of 243 days fell below it
- Contribution margin **73.5%**, range 71.5–75.6%
- Social audience **43,011** at a median **0.06%** engagement, dated 18 September 2026

A launch-day reading of the current channels — delivery platforms, phone log, Instagram —
still needs taking on the day.
