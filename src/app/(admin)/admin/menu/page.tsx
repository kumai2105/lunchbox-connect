import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { menuCategories, menuItems } from "@/lib/db/schema";
import { toggleMenuCategoryAction, toggleMenuItemAction } from "@/app/actions/admin";
import { formatPrice } from "@/lib/content";

export default async function AdminMenu() {
  if (!(await getAdmin())) redirect("/admin/login");

  const cats = db.select().from(menuCategories).orderBy(asc(menuCategories.sort)).all();
  const items = db.select().from(menuItems).orderBy(asc(menuItems.sort)).all();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Menu</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-ink-soft">
            A category and its items appear on the public menu only when both are published. Use
            &ldquo;Hide&rdquo; to take something off the site temporarily without deleting it.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/menu/category"
            className="rounded border border-brand-line px-4 py-2 text-sm hover:border-brand-accent"
          >
            New category
          </Link>
          <Link href="/admin/menu/item" className="rounded bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
            New item
          </Link>
        </div>
      </div>

      <div className="space-y-8">
        {cats.map((c) => {
          const own = items.filter((i) => i.categoryId === c.id);
          return (
            <section key={c.id} className="rounded border border-brand-line bg-brand-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line-soft px-4 py-3">
                <div>
                  <h2 className="font-semibold">
                    {c.nameEn}{" "}
                    <span className="ms-2 text-xs font-normal text-brand-ink-soft">/{c.slug}</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-brand-ink-soft">
                    {c.published ? "Published" : "Draft — not on the site"} ·{" "}
                    {c.nameAr ? "Arabic name set" : "No Arabic name"} · {own.length} items
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleMenuCategoryAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="rounded border border-brand-line px-3 py-1.5 text-xs hover:border-brand-accent"
                    >
                      {c.published ? "Hide" : "Publish"}
                    </button>
                  </form>
                  <Link
                    href={`/admin/menu/category?id=${c.id}`}
                    className="rounded border border-brand-line px-3 py-1.5 text-xs hover:border-brand-accent"
                  >
                    Edit
                  </Link>
                </div>
              </header>

              {own.length === 0 ? (
                <p className="px-4 py-6 text-sm text-brand-ink-soft">No items in this category yet.</p>
              ) : (
                <ul className="divide-y divide-brand-line-soft">
                  {own.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {i.nameEn}
                          {i.featured ? (
                            <span className="ms-2 rounded bg-brand-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-accent">
                              Featured
                            </span>
                          ) : null}
                          {!i.inStock ? (
                            <span className="ms-2 rounded bg-state-warn-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase text-state-warn">
                              Unavailable
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-brand-ink-soft">
                          {formatPrice(i.priceFils, i.currency) ?? "No price set"}
                          {i.sourceNote ? ` · ${i.sourceNote}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            i.published
                              ? "bg-state-success-bg text-state-success"
                              : "bg-brand-line-soft text-brand-ink-soft"
                          }`}
                        >
                          {i.published ? "Live" : "Draft"}
                        </span>
                        <form action={toggleMenuItemAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <button
                            type="submit"
                            className="rounded border border-brand-line px-3 py-1 text-xs hover:border-brand-accent"
                          >
                            {i.published ? "Hide" : "Publish"}
                          </button>
                        </form>
                        <Link
                          href={`/admin/menu/item?id=${i.id}`}
                          className="rounded border border-brand-line px-3 py-1 text-xs hover:border-brand-accent"
                        >
                          Edit
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
