import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { packages } from "@/lib/db/schema";
import { deletePackageAction, savePackageAction } from "@/app/actions/admin";
import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/admin/AdminUI";
import { parseList } from "@/lib/content";

export default async function PackageEditor({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; pillar?: string }>;
}) {
  if (!(await getAdmin())) redirect("/admin/login");
  const { id, pillar } = await searchParams;
  const row = id ? db.select().from(packages).where(eq(packages.id, Number(id))).all()[0] : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/packages" className="text-sm underline underline-offset-4">
          ← Back to packages
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{row ? "Edit package" : "New package"}</h1>
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <ActionForm action={savePackageAction}>
          {row ? <input type="hidden" name="id" value={row.id} /> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="Applies to"
              name="pillar"
              defaultValue={row?.pillar ?? pillar ?? "wedding"}
              options={[
                { value: "wedding", label: "Weddings & celebrations" },
                { value: "corporate", label: "Corporate events" },
                { value: "catering", label: "Catering" },
                { value: "brunch", label: "Sunday brunch" },
              ]}
            />
            <Field label="Sort order" name="sort" type="number" dir="ltr" defaultValue={row?.sort ?? 0} />
            <Field label="Name (English)" name="nameEn" required defaultValue={row?.nameEn} />
            <Field label="Name (Arabic)" name="nameAr" dir="rtl" defaultValue={row?.nameAr} />
            <div className="sm:col-span-2">
              <TextArea label="Summary (English)" name="summaryEn" rows={3} defaultValue={row?.summaryEn} />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Summary (Arabic)" name="summaryAr" rows={3} dir="rtl" defaultValue={row?.summaryAr} />
            </div>
            <div className="sm:col-span-2">
              <TextArea
                label="What is included (English)"
                name="inclusionsEn"
                rows={6}
                defaultValue={parseList(row?.inclusionsEn).join("\n")}
                hint="One per line."
              />
            </div>
            <div className="sm:col-span-2">
              <TextArea
                label="What is included (Arabic)"
                name="inclusionsAr"
                rows={6}
                dir="rtl"
                defaultValue={parseList(row?.inclusionsAr).join("\n")}
              />
            </div>
            <Field label="Minimum guests" name="minGuests" type="number" dir="ltr" defaultValue={row?.minGuests} />
            <Field label="Maximum guests" name="maxGuests" type="number" dir="ltr" defaultValue={row?.maxGuests} />
            <Field
              label="Price from (AED)"
              name="priceFrom"
              type="number"
              step="0.01"
              dir="ltr"
              defaultValue={row?.priceFromFils != null ? (row.priceFromFils / 100).toString() : ""}
              hint="Leave empty and no price line appears."
            />
            <Select
              label="Price is"
              name="priceUnit"
              defaultValue={row?.priceUnit ?? ""}
              options={[
                { value: "", label: "Not specified" },
                { value: "per_person", label: "Per person" },
                { value: "per_event", label: "Per event" },
              ]}
            />
            <Field label="Price note (English)" name="priceNoteEn" defaultValue={row?.priceNoteEn} />
            <Field label="Price note (Arabic)" name="priceNoteAr" dir="rtl" defaultValue={row?.priceNoteAr} />
            <div className="sm:col-span-2">
              <Checkbox label="Published — show on the site" name="published" defaultChecked={row?.published ?? false} />
            </div>
          </div>
          <div className="mt-6">
            <SubmitButton>Save package</SubmitButton>
          </div>
        </ActionForm>
      </div>

      {row ? (
        <form action={deletePackageAction} className="rounded border border-state-error/30 bg-state-error-bg p-4">
          <input type="hidden" name="id" value={row.id} />
          <button type="submit" className="rounded border border-state-error px-4 py-2 text-sm font-semibold text-state-error">
            Delete package
          </button>
        </form>
      ) : null}
    </div>
  );
}
