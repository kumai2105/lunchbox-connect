# Content and Asset Completion Register

Everything the owner must supply before this website can go live, and everything that can wait.

**How to read the columns**

- **Blocks launch?** — *Yes* means the site should not be published without it. *No* means the site
  is complete and correct without it; the related block simply does not render.
- **Public or internal?** — whether the item will appear on the website, or is only used to make
  internal decisions and must not be published.
- **Format** — what to send so it can be used without rework.

Nothing in this register has been guessed, approximated or filled with a placeholder. Where an item
is missing, the corresponding part of the site is absent, not empty.

---

## 1. Blocks launch

| # | Item | Why it is required | Where it appears | Public/internal | Format |
|---|---|---|---|---|---|
| 1 | **Approved menu — full, current, dine-in** | The only menu the research could find is a third-party delivery snapshot from 31 Aug 2026. All 82 items are loaded as **unpublished drafts** with their source recorded; the Menu page currently publishes none of them. | `/menu`, plus the featured items on `/restaurant` | Public | A spreadsheet or PDF with category, item name (EN and AR), description, price, portion where relevant. Or edit the drafts directly in **Admin → Menu**. |
| 2 | **Confirmed prices** | Prices differ between platforms and none is owner-approved. Publishing an out-of-date price is a consumer-protection exposure. | Menu, packages | Public | AED, per item, and a note where dine-in and delivery prices differ. |
| 3 | **Beverage list** | The business is a "Restaurant **& Café**" and no drink appears on any public source. A café with no published drinks is the biggest single content gap. | `/menu` | Public | Category + item + price. Hot drinks, juices, soft drinks. |
| 4 | **WhatsApp number** | A verified WhatsApp presence exists but the number is not public anywhere. Until supplied, no WhatsApp link is shown. | Header, footer, contact page | Public | International format, e.g. `+9715XXXXXXXX`. |
| 5 | **Public email address** | Present on the venue's own QR menu but unreadable to research. Needed for enquiry replies and for the contact page. | Footer, contact page | Public | One address. |
| 6 | **Enquiry recipient + mail account** | Enquiries are stored and visible in the admin, but nothing is emailed to anyone. This must be switched on before launch or enquiries will only be seen by someone who logs in. | Server configuration | Internal | SMTP host, port, username, password, and the address enquiries should go to. See `docs/DEPLOYMENT.md`. |
| 7 | **Confirmed opening hours, including any day-to-day variation and Ramadan hours** | The site currently publishes a single, verified 10:00–02:00 for all seven days. Anything more specific is unknown. | Header, footer, contact, structured data | Public | Per day, plus kitchen close if it differs from the venue. |
| 8 | **Domain name and hosting** | The site cannot be published without one. Research found no registered Jazeel domain, and `jazeel.ae` does not resolve. | — | Internal | Registrar login or delegated DNS. |
| 9 | **A strong admin password** | The seed created a development password. It must be replaced before the admin is reachable from the internet. | Admin sign-in | Internal | Set `ADMIN_PASSWORD` before the first deployment. |
| 10 | **Legal review of the shisha references** — *the site now hides shisha by default; this item is to decide whether it may come back* | Four separate UAE instruments bear on advertising or displaying tobacco products online, and Phase 1 could not establish what is permitted for a restaurant's own website. **Every mention is now switched off**, as a precaution rather than a legal conclusion: Cabinet Resolution 24/2013 Arts. 5–8 name the internet expressly, DM-HSD-GU118-SSP2 Annex 13 prohibits displaying tobacco products by electronic means, and the penalty band is AED 100,000–1,000,000. One admin field turns it back on if counsel says it is permitted. | `/restaurant`, homepage facility list | Internal decision, public consequence | A written position from UAE counsel. |

---

## 2. Strongly recommended before launch — the site works without them

| # | Item | Why it matters | Where it appears | Public/internal | Format |
|---|---|---|---|---|---|
| ~~11~~ | ~~**Logo files**~~ | **Supplied 31 Aug 2026.** See section 5. | | | |
| ~~12~~ | ~~**Brand colours and typefaces**~~ | **Colours supplied 31 Aug 2026**, measured from the logo. Typefaces are still ours — see section 2a. | | | |
| 13 | **Restaurant and café photography** | The site has composed image areas where photographs belong. No stock and no AI imagery has been used, and none will be. | Homepage, `/restaurant`, `/about` | Public | JPEG or WebP, at least 2000px on the long edge, landscape. Interior, the family hall, the outdoor area, the storefront and signage, and the venue after dark. |
| 14 | **Food photography** | Menu items currently carry no images. | `/menu`, homepage | Public | Same format. Ideally the grills, mezze, manakeesh and one sharing platter. |
| 15 | **Wedding and celebration photography** | The weddings page is the highest-value page on the site and currently has no imagery of real events. | `/weddings`, gallery | Public | Same format. **Only real Jazeel events**, and only where you have permission to publish them. |
| 16 | **Corporate event and launch photography** | Same, for the corporate page. | `/corporate`, gallery | Public | Same format, with client permission. |
| 17 | **Catering and buffet photography** | Same, for catering. | `/catering`, gallery | Public | Same format. |
| 18 | **Sunday brunch photography** | Same, for brunch. | `/brunch`, gallery | Public | Same format. |
| 19 | **Approved Arabic copy** | The Arabic site is fully built, routed and tested, and every Arabic page works today by falling back to the English text. Nothing has been machine-translated. | Every page, in Arabic | Public | Arabic for each page's kicker, title, intro, body and search description. Enter it in **Admin → Page content**, then tick "Arabic text approved". |
| 20 | **Confirmed map pin** | Two published coordinate pairs sit about 1.3 km apart, so no coordinates are published and no map is embedded. "Get directions" currently searches by the written address, which works. | Contact, directions links, structured data | Public | A Google Maps share link for the correct entrance. |

