import type { Metadata } from "next";
import Link from "next/link";
import "../../globals.css";
import { getAdmin } from "@/lib/auth";
import { logoutAction } from "@/app/actions/admin";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Jazeel — site administration",
  robots: { index: false, follow: false, nocache: true },
};

// Admin reads and writes live data on every request.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/pages", label: "Page content" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/spaces", label: "Spaces" },
  { href: "/admin/gallery", label: "Photographs" },
  { href: "/admin/settings", label: "Details & hours" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();

  return (
    <html lang="en" dir="ltr" className={fontVariables}>
      <body className="min-h-dvh bg-brand-paper antialiased">
        {admin ? (
          <div className="flex min-h-dvh flex-col">
            <header className="border-b border-brand-line bg-brand-surface">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-baseline gap-3">
                  <Link href="/admin" className="text-lg font-semibold">
                    Jazeel
                  </Link>
                  <span className="text-xs uppercase tracking-widest text-brand-ink-soft">
                    Site administration
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <Link href="/en" className="underline underline-offset-4" target="_blank">
                    View site
                  </Link>
                  <span className="text-brand-ink-soft">{admin.email}</span>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="rounded border border-brand-line px-3 py-1.5 text-sm hover:border-brand-accent"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
              <nav aria-label="Administration" className="border-t border-brand-line-soft">
                <div className="mx-auto max-w-6xl overflow-x-auto px-5">
                  <ul className="flex gap-5 py-2 text-sm whitespace-nowrap">
                    {NAV.map((n) => (
                      <li key={n.href}>
                        <Link href={n.href} className="text-brand-ink-soft hover:text-brand-ink">
                          {n.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
          </div>
        ) : (
          <main className="mx-auto w-full max-w-md px-5 py-16">{children}</main>
        )}
      </body>
    </html>
  );
}
