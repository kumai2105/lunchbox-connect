import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";

const LABELS: Record<string, string> = {
  home: "Home",
  restaurant: "Restaurant & Café",
  menu: "Menu",
  weddings: "Weddings & Celebrations",
  corporate: "Corporate Events",
  catering: "Catering",
  brunch: "Sunday Brunch",
  gallery: "Gallery",
  about: "About Jazeel",
  contact: "Contact & Location",
  privacy: "Privacy notice",
};

export default async function AdminPages() {
  if (!(await getAdmin())) redirect("/admin/login");
  const rows = db.select().from(pages).orderBy(asc(pages.slug)).all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Page content</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-ink-soft">
          The words on each public page. Every page has separate English and Arabic fields — Arabic
          is never translated automatically. Where Arabic is empty the site shows the English text
          instead, so the Arabic pages always work.
        </p>
      </div>

      <ul className="divide-y divide-brand-line-soft rounded border border-brand-line bg-brand-surface">
        {rows.map((p) => (
          <li key={p.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{LABELS[p.slug] ?? p.slug}</p>
              <p className="mt-0.5 text-xs text-brand-ink-soft">
                {p.published ? "Published" : "Hidden"} ·{" "}
                {p.arabicApproved ? "Arabic approved" : "Arabic not yet approved"}
              </p>
            </div>
            <Link
              href={`/admin/pages/${p.slug}`}
              className="rounded border border-brand-line px-3 py-1.5 text-sm hover:border-brand-accent"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