---

## 2a. Still outstanding from the identity

| # | Item | Why it matters | Format |
|---|---|---|---|
| 12a | **Brand typefaces, if any exist** | The colours are now Jazeel's own, but the type is still our choice: Fraunces for English display, Karla for text, Amiri and IBM Plex Sans Arabic for Arabic. If a designer specified faces for the logo, send them and they replace ours in one file. | Font files with a web licence, or the names. |
| 12b | **The logo's original vector file** | The logo has been rebuilt from the 373 px JPEG you sent, which is the only version we have. It is clean at every size the site uses, but the original AI, EPS, PDF or SVG from whoever drew it would be better still — and is needed for print, signage and large formats. | AI, EPS, PDF or SVG. |

---

## 3. Unlocks a section that is currently absent by design

| # | Item | What it turns on | Public/internal | Format |
|---|---|---|---|---|
| 21 | **Wedding packages** | The Packages section on `/weddings`. Absent until at least one is published. | Public | Name, summary, what is included (one line each), guest range, starting price, and whether the price is per person or per event. |
| 22 | **Corporate packages** | The Packages section on `/corporate`. | Public | As above. |
| 23 | **Catering packages / menus** | The Packages section on `/catering`. | Public | As above, plus minimum order and lead time if they apply. |
| 24 | **Sunday brunch details** | Brunch times and price note on `/brunch`. | Public | Serving times, price, and what is included. |
| 25 | **Venue spaces and capacities** | The Spaces section on `/weddings` and `/corporate`. Capacities are never estimated. | Public | Space name, description, seated capacity, standing capacity, notable features. |
| 26 | **Shisha menu** | Nothing yet — do not publish before item 10 is resolved. | Internal until cleared | — |
| 27 | **Allergen matrix** | Per-item allergen tags on the menu. Dubai Municipality requires nine allergen categories to be declared or available on request. | Public, after review | Item by item, against the nine categories. |
| 28 | **Nutrition / calorie data** | Per-item calorie display. Whether menu calorie declaration is currently mandatory in Dubai could not be resolved in Phase 1 — take advice first. | Public, after review | Item by item. |
| 29 | **Halal documentation** | Nothing today. **No halal claim appears anywhere on the site** and none may be added without this. | Internal document, public claim | Certificate from a recognised body, or a written position from your food-safety adviser. |
| 30 | **Kids menu** | A kids section on the menu. The children's area is verified; a kids menu is not. | Public | Items and prices. |

---

## 4. Internal only — never published

| # | Item | Why it is needed |
|---|---|---|
| 31 | **Trade licence details** — legal entity name, licence number, issuing authority (DIEZ or DET), licensed activities | Federal Decree-Law 14/2023 makes licence identification a live question for any channel used to sell, and the DIEZ/DET distinction affects how service areas may be described. Needed for legal review; **not to be published without advice**. |
| 32 | **Permits** — shisha permit, food promotion permit, any catering or off-site service permit | Determines what may be advertised, and when a promotion needs lead time. |
| 33 | **Delivery and catering service area** | The site currently makes no service-area claim, because delivery geography is unknown. |
| 34 | **Operational capacity** — kitchen output, peak covers, real seating count, maximum catering volume | So the enquiry forms and any future capacity display reflect reality. The one public seating figure (160) comes from a single unverified source and is not used. |
| 35 | **Sales mix and most profitable items** | To decide which menu items are featured. Nothing has been featured on the basis of guesswork. |
| 36 | **Promotion history and current offers** | The site shows no promotions. Competitors on the same delivery pages all run discount mechanics; whether Jazeel should is a commercial decision, not a design one. |
| 37 | **Existing social account ownership and access** | Three accounts are verified as Jazeel's (`@jazeel.dxb`, `JAZEEL.UAE`, `@jazeel_restaurent`). A fourth handle, `@jazeel.restaurant`, exists and its ownership is unknown. |
| 38 | **Analytics preference** | The site ships with no third-party tracking and no cookies for visitors. Adding analytics is a decision with privacy-consent consequences under the UAE data-protection law. |

---

## 5. What is already confirmed and does not need to be sent again

Established in Phase 1 and already live on the site:

- The business name in English and Arabic.
- The address: Semmer Villas Community Centre; A1/2, Semmer A Street, Nadd Hessa, Dubai Silicon Oasis.
- The telephone number **+971 4 323 2797** — confirmed by five independent sources.
- Opening hours of **10:00–02:00 every day**.
- Dine-in, indoor family hall, outdoor seating, children's area, shisha, takeaway and delivery.
- That alcohol is not served.
- The Deliveroo and Talabat storefront links.
- The Instagram, Facebook and TikTok accounts.
- The cuisine: Arabic, Levantine, Middle Eastern and international.
- **The logo**, supplied 31 August 2026 — now in the header, footer, browser tab and social card, with a reversed version for dark grounds.
- **The brand colours**, measured from that logo: petrol teal `#1d4a4e` and antique gold `#a08d4c`. The whole site is built from them.
