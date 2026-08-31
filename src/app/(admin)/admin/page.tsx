import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { enquiries, galleryImages, menuItems, packages, pages, settings } from "@/lib/db/schema";

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const inner = (
    <>
      <span className="block text-2xl font-semibold">{value}</span>
      <span className="mt-1 block text-xs uppercase tracking-wide text-brand-ink-soft">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="rounded border border-brand-line bg-brand-surface p-4 hover:border-brand-accent">
      {inner}
    </Link>
  ) : (
    <div className="rounded border border-brand-line bg-brand-surface p-4">{inner}</div>
  );
}

export default async function AdminHome() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");

  const [newEnquiries] = db
    .select({ n: sql<number>`count(*)` })
    .from(enquiries)
    .where(eq(enquiries.status, "new"))
    .all();
  const [publishedItems] = db
    .select({ n: sql<number>`count(*)` })
    .from(menuItems)
    .where(eq(menuItems.published, true))
    .all();
  const [draftItems] = db
    .select({ n: sql<number>`count(*)` })
    .from(menuItems)
    .where(eq(menuItems.published, false))
    .all();
  const [pkgCount] = db.select({ n: sql<number>`count(*)` }).from(packages).all();
  const [imgCount] = db.select({ n: sql<number>`count(*)` }).from(galleryImages).all();

  const recent = db.select().from(enquiries).orderBy(desc(enquiries.id)).limit(5).all();
  const missing = db.select().from(settings).where(sql`${settings.value} IS NULL`).all();
  const arabicGaps = db.select().from(pages).where(eq(pages.arabicApproved, false)).all();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-2 text-sm text-brand-ink-soft">
          Everything on the public site is edited from here. Nothing you have not published is visible
          to visitors.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="New enquiries" value={newEnquiries?.n ?? 0} href="/admin/enquiries" />
        <Stat label="Menu items live" value={publishedItems?.n ?? 0} href="/admin/menu" />
        <Stat label="Menu items in draft" value={draftItems?.n ?? 0} href="/admin/menu" />
        <Stat label="Packages" value={pkgCount?.n ?? 0} href="/admin/packages" />
        <Stat label="Photographs" value={imgCount?.n ?? 0} href="/admin/gallery" />
      </div>

      {/* Honest, specific to-do list generated from the actual data — not a generic checklist. */}
      <section>
        <h2 className="text-lg font-semibold">Before launch</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(draftItems?.n ?? 0) > 0 ? (
            <li className="rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3">
              <strong>{draftItems?.n} menu items are in draft.</strong> They were imported from public
              research as a starting point and are <em>not</em> published. Check the names, prices and
              availability, then publish the ones that are correct.{" "}
              <Link href="/admin/menu" className="underline underline-offset-4">
                Open the menu
              </Link>
            </li>
          ) : null}
          {(imgCount?.n ?? 0) === 0 ? (
            <li className="rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3">
              <strong>No photographs have been uploaded.</strong> The site is built to work without
              them, and the Gallery page stays hidden until at least one is added.{" "}
              <Link href="/admin/gallery" className="underline underline-offset-4">
                Add photographs
              </Link>
            </li>
          ) : null}
          {(pkgCount?.n ?? 0) === 0 ? (
            <li className="rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3">
              <strong>No packages have been created.</strong> Wedding, corporate, catering and brunch
              pages are complete without them; add packages when you want prices and inclusions shown.{" "}
              <Link href="/admin/packages" className="underline underline-offset-4">
                Add a package
              </Link>
            </li>
          ) : null}
          {missing.length > 0 ? (
            <li className="rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3">
              <strong>{missing.length} business details are still empty:</strong>{" "}
              {missing.map((m) => m.key).join(", ")}.{" "}
              <Link href="/admin/settings" className="underline underline-offset-4">
                Fill them in
              </Link>
            </li>
          ) : null}
          {arabicGaps.length > 0 ? (
            <li className="rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3">
              <strong>{arabicGaps.length} pages have no approved Arabic text.</strong> The Arabic site
              works and falls back to English — it is never machine-translated.{" "}
              <Link href="/admin/pages" className="underline underline-offset-4">
                Add Arabic
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Latest enquiries</h2>
        {recent.length === 0 ? (
          <p className="mt-3 rounded border border-brand-line bg-brand-surface px-4 py-6 text-sm text-brand-ink-soft">
            No enquiries yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-brand-line-soft rounded border border-brand-line bg-brand-surface">
            {recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <Link href={`/admin/enquiries/${e.id}`} className="font-medium underline underline-offset-4">
                    {e.reference}
                  </Link>{" "}
                  <span className="text-brand-ink-soft">
                    — {e.type} · {e.name}
                  </span>
                </span>
                <span className="text-xs text-brand-ink-soft">{e.createdAt.slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
