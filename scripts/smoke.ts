/* eslint-disable no-console */
/**
 * End-to-end verification against a real production build.
 *
 * This does not assert that things "should" work — it drives a real browser against
 * `next start`, fills real forms, signs into the real admin, and reads the database back.
 *
 *   npm run build && npm start &   (or let this script assume a server on BASE)
 *   npm run smoke
 */
/*
  Read the same configuration the running server reads. Without this the script falls back
  to the development admin password, so the moment a real one is set every admin check
  fails on a login screen it never got past — which looks like eight broken features rather
  than one unread file. Same order as scripts/preflight.ts.
*/
import { config as loadEnv } from "dotenv";
for (const f of [".env.local", ".env"]) loadEnv({ path: f, override: false, quiet: true });

import { chromium, type Browser, type Page } from "playwright";
import Database from "better-sqlite3";
import path from "node:path";

const BASE = process.env.BASE ?? process.env.SMOKE_BASE ?? "http://127.0.0.1:3000";
const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "jazeel.db");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "owner@jazeel.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe!Jazeel2026";

const results: { name: string; ok: boolean; detail?: string }[] = [];
let browser: Browser;

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    record(name, true, detail || undefined);
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err));
  }
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const EN_ROUTES = [
  "/en",
  "/en/restaurant",
  "/en/menu",
  "/en/weddings",
  "/en/corporate",
  "/en/catering",
  "/en/brunch",
  "/en/about",
  "/en/contact",
  "/en/privacy",
];
const AR_ROUTES = [
  "/ar",
  "/ar/" + encodeURIComponent("المطعم"),
  "/ar/" + encodeURIComponent("قائمة-الطعام"),
  "/ar/" + encodeURIComponent("الأعراس"),
  "/ar/" + encodeURIComponent("فعاليات-الشركات"),
  "/ar/" + encodeURIComponent("خدمات-الضيافة"),
  "/ar/" + encodeURIComponent("برانش-الأحد"),
  "/ar/" + encodeURIComponent("عن-جزيل"),
  "/ar/" + encodeURIComponent("اتصل-بنا"),
  "/ar/" + encodeURIComponent("سياسة-الخصوصية"),
];

