import fs from "node:fs";
import { chromium } from "playwright";

const OUT = "/tmp/r3";
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
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
const admin = [
  ["18-admin-overview", "/admin"],
  ["19-admin-menu", "/admin/menu"],
  ["20-admin-page-editor", "/admin/pages/weddings"],
  ["21-admin-enquiries", "/admin/enquiries"],
  ["22-admin-settings", "/admin/settings"],
];

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

const actx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const lp = await actx.newPage();
await lp.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
await lp.fill('input[name="email"]', env.ADMIN_EMAIL);
await lp.fill('input[name="password"]', env.ADMIN_PASSWORD);
await Promise.all([lp.waitForURL(/\/admin(?!\/login)/), lp.click('button[type="submit"]')]);
await lp.close();
await shoot(actx, admin);
await actx.close();

await b.close();
console.log("captured", fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length);
