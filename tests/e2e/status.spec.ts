import { expect, test } from 'playwright/test';
import { adminDb, e2eReady, login, seeded } from './fixtures';

/**
 * Operational eligibility workflow (docs/05 §7-9, AT-010/011/012):
 * Super Admin sets ACTIVE_BILLABLE_TO_NURSERY; the student becomes eligible,
 * kitchen demand reflects the count, and the change is audit-logged.
 */
test.describe('operational status workflow', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('super admin sets eligible status and it lands in audit', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto('/status');

    // Level 1: the Layout repeats the page title as a topbar <h2>, so an
    // unqualified heading lookup matches two elements and fails strict mode.
    await expect(page.getByRole('heading', { level: 1, name: /Status/ })).toBeVisible();

    const row = page.locator('tr', { hasText: 'E2E-001' });
    await expect(row).toContainText('Not operationally eligible');

    await row.getByRole('button', { name: /Mark billable/i }).click();

    await expect(row).toContainText('Active — billable to nursery');

    // DB reflects it
    const { data } = await adminDb()
      .from('students')
      .select('operational_status')
      .eq('id', s.statusKid);
    expect(data![0].operational_status).toBe('ACTIVE_BILLABLE_TO_NURSERY');

    // audit captured it (docs/08 §18, AT-110 shape)
    const { data: audit } = await adminDb()
      .from('audit_log')
      .select('action, entity_type, entity_id, new_value')
      .eq('entity_type', 'students')
      .eq('entity_id', s.statusKid)
      .order('occurred_at', { ascending: false })
      .limit(1);
    expect(audit![0].action).toBe('update');
    expect(audit![0].new_value.operational_status).toBe('ACTIVE_BILLABLE_TO_NURSERY');
  });

  test('kitchen production demand is per published meal for eligible students (AT-010/§34)', async ({
    page,
  }) => {
    const s = seeded();
    await login(page, s.kitchenEmail);
    await page.goto('/kitchen');
    await expect(
      page.getByRole('heading', { level: 1, name: /Kitchen production/ }),
    ).toBeVisible();

    // Demand is per published MEAL (not a single per-institution number). Today
    // the nursery serves E2E overnight oats (breakfast) and E2E wrap (lunch);
    // both meals appear in the make list, attributed to the nursery.
    await expect(page.getByText('E2E overnight oats')).toBeVisible();
    await expect(page.getByText('E2E wrap')).toBeVisible();
    await expect(page.getByText(/E2E Nursery/).first()).toBeVisible();
  });

  test('classroom staff cannot reach the status admin screen (AT-012 scope)', async ({ page }) => {
    const s = seeded();
    await login(page, s.classroomEmail);
    await page.goto('/status');
    await expect(page).toHaveURL(/\/today/);
  });
});
