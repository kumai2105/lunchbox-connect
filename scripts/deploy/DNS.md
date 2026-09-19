# Pointing jazeeluae.com at the new site — GoDaddy

**Read the warning first.** Checked 19 September 2026.

---

## There is already a live site at jazeeluae.com

`jazeeluae.com` is not parked. It serves a **GoDaddy Website Builder landing page**:
the Jazeel logo, the headline **"Taste the Tradition"**, a cookie notice, a 2026 copyright,
and a form collecting **name and email** for "updates, promotions, and more".

That page has been collecting email addresses. Nothing in this project knew it existed.

**Before changing any DNS:**

1. **Export the subscriber list** from the GoDaddy Website Builder dashboard. Those
   addresses are a marketing asset the business already owns and is not using, and they
   disappear from view the moment the domain points elsewhere.
2. Decide what happens to that page. Repointing DNS does not delete it, but it stops being
   reachable at this domain.
3. Check whether anything else — a printed card, a QR code, a delivery listing, the
   Instagram bio — points at a path on that site.

**Also: mail must not break.** The MX records send mail to Microsoft 365. Change only the
records listed below. Do not touch `MX`, `autodiscover`, `selector1._domainkey`,
`selector2._domainkey`, `_dmarc`, or the `NETORGFT…onmicrosoft.com` TXT verification
record. Removing any of those stops management@jazeeluae.com working.

---

## The records to change

GoDaddy → **My Products** → the domain → **DNS** → **Manage Zones**.

Replace the existing `A` record for `@` (it currently points at GoDaddy's builder,
`13.248.243.5` / `76.223.105.230`) and make sure `www` follows it:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | **your server's IPv4 address** | 600 |
| CNAME | `www` | `@` | 600 |

If the server has IPv6, add it as well — Caddy will serve both:

| Type | Name | Value | TTL |
|---|---|---|---|
| AAAA | `@` | your server's IPv6 address | 600 |

Delete any other `A`, `AAAA` or `CNAME` record on `@` or `www` left over from the builder,
or the domain will resolve to two different places at random.

**Use a 600-second TTL until it is confirmed working**, then raise it to 3600. A short TTL
means a mistake is corrected in ten minutes instead of a day.

---

## Order of operations

1. Server provisioned (`provision.sh`) and the app deployed (`deploy.sh`) — check it
   answers on its own IP first.
2. Subscriber list exported from the builder page.
3. DNS changed as above.
4. Wait for propagation, then confirm from a machine that has never visited the site.
5. Caddy requests the certificate automatically on the first HTTPS request. Give it a
   minute; if it fails, `journalctl -u caddy -n 50` says why — nearly always DNS not yet
   resolving to this server.

## Confirming

```bash
dig +short jazeeluae.com A
dig +short jazeeluae.com MX          # must still be …mail.protection.outlook.com
curl -sSI https://jazeeluae.com | head -20
```

Then send a test email to and from management@jazeeluae.com. Mail is the thing most easily
broken by a DNS change and the least likely to be noticed.

---

## One more decision this forces

The existing landing page says **"Taste the Tradition"**. The new site does not use that
line anywhere. If it has been printed, posted or used in advertising, that is a
deliberate choice to make rather than something to discover after launch.
