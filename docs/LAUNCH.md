# Launch runbook

Everything needed to put this site on the internet, in the order it has to happen. Written
so that whoever does it does not have to make judgement calls — where a decision is needed,
it says so and stops.

**The site has never been deployed.** It has only ever run on one machine on `localhost`.
Nothing here should be run without an explicit instruction from the owner.

---

## Before anything: what is still missing

```bash
npm run preflight
```

It reads the configuration and the database and prints three kinds of line. `ok` is
settled. `WARN` is something to know about — the site works, but a person should have
decided it deliberately. `BLOCK` exits non-zero and means do not deploy.

As at 2 September 2026 it reports two blockers, and both are waiting on the owner: the
admin password is still the development one, and the site URL still points at localhost.
The five warnings are the menu, the mail account, the WhatsApp number, the public email
address, and the test enquiries left over from development.

---

## 1. Decide where it runs

The app is a Next.js server with a SQLite database on local disk and photographs on local
disk. That rules out anything with an ephemeral filesystem — on a platform that resets disk
between deploys, every enquiry and every content edit is lost on the next push.

| Option | Works | Notes |
|---|---|---|
| **A small VPS** (Hetzner, DigitalOcean, a UAE host) | Yes | Simplest correct answer. 1 GB RAM is ample. Disk persists, backups are a cron line. |
| **Fly.io with a volume** | Yes | Persistent volume required, not the default. |
| **Railway / Render with a disk** | Yes | Both offer attachable disks. |
| **Vercel** | **No, not as built** | The filesystem is read-only and per-request. Would need Postgres plus object storage — a real change, perhaps half a day, and worth doing only if you want their CDN. |

Whatever it runs on must be behind HTTPS. The app sends HSTS only when it sees a genuine
HTTPS request, so the proxy in front of it must set `X-Forwarded-Proto`.

## 2. Point the domain

Research found no registered Jazeel domain, and `jazeel.ae` does not resolve. Register one,
then point an A record at the server. `.ae` requires UAE trade-licence documents; a `.com`
does not, and both can be used together.

Do this first — DNS and certificate issuance have lead times, and everything downstream
needs the final hostname.

## 3. Configure the environment

On the server, create `.env.local`:

```bash
DATABASE_PATH=/var/lib/jazeel/jazeel.db
NEXT_PUBLIC_SITE_URL=https://<the real domain>

ADMIN_EMAIL=<the owner's address>
ADMIN_PASSWORD=<generated, 20+ characters, stored in a password manager>
IP_HASH_SALT=<openssl rand -hex 32>

ENQUIRY_TRANSPORT=smtp
SMTP_URL=smtps://user:pass@smtp.host:465
ENQUIRY_RECIPIENT=<where enquiries should land>
```

Two of these deserve a sentence each.

**`ADMIN_PASSWORD`** is the only thing between the internet and every page of the site.
Generate it, do not invent it: `openssl rand -base64 24`. Pre-flight blocks on anything
short or containing a common word.

**`IP_HASH_SALT`** is mixed into the one-way hash stored against each enquiry for rate
limiting. It exists so the site can throttle abuse without keeping anybody's IP address. If
it is shared or guessable, those hashes become reversible, which defeats the point.

## 4. Install and start

```bash
npm ci
npm run setup          # first deployment only — creates and seeds the database
npm run build
npm run preflight      # must exit clean
npm start
```

Run it under a process manager so it restarts on reboot — systemd, pm2, or the platform's
own supervisor. Put nginx or Caddy in front for TLS.

**`npm run setup` is first-deployment only.** On any later deploy it would overwrite the
owner's content with the seed. Later deploys are `npm ci && npm run build && restart`.

## 5. Check it before telling anyone

```bash
npm test               # 65 unit tests
BASE=https://<domain> npm run smoke     # 75 end-to-end checks against the live site
BASE=https://<domain> npm run perf      # page weight and LCP against the budgets
```

Then by hand, because no test catches these:

- Submit one real enquiry on each of the three forms and confirm the email arrives.
- Sign in to the admin, change one word on a page, confirm it appears on the public page.
- Open the site on a phone on mobile data, not office wifi.
- Ask somebody who reads Arabic to look at `/ar`.

## 6. Backups, from day one

```bash
npm run backup                    # → ./backups/jazeel-YYYY-MM-DD-HHmm.tar.gz
```

The database and `public/uploads` are the only things that cannot be rebuilt from the
repository. Put this on a nightly cron and copy the archive **off the server** — a backup
on the same disk is not a backup:

```cron
30 3 * * *  cd /srv/jazeel && /usr/bin/npm run backup >> /var/log/jazeel-backup.log 2>&1
```

Restore is in the `MANIFEST.txt` inside each archive: stop the site, put `jazeel.db` back at
`DATABASE_PATH`, copy `uploads/` into `public/uploads/`, start. No migration — the schema
travels with the file.

**Test the restore once, before you need it.**

## 7. After launch

- Submit the sitemap (`/sitemap.xml`) in Google Search Console and Bing Webmaster Tools.
- Claim the Google Business Profile. Phase 1 found it unclaimed, and it is almost certainly
  worth more traffic than the website in the first months.
- Update the Instagram, Facebook and TikTok bios with the domain.
- Ask the delivery platforms to add the website to your storefront pages.

---

## What is deliberately absent

So nobody adds these by accident, thinking they were forgotten:

- **No analytics and no cookies.** The site sets one cookie, for the admin session, and
  nothing for visitors. Adding analytics is a decision with consent obligations under the
  UAE data-protection law — take advice, then add it deliberately.
- **No map embed.** Two published coordinate pairs sit 1.3 km apart, so no pin is
  published. "Get directions" searches by the written address, which works.
- **No reservation system.** Nothing in the research established one exists. The structured
  data explicitly says `acceptsReservations: false`.
- **No halal claim.** Nothing anywhere, until documentation exists.
- **No shisha reference.** Off by default; see the content register, item 10.
