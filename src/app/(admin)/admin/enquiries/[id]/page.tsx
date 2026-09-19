import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { enquiries } from "@/lib/db/schema";
import { updateEnquiryAction } from "@/app/actions/admin";
import { ActionForm, Select, SubmitButton, TextArea } from "@/components/admin/AdminUI";

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-brand-line-soft py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-semibold">{term}</dt>
      <dd className="mt-1 text-sm text-brand-ink-soft sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  );
}

export default async function EnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) redirect("/admin/login");
  const { id } = await params;
  const row = db.select().from(enquiries).where(eq(enquiries.id, Number(id))).all()[0];
  if (!row) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/enquiries" className="text-sm underline underline-offset-4">
          ← Back to enquiries
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{row.reference}</h1>
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <dl>
          <Row term="Type">{row.type}</Row>
          <Row term="Name">{row.name}</Row>
          <Row term="Telephone">
            <a href={`tel:${row.phone}`} dir="ltr" className="underline underline-offset-4">
              {row.phone}
            </a>
          </Row>
          {row.email ? (
            <Row term="Email">
              <a href={`mailto:${row.email}`} dir="ltr" className="underline underline-offset-4">
                {row.email}
              </a>
            </Row>
          ) : null}
          {row.company ? <Row term="Company">{row.company}</Row> : null}
          {row.eventDate ? <Row term="Preferred date">{row.eventDate}</Row> : null}
          {row.guests ? <Row term="Guests">{row.guests}</Row> : null}
          {row.venueRequired != null ? (
            <Row term="Wants to hold it at Jazeel">{row.venueRequired ? "Yes" : "No"}</Row>
          ) : null}
          {row.cateringRequired != null ? (
            <Row term="Wants Jazeel to cater">{row.cateringRequired ? "Yes" : "No"}</Row>
          ) : null}
          {row.serviceStyle ? <Row term="Food service">{row.serviceStyle.replace("_", " ")}</Row> : null}
          {row.message ? (
            <Row term="Message">
              <p className="whitespace-pre-wrap">{row.message}</p>
            </Row>
          ) : null}
          <Row term="Language">{row.locale === "ar" ? "Arabic" : "English"}</Row>
          <Row term="From page">{row.sourcePage ?? "—"}</Row>
          <Row term="Received">{row.createdAt.replace("T", " ").slice(0, 19)}</Row>
          <Row term="Notification">
            {row.notificationStatus === "not_configured"
              ? "Stored only — email notification is not switched on."
              : row.notificationStatus}
            {row.notificationDetail ? (
              <span className="mt-1 block text-xs">{row.notificationDetail}</span>
            ) : null}
          </Row>
        </dl>
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <h2 className="text-lg font-semibold">Update</h2>
        <div className="mt-4">
          <ActionForm action={updateEnquiryAction}>
            <input type="hidden" name="id" value={row.id} />
            <div className="space-y-5">
              <Select
                label="Status"
                name="status"
                defaultValue={row.status}
                options={[
                  { value: "new", label: "New" },
                  { value: "in_progress", label: "In progress" },
                  { value: "quoted", label: "Quoted" },
                  { value: "won", label: "Confirmed" },
                  { value: "lost", label: "Lost" },
                  { value: "spam", label: "Spam" },
                ]}
              />
              <TextArea label="Internal notes" name="adminNotes" rows={5} defaultValue={row.adminNotes} />
              <SubmitButton>Save</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
