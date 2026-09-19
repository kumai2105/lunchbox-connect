import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { packages } from "@/lib/db/schema";
import { formatPrice } from "@/lib/content";

const PILLARS = [
  { key: "wedding", label: "Weddings & celebrations" },
  { key: "corporate", label: "Corporate events" },
  { key: "catering", label: "Catering" },
  { key: "brunch", label: "Sunday brunch" },
] as const;

export default async function AdminPackages() {
  if (!(await getAdmin())) redirect("/admin/login");
  const rows = db.select().from(packages).orderBy(asc(packages.sort)).all();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Packages</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-ink-soft">
            Optional. The wedding, corporate, catering and brunch pages are complete without
            packages — add them when you have real inclusions and prices to show. Nothing appears on
            the site until you tick <strong>Published</strong>.
          </p>
        </div>
        <Link href="/admin/packages/edit" className="rounded bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
          New package
        </Link>
      </div>

      {PILLARS.map((p) => {
        const own = rows.filter((r) => r.pillar === p.key);
        return (
          <section key={p.key}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-ink-soft">{p.label}</h2>
            {own.length === 0 ? (
              <p className="mt-2 rounded border border-brand-line bg-brand-surface px-4 py-5 text-sm text-brand-ink-soft">
                No packages yet. The {p.label.toLowerCase()} page currently shows the description and
                the enquiry form, with no package section — which is a complete, intentional page.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-brand-line-soft rounded border border-brand-line bg-brand-surface">
                {own.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium">{r.nameEn}</p>
                      <p className="mt-0.5 text-xs text-brand-ink-soft">
                        {r.published ? "Published" : "Draft"} ·{" "}
                        {formatPrice(r.priceFromFils) ?? "No price"} ·{" "}
                        {r.minGuests || r.maxGuests
                          ? `${r.minGuests ?? "?"}–${r.maxGuests ?? "?"} guests`
                          : "No guest range"}
                      </p>
                    </div>
                    <Link
                      href={`/admin/packages/edit?id=${r.id}`}
                      className="rounded border border-brand-line px-3 py-1.5 text-sm hover:border-brand-accent"
                    >
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
