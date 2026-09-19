# Jazeel email signature — asset record

**Created 19 September 2026. Lives in `brand-assets/signature/`, deliberately outside `public/` —
the website build has an evidence test that fails if unexplained images appear in the web root.**
Built from `scripts/signature/build.py` (HTML rendered
through Chromium at 2000 × 760, then downscaled). Re-run that script to regenerate.

## Files

| File | Use |
|---|---|
| `jazeel-email-signature-700.png` | Paste-ready. Gmail inserts it at native size — 700px is the intended display width. 70 KB. |
| `jazeel-email-signature-1400.jpg` | 2× retina. Use where the signature editor lets you set a display width; set it to 700px. JPEG because the foliage in the photograph makes the PNG three times heavier for no visible gain. 233 KB. |
| `jazeel-email-signature-2000.png` | Master. Keep for reprints, letterhead, anything larger. 1.1 MB. |

## What is on it, and where each line came from

| Element | Value | Provenance |
|---|---|---|
| Landline | +971 4 323 2797 | VERIFIED — Phase 1 dossier §2.3, five independent sources |
| WhatsApp | +971 55 665 4411 | Owner-confirmed 19 Sep 2026; matches the number registered on the Facebook page (social audit, 18 Sep 2026) |
| Email | management@jazeeluae.com | Owner-supplied 19 Sep 2026 |
| Instagram | @jazeel.dxb | VERIFIED — social audit, 18 Sep 2026 |
| Address | Semmer Villas Community Centre, Dubai Silicon Oasis | VERIFIED — dossier §2.2, five sources |
| Hours | Open daily 9am – 2am | OWNER-STATED 19 Sep 2026. **This contradicts every published listing** — four sources incl. Jazeel's own e-menu say 10:00, Zomato says 09:30. The owner is authoritative for what the restaurant actually does, so the banner says 9am. See the note below. |
| Three pillars | Restaurant & Café / Weddings & Celebrations / Catering & Corporate | Restaurant services VERIFIED (dossier §2.5); events and catering OWNER_PROVIDED (Phase 2 brief) |
| Photograph | `public/media/terrace-umbrellas.jpg` | Owner-supplied, already published on the site build. Chosen by the owner on 19 Sep 2026 over the interior room shot: no identifiable guests, and the umbrella terrace is the single most distinctive thing in Jazeel's photography. |
| Tagline | "Arabic table. Hosted occasions. Catering across the UAE." | OWNER_PROVIDED — owner instruction 19 Sep 2026 (changed from "across Dubai"). Note: this is a **service-area claim**. The website deliberately publishes no delivery or catering area, because none is verified. The signature and the site now say different things; the site should either match this or the claim should be narrowed. |
| Logo, colours, type | `public/brand/logo.png`; teal #1d4a4e, gold #bda65f, night #0c2426; Fraunces + Karla | Same tokens as the website (`docs/BRAND.md`) |

**Deliberately absent:** no website URL (none is live), no capacity figure, no halal claim,
no rating, no testimonial, no superlative.

**Open item:** the UAE-wide catering line is an owner claim, not a verified fact. It is fine
to make — it is their own business — but it should be one Jazeel can actually service, and
the website should be brought into line with it before launch.

## Three things this exercise established

1. **Jazeel has a domain: `jazeeluae.com`.** The Phase 1 digital audit recorded "no owned
   domain" from the Facebook website field and the TripAdvisor/HiDubai listings. A working
   mailbox at `management@jazeeluae.com` contradicts that. The domain question was blocker
   #2 on the website launch list — it may already be answered. **Needs confirming: who
   controls the registration, and is the web root free to point at the site?**

2. **The WhatsApp number is 055 665 4411.** The social audit found two mobile numbers in
   Jazeel's own post captions — `0556654411` and `0557474181` — and flagged the split as a
   partial explanation for "nobody answers". The owner has confirmed 4411. Everything
   customer-facing should now standardise on it.

3. **The restaurant opens at 9am, not 10am.** Owner statement, 19 Sep 2026. Four published
   sources — including Jazeel's own e-menu — say 10:00, and Zomato says 09:30. If 9am is
   right, Jazeel has been giving away an hour of discoverability every day, and anyone who
   checks Google before coming will arrive late. `FACTS.hoursOpen` and the site's `hours_open`
   setting have been moved to 09:00 and the evidence test updated. **Action: correct the hour
   on Google Business Profile, Zomato, Deliveroo, Talabat, HiDubai, 2GIS and the e-menu.**
   Owner to confirm whether 9am applies every day, including Fridays and Ramadan.

---

## Installing it

**Which email system Jazeel actually runs on** — checked by DNS lookup, 19 Sep 2026:

| Record | Value | What it means |
|---|---|---|
| MX | `jazeel-uae-com.mail.protection.outlook.com` | Mail is delivered to **Microsoft 365 / Exchange Online** |
| TXT | `NETORGFT21144101.onmicrosoft.com` | The `NETORGFT` prefix is a **GoDaddy-provisioned** Microsoft 365 tenant |
| SPF | `v=spf1 include:secureserver.net -all` | Sending is authorised through GoDaddy's infrastructure |
| DKIM | `selector1`/`selector2` → `…dkim.mail.microsoft` | DKIM signing is set up correctly |
| DMARC | `p=quarantine`, `rua=…@onsecureserver.net` | Enforcing, with reports going to GoDaddy rather than to Jazeel |
| NS | `ns19/ns20.domaincontrol.com` | DNS is managed at GoDaddy |
| A | `13.248.243.5`, `76.223.105.230` | The domain root already resolves — something is being served there |

**So there is no separate "GoDaddy webmail" signature to set.** Microsoft 365 *is* the GoDaddy
email product on this domain, and Outlook is its client. One signature covers both.

### The one place to set it

Outlook on the web stores the signature **in the mailbox**, so it follows the account to new
Outlook for Windows and Mac and to Outlook mobile ("roaming signatures").

1. `outlook.office.com` → sign in as `management@jazeeluae.com`
2. **Settings** (gear) → **Accounts** → **Signatures**
3. **New signature**, name it `Jazeel`
4. Insert-picture icon → upload **`jazeel-email-signature-700.png`**
5. Set it for **new messages** *and* **replies/forwards**
6. **Save**

### Classic Outlook for Windows (only if it doesn't appear)

**File → Options → Mail → Signatures → New → Insert Picture**, then set it as the default for
new messages and replies. Classic Outlook keeps signatures locally unless roaming is enabled,
so it may need doing once per machine.

### Three things that will otherwise go wrong

1. **Use the 700px file.** Outlook inserts images at their native pixel size. The 1400px file
   will arrive twice the intended width.
2. **Classic Outlook on a scaled display** (125% / 150%) inserts images oversized. If it looks
   too big: right-click the image → **Picture** → **Size** → set width to 700 px.
3. **Add alt text to the image.** Many corporate mail clients block images by default, and an
   image-only signature then shows an empty box with no phone number in it. Right-click →
   **Edit alt text** and use:
   `Jazeel Restaurant & Café — +971 4 323 2797 — management@jazeeluae.com — Dubai Silicon Oasis`

### To put it on every mailbox at once

Microsoft 365 admin centre → **Exchange admin centre** → **Mail flow** → **Rules** → *Apply
disclaimers*. This appends it server-side to everything the whole domain sends. Worth doing
only once the wording is settled, because it then applies to every message including replies.

### Don't use GoDaddy's signature generator

The GoDaddy dashboard has a **Create email signature** tool. It builds its own design from a
template and would replace this one. Skip it.

