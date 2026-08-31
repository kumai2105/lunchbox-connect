import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { venueSpaces } from "@/lib/db/schema";
import { deleteVenueSpaceAction, saveVenueSpaceAction } from "@/app/actions/admin";
import { ActionForm, Checkbox, Field, SubmitButton, TextArea } from "@/components/admin/AdminUI";
import { parseList } from "@/lib/content";

export default async function SpaceEditor({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  if (!(await getAdmin())) redirect("/admin/login");
  const { id } = await searchParams;
  const row = id ? db.select().from(venueSpaces).where(eq(venueSpaces.id, Number(id))).all()[0] : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/spaces" className="text-sm underline underline-offset-4">
          ← Back to spaces
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{row ? "Edit space" : "New space"}</h1>
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <ActionForm action={saveVenueSpaceAction}>
          {row ? <input type="hidden" name="id" value={row.id} /> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name (English)" name="nameEn" required defaultValue={row?.nameEn} />
            <Field label="Name (Arabic)" name="nameAr" dir="rtl" defaultValue={row?.nameAr} />
            <div className="sm:col-span-2">
              <TextArea label="Description (English)" name="descriptionEn" rows={3} defaultValue={row?.descriptionEn} />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Description (Arabic)" name="descriptionAr" rows={3} dir="rtl" defaultValue={row?.descriptionAr} />
            </div>
            <Field label="Seated capacity" name="seatedCapacity" type="number" dir="ltr" defaultValue={row?.seatedCapacity} />
            <Field label="Standing capacity" name="standingCapacity" type="number" dir="ltr" defaultValue={row?.standingCapacity} />
            <div className="sm:col-span-2">
              <TextArea
                label="Features (English)"
                name="featuresEn"
                rows={4}
                defaultValue={parseList(row?.featuresEn).join("\n")}
                hint="One per line."
              />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Features (Arabic)" name="featuresAr" rows={4} dir="rtl" defaultValue={parseList(row?.featuresAr).join("\n")} />
            </div>
            <Field label="Sort order" name="sort" type="number" dir="ltr" defaultValue={row?.sort ?? 0} />
            <div className="pt-6">
              <Checkbox label="Published" name="published" defaultChecked={row?.published ?? false} />
            </div>
          </div>
          <div className="mt-6">
            <SubmitButton>Save space</SubmitButton>
          </div>
        </ActionForm>
      </div>

      {row ? (
        <form action={deleteVenueSpaceAction} className="rounded border border-state-error/30 bg-state-error-bg p-4">
          <input type="hidden" name="id" value={row.id} />
          <button type="submit" className="rounded border border-state-error px-4 py-2 text-sm font-semibold text-state-error">
            Delete space
          </button>
        </form>
      ) : null}
    </div>
  );
}
