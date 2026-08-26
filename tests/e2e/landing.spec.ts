import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded, settled } from './fixtures';

/**
 * THE PUBLIC HOMEPAGE MUST NOT COST ANYONE THEIR PRODUCT.
 *
 * Adding a public page at `/` touches the one route every signed-in person
 * passes through: LoginPage navigates to `/` and Home resolves the role from
 * there. Get that wrong and a Super Admin lands on a marketing page instead of
 * the Command Center — which is exactly the class of bug that once sent every
 * role to /parent, because "role not loaded yet" was read as "is a parent".
 *
 * So these tests are mostly about what did NOT change: sign-in still works,
 * every role still reaches its own first page, and a protected URL still sends
 * an anonymous visitor to /login rather than to an advertisement.
 */

test.describe('public homepage', () => {
  test.describe('anonymous', () => {
    // No Supabase needed: the page reads nothing. These run even when the
    // seeded project is absent, because they are the checks that matter most
    // for a public URL.
    test('/ renders the public homepage, not the sign-in form', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Every child’s meal.',
      );
      await expect(page).toHaveURL(/\/$/);
      // The real sign-in form belongs to /login and must not be duplicated here.
      await expect(page.locator('input[autocomplete="current-password"]')).toHaveCount(0);
    });

    test('every audience has a visible place on the page', async ({ page }) => {
      await page.goto('/');
      for (const audience of [
        'For Institutions',
        'For Operations',
        'For Classroom teams',
        'For Parents',
      ]) {
        await expect(page.getByText(audience, { exact: true }).first()).toBeVisible();
      }
      // Parents get a section of their own, not a single card.
      await expect(
        page.getByRole('heading', {
          name: /Parents should see the part of the journey that belongs to their child/i,
        }),
      ).toBeVisible();
    });

    test('each UAE figure is shown with its source and year', async ({ page }) => {
      await page.goto('/');
      const strip = page.locator('.lp-stats');
      await expect(strip.getByText('331')).toBeVisible();
      await expect(strip.getByText('Dubai, KHDA 2025–26').first()).toBeVisible();
      await expect(strip.getByText('456')).toBeVisible();
      await expect(strip.getByText('Dubai Municipality, 2025')).toBeVisible();
      await expect(
        page.getByText(/do not indicate endorsement, partnership or certification/i),
      ).toBeVisible();
    });

    test('Client login goes to the real sign-in page', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: 'Client login', exact: true }).first().click();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
      await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
      // /login is the existing form and gains nothing invented.
      await expect(page.getByText(/sign up|create account|book a demo/i)).toHaveCount(0);
    });

    test('a protected URL still sends an anonymous visitor to /login', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
      await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
    });

    test('an unknown URL still sends an anonymous visitor to /login', async ({ page }) => {
      // The catch-all must not answer every wrong address with marketing.
      await page.goto('/not-a-real-page');
      await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    });

    test('no horizontal overflow at 390px', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      // And the way in is still reachable on a phone.
      await expect(page.getByRole('link', { name: 'Client login', exact: true }).first()).toBeVisible();
    });

    test('no horizontal overflow at 820px or 1440px', async ({ page }) => {
      for (const size of [
        { width: 820, height: 1180 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(size);
        await page.goto('/');
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `overflow at ${size.width}px`).toBeLessThanOrEqual(0);
      }
    });

    test('the header actions are reachable from the keyboard', async ({ page }) => {
      await page.goto('/');
      const reached: string[] = [];
      // Walk the first handful of stops; the header is at the top of the order.
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        const label = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el ? (el.textContent ?? '').trim() : '';
        });
        if (label) reached.push(label);
      }
      const joined = reached.join(' | ');
      expect(joined).toContain('Client login');
      expect(joined).toContain('Talk to us');
    });
  });

  test.describe('signed in', () => {
    test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

    test('a Super Admin still lands on their own first page, not the homepage', async ({
      page,
    }) => {
      // The exact regression the anonymous branch could have caused: LoginPage
      // navigates to '/', and '/' is now also the public page.
      await login(page, seeded().superAdminEmail);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).not.toContainText(
        'Every child’s meal.',
      );
    });

    test('a Parent still lands in the Parent portal', async ({ page }) => {
      await login(page, seeded().parentEmail);
      await expect(page).toHaveURL(/\/parent/, { timeout: 15_000 });
      await settled(page);
    });

    test('returning to / while signed in never shows the public homepage', async ({ page }) => {
      await login(page, seeded().kitchenEmail);
      await expect(page).toHaveURL(/\/kitchen/, { timeout: 15_000 });
      await page.goto('/');
      await expect(page).toHaveURL(/\/kitchen/, { timeout: 15_000 });
      await expect(page.locator('.lp-hero')).toHaveCount(0);
    });
  });
});
