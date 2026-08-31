import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { galleryImages, menuCategories, menuItems } from "@/lib/db/schema";
import { deleteMenuItemAction, saveMenuItemAction } from "@/app/actions/admin";
import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/admin/AdminUI";
import { parseList } from "@/lib/content";

export default async function ItemEditor({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; category?: string }>;
}) {
  if (!(await getAdmin())) redirect("/admin/login");
  const { id, category } = await searchParams;
  const row = id ? db.select().from(menuItems).where(eq(menuItems.id, Number(id))).all()[0] : null;
  const cats = db.select().from(menuCategories).orderBy(asc(menuCategories.sort)).all();
  const images = db.select().from(galleryImages).orderBy(asc(galleryImages.id)).all();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/menu" className="text-sm underline underline-offset-4">
          ← Back to the menu
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{row ? "Edit item" : "New item"}</h1>
        {row?.sourceNote ? (
          <p className="mt-3 rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3 text-sm">
            <strong>Where this came from:</strong> {row.sourceNote}. Check it against your real menu
            before publishing.
          </p>
        ) : null}
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <ActionForm action={saveMenuItemAction}>
          {row ? <input type="hidden" name="id" value={row.id} /> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="Category"
              name="categoryId"
              defaultValue={String(row?.categoryId ?? category ?? cats[0]?.id ?? "")}
              options={cats.map((c) => ({ value: String(c.id), label: c.nameEn }))}
            />
            <Field
              label="Price (AED)"
              name="price"
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              defaultValue={row?.priceFils != null ? (row.priceFils / 100).toString() : ""}
              hint="Leave empty to show the item with no price."
            />
            <Field label="Name (English)" name="nameEn" required defaultValue={row?.nameEn} />
            <Field label="Name (Arabic)" name="nameAr" dir="rtl" defaultValue={row?.nameAr} />
            <div className="sm:col-span-2">
              <TextArea label="Description (English)" name="descriptionEn" rows={2} defaultValue={row?.descriptionEn} />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Description (Arabic)" name="descriptionAr" rows={2} dir="rtl" defaultValue={row?.descriptionAr} />
            </div>
            <Field
              label="Portion / size (English)"
              name="portionEn"
              defaultValue={row?.portionEn}
              hint="e.g. 800g, 1 kg, serves 2"
            />
            <Field label="Portion / size (Arabic)" name="portionAr" dir="rtl" defaultValue={row?.portionAr} />
            <div className="sm:col-span-2">
              <TextArea
                label="Dietary labels"
                name="dietary"
                rows={3}
                defaultValue={parseList(row?.dietary).join("\n")}
                hint="One per line, e.g. Vegetarian. Shown as small tags on the menu."
              />
            </div>
            <div className="sm:col-span-2">
              <TextArea
                label="Allergens"
                name="allergens"
                rows={3}
                defaultValue={parseList(row?.allergens).join("\n")}
                hint="One per line. Dubai Municipality requires nine allergen categories to be declared or available on request — confirm your list with your food-safety adviser."
              />
            </div>
            <Select
              label="Photograph"
              name="imagePath"
              defaultValue={row?.imagePath ?? ""}
              options={[
                { value: "", label: "None" },
                ...images.map((i) => ({ value: i.filePath, label: i.altEn })),
              ]}
            />
            <Field label="Sort order" name="sort" type="number" dir="ltr" defaultValue={row?.sort ?? 0} />
            <Field label="Image alt text (English)" name="imageAltEn" defaultValue={row?.imageAltEn} />
            <Field label="Image alt text (Arabic)" name="imageAltAr" dir="rtl" defaultValue={row?.imageAltAr} />
            <div className="sm:col-span-2">
              <Field
                label="Internal source note"
                name="sourceNote"
                defaultValue={row?.sourceNote}
                hint="Never shown publicly. Records where this item's details came from."
              />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <Checkbox label="Published — show on the public menu" name="published" defaultChecked={row?.published ?? false} />
              <Checkbox label="In stock" name="inStock" defaultChecked={row?.inStock ?? true} />
              <Checkbox label="Available to dine in" name="availableDineIn" defaultChecked={row?.availableDineIn ?? true} />
              <Checkbox label="Available for delivery" name="availableDelivery" defaultChecked={row?.availableDelivery ?? true} />
              <Checkbox label="Featured" name="featured" defaultChecked={row?.featured ?? false} />
              <Checkbox label="Arabic text approved by a person" name="arabicApproved" defaultChecked={row?.arabicApproved ?? false} />
            </div>
          </div>
          <div className="mt-6">
            <SubmitButton>Save item</SubmitButton>
          </div>
        </ActionForm>
      </div>

      {row ? (
        <form action={deleteMenuItemAction} className="rounded border border-state-error/30 bg-state-error-bg p-4">
          <input type="hidden" name="id" value={row.id} />
          <button type="submit" className="rounded border border-state-error px-4 py-2 text-sm font-semibold text-state-error">
            Delete item
          </button>
        </form>
      ) : null}
    </div>
  );
}
