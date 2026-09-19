import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { venueSpaces } from "@/lib/db/schema";

export default async function AdminSpaces() {
  if (!(await getAdmin())) redirect("/admin/login");
  const rows = db.select().from(venueSpaces).orderBy(asc(venueSpaces.sort)).all();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Spaces</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-ink-soft">
            The areas you can host an event in, and how many people fit. Capacities are never
            guessed — they appear on the site only after you enter them here.
          </p>
        </div>
        <Link href="/admin/spaces/edit" className="rounded bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
          New space
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded border border-brand-line bg-brand-surface px-4 py-6 text-sm text-brand-ink-soft">
          No spaces have been added. The wedding and corporate pages currently show no capacity
          section at all, which is correct — an empty or approximate capacity is worse than none.
        </p>
      ) : (
        <ul className="divide-y divide-brand-line-soft rounded border border-brand-line bg-brand-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{r.nameEn}</p>
                <p className="mt-0.5 text-xs text-brand-ink-soft">
                  {r.published ? "Published" : "Draft"} ·{" "}
                  {r.seatedCapacity ? `${r.seatedCapacity} seated` : "no seated capacity"} ·{" "}
                  {r.standingCapacity ? `${r.standingCapacity} standing` : "no standing capacity"}
                </p>
              </div>
              <Link
                href={`/admin/spaces/edit?id=${r.id}`}
                className="rounded border border-brand-line px-3 py-1.5 text-sm hover:border-brand-accent"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
