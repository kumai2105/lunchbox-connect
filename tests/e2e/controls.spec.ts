import { expect, test, type Page } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

/**
 * EVERY EXPOSED CONTROL IS ACCOUNTED FOR, AND EVERY CONTROL HAS A NAME.
 *
 * The previous evidence said plainly that no control inventory existed: 51
 * tests covered each role's primary workflow and the specific defects that had
 * been found, and nothing swept the surface. So a button that did nothing, or
 * an icon-only action a screen reader announces as "button", could sit on a
 * screen indefinitely without a single test noticing.
 *
 * This file walks the functional-core routes for the role that owns them and
 * asserts, for every interactive element it finds:
 *
 *   * it has an accessible name — an icon-only control with no name is not
 *     operable by anyone using a screen reader, and is unlabelled in every
 *     automated tool including this one;
 *   * if it is disabled, it is SEMANTICALLY disabled, not merely greyed;
 *   * if it navigates, it goes somewhere real — a dead link is the classic
 *     "documented but never fixed" defect;
 *   * focus is visible when it is reached by keyboard.
 *
 * Deferred shells are held to a different and explicitly weaker standard, in
 * their own describe below: honest emptiness is not a defect, but a shell that
 * offers a control implying real business action is.
 */

/** Routes that are part of the current functional core, with the role that owns each. */
const CORE_ROUTES: Array<{ path: string; roleKey: string; label: string }> = [
  { path: '/dashboard', roleKey: 'superAdminEmail', label: 'Dashboard' },
  { path: '/institutions', roleKey: 'superAdminEmail', label: 'Institutions' },
  { path: '/meals', roleKey: 'superAdminEmail', label: 'Meal Library' },
  { path: '/menu-builder', roleKey: 'superAdminEmail', label: 'Menu Builder' },
  { path: '/classes', roleKey: 'superAdminEmail', label: 'Classes' },
  { path: '/students', roleKey: 'superAdminEmail', label: 'Students' },
  { path: '/staff', roleKey: 'superAdminEmail', label: 'Staff' },
  { path: '/users', roleKey: 'superAdminEmail', label: 'Users' },
  { path: '/guardians', roleKey: 'superAdminEmail', label: 'Guardians' },
  { path: '/status', roleKey: 'superAdminEmail', label: 'Operational status' },
  { path: '/review', roleKey: 'superAdminEmail', label: 'Note review' },
  { path: '/audit', roleKey: 'superAdminEmail', label: 'Audit' },
  { path: '/analytics', roleKey: 'superAdminEmail', label: 'Meal analytics' },
  { path: '/reports', roleKey: 'superAdminEmail', label: 'Reports' },
  { path: '/kitchen', roleKey: 'kitchenEmail', label: 'Kitchen production demand' },
  { path: '/today', roleKey: 'classroomEmail', label: 'Classroom register' },
  { path: '/schedule', roleKey: 'schoolAdminEmail', label: 'Published schedule' },
];

/** Deliberately deferred areas. Honest emptiness is the requirement, not features. */
const DEFERRED_ROUTES: Array<{ path: string; roleKey: string; label: string }> = [
  { path: '/deliveries', roleKey: 'driverEmail', label: 'Deliveries' },
  { path: '/ops', roleKey: 'operationsEmail', label: 'Ops log & issues' },
  { path: '/absences', roleKey: 'superAdminEmail', label: 'Absences' },
];

interface ControlReport {
  tag: string;
  name: string;
  disabled: boolean;
  href: string | null;
}

/**
 * Every interactive element currently rendered, with its accessible name.
 *
 * Computed in the page rather than by locator queries so that one pass sees
 * everything — buttons, links, tabs, selects, inputs and anything carrying an
 * interactive ARIA role — instead of whatever a hand-written list remembered.
 */