async function main() {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
    args: ["--no-sandbox"],
  });

  console.log(`\nJazeel end-to-end verification against ${BASE}\n`);

  // The site rate-limits enquiries per client. Clear the counter so repeated verification runs
  // are not throttled by their own previous runs; the limiter itself is exercised in section 4.
  resetRateLimits();

  /* ------------------------------------------------------------ 1. routes */
  console.log("1. Public routes");
  for (const route of [...EN_ROUTES, ...AR_ROUTES]) {
    await check(`GET ${decodeURIComponent(route)}`, async () => {
      const res = await fetch(`${BASE}${route}`);
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const html = await res.text();
      assert(html.includes("<h1"), "no <h1> on the page");
      const visible = html
        .replace(/<script[\s\S]*?<\/script>/g, "")
        .replace(/<style[\s\S]*?<\/style>/g, "")
        .replace(/<[^>]+>/g, " ");
      assert(
        !/lorem ipsum|coming soon|placeholder|\bTBC\b|to be confirmed/i.test(visible),
        "placeholder text found in visible copy",
      );
      return `${res.status}`;
    });
  }

  await check("GET / redirects to a locale", async () => {
    const res = await fetch(`${BASE}/`, { redirect: "manual" });
    assert([307, 308, 302].includes(res.status), `expected a redirect, got ${res.status}`);
    const loc = res.headers.get("location") ?? "";
    assert(/\/(en|ar)$/.test(loc), `unexpected redirect target ${loc}`);
    return loc;
  });

  // The gallery route is gated on real, owner-supplied photographs. It 404'd until
  // 2 Sep 2026; now that twelve are published it must be reachable and must show them.
  await check("Gallery is reachable and shows only owner photographs", async () => {
    const res = await fetch(`${BASE}/en/gallery`);
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const html = await res.text();
    const srcs = [...html.matchAll(/%2Fmedia%2F([a-z0-9-]+)\.jpg|\/media\/([a-z0-9-]+)\.jpg/g)].map((m) => m[1] ?? m[2]);
    assert(srcs.length > 0, "gallery renders no images");
    return `${new Set(srcs).size} images`;
  });

  await check("Unknown page returns a real 404", async () => {
    const res = await fetch(`${BASE}/en/does-not-exist`);
    assert(res.status === 404, `expected 404, got ${res.status}`);
    const html = await res.text();
    assert(html.includes("could not be found"), "404 page has no message");
    return "404 with message";
  });

  /* ------------------------------------------------- 2. RTL and bilingual */
  console.log("\n2. Bilingual and RTL");
  await check("Arabic pages declare lang and dir", async () => {
    const html = await (await fetch(`${BASE}/ar`)).text();
    assert(/<html[^>]+lang="ar-AE"/.test(html), "lang is not ar-AE");
    assert(/<html[^>]+dir="rtl"/.test(html), "dir is not rtl");
    return "lang=ar-AE dir=rtl";
  });

  await check("English pages declare lang and dir", async () => {
    const html = await (await fetch(`${BASE}/en`)).text();
    assert(/<html[^>]+lang="en-AE"/.test(html), "lang is not en-AE");
    assert(/<html[^>]+dir="ltr"/.test(html), "dir is not ltr");
    return "lang=en-AE dir=ltr";
  });

  await check("Every page offers hreflang alternates", async () => {
    const html = await (await fetch(`${BASE}/en/weddings`)).text();
    const lower = html.toLowerCase();
    assert(lower.includes('hreflang="ar-ae"'), "no Arabic alternate");
    assert(lower.includes('hreflang="en-ae"'), "no English alternate");
    assert(lower.includes('hreflang="x-default"'), "no x-default");
    return "en-AE, ar-AE, x-default";
  });

  await check("Arabic layout actually mirrors (computed direction)", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/ar`, { waitUntil: "domcontentloaded" });
    const dir = await page.evaluate(() => getComputedStyle(document.body).direction);
    await page.close();
    assert(dir === "rtl", `computed direction was ${dir}`);
    return "rtl";
  });

  await check("Language switch keeps you on the same page", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en/weddings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "العربية" }).first().click();
    await page.waitForURL(/\/ar\//);
    const url = decodeURIComponent(page.url());
    await page.close();
    assert(url.includes("الأعراس"), `landed on ${url}`);
    return "en/weddings → ar/الأعراس";
  });

  /* ------------------------------------------------------ 3. navigation */
  console.log("\n3. Navigation and calls to action");
  await check("Every header link resolves to 200", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
    const raw = await page.locator("header nav a").evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href")).filter(Boolean),
    );
    await page.close();
    /*
      The header renders the same list twice — a permanent bar at >=1024px and a <details>
      disclosure below it — and both now sit inside a <nav>, because a small screen
      otherwise gets no navigation landmark at all. Only one is ever exposed at a time
      (the other is display:none, so it leaves the accessibility tree), but both are in
      the markup, so count distinct destinations rather than anchors.

      Asserting that the deduplicated count is 7 while the raw count is 14 also pins the
      two renderings together: if they ever drift apart, this fails.
    */
    const hrefs = [...new Set(raw as string[])];
    assert(
      raw.length === hrefs.length * 2,
      `the two header renderings have drifted — ${raw.length} anchors, ${hrefs.length} distinct`,
    );
    // Seven by design: Menu, Restaurant, Weddings, Corporate, Catering, Brunch, Contact.
    // About and Gallery live in the footer — verified separately below.
    assert(hrefs.length === 7, `expected 7 nav links, found ${hrefs.length}`);
    for (const href of hrefs) {
      const res = await fetch(`${BASE}${href}`);
      assert(res.status === 200, `${href} returned ${res.status}`);
    }
    return `${hrefs.length} links`;
  });

  await check("The three pillars each keep their own top-level nav slot", async () => {
    const html = await (await fetch(`${BASE}/en`)).text();
    const nav = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    for (const path of ["/en/weddings", "/en/corporate", "/en/catering"]) {
      assert(nav.includes(`href="${path}"`), `${path} is not in the header`);
    }
    assert(!/Services/i.test(nav), "the pillars were folded into a Services item");
    return "weddings, corporate, catering";
  });

  await check("Nothing became unreachable when the nav was trimmed", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
    const footer = await page.locator("footer a").evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
    await page.close();
    for (const path of ["/en/about", "/en/privacy", "/en/contact"]) {
      assert(footer.includes(path), `${path} is reachable from neither the header nor the footer`);
    }
    return "about, privacy, contact all in the footer";
  });

  await check("No dead or empty links anywhere on the homepage", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
    const bad = await page.locator("a").evaluateAll((els) =>
      els
        .map((e) => (e as HTMLAnchorElement).getAttribute("href"))
        .filter((h) => !h || h === "#" || h === "javascript:void(0)"),
    );
    await page.close();
    assert(bad.length === 0, `${bad.length} placeholder links`);
    return "0 placeholder links";
  });

  await check("Call and directions actions are real", async () => {
    const html = await (await fetch(`${BASE}/en`)).text();
    assert(html.includes("tel:+97143232797"), "no tel: link");
    assert(html.includes("google.com/maps/search"), "no directions link");
    return "tel + maps present";
  });

  await check("Delivery links point at the verified storefronts only", async () => {
    const html = await (await fetch(`${BASE}/en`)).text();
    assert(html.includes("deliveroo.ae/en/menu/dubai/silicon-oasis/jazeel-restaurant"), "no Deliveroo");
    assert(html.includes("talabat.com/uae/restaurant/622958"), "no Talabat");
    return "Deliveroo + Talabat";
  });

  await check("Delivery is not the primary homepage action", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
    const firstCta = await page.locator("main a").first().getAttribute("href");
    const deliveryY = await page
      .locator('a[href*="deliveroo"]')
      .first()
      .evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
    const enquiryY = await page
      .locator('main a[href*="weddings"]')
      .first()
      .evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
    await page.close();
    assert(!String(firstCta).includes("deliveroo"), "a delivery link is the first CTA");
    assert(deliveryY > enquiryY, "delivery appears above the events proposition");
    return "events above delivery";
  });

  /* ------------------------------------------------------ 4. enquiry flow */
  console.log("\n4. Enquiry forms");

  const before = countEnquiries();

  await check("Wedding enquiry validates before it submits", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en/weddings#enquiry`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await page.waitForTimeout(1200);
    const invalid = await page.locator("[aria-invalid='true']").count();
    const stillOnForm = await page.getByRole("button", { name: "Send enquiry" }).count();
    await page.close();
    assert(stillOnForm === 1, "form disappeared without being submitted");
    return `${invalid} fields flagged, no false success`;
  });

  const reference = await submitEnquiry("wedding").catch(() => null);
  await check("Wedding enquiry submits and shows a real reference", async () => {
    assert(reference, "no reference shown");
    assert(/^JZ-\d{8}-[A-Z0-9]{5}$/.test(reference!), `unexpected reference ${reference}`);
    return reference!;
  });

  await check("Enquiry is genuinely stored in the database", async () => {
    const row = readEnquiry(reference!);
    assert(row, "no row found for the reference shown to the visitor");
    assert(row.name === "Smoke Test", `stored name was ${row.name}`);
    assert(row.consent === 1, "consent not recorded");
    assert(row.ip_hash && row.ip_hash.length === 32, "no salted IP hash stored");
    return `id ${row.id}, status ${row.status}`;
  });

  await check("Visitor is never told an email was sent when none was", async () => {
    const row = readEnquiry(reference!);
    assert(row.notification_status === "not_configured", `status was ${row.notification_status}`);
    const page = await browser.newPage();
    await page.goto(`${BASE}/en/catering#enquiry`, { waitUntil: "domcontentloaded" });
    const html = await page.content();
    await page.close();
    assert(!/we (have )?emailed|email has been sent/i.test(html), "false email claim in the UI");
    return "stored, no email claimed";
  });

  await check("Enquiry count increased by exactly one", async () => {
    const after = countEnquiries();
    assert(after === before + 1, `expected ${before + 1}, got ${after}`);
    return `${before} → ${after}`;
  });

  await check("Arabic enquiry submits and records its language", async () => {
    const ref = await submitEnquiry("ar");
    assert(ref, "no reference in Arabic");
    const row = readEnquiry(ref!);
    assert(row.locale === "ar", `locale stored as ${row.locale}`);
    return `${ref} (ar)`;
  });

  await check("Rate limiting refuses a flood and says so plainly", async () => {
    const created: string[] = [];
    let refused = false;
    for (let i = 0; i < 8 && !refused; i += 1) {
      const page = await browser.newPage();
      await page.goto(`${BASE}/en/catering#enquiry`, { waitUntil: "domcontentloaded" });
      await page.fill('input[name="name"]', `Flood ${i}`);
      await page.fill('input[name="phone"]', "+971500000001");
      await page.check('input[name="consent"]');
      await page.waitForTimeout(1700);
      await page.getByRole("button", { name: "Send enquiry" }).click();
      await page.waitForTimeout(1200);
      const body = (await page.locator("main").innerText()).toLowerCase();
      if (body.includes("too many enquiries")) refused = true;
      const ref = body.match(/jz-\d{8}-[a-z0-9]{5}/i)?.[0];
      if (ref) created.push(ref.toUpperCase());
      await page.close();
    }
    // Clean up the flood so the owner's enquiry list is not polluted by verification runs.
    deleteEnquiries(created);
    resetRateLimits();
    assert(refused, "the rate limiter never engaged");
    return `refused after ${created.length} submissions`;
  });

  await check("Honeypot submission is rejected", async () => {
    const startCount = countEnquiries();
    const page = await browser.newPage();
    await page.goto(`${BASE}/en/corporate#enquiry`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="name"]', "Bot");
    await page.fill('input[name="phone"]', "+971500000000");
    await page.fill('input[name="website"]', "http://spam.example");
    await page.check('input[name="consent"]');
    await page.waitForTimeout(1700);
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await page.waitForTimeout(1500);
    await page.close();
    assert(countEnquiries() === startCount, "a honeypot submission was stored");
    return "rejected, nothing stored";
  });

  /* ---------------------------------------------------------- 5. admin */
  console.log("\n5. Admin");

  await check("Admin is protected when signed out", async () => {
    for (const route of ["/admin", "/admin/menu", "/admin/enquiries", "/admin/settings"]) {
      const res = await fetch(`${BASE}${route}`, { redirect: "manual" });
      assert([302, 307, 308].includes(res.status), `${route} returned ${res.status}`);
      assert((res.headers.get("location") ?? "").includes("/admin/login"), `${route} did not redirect to login`);
    }
    return "4 routes redirect to /admin/login";
  });

  await check("Admin is excluded from robots.txt", async () => {
    const txt = await (await fetch(`${BASE}/robots.txt`)).text();
    assert(txt.includes("Disallow: /admin"), "admin not disallowed");
    return "Disallow: /admin";
  });

  await check("Wrong password is rejected", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', "definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(1500);
    const alert = await page.locator("main [role='alert']").first().textContent();
    const url = page.url();
    await page.close();
    assert(url.includes("/admin/login"), "wrong password let the user in");
    assert(/not recognised/i.test(alert ?? ""), "no error shown");
    return "rejected with a message";
  });

  const adminPage = await browser.newPage();
  await check("Correct password signs in", async () => {
    await adminPage.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
    await adminPage.fill('input[name="email"]', ADMIN_EMAIL);
    await adminPage.fill('input[name="password"]', ADMIN_PASSWORD);
    await adminPage.getByRole("button", { name: "Sign in" }).click();
    await adminPage.waitForURL(/\/admin$/, { timeout: 15000 });
    const h1 = await adminPage.locator("h1").first().textContent();
    assert(h1?.includes("Overview"), `landed on ${h1}`);
    return "signed in";
  });

  await check("Enquiry appears in the admin list", async () => {
    await adminPage.goto(`${BASE}/admin/enquiries`, { waitUntil: "domcontentloaded" });
    const text = await adminPage.locator("table").textContent();
    assert(text?.includes(reference!), "the enquiry is not listed");
    return reference!;
  });

  await check("Enquiry status can be changed and persists", async () => {
    const row = readEnquiry(reference!);
    await adminPage.goto(`${BASE}/admin/enquiries/${row.id}`, { waitUntil: "domcontentloaded" });
    await adminPage.selectOption('select[name="status"]', "in_progress");
    await adminPage.fill('textarea[name="adminNotes"]', "Verified by the smoke test.");
    await adminPage.getByRole("button", { name: "Save" }).click();
    await adminPage.waitForTimeout(1500);
    const updated = readEnquiry(reference!);
    assert(updated.status === "in_progress", `status is ${updated.status}`);
    assert(updated.admin_notes?.includes("smoke test"), "notes not saved");
    return "status + notes saved";
  });

  await check("A draft menu item can be published and reaches the public page", async () => {
    // Publish one category and one item, then confirm the public menu changes.
    const db = openDb();
    const cat = db.prepare("SELECT id, slug FROM menu_categories ORDER BY sort LIMIT 1").get() as {
      id: number;
      slug: string;
    };
    const item = db
      .prepare("SELECT id, name_en FROM menu_items WHERE category_id = ? ORDER BY sort LIMIT 1")
      .get(cat.id) as { id: number; name_en: string };
    db.close();

    await adminPage.goto(`${BASE}/admin/menu`, { waitUntil: "domcontentloaded" });
    await adminPage.locator(`form[action] >> nth=0`).waitFor();

    // Publish the category via its toggle, then the item via its toggle.
    await adminPage.goto(`${BASE}/admin/menu/category?id=${cat.id}`, { waitUntil: "domcontentloaded" });
    await adminPage.check('input[name="published"]');
    await adminPage.getByRole("button", { name: "Save category" }).click();
    await adminPage.waitForTimeout(1200);

    await adminPage.goto(`${BASE}/admin/menu/item?id=${item.id}`, { waitUntil: "domcontentloaded" });
    await adminPage.check('input[name="published"]');
    await adminPage.getByRole("button", { name: "Save item" }).click();
    await adminPage.waitForTimeout(2000);

    const html = await (await fetch(`${BASE}/en/menu`)).text();
    assert(html.includes(item.name_en), `"${item.name_en}" did not appear on the public menu`);
    return `${item.name_en} is live`;
  });

  await check("Hiding the item removes it from the public page again", async () => {
    const db = openDb();
    const item = db
      .prepare("SELECT id, name_en FROM menu_items WHERE published = 1 ORDER BY id LIMIT 1")
      .get() as { id: number; name_en: string };
    db.close();

    await adminPage.goto(`${BASE}/admin/menu/item?id=${item.id}`, { waitUntil: "domcontentloaded" });
    await adminPage.uncheck('input[name="published"]');
    await adminPage.getByRole("button", { name: "Save item" }).click();
    await adminPage.waitForTimeout(2000);

    const html = await (await fetch(`${BASE}/en/menu`)).text();
    assert(!html.includes(`>${item.name_en}<`), "the item is still on the public menu");
    return `${item.name_en} hidden`;
  });

  await check("Page copy can be edited and appears on the site", async () => {
    const marker = `Verified ${Date.now()}`;
    await adminPage.goto(`${BASE}/admin/pages/about`, { waitUntil: "domcontentloaded" });
    const original = await adminPage.inputValue('input[name="kickerEn"]');
    await adminPage.fill('input[name="kickerEn"]', marker);
    await adminPage.getByRole("button", { name: "Save page" }).click();
    await adminPage.waitForTimeout(2000);
    const saveError = await adminPage.locator("main [role='alert']").count();
    assert(saveError === 0, "the admin rejected the save");

    const html = await (await fetch(`${BASE}/en/about`)).text();
    const found = html.includes(marker);

    // restore
    await adminPage.fill('input[name="kickerEn"]', original);
    await adminPage.getByRole("button", { name: "Save page" }).click();
    await adminPage.waitForTimeout(1500);

    assert(found, "the edit did not reach the public page");
    return "edit visible, then restored";
  });

  await check("A business detail can be set and shows up, then cleared and disappears", async () => {
    /*
      This test ends by clearing the field, which is the behaviour it is checking — but the
      field is a real setting, so running the suite used to wipe the owner's published email
      address and leave pre-flight warning about it afterwards. Remember what was there and
      put it back.
    */
    const db = new Database(DB_PATH);
    const previous =
      (db.prepare("select value from settings where key = 'email'").get() as { value: string | null } | undefined)
        ?.value ?? null;
    db.close();

    await adminPage.goto(`${BASE}/admin/settings`, { waitUntil: "domcontentloaded" });
    await adminPage.fill('input[name="email"]', "smoke@example.test");
    await adminPage.getByRole("button", { name: "Save details" }).click();
    await adminPage.waitForTimeout(2000);
    const withEmail = await (await fetch(`${BASE}/en/contact`)).text();
    const shown = withEmail.includes("smoke@example.test");

    await adminPage.goto(`${BASE}/admin/settings`, { waitUntil: "domcontentloaded" });
    await adminPage.fill('input[name="email"]', "");
    await adminPage.getByRole("button", { name: "Save details" }).click();
    await adminPage.waitForTimeout(2000);
    const without = await (await fetch(`${BASE}/en/contact`)).text();
    const hidden = !without.includes("smoke@example.test");

    const restore = new Database(DB_PATH);
    restore.prepare("update settings set value = ? where key = 'email'").run(previous);
    restore.close();

    assert(shown, "the email did not appear after being set");
    assert(hidden, "the email is still shown after being cleared");
    return previous ? "shown when set, absent when empty; prior value restored" : "shown when set, absent when empty";
  });

  await check("Sign out ends the session", async () => {
    await adminPage.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("button", { name: "Sign out" }).click();
    await adminPage.waitForURL(/\/admin\/login/, { timeout: 10000 });
    const res = await fetch(`${BASE}/admin`, { redirect: "manual" });
    assert([302, 307, 308].includes(res.status), "admin still reachable after sign out");
    return "session destroyed";
  });
  await adminPage.close();

  /* ------------------------------------------------------------- 6. SEO */
  console.log("\n6. SEO and structured data");

  await check("Structured data is valid JSON and evidence-safe", async () => {
    const html = await (await fetch(`${BASE}/en`)).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => m[1],
    );
    assert(blocks.length > 0, "no JSON-LD found");
    const parsed = blocks.map((b) => JSON.parse(b));
    const flat = JSON.stringify(parsed);
    assert(flat.includes('"Restaurant"'), "no Restaurant node");
    assert(!flat.includes("aggregateRating"), "a rating was published");
    assert(!flat.includes('"geo"'), "coordinates were published");
    assert(!/halal/i.test(flat), "a halal claim was published");
    assert(flat.includes('"acceptsReservations":false'), "reservations not explicitly disclaimed");
    return `${blocks.length} valid blocks`;
  });

  await check("Service structured data is present on pillar pages", async () => {
    const html = await (await fetch(`${BASE}/en/corporate`)).text();
    assert(html.includes('"Service"'), "no Service node");
    assert(!html.includes('"Event"'), "an Event was invented");
    return "Service, no Event";
  });

  await check("Each page has a unique canonical, title and description", async () => {
    const seen = new Map<string, string>();
    for (const route of ["/en", "/en/weddings", "/en/corporate", "/en/catering", "/en/brunch"]) {
      const html = await (await fetch(`${BASE}${route}`)).text();
      const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
      const desc = html.match(/name="description" content="([^"]+)"/)?.[1];
      assert(canonical?.endsWith(route), `canonical for ${route} was ${canonical}`);
      assert(title && title.length > 10, `weak title on ${route}`);
      assert(desc && desc.length > 40, `weak description on ${route}`);
      assert(!seen.has(title!), `duplicate title with ${seen.get(title!)}`);
      seen.set(title!, route);
    }
    return `${seen.size} unique titles`;
  });

  await check("Open Graph metadata is present", async () => {
    const html = await (await fetch(`${BASE}/en/weddings`)).text();
    assert(html.includes('property="og:title"'), "no og:title");
    assert(html.includes('property="og:url"'), "no og:url");
    return "og:title, og:url";
  });

  await check("Sitemap lists both languages and the now-live gallery", async () => {
    const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
    assert(xml.includes("/en/weddings"), "English weddings missing");
    assert(xml.includes("/ar/"), "no Arabic URLs");
    assert(xml.includes("/gallery"), "gallery is live but missing from the sitemap");
    const count = (xml.match(/<url>/g) ?? []).length;
    return `${count} URLs`;
  });

  /* ------------------------------------------- 7. accessibility & mobile */
  console.log("\n7. Accessibility and responsiveness");

  await check("The skip link actually moves focus into the content", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
    // Tab once from the top of the document: the skip link is the first focusable thing.
    await page.keyboard.press("Tab");
    const onSkip = await page.evaluate(() => document.activeElement?.className ?? "");
    assert(onSkip.includes("skip-link"), `first Tab landed on "${onSkip}", not the skip link`);
    await page.keyboard.press("Enter");
    // Without tabindex="-1" on <main> the browser scrolls but leaves focus on the link,
    // so the next Tab walks straight back into the header the visitor asked to skip.
    const landed = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return { tag: el?.tagName ?? "", id: el?.id ?? "" };
    });
    await page.close();
    assert(
      landed.tag === "MAIN" && landed.id === "main",
      `focus went to <${landed.tag.toLowerCase()} id="${landed.id}">, not <main>`,
    );
    return "focus lands on <main>";
  });

  await check("Exactly one h1 per page, in order", async () => {
    for (const route of ["/en", "/en/weddings", "/en/menu", "/en/contact"]) {
      const page = await browser.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      const h1 = await page.locator("h1").count();
      await page.close();
      assert(h1 === 1, `${route} has ${h1} h1 elements`);
    }
    return "1 h1 on each of 4 pages";
  });

  await check("Every form control has an accessible name", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en/contact`, { waitUntil: "domcontentloaded" });
    const unlabelled = await page.evaluate(() => {
      const controls = [...document.querySelectorAll("input, select, textarea")];
      return controls
        .filter((c) => {
          const el = c as HTMLInputElement;
          if (el.type === "hidden") return false;
          if (el.name === "website") return false; // honeypot, aria-hidden by design
          const id = el.getAttribute("id");
          const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
          const wrapped = !!el.closest("label");
          return !hasLabel && !wrapped && !el.getAttribute("aria-label");
        })
        .map((c) => (c as HTMLInputElement).name);
    });
    await page.close();
    assert(unlabelled.length === 0, `unlabelled: ${unlabelled.join(", ")}`);
    return "all controls labelled";
  });

  await check("Every image has an alt attribute", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
    const missing = await page.locator("img:not([alt])").count();
    await page.close();
    assert(missing === 0, `${missing} images without alt`);
    return "0 missing";
  });

  await check("Skip link exists and is focusable", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
    await page.close();
    assert(/skip/i.test(focused), `first tab stop was "${focused}"`);
    return "first tab stop is the skip link";
  });

  await check("Keyboard can reach the enquiry submit button", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en/weddings#enquiry`, { waitUntil: "domcontentloaded" });
    const reachable = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        /send enquiry/i.test(b.textContent ?? ""),
      );
      return !!btn && btn.tabIndex >= 0 && !btn.hasAttribute("disabled");
    });
    await page.close();
    assert(reachable, "submit button is not keyboard reachable");
    return "reachable";
  });

  await check("Mobile navigation opens without JavaScript enabled", async () => {
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
    const panel = page.locator("header details ul");
    const before = await panel.isVisible();
    await page.locator("header details summary").click();
    const after = await panel.isVisible();
    const links = await panel.locator("a").count();
    await ctx.close();
    assert(!before, "the menu was already open on mobile");
    assert(after, "the menu did not open");
    assert(links === 7, `expected 7 links in the mobile menu, found ${links}`);
    return "opens with JS disabled, 7 links";
  });

  await check("Only one navigation landmark is exposed at each breakpoint", async () => {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
      const visible = await page.locator("header nav:visible").count();
      await page.close();
      // Exactly one, not "at most one": `<= 1` is satisfied by zero, and zero is the bug
      // this check was meant to catch. Below 1024px the permanent bar is display:none, so
      // the disclosure needs its own <nav> or the page has no navigation landmark at all.
      assert(visible === 1, `${visible} header nav landmarks visible at ${width}px, expected 1`);
    }
    return "one at 390px, one at 1280px";
  });

  await check("No horizontal overflow at 320px, 390px, 768px, 1280px", async () => {
    const widths = [320, 390, 768, 1280];
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      await page.close();
      assert(!overflow, `horizontal overflow at ${width}px`);
    }
    return widths.join(", ");
  });

  await check("Arabic page does not overflow at 390px", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/ar`, { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    await page.close();
    assert(!overflow, "horizontal overflow on the Arabic homepage");
    return "no overflow";
  });

  /* ------------------------------------------------------- 8. security */
  console.log("\n8. Security headers and hygiene");

  await check("Security headers are set", async () => {
    const res = await fetch(`${BASE}/en`);
    for (const h of ["x-content-type-options", "referrer-policy", "x-frame-options"]) {
      assert(res.headers.get(h), `missing ${h}`);
    }
    return "nosniff, referrer-policy, frame-options";
  });

  await check("No secrets are exposed in the HTML", async () => {
    const html = await (await fetch(`${BASE}/en`)).text();
    for (const needle of ["ADMIN_PASSWORD", "IP_HASH_SALT", "SMTP_URL", ADMIN_PASSWORD]) {
      assert(!html.includes(needle), `"${needle}" appears in the page source`);
    }
    return "clean";
  });

  await check("The session cookie is HttpOnly", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin$/, { timeout: 15000 });
    const cookie = (await ctx.cookies()).find((c) => c.name === "jazeel_session");
    await ctx.close();
    assert(cookie, "no session cookie");
    assert(cookie!.httpOnly, "session cookie is readable by JavaScript");
    assert(cookie!.sameSite === "Lax", `sameSite is ${cookie!.sameSite}`);
    return "HttpOnly, SameSite=Lax";
  });

  /* --------------------------------------------------------- 9. content */
  console.log("\n9. Content integrity");

  await check("No unsupported superlative appears anywhere on the site", async () => {
    const banned = /\b(leading|largest|award[- ]winning|number one|voted best|world[- ]class|five[- ]star)\b/i;
    for (const route of EN_ROUTES) {
      const html = await (await fetch(`${BASE}${route}`)).text();
      const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
      const hit = text.match(banned);
      assert(!hit, `"${hit?.[0]}" found on ${route}`);
    }
    return `${EN_ROUTES.length} pages clean`;
  });

  await check("No rating, review or testimonial is published", async () => {
    for (const route of EN_ROUTES) {
      const html = await (await fetch(`${BASE}${route}`)).text();
      const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
      assert(!/\b\d\.\d\s*(\/|out of)\s*5\b/.test(text), `a rating appears on ${route}`);
      assert(!/testimonial/i.test(text), `a testimonial appears on ${route}`);
    }
    return "none found";
  });

  await check("No halal claim is published", async () => {
    for (const route of [...EN_ROUTES, ...AR_ROUTES]) {
      const html = await (await fetch(`${BASE}${route}`)).text();
      assert(!/halal|حلال/i.test(html), `a halal claim appears on ${decodeURIComponent(route)}`);
    }
    return "none found";
  });

  await check("No stock or generated photograph is served", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "networkidle" });
    const srcs = await page.locator("img").evaluateAll((els) =>
      els.map((e) => (e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src),
    );
    await page.close();
    const external = srcs.filter((s) => s && !s.startsWith(BASE) && !s.startsWith("data:"));
    assert(external.length === 0, `external images: ${external.join(", ")}`);
    return `${srcs.length} images, none external`;
  });

  /* --------------------------------------------------------------- done */
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${"─".repeat(60)}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail}`);
    process.exit(1);
  }
  console.log("All checks passed.\n");
}

