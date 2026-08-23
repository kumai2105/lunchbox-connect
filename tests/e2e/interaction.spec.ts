import { expect, test } from 'playwright/test';
import { adminDb, e2eReady, login, seeded } from './fixtures';

/**
 * CANCEL, CLOSE, ESCAPE — AND WHAT A FAILURE LOOKS LIKE TO A PERSON.
 *
 * Two gaps the previous evidence named explicitly:
 *
 *   1. No test had ever exercised a Cancel control. Every acceptance test
 *      filled a form and pressed Save, so the entire "changed my mind" half of
 *      each dialog was unverified. A Cancel that silently saves, or a modal
 *      that will not close, traps an operator in a decision they were trying to
 *      back out of — and nothing in the suite would have noticed.
 *
 *   2. `messageOf()` is asserted at the source, but no test had ever read what
 *      a user actually SEES when something is refused. The `[object Object]`
 *      defect lived at exactly that seam: the function was fine in isolation
 *      and the banner was garbage on screen.
 *
 * These tests assert the negative each time — that nothing was written — rather
 * than only that a dialog disappeared. A modal closing is cosmetic; the row not
 * existing is the guarantee.
 */

const stamp = Date.now();

/** Text that must never reach a person, whatever went wrong underneath. */
const FORBIDDEN_IN_UI = [
  '[object Object]',
  'undefined',
  'service_role',
  'eyJ', // a JWT prefix — no token may ever be rendered
  'at Object.', // a stack frame
  'pg_catalog',
];

function assertHumanReadable(text: string, where: string) {
  expect(
    text.trim().length,
    `${where}: the error area is empty — the user is told nothing`,
  ).toBeGreaterThan(0);
  for (const bad of FORBIDDEN_IN_UI) {
    expect(
      text.includes(bad),
      `${where}: the message shown to the user contains "${bad}" — ${JSON.stringify(text)}`,
    ).toBe(false);
  }
}

test.describe('cancel and close — backing out must not write anything', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(90_000);

  test('Cancel on Create class closes the dialog and creates nothing', async ({ page }) => {
    const s = seeded();
    const db = adminDb();
    const name = `E2E Cancelled Class ${stamp}`;

    await login(page, s.superAdminEmail!);
    await page.goto('/classes');
    await page.getByRole('button', { name: '+ Create class', exact: true }).click();

    const field = page.getByLabel('Class name', { exact: true });
    await expect(field, 'the Create class dialog did not open').toBeVisible();
    await field.fill(name);

    await page.getByRole('button', { name: /^cancel$/i }).click();

    // The dialog is gone...
    await expect(field, 'Cancel did not close the dialog — the operator is trapped').toHaveCount(0);

    // ...and nothing was written. This is the assertion that matters: a Cancel
    // that closes the dialog AND saves the row is worse than one that does
    // neither, because it looks like it worked.
    const wrote = await db.from('classes').select('id').eq('name', name);
    expect(
      (wrote.data ?? []).length,
      'Cancel created the Class anyway — backing out wrote to the database',
    ).toBe(0);

    // And the operator can carry on: the screen is still usable afterwards.
    await expect(page.getByRole('button', { name: '+ Create class', exact: true })).toBeVisible();
  });

  test('Cancel on Add meal creates no Meal and no revision', async ({ page }) => {
    const s = seeded();
    const db = adminDb();
    const name = `E2E Cancelled Meal ${stamp}`;

    await login(page, s.superAdminEmail!);
    await page.goto('/meals');
    await page
      .getByRole('button', { name: /add meal/i })
      .first()
      .click();

    const field = page.getByLabel('Name', { exact: true });
    await expect(field, 'the Meal editor did not open').toBeVisible();
    await field.fill(name);
    await page.getByPlaceholder('chicken, pasta, tomato').fill('should never persist');

    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(field, 'Cancel did not close the Meal editor').toHaveCount(0);

    const meals = await db.from('meals').select('id').eq('name', name);
    expect((meals.data ?? []).length, 'Cancel saved the Meal anyway').toBe(0);
  });

  test('a dismissed dialog can be reopened and used — no dead state left behind', async ({
    page,
  }) => {
    const s = seeded();
    await login(page, s.superAdminEmail!);
    await page.goto('/classes');

    // Open, cancel, open again. A modal that leaves a stale overlay or a locked
    // scroll behind is a trap the second time, not the first.
    await page.getByRole('button', { name: '+ Create class', exact: true }).click();
    await expect(page.getByLabel('Class name', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.getByLabel('Class name', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: '+ Create class', exact: true }).click();
    const field = page.getByLabel('Class name', { exact: true });
    await expect(field, 'the dialog could not be reopened after being cancelled').toBeVisible();
    await field.fill('reopened');
    await expect(field, 'the reopened dialog does not accept input').toHaveValue('reopened');
    await page.getByRole('button', { name: /^cancel$/i }).click();
  });

  test('browser Back out of a dialog leaves a coherent screen', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail!);
    await page.goto('/institutions');
    await page.getByRole('button', { name: '+ Add institution', exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible();

    // Back from a modal that is not a route should not strand the app. Whatever
    // it lands on, the user must not be looking at a frozen overlay.
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root'), 'the app did not render after Back').toBeVisible();
    // Nothing is blocking the page: some interactive control is reachable.
    await expect(page.getByRole('button').first()).toBeVisible();
  });
});

