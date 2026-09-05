import { expect, test } from 'playwright/test';
import { PASS, SEL, adminDb, e2eReady, login, seeded } from './fixtures';

/**
 * THE LIFECYCLE ACTIONS, DRIVEN BY A PERSON.
 *
 * Migrations 0044/0045 put deactivation, archival, guardian revocation and
 * password issuance into the database, and verify_lifecycle_security proves
 * they hold there against a live token. That is the security question, and it
 * is answered. This file answers the other one: can the human who is supposed
 * to do these things actually do them, through the product, and does the
 * product tell them the truth about what happened?
 *
 * DISPOSABLE FIXTURES ONLY. Every account, class and child touched here is
 * created by this file, used, and cleaned up afterwards. Nothing shared is
 * deactivated, archived or unlinked — a test that proves a lifecycle by
 * breaking the fixtures every other spec depends on has proved nothing except
 * that it should not have run.
 */

const stamp = Date.now();
const DISPOSABLE_EMAIL = `e2e.lifecycle.${stamp}@lunchbox.app`;
const DISPOSABLE_NAME = `Lifecycle Fixture ${stamp}`;
const REISSUED_PASS = `Reissued-${stamp}!ab`;
const SELF_CHOSEN_PASS = `SelfChosen-${stamp}!ab`;
const DISPOSABLE_CLASS = `E2E Disposable ${stamp}`;