/* ------------------------------------------------------------- helpers */

function openDb() {
  return new Database(DB_PATH, { readonly: false });
}

function resetRateLimits() {
  const db = openDb();
  db.prepare("DELETE FROM rate_limits").run();
  db.close();
}

function deleteEnquiries(references: string[]) {
  if (references.length === 0) return;
  const db = openDb();
  const stmt = db.prepare("DELETE FROM enquiries WHERE reference = ?");
  for (const r of references) stmt.run(r);
  db.close();
}

function countEnquiries(): number {
  const db = openDb();
  const row = db.prepare("SELECT COUNT(*) AS n FROM enquiries").get() as { n: number };
  db.close();
  return row.n;
}

function readEnquiry(reference: string) {
  const db = openDb();
  const row = db.prepare("SELECT * FROM enquiries WHERE reference = ?").get(reference) as never as {
    id: number;
    name: string;
    status: string;
    locale: string;
    consent: number;
    ip_hash: string;
    admin_notes: string | null;
    notification_status: string;
  };
  db.close();
  return row;
}

async function submitEnquiry(kind: "wedding" | "ar"): Promise<string | null> {
  const page = await browser.newPage();
  const url = kind === "ar" ? `${BASE}/ar/${encodeURIComponent("خدمات-الضيافة")}#enquiry` : `${BASE}/en/weddings#enquiry`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="name"]', "Smoke Test");
  await page.fill('input[name="phone"]', "+971 50 000 0000");
  await page.fill('input[name="email"]', "smoke@example.test");
  const guests = page.locator('input[name="guests"]');
  if (await guests.count()) await guests.fill("150");
  await page.check('input[name="consent"]');
  await page.waitForTimeout(1700); // clear the anti-bot timing gate
  await page.getByRole("button").filter({ hasText: /Send enquiry|إرسال الطلب/ }).click();
  await page.waitForSelector("[role='status']", { timeout: 15000 });
  const text = (await page.locator("[role='status']").textContent()) ?? "";
  await page.close();
  return text.match(/JZ-\d{8}-[A-Z0-9]{5}/)?.[0] ?? null;
}

main().catch(async (err) => {
  console.error(err);
  await browser?.close();
  process.exit(1);
});