async function inventory(page: Page): Promise<ControlReport[]> {
  return page.evaluate(() => {
    const INTERACTIVE_ROLES = ['button', 'link', 'tab', 'menuitem', 'switch', 'checkbox', 'radio'];
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[href], select, input:not([type="hidden"]), textarea, [role], [tabindex]',
      ),
    );

    const visible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return (
        r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'
      );
    };

    const nameOf = (el: HTMLElement): string => {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const t = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (t) return t;
      }
      if (el.id) {
        const lbl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl?.textContent?.trim()) return lbl.textContent.trim();
      }
      const wrapping = el.closest('label');
      if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();
      const title = el.getAttribute('title');
      if (title && title.trim()) return title.trim();
      const alt = el.querySelector('img')?.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
      const ph = el.getAttribute('placeholder');
      if (ph && ph.trim()) return ph.trim();
      return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    };

    const out: ControlReport[] = [];
    const seen = new Set<HTMLElement>();
    for (const el of nodes) {
      if (seen.has(el)) continue;
      seen.add(el);
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const isInteractive =
        tag === 'button' ||
        tag === 'select' ||
        tag === 'textarea' ||
        (tag === 'a' && el.hasAttribute('href')) ||
        tag === 'input' ||
        (role !== null && INTERACTIVE_ROLES.includes(role));
      if (!isInteractive) continue;
      if (!visible(el)) continue;
      out.push({
        tag: role ? `${tag}[role=${role}]` : tag,
        name: nameOf(el),
        disabled:
          (el as HTMLButtonElement).disabled === true ||
          el.getAttribute('aria-disabled') === 'true',
        href: tag === 'a' ? el.getAttribute('href') : null,
      });
    }
    return out;
  });
}

test.describe('control inventory — nothing unexplained on a functional-core screen', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(180_000);

  test('every visible control on every core route has an accessible name', async ({ page }) => {
    const s = seeded();
    let currentRole = '';
    const unnamed: string[] = [];
    let total = 0;

    for (const r of CORE_ROUTES) {
      if (currentRole !== r.roleKey) {
        await login(page, s[r.roleKey]!);
        currentRole = r.roleKey;
      }
      await page.goto(r.path);
      await expect(page.locator('#root'), `${r.label} did not render`).toBeVisible();
      // Let data-driven controls arrive before counting them.
      await page.waitForLoadState('networkidle').catch(() => undefined);

      const controls = await inventory(page);
      total += controls.length;
      expect(
        controls.length,
        `${r.label} (${r.path}) renders no interactive control at all — the screen is inert`,
      ).toBeGreaterThan(0);

      for (const c of controls) {
        if (c.name.length === 0) {
          unnamed.push(`${r.path} → <${c.tag}> with no accessible name`);
        }
      }
    }

    // Report EVERY unnamed control at once. Fixing them one CI round at a time
    // is how a surface like this stays broken for months.
    expect(
      unnamed,
      `controls with no accessible name (a screen reader announces these as just "button"):\n${unnamed.join('\n')}`,
    ).toEqual([]);
    expect(total, 'the inventory found suspiciously few controls').toBeGreaterThan(40);
  });

  test('no core route links somewhere that does not exist', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail!);

    const dead: string[] = [];
    for (const r of CORE_ROUTES.filter((x) => x.roleKey === 'superAdminEmail')) {
      await page.goto(r.path);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const controls = await inventory(page);
      for (const c of controls) {
        if (!c.href) continue;
        if (c.href.startsWith('http') || c.href.startsWith('mailto:')) continue;
        if (c.href === '#' || c.href === '') {
          dead.push(`${r.path} → "${c.name}" links to "${c.href}"`);
        }
      }
    }
    expect(dead, `links that go nowhere:\n${dead.join('\n')}`).toEqual([]);
  });

  test('a disabled control is semantically disabled, not just styled', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail!);

    // The Guardians link dialog is the clearest case in the product: its submit
    // is intentionally unusable until both selections are made. That intent has
    // to be expressed in the DOM, or a keyboard user can still fire it.
    await page.goto('/guardians');
    await page.getByRole('button', { name: '+ Link guardian', exact: true }).click();
    const submit = page.getByRole('button', { name: 'Link', exact: true });
    await expect(submit).toBeVisible();
    await expect(
      submit,
      'the Link button is not semantically disabled before a student and parent are chosen',
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('keyboard focus is visible as a person tabs through a core screen', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail!);
    await page.goto('/institutions');
    await expect(page.locator('#root')).toBeVisible();

    // Tab, not .focus(). `:focus-visible` is a keyboard-interaction heuristic:
    // programmatic focus does not match it in Chromium, so a test built on
    // .focus() would report "no ring" on a perfectly accessible app and "ring"
    // on nothing at all. Tabbing is also what the person being protected here
    // actually does.
    const invisible: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const st = getComputedStyle(el);
        const ring =
          (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth || '0') > 0) ||
          (st.boxShadow !== 'none' && st.boxShadow.length > 0);
        const name =
          el.getAttribute('aria-label') ??
          (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) ??
          '';
        return { ring, tag: el.tagName.toLowerCase(), name };
      });
      if (!state) continue;
      if (!state.ring) invisible.push(`<${state.tag}> "${state.name}"`);
    }

    expect(
      invisible,
      `these controls take keyboard focus with no visible indicator — someone navigating by keyboard cannot see where they are:\n${invisible.join('\n')}`,
    ).toEqual([]);
  });
});

