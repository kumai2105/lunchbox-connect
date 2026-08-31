import Image from "next/image";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { galleryImages } from "@/lib/db/schema";
import {
  deleteGalleryImageAction,
  toggleGalleryImageAction,
  uploadGalleryImageAction,
} from "@/app/actions/admin";
import { ActionForm, Checkbox, Field, Select, SubmitButton, labelClass, inputClass } from "@/components/admin/AdminUI";

export default async function AdminGallery() {
  if (!(await getAdmin())) redirect("/admin/login");
  const rows = db.select().from(galleryImages).orderBy(asc(galleryImages.sort)).all();
  const published = rows.filter((r) => r.published).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Photographs</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-ink-soft">
          Only real photographs of Jazeel belong here — the restaurant, the food, and events you have
          actually hosted. The public Gallery page stays hidden until at least one photograph is
          published{published > 0 ? "" : " (it is hidden right now)"}.
        </p>
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <h2 className="text-lg font-semibold">Add a photograph</h2>
        <div className="mt-4">
          <ActionForm action={uploadGalleryImageAction} encType="multipart/form-data">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="f-file" className={labelClass}>
                  Image file <span className="text-state-error">*</span>
                </label>
                <input
                  id="f-file"
                  name="file"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-brand-ink-soft">JPEG, PNG, WebP or AVIF, up to 8 MB.</p>
              </div>
              <Select
                label="Where it belongs"
                name="pillar"
                defaultValue="restaurant"
                options={[
                  { value: "restaurant", label: "Restaurant & café" },
                  { value: "wedding", label: "Weddings & celebrations" },
                  { value: "corporate", label: "Corporate events" },
                  { value: "catering", label: "Catering" },
                  { value: "brunch", label: "Sunday brunch" },
                  { value: "venue", label: "The venue / spaces" },
                ]}
              />
              <Field label="Sort order" name="sort" type="number" dir="ltr" defaultValue={0} />
              <div className="sm:col-span-2">
                <Field
                  label="Describe the photograph (English)"
                  name="altEn"
                  required
                  hint="Read aloud to visitors using a screen reader, and shown if the image fails to load. Describe what is in the picture."
                />
              </div>
              <div className="sm:col-span-2">
                <Field label="Describe the photograph (Arabic)" name="altAr" dir="rtl" />
              </div>
              <Field label="Caption (English)" name="captionEn" />
              <Field label="Caption (Arabic)" name="captionAr" dir="rtl" />
              <div className="sm:col-span-2">
                <Field label="Photographer credit" name="credit" />
              </div>
              <div className="sm:col-span-2">
                <Checkbox label="Publish immediately" name="published" defaultChecked />
              </div>
            </div>
            <div className="mt-6">
              <SubmitButton>Upload</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </div>

      {rows.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded border border-brand-line bg-brand-surface p-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded">
                <Image src={r.filePath} alt={r.altEn} fill sizes="300px" className="object-cover" />
              </div>
              <p className="mt-2 text-sm font-medium">{r.altEn}</p>
              <p className="text-xs text-brand-ink-soft">
                {r.pillar} · {r.published ? "Published" : "Hidden"}
                {r.altAr ? " · Arabic description set" : " · no Arabic description"}
              </p>
              <div className="mt-3 flex gap-2">
                <form action={toggleGalleryImageAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="rounded border border-brand-line px-3 py-1 text-xs hover:border-brand-accent">
                    {r.published ? "Hide" : "Publish"}
                  </button>
                </form>
                <form action={deleteGalleryImageAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="rounded border border-state-error px-3 py-1 text-xs text-state-error">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