test.describe('account lifecycle through the interface', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(120_000);
  test.describe.configure({ mode: 'serial' });

  test.afterAll(async () => {
    const db = adminDb();
    const { data } = await db
      .from('app_users')
      .select('user_id')
      .eq('email', DISPOSABLE_EMAIL)
      .maybeSingle();
    if (data?.user_id) {
      await db.from('app_users').delete().eq('user_id', data.user_id);
      await db.auth.admin.deleteUser(data.user_id as string);
    }
    await db.from('classes').delete().eq('name', DISPOSABLE_CLASS);
  });

  test('a Super Admin creates an account, and it works immediately', async ({ page }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/users');
    await page.getByRole('button', { name: '+ Create account', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill(DISPOSABLE_NAME);
    await page.getByLabel('Email', { exact: true }).fill(DISPOSABLE_EMAIL);
    await page.getByLabel('Password (min 8)', { exact: true }).fill(PASS);
    await page.getByLabel('Role', { exact: true }).selectOption('parent');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    const row = page.locator('tr', { hasText: DISPOSABLE_EMAIL });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText('Active');
  });

  test('the password box can be revealed before it is sent', async ({ page }) => {
    // An administrator TYPES a password here and then has to read it back to
    // the person it belongs to. A permanently masked field is a transcription
    // error waiting to happen, not a security control — nothing stored is ever
    // revealed by this, because nothing stored is retrievable.
    await login(page, seeded().superAdminEmail);
    await page.goto('/users');
    await page.getByRole('button', { name: '+ Create account', exact: true }).click();
    const field = page.getByLabel('Password (min 8)', { exact: true });
    await field.fill('visible-check');
    await expect(field).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(field).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(field).toHaveAttribute('type', 'password');
  });

  test('email and role are not editable, and the screen says why', async ({ page }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/users');
    const row = page.locator('tr', { hasText: DISPOSABLE_EMAIL });
    await row.getByRole('button', { name: 'Edit', exact: true }).click();

    const emailField = page.getByLabel('Email (sign-in identity)', { exact: true });
    await expect(emailField).toBeDisabled();
    // The dialog must EXPLAIN the immutability rather than leaving a greyed
    // box with no reason. Match the sentence the screen actually carries.
    await expect(page.locator('.modal')).toContainText('what this person signs in with');
    await expect(page.locator('.modal')).toContainText('Role and scope are not editable');
    // The name IS editable — that is the point of having the dialog at all.
    await page.getByLabel('Full name', { exact: true }).fill(`${DISPOSABLE_NAME} (corrected)`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('tr', { hasText: DISPOSABLE_EMAIL })).toContainText('(corrected)');
  });

  test('deactivating stops the sign-in and deletes nothing', async ({ page, browser }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/users');
    const row = page.locator('tr', { hasText: DISPOSABLE_EMAIL });
    await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await page.getByLabel(/Reason/).fill('left the nursery — e2e');
    await page.locator('.modal').getByRole('button', { name: 'Deactivate', exact: true }).click();

    await expect(page.locator('tr', { hasText: DISPOSABLE_EMAIL })).toContainText('Deactivated', {
      timeout: 20_000,
    });

    // NOT DELETED. The row is still the row, with its history intact.
    const { data } = await adminDb()
      .from('app_users')
      .select('active, deactivated_reason')
      .eq('email', DISPOSABLE_EMAIL)
      .single();
    expect(data!.active).toBe(false);
    expect(data!.deactivated_reason).toContain('left the nursery');

    // And they cannot get in. A fresh browser context so nothing is inherited.
    const fresh = await browser.newContext();
    const theirPage = await fresh.newPage();
    await theirPage.goto('/login');
    await theirPage.locator(SEL.email).fill(DISPOSABLE_EMAIL);
    await theirPage.locator(SEL.password).fill(PASS);
    await theirPage.getByRole('button', { name: /enter the platform/i }).click();
    // Either the sign-in is refused outright (the Auth account is banned) or a
    // session is issued and the application refuses it. Both are correct; what
    // must never happen is landing inside the product.
    await expect
      .poll(async () => new URL(theirPage.url()).pathname, { timeout: 20_000 })
      .toMatch(/^\/(login|)$/);
    await expect(theirPage.locator('body')).not.toContainText('Command center');
    await fresh.close();
  });

  test('the last active Super Admin cannot be deactivated, and is told why', async ({ page }) => {
    // Proven exhaustively in SQL; proven here to REACH the person. A refusal
    // that only exists in a database error message is not a refusal a Super
    // Admin can act on.
    await login(page, seeded().superAdminEmail);
    await page.goto('/users');
    const me = page.locator('tr', { hasText: seeded().superAdminEmail });
    await me.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Deactivate', exact: true }).click();

    // The dialog stays open and shows the reason, rather than closing on a
    // silent failure or quietly doing something else instead.
    await expect(page.locator('.modal .banner.err')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.modal')).toContainText(/cannot|may not|yourself/i);
    // And nothing changed.
    const { data } = await adminDb()
      .from('app_users')
      .select('active')
      .eq('email', seeded().superAdminEmail)
      .single();
    expect(data!.active).toBe(true);
  });

  test('reactivating lets them back in, with the same password', async ({ page, browser }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/users');
    const row = page.locator('tr', { hasText: DISPOSABLE_EMAIL });
    await row.getByRole('button', { name: 'Reactivate', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Reactivate', exact: true }).click();
    await expect(page.locator('tr', { hasText: DISPOSABLE_EMAIL })).toContainText('Active', {
      timeout: 20_000,
    });

    const fresh = await browser.newContext();
    const theirPage = await fresh.newPage();
    await login(theirPage, DISPOSABLE_EMAIL);
    await expect(theirPage).toHaveURL(/\/parent/);
    await fresh.close();
  });

  test('an administrator issues a new password, and the old one stops working', async ({
    page,
    browser,
  }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/users');
    const row = page.locator('tr', { hasText: DISPOSABLE_EMAIL });
    await row.getByRole('button', { name: 'Set password', exact: true }).click();
    await expect(page.locator('.modal')).toContainText('cannot be looked up');
    await page.getByLabel('New password (min 8)', { exact: true }).fill(REISSUED_PASS);
    await page.getByLabel(/Reason/).fill('forgot it — e2e');
    await page.locator('.modal').getByRole('button', { name: 'Set password', exact: true }).click();
    await expect(page.locator('.banner.ok')).toBeVisible({ timeout: 20_000 });

    // The audit records THAT it happened, and carries no password material.
    const { data: audit } = await adminDb()
      .from('audit_log')
      .select('action, new_value, reason')
      .eq('action', 'user.password_reset')
      .order('occurred_at', { ascending: false })
      .limit(1);
    expect(audit![0]!.reason).toContain('forgot it');
    const recorded = JSON.stringify(audit![0]);
    expect(recorded).not.toContain(REISSUED_PASS);
    expect(recorded).not.toContain(PASS);

    // The new password works.
    const fresh = await browser.newContext();
    const theirPage = await fresh.newPage();
    await theirPage.goto('/login');
    await theirPage.locator(SEL.email).fill(DISPOSABLE_EMAIL);
    await theirPage.locator(SEL.password).fill(REISSUED_PASS);
    await theirPage.getByRole('button', { name: /enter the platform/i }).click();
    await theirPage.waitForURL((u) => u.pathname.startsWith('/parent'), { timeout: 20_000 });

    // And the old one does not.
    const stale = await browser.newContext();
    const stalePage = await stale.newPage();
    await stalePage.goto('/login');
    await stalePage.locator(SEL.email).fill(DISPOSABLE_EMAIL);
    await stalePage.locator(SEL.password).fill(PASS);
    await stalePage.getByRole('button', { name: /enter the platform/i }).click();
    await expect(stalePage.locator('.auth-error')).toBeVisible({ timeout: 20_000 });
    await fresh.close();
    await stale.close();
  });

  test('a Parent changes their own password from their own profile', async ({ browser }) => {
    // The thing that did not exist at all: every account was stuck on whatever
    // an administrator first typed for them.
    //
    // THIS PARENT HAS NO CHILD LINKED, deliberately. The Parent shell used to
    // render the "no children are linked" empty state and nothing else — no
    // navigation, no route — so an account in exactly this state could not
    // reach its own profile, could not change its password, and could not even
    // sign out, because the sign-out control lives there. Run 32641054574
    // failed here and the defect was the product's, not the test's.
    const ctx = await browser.newContext();
    const theirPage = await ctx.newPage();
    await theirPage.goto('/login');
    await theirPage.locator(SEL.email).fill(DISPOSABLE_EMAIL);
    await theirPage.locator(SEL.password).fill(REISSUED_PASS);
    await theirPage.getByRole('button', { name: /enter the platform/i }).click();
    await theirPage.waitForURL((u) => u.pathname.startsWith('/parent'), { timeout: 20_000 });

    // The empty state is still shown — it is true — but it is not the whole
    // screen any more.
    await expect(theirPage.getByText(/No children are linked/)).toBeVisible();
    await expect(
      theirPage.getByRole('button', { name: 'Sign out', exact: true }),
      'a Parent with no linked child had no way to sign out',
    ).toBeVisible();

    await theirPage.goto('/parent/profile');
    await theirPage.getByLabel('New password (min 8)', { exact: true }).fill(SELF_CHOSEN_PASS);
    await theirPage.getByLabel('Repeat it', { exact: true }).fill(SELF_CHOSEN_PASS);
    await theirPage.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(theirPage.locator('.banner.ok')).toBeVisible({ timeout: 20_000 });
    await ctx.close();

    const after = await browser.newContext();
    const againPage = await after.newPage();
    await againPage.goto('/login');
    await againPage.locator(SEL.email).fill(DISPOSABLE_EMAIL);
    await againPage.locator(SEL.password).fill(SELF_CHOSEN_PASS);
    await againPage.getByRole('button', { name: /enter the platform/i }).click();
    await againPage.waitForURL((u) => u.pathname.startsWith('/parent'), { timeout: 20_000 });
    await after.close();
  });
});

test.describe('class and student lifecycle through the interface', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(120_000);
  test.describe.configure({ mode: 'serial' });

  test.afterAll(async () => {
    await adminDb().from('classes').delete().eq('name', DISPOSABLE_CLASS);
  });

  test('archiving a class that still holds children is refused, in words', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto(`/classes?institution=${s.institutionId}`);
    // The seeded class has the whole fixture roster and its staff in it.
    const seededRow = page.locator('tr', { hasText: 'E2E 1-A' }).first();
    await seededRow.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.locator('.modal .banner.err')).toBeVisible({ timeout: 20_000 });
    // The refusal names what is in the way rather than failing anonymously.
    await expect(page.locator('.modal .banner.err')).toContainText(/student|staff/i);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('an empty class archives, and stops accepting children', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto(`/classes?institution=${s.institutionId}`);
    await page.getByRole('button', { name: '+ Create class', exact: true }).click();
    await page.getByLabel('Class name', { exact: true }).fill(DISPOSABLE_CLASS);
    await page.locator('.modal').getByRole('button', { name: 'Create class', exact: true }).click();

    const row = page.locator('tr', { hasText: DISPOSABLE_CLASS });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByLabel(/Reason/).fill('closed — e2e');
    await page.locator('.modal').getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.locator('.banner.ok')).toBeVisible({ timeout: 20_000 });

    const { data } = await adminDb()
      .from('classes')
      .select('active, archived_reason')
      .eq('name', DISPOSABLE_CLASS)
      .single();
    expect(data!.active).toBe(false);
    expect(data!.archived_reason).toContain('closed');

    // It is no longer offered as somewhere to put a child. Target the class
    // filter by what it contains, not by position — the institution filter
    // sits before it for a Super Admin and after nothing for anyone else.
    await page.goto('/students');
    await expect(page.locator('#root')).toBeVisible();
    const classFilter = page.locator('select', { hasText: 'All classes' }).first();
    await expect(classFilter).toBeVisible({ timeout: 20_000 });
    const options = await classFilter.locator('option').allTextContents();
    expect(
      options.join(' '),
      'an archived class was still offered as somewhere to put a child',
    ).not.toContain(DISPOSABLE_CLASS);
  });

  test("a child's own details can be corrected where the child is", async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto(`/students/${s.statusKid}`);
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();

    const corrected = `Corrected${stamp % 10000}`;
    await page.getByLabel('Given name', { exact: true }).fill(corrected);
    await page.locator('.modal').getByRole('button', { name: 'Save', exact: true }).click();

    await expect
      .poll(
        async () => {
          const { data } = await adminDb()
            .from('students')
            .select('given_name')
            .eq('id', s.statusKid)
            .single();
          return data?.given_name ?? '';
        },
        { message: 'the corrected given name never reached the record' },
      )
      .toBe(corrected);
  });
});

