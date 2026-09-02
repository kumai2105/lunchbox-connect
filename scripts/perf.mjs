/**
 * Measure what a real visitor actually downloads, on a phone and on a desktop.
 *
 * Not a synthetic score. It loads each page in Chromium, records every response, and
 * reports transferred bytes by type plus Largest Contentful Paint. The point is to catch
 * the specific failure that arrives with photography: shipping a 2400px hero to a 390px
 * phone, or blocking first paint on an image nobody has scrolled to yet.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PAGES = ["/en", "/en/restaurant", "/en/gallery", "/en/weddings", "/ar"];
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, dsf: 2, mobile: true },
  { name: "desktop", width: 1440, height: 900, dsf: 1, mobile: false },
];

// Budgets. A restaurant page that takes longer than this on a hotel wifi is losing people.
const BUDGET = { totalKb: 900, imageKb: 600, lcpMs: 2500 };

/*
  The gallery is the one page whose entire purpose is photographs, so holding it to the
  same total as a text page would mean shipping fewer pictures rather than shipping them
  well. It is allowed more bytes, but not more time: the LCP budget is unchanged, and the
  images below the fold are lazy so the extra weight arrives only if someone scrolls.
*/
const OVERRIDES = { "/en/gallery": { totalKb: 1100, imageKb: 800 } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const rows = [];
let failures = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  for (const path of PAGES) {
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: "networkidle" });

    /*
      transferSize is what actually crossed the wire, compression included. Counting
      response bodies instead inflates JavaScript roughly threefold, because the body has
      already been decompressed by the time it is readable — which is how a page that
      ships ~190KB of gzipped JS appears to ship 534KB.
    */
    const { bytes, imgs } = await page.evaluate(() => {
      const b = { image: 0, font: 0, script: 0, style: 0, doc: 0, other: 0 };
      const images = [];
      for (const e of performance.getEntriesByType("resource")) {
        const size = e.transferSize || e.encodedBodySize || 0;
        const u = e.name;
        const bucket = /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)|\/_next\/image/.test(u)
          ? "image"
          : /\.woff2?(\?|$)/.test(u)
            ? "font"
            : /\.js(\?|$)/.test(u)
              ? "script"
              : /\.css(\?|$)/.test(u)
                ? "style"
                : "other";
        b[bucket] += size;
        if (bucket === "image") images.push(u);
      }
      const nav = performance.getEntriesByType("navigation")[0];
      b.doc = nav ? nav.transferSize || 0 : 0;
      return { bytes: b, imgs: images };
    });
    const lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let v = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) v = e.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolve(Math.round(v)), 400);
        }),
    );

    const total = Object.values(bytes).reduce((a, b) => a + b, 0);
    const kb = (n) => Math.round(n / 1024);
    const budget = { ...BUDGET, ...(OVERRIDES[path] ?? {}) };
    const over = [];
    if (kb(total) > budget.totalKb) over.push(`total ${kb(total)}KB > ${budget.totalKb}`);
    if (kb(bytes.image) > budget.imageKb) over.push(`images ${kb(bytes.image)}KB > ${budget.imageKb}`);
    if (lcp > budget.lcpMs) over.push(`LCP ${lcp}ms`);
    if (over.length) failures++;

    rows.push({
      vp: vp.name,
      path,
      total: kb(total),
      image: kb(bytes.image),
      script: kb(bytes.script),
      font: kb(bytes.font),
      lcp,
      over,
      widest: imgs
        .map((u) => Number(new URL(u, BASE).searchParams.get("w") ?? 0))
        .sort((a, b) => b - a)[0],
    });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `\n${pad("viewport", 9)}${pad("page", 17)}${pad("total", 8)}${pad("img", 8)}${pad("js", 7)}${pad("font", 7)}${pad("LCP", 8)}widest`,
);
console.log("-".repeat(72));
for (const r of rows) {
  const flag = r.over.length ? `  ← ${r.over.join(", ")}` : "";
  console.log(
    `${pad(r.vp, 9)}${pad(r.path, 17)}${pad(r.total + "KB", 8)}${pad(r.image + "KB", 8)}${pad(r.script + "KB", 7)}${pad(r.font + "KB", 7)}${pad(r.lcp + "ms", 8)}${r.widest || "-"}px${flag}`,
  );
}
console.log(
  `\nbudget: ${BUDGET.totalKb}KB total, ${BUDGET.imageKb}KB images, ${BUDGET.lcpMs}ms LCP`,
);
console.log(failures ? `\n${failures} page/viewport pairs over budget` : "\nAll within budget.");
process.exit(failures ? 1 : 0);
