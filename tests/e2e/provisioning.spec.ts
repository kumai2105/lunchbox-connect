import { expect, test } from 'playwright/test';
import { adminDb, e2eReady, login, seeded } from './fixtures';

/**
 * TWO WORKFLOWS THAT EXISTED BUT HAD NEVER BEEN DRIVEN THROUGH THE BROWSER.
 *
 *   1. The Meal image flow. Upload, storage, signed-URL display and the
 *      historical-immutability guarantee were all implemented and all proven at
 *      the database boundary — and never once exercised by a person clicking
 *      "choose file". The gap mattered because the failure mode is silent: a
 *      broken signed URL renders as a missing thumbnail, not an error.
 *
 *   2. Super Admin provisioning of Parent access. The authority exists
 *      (accounts via the admin path, guardian links via /guardians) and the
 *      negatives are proven in SQL, but nobody had shown that a Super Admin can
 *      take a family from "no account" to "sees their own child, and only their
 *      own child" using the product.
 *
 * Both use isolated fixtures created and consumed inside the test. Neither
 * touches a Meal or a family that anything else depends on.
 */

const stamp = Date.now();

/**
 * A real 1x1 PNG, byte for byte.
 *
 * Uploading a text file with a .png name would prove the plumbing but not the
 * content type, and object storage that accepts anything is exactly the sort of
 * thing worth knowing. This is a valid image.
 */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('meal images — upload, persist, render, and stay historical', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(120_000);

  const MEAL = `E2E Image Meal ${stamp}`;

  /**
   * Does object storage accept the upload at all?
   *
   * The first run of this file failed with "the Meal was never created", which
   * is what the UI does when the image upload is refused: MealLibraryPage
   * uploads FIRST so one save is one revision, so a storage refusal aborts the
   * whole save and no Meal row appears. That symptom names the wrong layer.
   * This probe separates them — it drives storage directly with the same
   * credentials and the same call the app makes, so a refusal is reported as a
   * refusal, with the server's own message.
   */
  test('object storage accepts a Super Admin upload (isolates storage from the UI)', async () => {
    const s = seeded();
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(
      process.env.E2E_SUPABASE_URL!,
      process.env.E2E_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const signedIn = await client.auth.signInWithPassword({
      email: s.superAdminEmail!,
      password: process.env.E2E_PASSWORD ?? 'E2e-pass!12345',
    });
    expect(signedIn.error, 'could not sign in as the Super Admin').toBeNull();

    const path = `e2e-probe-${stamp}.png`;
    const up = await client.storage
      .from('meal-images')
      .upload(path, PNG_1PX, { upsert: true, contentType: 'image/png' });

    expect(
      up.error,
      `object storage refused a Super Admin upload to meal-images: ${JSON.stringify(up.error)}`,
    ).toBeNull();

    // Clean up after the probe: this object belongs to no Meal.
    await adminDb().storage.from('meal-images').remove([path]);
    await client.auth.signOut();
  });

  test('a Super Admin uploads a Meal image and it survives a reload', async ({ page }) => {
    const s = seeded();
    const db = adminDb();

    // Capture what the PAGE says, not only what the DOM shows. The previous
    // run reported "no Meal was created" with no error banner at all, which is
    // the signature of an exception thrown inside the save handler: onSave sets
    // busy, awaits, and never reaches its own error branch, so the UI shows
    // nothing. A rejected promise leaves no trace in the DOM and every trace in
    // the console.
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await login(page, s.superAdminEmail!);
    await page.goto('/meals');
    await page.getByRole('button', { name: /add meal/i }).first().click();
    await page.getByLabel('Name', { exact: true }).fill(MEAL);
    await page.getByPlaceholder('chicken, pasta, tomato').fill('rice, peas');
    await page.getByPlaceholder('gluten, dairy').fill('none');

    await page.getByLabel('Image', { exact: true }).setInputFiles({
      name: 'e2e-meal.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    });

    await page.getByRole('button', { name: /save meal/i }).click();

    // The Meal exists, carries a first revision, AND carries an image path.
    // Asserting only "the Meal saved" would pass with the upload silently
    // dropped, which is the actual risk here.
    // NOT maybeSingle(). maybeSingle yields null for ZERO rows and ERRORS for
    // more than one, and this test previously mapped both to "missing" — so a
    // retry that created a second Meal under the same name reported the same
    // symptom as never creating one at all, and the diagnosis chased the wrong
    // failure for two rounds. This is the identical mistake recorded earlier
    // in this project against the Class-create investigation. Listing the rows
    // distinguishes the two, and the message says which.
    let imagePath = '';
    let detail = '';
    await expect
      .poll(
        async () => {
          const r = await db
            .from('meals')
            .select('id,image_path,current_revision_id,created_at')
            .eq('name', MEAL)
            .order('created_at', { ascending: true });
          if (r.error) {
            detail = `query error: ${r.error.message}`;
            return 'query-failed';
          }
          const rows = r.data ?? [];
          detail = `${rows.length} row(s): ${JSON.stringify(rows)}`;
          if (rows.length === 0) return 'missing';
          if (rows.length > 1) return 'duplicated';
          const row = rows[0]!;
          imagePath = (row.image_path as string) ?? '';
          if (!row.current_revision_id) return 'no-revision';
          return imagePath ? 'stored' : 'no-image';
        },
        { message: 'the Meal image was not stored with the Meal' },
      )
      .toBe('stored')
      .catch(async (e: unknown) => {
        // Say WHY, using the app's own words AND the browser's, instead of
        // only "missing".
        const banner = page.locator('.banner.err');
        const shown = (await banner.count())
          ? ((await banner.first().textContent()) ?? '').trim()
          : '(no error banner rendered)';
        const stillOpen = (await page.getByLabel('Name', { exact: true }).count()) > 0;
        throw new Error(
          [
            (e as Error).message,
            `Rows found: ${detail}`,
            `App banner: ${shown}`,
            `Meal editor still open: ${stillOpen}`,
            `Uncaught page errors: ${pageErrors.length ? pageErrors.join(' | ') : '(none)'}`,
            `Console errors: ${consoleErrors.length ? consoleErrors.join(' | ') : '(none)'}`,
          ].join('\n'),
        );
      });

    // The object is genuinely in the bucket, not just referenced by a row.
    const dl = await db.storage.from('meal-images').download(imagePath);
    expect(dl.error, `the stored object could not be read back: ${dl.error?.message}`).toBeNull();
    expect(
      (await dl.data!.arrayBuffer()).byteLength,
      'the stored object is empty',
    ).toBeGreaterThan(0);

    // And it renders in the library after a full reload — the signed-URL path,
    // which is where a broken thumbnail would come from.
    await page.reload();
    const card = page.locator('.meal-card', { hasText: MEAL }).first();
    const img = card.locator('img').first();
    if (await img.count()) {
      await expect(img, 'the meal image element never became visible').toBeVisible({
        timeout: 15_000,
      });
      const ok = await img.evaluate((el) => {
        const i = el as HTMLImageElement;
        return i.complete && i.naturalWidth > 0;
      });
      expect(ok, 'the meal image element rendered but the image itself failed to load').toBe(true);
    } else {
      // No <img> in the card markup is a finding in its own right: the image was
      // stored and the library does not show it.
      throw new Error('the Meal saved an image but the library renders no image element for it');
    }
  });

  test('the image bucket is private — an anonymous caller cannot read the object', async ({
    request,
  }) => {
    const db = adminDb();
    const r = await db.from('meals').select('image_path').eq('name', MEAL).maybeSingle();
    const path = (r.data?.image_path as string) ?? '';
    expect(path, 'no image path to test privacy against').not.toBe('');

    // The public object URL for a private bucket must not serve the file.
    const base = process.env.E2E_SUPABASE_URL!;
    const res = await request.get(`${base}/storage/v1/object/public/meal-images/${path}`, {
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      'the meal image is served to anonymous callers over the public object path',
    ).not.toBe(200);
  });

  test('editing the Meal does not rewrite the image a served meal was recorded against', async ({
    page,
  }) => {
    const s = seeded();
    const db = adminDb();

    const before = await db
      .from('meals')
      .select('id,image_path,current_revision_id')
      .eq('name', MEAL)
      .single();
    const firstRevision = before.data!.current_revision_id as string;
    const firstImage = before.data!.image_path as string;

    // Edit the Meal — one save, one new revision.
    await login(page, s.superAdminEmail!);
    await page.goto('/meals');
    await page
      .locator('.meal-card', { hasText: MEAL })
      .first()
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    const nameField = page.getByLabel('Name', { exact: true });
    await expect(nameField, 'the Meal editor did not open for editing').toBeVisible();
    await page.getByPlaceholder('chicken, pasta, tomato').fill('rice, peas, carrot');
    await page.getByRole('button', { name: /save meal/i }).click();

    await expect
      .poll(async () => {
        const r = await db
          .from('meals')
          .select('current_revision_id')
          .eq('name', MEAL)
          .maybeSingle();
        return (r.data?.current_revision_id as string) ?? '';
      }, { message: 'editing the Meal did not create a new revision' })
      .not.toBe(firstRevision);

    // The OLD revision is untouched — that is what a historical record points
    // at, and it is the whole reason revisions exist.
    const old = await db
      .from('meal_revisions')
      .select('id,image_path')
      .eq('id', firstRevision)
      .maybeSingle();
    expect(old.data, 'the original revision was deleted').not.toBeNull();
    if (old.data && 'image_path' in old.data) {
      expect(
        old.data.image_path,
        'editing the Meal rewrote the image on the historical revision',
      ).toBe(firstImage);
    }

    // And the original stored object still exists.
    const dl = await db.storage.from('meal-images').download(firstImage);
    expect(
      dl.error,
      'the image a historical revision points at was removed when the Meal was edited',
    ).toBeNull();
  });
});

test.describe('parent access — provisioned by a Super Admin, and scoped to one child', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(150_000);
  test.describe.configure({ mode: 'serial' });

  const INST = `E2E Prov Inst ${stamp}`;
  const CLASS = `E2E Prov Class ${stamp}`;
  const STUDENT_NO = `EPROV-${stamp}`;
  const OTHER_NO = `EPROVX-${stamp}`;
  const PARENT_EMAIL = `e2e.prov.parent.${stamp}@lunchbox.app`;
  const PARENT_PASS = 'E2e-pass!12345';

  let instId = '';
  let classId = '';
  let studentId = '';
  let otherStudentId = '';

  test('a Super Admin creates the family and links the guardian, all through the UI', async ({
    page,
  }) => {
    const s = seeded();
    const db = adminDb();
    await login(page, s.superAdminEmail!);

    // Institution
    await page.goto('/institutions');
    await page.getByRole('button', { name: '+ Add institution', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(INST);
    await page.getByLabel('Type', { exact: true }).selectOption('nursery');
    await page.getByRole('button', { name: 'Add institution', exact: true }).click();
    await expect
      .poll(async () => {
        const r = await db.from('institutions').select('id').eq('name', INST).maybeSingle();
        instId = (r.data?.id as string) ?? '';
        return instId !== '';
      }, { message: 'the Institution was never created' })
      .toBe(true);

    // Class
    await page.goto(`/classes?institution=${instId}`);
    await page.getByRole('button', { name: '+ Create class', exact: true }).click();
    await page.getByLabel('Class name', { exact: true }).fill(CLASS);
    await page.getByRole('button', { name: 'Create class', exact: true }).click();
    await expect
      .poll(async () => {
        const r = await db.from('classes').select('id').eq('name', CLASS).maybeSingle();
        classId = (r.data?.id as string) ?? '';
        return classId !== '';
      }, { message: 'the Class was never created' })
      .toBe(true);

    // Two students: the one this parent will be linked to, and one they must
    // never see. A single-student test cannot tell "correct child" apart from
    // "every child".
    for (const [given, no] of [
      ['Prov', STUDENT_NO],
      ['Other', OTHER_NO],
    ] as const) {
      await page.goto('/students');
      await page.getByRole('button', { name: /add student/i }).first().click();
      await page.getByLabel('Given name', { exact: true }).fill(given);
      await page.getByLabel('Family name', { exact: true }).fill('Child');
      await page.getByLabel('Student no.', { exact: true }).fill(no);
      await page.getByLabel('Institution', { exact: true }).selectOption(instId);
      await page.getByLabel('Class', { exact: true }).selectOption(classId);
      await page.getByRole('button', { name: /^(Add|Create) student$/i }).click();
      await expect
        .poll(async () => {
          const r = await db.from('students').select('id').eq('student_no', no).maybeSingle();
          return (r.data?.id as string) ?? '';
        }, { message: `student ${no} was never created` })
        .not.toBe('');
    }
    studentId = (await db.from('students').select('id').eq('student_no', STUDENT_NO).single()).data!
      .id as string;
    otherStudentId = (await db.from('students').select('id').eq('student_no', OTHER_NO).single())
      .data!.id as string;

    // The Parent ACCOUNT, created through the Users screen.
    await page.goto('/users');
    await page.getByRole('button', { name: '+ Create account', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill('Prov Parent');
    await page.getByLabel('Email', { exact: true }).fill(PARENT_EMAIL);
    await page.getByLabel('Password (min 8)', { exact: true }).fill(PARENT_PASS);
    await page.getByLabel('Role', { exact: true }).selectOption('parent');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    await expect
      .poll(async () => {
        const r = await db
          .from('app_users')
          .select('user_id,role')
          .eq('email', PARENT_EMAIL)
          .maybeSingle();
        return r.data ? (r.data.role as string) : 'missing';
      }, { message: 'the Parent account was never provisioned through the UI' })
      .toBe('parent');

    // The GUARDIAN LINK, made through the Guardians screen — the existing
    // Super Admin authority, not a parallel model.
    await page.goto('/guardians');
    await page.getByRole('button', { name: '+ Link guardian', exact: true }).click();
    await expect(
      page.getByLabel('Student', { exact: true }),
      'the Link guardian dialog did not open',
    ).toBeVisible();
    await page.getByLabel('Student', { exact: true }).selectOption(studentId);

    // Select the parent by its account id rather than by rendered label: the
    // option text is "name (email)" and matching on a fragment of that would
    // break the moment another fixture account shares a name.
    const parentUid = (
      await db.from('app_users').select('user_id').eq('email', PARENT_EMAIL).single()
    ).data!.user_id as string;
    await page
      .getByLabel('Parent / guardian account', { exact: true })
      .selectOption(parentUid);
    await page.getByRole('button', { name: 'Link', exact: true }).click();

    await expect
      .poll(async () => {
        const r = await db
          .from('student_parents')
          .select('student_id')
          .eq('student_id', studentId);
        return (r.data ?? []).length;
      }, { message: 'the guardian link was never written from the Guardians screen' })
      .toBe(1);
  });

  test('the provisioned Parent sees their own child, and only their own child', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[autocomplete="email"]').fill(PARENT_EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill(PARENT_PASS);
    await page.getByRole('button', { name: /enter the platform/i }).click();
    await expect(page).toHaveURL(/\/parent/, { timeout: 20_000 });

    await expect(page.getByText(/Prov/).first(), 'the linked child is not shown').toBeVisible();
    const body = await page.locator('body').innerText();
    expect(
      body.includes('Other Child'),
      'the Parent can see a child they were never linked to',
    ).toBe(false);
  });

  test('the guardian link cannot be forged from a client, by anyone', async () => {
    const db = adminDb();
    const url = process.env.E2E_SUPABASE_URL!;
    const anon = process.env.E2E_SUPABASE_ANON_KEY!;
    const { createClient } = await import('@supabase/supabase-js');

    // As the Parent themselves: claiming another Student must be refused.
    const asParent = createClient(url, anon, { auth: { persistSession: false } });
    const signedIn = await asParent.auth.signInWithPassword({
      email: PARENT_EMAIL,
      password: PARENT_PASS,
    });
    expect(signedIn.error, 'could not sign in as the provisioned Parent').toBeNull();

    const selfClaim = await asParent
      .from('student_parents')
      .insert({ student_id: otherStudentId, user_id: signedIn.data.user!.id });
    expect(
      selfClaim.error,
      'a Parent linked themselves to a Student they have no relationship with',
    ).not.toBeNull();

    // And the row really is absent — an error that did not prevent the write
    // would be worse than no error at all.
    const after = await db
      .from('student_parents')
      .select('student_id')
      .eq('student_id', otherStudentId);
    expect((after.data ?? []).length, 'the forged link was written anyway').toBe(0);
    await asParent.auth.signOut();
  });

  test('a Nursery Admin cannot create a guardian link', async ({ page }) => {
    const s = seeded();
    await login(page, s.schoolAdminEmail!);
    await page.goto('/guardians');
    await expect(page.locator('#root')).toBeVisible();

    // The authority is Super Admin only (guardian actions for a Nursery Admin
    // are NOT_YET_DEFINED), so the control must not be offered at all.
    await expect(
      page.getByRole('button', { name: '+ Link guardian', exact: true }),
      'a Nursery Admin is being offered guardian linking, which is not an approved authority',
    ).toHaveCount(0);
  });
});
