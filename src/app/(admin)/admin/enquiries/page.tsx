import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { enquiries } from "@/lib/db/schema";

const STATUS_STYLE: Record<string, string> = {
  new: "bg-brand-accent-soft text-brand-accent",
  in_progress: "bg-state-warn-bg text-state-warn",
  quoted: "bg-state-warn-bg text-state-warn",
  won: "bg-state-success-bg text-state-success",
  lost: "bg-brand-line-soft text-brand-ink-soft",
  spam: "bg-state-error-bg text-state-error",
};

export default async function AdminEnquiries() {
  if (!(await getAdmin())) redirect("/admin/login");
  const rows = db.select().from(enquiries).orderBy(desc(enquiries.id)).limit(200).all();

  const notConfigured = rows.some((r) => r.notificationStatus === "not_configured");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Enquiries</h1>
        <p className="mt-2 text-sm text-brand-ink-soft">
          Every enquiry sent from the website is stored here, whether or not email notification has
          been switched on.
        </p>
      </div>

      {notConfigured ? (
        <div className="rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3 text-sm">
          <strong>Email notification is not switched on.</strong> Enquiries are being saved here
          correctly, and visitors are told their enquiry has been received — they are never told an
          email was sent. To have them emailed to you as well, the server needs a mail account
          configured (see <code>docs/DEPLOYMENT.md</code>). Until then, check this page.
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded border border-brand-line bg-brand-surface px-4 py-6 text-sm text-brand-ink-soft">
          No enquiries yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-brand-line bg-brand-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Enquiries received, newest first</caption>
            <thead className="border-b border-brand-line text-start text-xs uppercase tracking-wide text-brand-ink-soft">
              <tr>
                <th scope="col" className="px-4 py-2 text-start">Reference</th>
                <th scope="col" className="px-4 py-2 text-start">Type</th>
                <th scope="col" className="px-4 py-2 text-start">Name</th>
                <th scope="col" className="px-4 py-2 text-start">Date wanted</th>
                <th scope="col" className="px-4 py-2 text-start">Guests</th>
                <th scope="col" className="px-4 py-2 text-start">Status</th>
                <th scope="col" className="px-4 py-2 text-start">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line-soft">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/enquiries/${r.id}`} className="font-medium underline underline-offset-4">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{r.type}</td>
                  <td className="px-4 py-2.5">{r.name}</td>
                  <td className="px-4 py-2.5">{r.eventDate ?? "—"}</td>
                  <td className="px-4 py-2.5">{r.guests ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status] ?? ""}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-brand-ink-soft">
                    {r.createdAt.slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