test.describe('guardian access is ended deliberately, or not at all', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('ending access demands a reason before it can be done', async ({ page }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/guardians');
    const first = page.locator('tbody tr').first();
    await first.getByRole('button', { name: 'End access', exact: true }).click();

    const confirm = page.locator('.modal').getByRole('button', { name: 'End access', exact: true });
    await expect(
      confirm,
      'ending a guardian relationship was possible with no reason recorded',
    ).toBeDisabled();
    await expect(page.locator('.modal')).toContainText('recorded anonymously');
    await page.getByLabel(/Reason/).fill('a reason');
    await expect(confirm).toBeEnabled();
    // Deliberately NOT clicked: this would unlink a family the parent-portal
    // specs depend on. The revocation itself is proven at the database in
    // verify_lifecycle_security (g4/g5); what is proven here is that the
    // product will not let it happen by accident.
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('an Institution Admin is not offered the action at all', async ({ page }) => {
    await login(page, seeded().schoolAdminEmail);
    await page.goto('/guardians');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByRole('button', { name: 'End access', exact: true })).toHaveCount(0);
  });
});

test.describe('an Institution Admin holds the same authority, on the screen they can reach', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(120_000);

  test('Staff offers the account actions that Users & roles would not', async ({ page }) => {
    // app_may_manage_account() has always let a Nursery Admin deactivate,
    // rename and re-password THEIR OWN classroom staff. Nothing served it:
    // Users & roles is Super-Admin-only, so an Institution Admin held the
    // authority in the database with no way to use it. This asserts the way.
    await login(page, seeded().schoolAdminEmail);
    await page.goto('/staff');
    await expect(page.locator('#root')).toBeVisible();

    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Set password', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible();

    // And the dialog tells the truth about what cannot be looked up.
    await row.getByRole('button', { name: 'Set password', exact: true }).click();
    await expect(page.locator('.modal')).toContainText('cannot be looked up');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('and still cannot reach the platform-wide account screen', async ({ page }) => {
    await login(page, seeded().schoolAdminEmail);
    await page.goto('/users');
    // Bounced to their own first page — the authority is over their own staff,
    // not over every account on the platform.
    await expect.poll(async () => new URL(page.url()).pathname).not.toBe('/users');
  });
});
