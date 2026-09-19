import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { savePageAction } from "@/app/actions/admin";
import { ActionForm, Checkbox, Field, SubmitButton, TextArea } from "@/components/admin/AdminUI";

export default async function PageEditor({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await getAdmin())) redirect("/admin/login");
  const { slug } = await params;
  const row = db.select().from(pages).where(eq(pages.slug, slug)).all()[0];
  if (!row) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/admin/pages" className="text-sm underline underline-offset-4">
          ← Back to page content
        </Link>
        <h1 className="mt-2 text-2xl font-semibold capitalize">{slug}</h1>
        {!row.arabicApproved ? (
          <p className="mt-3 rounded border border-state-warn/30 bg-state-warn-bg px-4 py-3 text-sm">
            The Arabic text on this page has not been approved. Arabic visitors currently see the
            English wording. Add the Arabic yourself, or have it written by someone who speaks it —
            it is never translated automatically.
          </p>
        ) : null}
      </div>

      <div className="rounded border border-brand-line bg-brand-surface p-6">
        <ActionForm action={savePageAction}>
          <input type="hidden" name="slug" value={row.slug} />

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-accent">English</h2>
              <Field label="Small heading above the title" name="kickerEn" defaultValue={row.kickerEn} />
              <Field label="Page title" name="titleEn" defaultValue={row.titleEn} />
              <TextArea label="Introduction" name="introEn" rows={4} defaultValue={row.introEn} />
              <TextArea
                label="Body text"
                name="bodyEn"
                rows={12}
                defaultValue={row.bodyEn}
                hint="Leave a blank line between paragraphs. Start a line with ## to make a subheading."
              />
              <Field label="Search-result title" name="seoTitleEn" defaultValue={row.seoTitleEn} hint="Up to 70 characters." />
              <TextArea
                label="Search-result description"
                name="seoDescriptionEn"
                rows={3}
                defaultValue={row.seoDescriptionEn}
                hint="Up to 180 characters."
              />
            </section>

            <section className="space-y-5" dir="rtl">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-accent" dir="ltr">
                Arabic
              </h2>
              <Field label="عنوان صغير فوق العنوان" name="kickerAr" dir="rtl" defaultValue={row.kickerAr} />
              <Field label="عنوان الصفحة" name="titleAr" dir="rtl" defaultValue={row.titleAr} />
              <TextArea label="المقدمة" name="introAr" rows={4} dir="rtl" defaultValue={row.introAr} />
              <TextArea label="النص الأساسي" name="bodyAr" rows={12} dir="rtl" defaultValue={row.bodyAr} />
              <Field label="عنوان نتيجة البحث" name="seoTitleAr" dir="rtl" defaultValue={row.seoTitleAr} />
              <TextArea label="وصف نتيجة البحث" name="seoDescriptionAr" rows={3} dir="rtl" defaultValue={row.seoDescriptionAr} />
            </section>
          </div>

          <div className="mt-8 space-y-3 border-t border-brand-line-soft pt-6">
            <Checkbox label="Published" name="published" defaultChecked={row.published} />
            <Checkbox
              label="Arabic text approved by a person"
              name="arabicApproved"
              defaultChecked={row.arabicApproved}
            />
            <SubmitButton>Save page</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
