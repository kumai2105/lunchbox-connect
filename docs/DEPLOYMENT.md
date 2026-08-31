# Running and deploying the site

**Nothing has been deployed.** The site has only ever run on this machine, on `localhost:3000`.
Publishing it requires an explicit instruction and the items marked *blocks launch* in
`docs/CONTENT-REGISTER.md`.

---

## Run it locally

```bash
npm install
npm run setup      # creates data/jazeel.db, applies the schema, seeds content
npm run dev        # http://localhost:3000
```

Sign in to the admin at **http://localhost:3000/admin** with the values in `.env.local`
(`owner@jazeel.local` / `ChangeMe!Jazeel2026` by default).

Production build:

```bash
npm run build
npm start
```

Verification:

```bash
npm test           # 61 unit tests — validation, i18n, evidence rules
npm run smoke      # 72 end-to-end checks against a running server
```

`npm run smoke` needs the site running (`npm start`) and drives a real browser against it.

---

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_PATH` | no | SQLite file. Defaults to `./data/jazeel.db`. |
| `NEXT_PUBLIC_SITE_URL` | **yes in production** | Absolute origin. Canonical URLs, `hreflang`, Open Graph and the sitemap all derive from it. Wrong value = wrong canonicals. |
| `ADMIN_EMAIL` | at seed time | The admin account created on first seed. |
| `ADMIN_PASSWORD` | **yes before deployment** | Replace the development default. Used only when the account is first created. |
| `IP_HASH_SALT` | **yes in production** | Salts the one-way hash stored against each enquiry for rate limiting. Changing it resets rate-limit counters. |
| `ENQUIRY_TRANSPORT` | no | Unset = enquiries are stored only. `log` = also written to the server log. `smtp` = email (see below). |
| `SMTP_URL` | with smtp | e.g. `smtp://user:pass@host:587` |
| `ENQUIRY_RECIPIENT` | with smtp | Where enquiry notifications go. |
| `SMTP_FROM` | optional | Defaults to `ENQUIRY_RECIPIENT`. |

Secrets live in the environment only. `.env.local` is git-ignored; `.env.example` documents the
shape without values.

---

## Switching on enquiry emails

Today every enquiry is **genuinely stored** and appears in **Admin → Enquiries**, and each row
records `notificationStatus: not_configured`. The visitor is told their enquiry has been
*received* — never that an email was sent, because none was.

To send email as well:

1. `npm i nodemailer`
2. Open `src/lib/notify.ts` and enable the block marked `--- ACTIVATION BLOCK ---`.
3. Set `ENQUIRY_TRANSPORT=smtp`, `SMTP_URL` and `ENQUIRY_RECIPIENT`.
4. Send a test enquiry and confirm the row shows `sent` in the admin.

Nothing else changes. Enquiries continue to be stored regardless, so a mail outage never loses one.

---

## Deploying

The app is a standard Next.js server application with a SQLite file. It needs a host with a
**persistent writable disk** — not a purely serverless platform, because both the database and
uploaded photographs live on disk.

Suitable: a small VPS, a container host with a mounted volume, or any Node host with persistent
storage. Node 20+.

```bash
npm ci
npm run build
npm run db:push          # applies the schema to the deployment database
npm run db:seed          # first deploy only — creates the admin and seeds content
npm start                # behind a reverse proxy terminating TLS
```

Back up two things and you have backed up everything:

- `data/jazeel.db` (all content, enquiries and settings)
- `public/uploads/` (all photographs)

### Moving to Postgres later

The schema is defined with Drizzle and is portable. Swap the dialect in
`src/lib/db/index.ts` and `drizzle.config.ts`, regenerate migrations, and move the data. No
application or page code changes.

---

## Pre-deployment checklist

- [ ] `ADMIN_PASSWORD` changed from the development default, and the seeded account renamed to a real address
- [ ] `IP_HASH_SALT` set to a random value
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real origin
- [ ] TLS terminated in front of the app (the session cookie sets `Secure` in production)
- [ ] Enquiry email configured and tested end to end
- [ ] `npm test` and `npm run smoke` both green against the deployment build
- [ ] Everything marked *blocks launch* in `docs/CONTENT-REGISTER.md` supplied
- [ ] Legal position on shisha references confirmed (see the register, item 10)
- [ ] Menu drafts reviewed and published, or removed
- [ ] `data/` and `public/uploads/` included in the backup schedule