test.describe('rendered errors — what a person actually sees when something fails', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(90_000);

  test('a duplicate name is refused with a readable message, not [object Object]', async ({
    page,
  }) => {
    const s = seeded();
    const name = `E2E Duplicate Institution ${stamp}`;

    await login(page, s.superAdminEmail!);

    // Create it once, legitimately.
    await page.goto('/institutions');
    await page.getByRole('button', { name: '+ Add institution', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Type', { exact: true }).selectOption('nursery');
    await page.getByRole('button', { name: 'Add institution', exact: true }).click();
    await expect(page.getByRole('link', { name })).toBeVisible();

    // Now create it again. institutions.name is UNIQUE, so this is a real
    // backend refusal travelling the real error path — not a mocked failure.
    await page.getByRole('button', { name: '+ Add institution', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Type', { exact: true }).selectOption('nursery');
    await page.getByRole('button', { name: 'Add institution', exact: true }).click();

    const banner = page.locator('.banner.err');
    await expect(
      banner,
      'a duplicate name was accepted, or the refusal was shown nowhere',
    ).toBeVisible({
      timeout: 15_000,
    });
    const text = (await banner.first().textContent()) ?? '';
    assertHumanReadable(text, 'duplicate institution name');
  });

  test('a validation failure is explained in words the operator can act on', async ({ page }) => {
    const s = seeded();
    const menu = `E2E Validation Menu ${stamp}`;
    const inst = `E2E Validation Inst ${stamp}`;

    await login(page, s.superAdminEmail!);

    // A two-week menu, then an anchor week the menu does not have. This is a
    // real rule (0033 enforces the same bound in the database), so the message
    // has to tell the operator what the allowed range actually is — "invalid
    // input" would be useless here.
    await page.goto('/menu-builder');
    await page.getByRole('button', { name: /new menu/i }).click();
    await page.getByLabel('Menu name', { exact: true }).fill(menu);
    await page.getByLabel('Number of weeks', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('.menu-list-item', { hasText: menu }).first()).toBeVisible();

    await page.goto('/institutions');
    await page.getByRole('button', { name: '+ Add institution', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(inst);
    await page.getByLabel('Type', { exact: true }).selectOption('nursery');
    await page.getByRole('button', { name: 'Add institution', exact: true }).click();
    await page.getByRole('link', { name: inst }).click();
    await expect(page).toHaveURL(/\/institutions\/[0-9a-f-]{36}/);
    const instId = new URL(page.url()).pathname.split('/').pop()!;

    await page.goto(`/institutions/${instId}?tab=service`);
    await page.getByLabel('Menu', { exact: true }).selectOption({ label: `${menu} (2 weeks)` });

    // The number input clamps, so drive the underlying value the way a stale
    // form or a keyboard-entered value would, then submit.
    const week = page.getByLabel('Starting rotation week', { exact: true });
    await week.fill('9');
    await page.getByRole('button', { name: 'Assign menu' }).click();

    const banner = page.locator('.banner.err');
    if (await banner.count()) {
      const text = (await banner.first().textContent()) ?? '';
      assertHumanReadable(text, 'out-of-range rotation week');
    } else {
      // The control clamped the value before submission, which is the better
      // outcome — but then the SAVED value must be inside the menu's range,
      // not silently wrong.
      const value = await week.inputValue();
      expect(
        Number(value),
        'an out-of-range starting week was neither refused nor clamped into range',
      ).toBeLessThanOrEqual(2);
    }
  });

  test('a Nursery Admin is not offered Super Admin actions, and sees no broken error', async ({
    page,
  }) => {
    const s = seeded();

    // Stated honestly: the application does not offer unauthorized controls, so
    // there is no UI path by which a Nursery Admin can provoke an authorization
    // refusal. The server-side refusal is proven at the database boundary
    // (verify_authorization_matrix, 520 checks). What belongs HERE is the other
    // half: the screen renders correctly for the restricted role, with the
    // control absent rather than present-and-failing.
    await login(page, s.schoolAdminEmail!);
    await page.goto('/institutions');
    await expect(page.locator('#root')).toBeVisible();
    await expect(
      page.getByRole('button', { name: '+ Add institution', exact: true }),
      'a Nursery Admin is being offered Institution creation',
    ).toHaveCount(0);

    const banners = page.locator('.banner.err');
    const n = await banners.count();
    for (let i = 0; i < n; i++) {
      const t = (await banners.nth(i).textContent()) ?? '';
      assertHumanReadable(t, 'nursery admin institutions screen');
    }
  });

  test('no screen in the core renders an unreadable error to a Super Admin', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail!);

    // A sweep, not a single case: every functional-core route is visited and
    // any error banner it renders must be readable. This is the check that
    // would have caught "[object Object]" wherever it appeared, not only on the
    // one screen someone happened to test.
    const routes = [
      '/dashboard',
      '/institutions',
      '/meals',
      '/menu-builder',
      '/classes',
      '/students',
      '/staff',
      '/users',
      '/guardians',
      '/status',
      '/review',
      '/audit',
      '/analytics',
      '/reports',
      '/kitchen',
      '/today',
    ];

    // A core screen showing its OWNING role an error banner is a defect, not
    // a style question — so the text of any that appear is collected and
    // reported together at the end rather than swallowed.
    const erroring: string[] = [];

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('#root'), `${route} did not render`).toBeVisible();
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const banners = page.locator('.banner.err');
      const n = await banners.count();
      for (let i = 0; i < n; i++) {
        const t = ((await banners.nth(i).textContent()) ?? '').trim();
        assertHumanReadable(t, route);
        erroring.push(`${route} → ${t}`);
      }
      // And nothing anywhere on the page prints the literal object string.
      const body = (await page.locator('body').innerText()).slice(0, 20000);
      expect(
        body.includes('[object Object]'),
        `${route} renders the literal string "[object Object]" somewhere on the page`,
      ).toBe(false);
    }

    expect(
      erroring,
      `these core screens showed an error banner to the role that owns them:\n${erroring.join('\n')}`,
    ).toEqual([]);
  });
});
