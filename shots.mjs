import fs from "node:fs";
import { chromium } from "playwright";

const OUT = "/tmp/r3";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";

const desktop = [
  ["01-home", "/en"],
  ["02-restaurant", "/en/restaurant"],
  ["03-menu", "/en/menu"],
  ["04-weddings", "/en/weddings"],
  ["05-corporate", "/en/corporate"],
  ["06-catering", "/en/catering"],
  ["07-brunch", "/en/brunch"],
  ["08-about", "/en/about"],
  ["09-contact", "/en/contact"],
  ["10-privacy", "/en/privacy"],
  ["11-404", "/en/no-such-page"],
  ["12-ar-home", "/ar"],
  ["13-ar-weddings", "/ar/" + encodeURIComponent("الأعراس")],
  ["14-ar-contact", "/ar/" + encodeURIComponent("اتصل-بنا")],
];
const mobile = [
  ["15-m-home", "/en"],
  ["16-m-weddings", "/en/weddings"],
  ["17-m-ar-home", "/ar"],
];
/*
  The admin screens are deliberately NOT captured any more.

  The preview they fed is a hosted page, and a hosted page is one careless share away
  from anyone. Screenshots of the signed-in admin show its layout, its controls, the
  shape of the enquiry list and the settings form — reconnaissance for anyone deciding
  whether /admin is worth attacking, handed over without them needing to reach the site.
  A preview exists so the owner and his managers can look at the public site; it does
  not need the admin in it to do that.
*/

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function shoot(ctx, list) {
  const p = await ctx.newPage();
  for (const [name, url] of list) {
    await p.goto(BASE + url, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(220);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  }
  await p.close();
}

const dctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await shoot(dctx, desktop);
await dctx.close();

const mctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await shoot(mctx, mobile);
await mctx.close();

await b.close();
console.log("captured", fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length);