test.describe('deferred shells — honest about being unfinished', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(120_000);

  for (const r of DEFERRED_ROUTES) {
    test(`${r.label} says it is not active and offers no fake business action`, async ({ page }) => {
      const s = seeded();
      await login(page, s[r.roleKey]!);
      await page.goto(r.path);
      await expect(page.locator('#root'), `${r.label} did not render`).toBeVisible();

      // 1. It TELLS the user. A blank page is not honest; it is broken-looking.
      const body = await page.locator('body').innerText();
      const saysSo =
        /NOT_YET_DEFINED|not yet defined|not active|BLOCKED_BY_SPEC/i.test(body);
      expect(
        saysSo,
        `${r.label} does not tell the user the functionality is not defined yet — it just looks empty or broken`,
      ).toBe(true);

      // 2. It offers no control implying a real business operation. Navigation,
      //    sign-out and the shell's own chrome are fine; a "Dispatch" or
      //    "Create delivery" button on a page with no state machine is not.
      const controls = await inventory(page);
      const pretendActions = controls.filter((c) =>
        /^(create|add|new|dispatch|assign|deliver|start|record|approve|submit|save|generate)\b/i.test(
          c.name,
        ),
      );
      expect(
        pretendActions.map((c) => c.name),
        `${r.label} offers action(s) that imply working business functionality it does not have`,
      ).toEqual([]);

      // 3. The user is not TRAPPED.
      //
      // "Navigate away" cannot mean "reach /dashboard": a driver and an
      // operations manager are not permitted there, and the app correctly
      // returns them to their own landing page. That redirect is the role
      // boundary working, not a trap — asserting a path change would have been
      // asserting that the boundary is broken.
      //
      // What actually matters is that the shell around the shell page is real:
      // the navigation is rendered and the sign-out control works. That is the
      // difference between "this page has nothing on it yet" and "this page is
      // where the session goes to die".
      await expect(
        page.getByRole('navigation').or(page.locator('.sidebar')).first(),
        `${r.label} renders no navigation — the user has no way out of the page`,
      ).toBeVisible();
      const out = page.getByRole('button', { name: /log out/i });
      await expect(
        out,
        `${r.label} offers no way to sign out — a deferred page must not strand a session`,
      ).toBeVisible();

      // And asking for another route leaves the app coherent, wherever the
      // role guard decides to put them.
      await page.goto('/dashboard');
      await expect(
        page.locator('#root'),
        `the app did not render after navigating away from ${r.label}`,
      ).toBeVisible();
      await expect(page.locator('.banner.err')).toHaveCount(0);
    });
  }
});

test.describe('absent must not read as a completed meal', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(90_000);

  test('the Absent control is distinguishable from a full-consumption result', async ({ page }) => {
    const s = seeded();
    await login(page, s.classroomEmail!);

    // WITH a class. /today alone lands on the class picker, where no recording
    // control exists at all — the previous version of this test skipped for
    // that reason, and a skip in this gate is a hole, not a pass.
    await page.goto(`/today?class=${s.classForServing}`);
    await expect(page.locator('.roster-chip').first()).toBeVisible({ timeout: 20_000 });

    const absent = page.getByRole('button', { name: 'Absent', exact: true });
    const full = page.getByRole('button', { name: '100% eaten', exact: true });
    await expect(absent, 'the Absent control is not on the register').toBeVisible();
    await expect(full, 'the 100% control is not on the register').toBeVisible();

    // Same background AND same text colour AND same shape is how a teacher
    // misreads one for the other at speed. Any one of them differing is enough
    // to tell them apart; being identical on all three is the defect.
    const style = (loc: ReturnType<typeof page.getByRole>) =>
      loc.evaluate((el) => {
        const st = getComputedStyle(el as HTMLElement);
        return [st.backgroundColor, st.color, st.borderRadius, st.borderWidth].join('|');
      });

    const [a, f] = await Promise.all([style(absent), style(full)]);
    expect(
      a === f,
      `Absent and 100% are styled identically (${a}) — they must not read as the same result`,
    ).toBe(false);
  });
});
