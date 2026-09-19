import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { menuCategories } from "@/lib/db/schema";
import { deleteMenuCategoryAction, saveMenuCategoryAction } from "@/app/actions/admin";
import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/admin/AdminUI";

export default async function CategoryEditor({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  if (!(await getAdmin())) redirect("/admin/login");
  const { id } = await searchParams;
  const row = id ? db.select().from(menuCategories).where(eq(menuCategories.id, Number(id))).all()[0] : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/menu" className="text-sm underline underline-offset-4">
          ← Back to the menu
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{row ? "Edit category" : "New category"}</h1>
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <ActionForm action={saveMenuCategoryAction}>
          {row ? <input type="hidden" name="id" value={row.id} /> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Name (English)"
              name="nameEn"
              required
              defaultValue={row?.nameEn}
            />
            <Field label="Name (Arabic)" name="nameAr" dir="rtl" defaultValue={row?.nameAr} />
            <Field
              label="URL slug"
              name="slug"
              required
              defaultValue={row?.slug}
              hint="Lowercase letters, numbers and hyphens. Used for the in-page link."
              dir="ltr"
            />
            <Select
              label="Served"
              name="daypart"
              defaultValue={row?.daypart ?? "all_day"}
              options={[
                { value: "all_day", label: "All day" },
                { value: "breakfast", label: "Breakfast" },
                { value: "lunch", label: "Lunch" },
                { value: "dinner", label: "Dinner" },
                { value: "late_night", label: "Late night" },
              ]}
            />
            <div className="sm:col-span-2">
              <TextArea label="Description (English)" name="descriptionEn" rows={2} defaultValue={row?.descriptionEn} />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Description (Arabic)" name="descriptionAr" rows={2} dir="rtl" defaultValue={row?.descriptionAr} />
            </div>
            <Field label="Sort order" name="sort" type="number" defaultValue={row?.sort ?? 0} dir="ltr" />
            <div className="space-y-3 pt-6">
              <Checkbox
                label="Published — show this category on the site"
                name="published"
                defaultChecked={row?.published ?? false}
              />
              <Checkbox
                label="Arabic text approved by a person"
                name="arabicApproved"
                defaultChecked={row?.arabicApproved ?? false}
                hint="Leave unticked until a person has written or checked the Arabic."
              />
            </div>
          </div>
          <div className="mt-6">
            <SubmitButton>Save category</SubmitButton>
          </div>
        </ActionForm>
      </div>

      {row ? (
        <form action={deleteMenuCategoryAction} className="rounded border border-state-error/30 bg-state-error-bg p-4">
          <input type="hidden" name="id" value={row.id} />
          <p className="text-sm text-brand-ink">
            Deleting a category also deletes every item inside it. To take it off the site
            temporarily, use <strong>Hide</strong> instead.
          </p>
          <button type="submit" className="mt-3 rounded border border-state-error px-4 py-2 text-sm font-semibold text-state-error">
            Delete category
          </button>
        </form>
      ) : null}
    </div>
  );
}
