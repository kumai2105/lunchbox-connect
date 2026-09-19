import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from 'playwright/test';

export const PASS = process.env.E2E_PASSWORD ?? 'E2e-pass!12345';

// Readiness must match global-setup's: without the ANON key the browser bundle
// is not built against the seeded project, so the specs would drive a page
// talking to a placeholder host and fail for the wrong reason.
export const e2eReady = Boolean(
  process.env.E2E_SUPABASE_URL &&
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY &&
  process.env.E2E_SUPABASE_ANON_KEY,
);

// This package is `"type": "module"`, so `__dirname` does not exist at runtime.
// It USED to be referenced here, and it made every spec throw
// `ReferenceError: __dirname is not defined` the moment it called seeded().
// Nothing caught it: @types/node declares __dirname as a global, so typecheck
// was happy, and typescript-eslint turns off `no-undef`, so lint was too. Only
// executing the suite could find it — which is exactly what this gate is for.
// global-setup.ts always resolved its own directory correctly; this file must
// resolve to the SAME directory, because that is where it writes .seeded.json.
const HERE = path.dirname(fileURLToPath(import.meta.url));

export function seeded(): Record<string, string> {
  const file = path.join(HERE, '.seeded.json');
  if (!fs.existsSync(file)) throw new Error('.seeded.json missing — run global-setup first');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
}

export function adminDb() {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('E2E env incomplete');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Remove a disposable institution and everything a lived-through day left on it.
 *
 * `delete from institutions` on its own does NOT work once a day has been run,
 * and it fails SILENTLY through PostgREST: `delivery_manifests.institution_id`
 * is `on delete restrict`, so the delete is refused, the error lands in
 * `error` rather than throwing, and an unchecked teardown moves on. The
 * institution and its manifests survive into the next spec.
 *
 * That is not a tidiness problem. The Kitchen's Dispatch table lists every site
 * finalised for the date, so one spec's leftovers become another spec's second
 * row — which is exactly how spine.spec's "Assign a Driver before releasing"
 * assertion hit a strict-mode violation against a manifest belonging to a
 * institution that should no longer have existed.
 *
 * Children first, and through the restrict edges in order:
 * manifest lines cascade from manifests, production runs and special lines
 * cascade from final demand, and final_demand -> meal_services and
 * manifests -> institutions are both `restrict`.
 */
export async function removeInstitutionDay(
  db: ReturnType<typeof adminDb>,
  institutionIds: string[],
): Promise<void> {
  if (institutionIds.length === 0) return;

  const services = await db.from('meal_services').select('id').in('institution_id', institutionIds);
  const serviceIds = (services.data ?? []).map((r) => (r as { id: string }).id);

  await db.from('delivery_manifests').delete().in('institution_id', institutionIds);
  await db.from('operational_issues').delete().in('institution_id', institutionIds);
  if (serviceIds.length > 0) {
    await db.from('final_demand').delete().in('meal_service_id', serviceIds);
  }
  await db.from('delivery_receivers').delete().in('institution_id', institutionIds);
  await db.from('institution_delivery_configs').delete().in('institution_id', institutionIds);
  await db.from('institution_meal_plans').delete().in('institution_id', institutionIds);
  await db.from('institution_service_plans').delete().in('institution_id', institutionIds);

  const students = await db.from('students').select('id').in('institution_id', institutionIds);
  const studentIds = (students.data ?? []).map((r) => (r as { id: string }).id);
  if (studentIds.length > 0) {
    await db.from('special_meal_resolutions').delete().in('student_id', studentIds);
    await db.from('student_dietary_requirements').delete().in('student_id', studentIds);
    await db.from('student_meal_plans').delete().in('student_id', studentIds);
    await db.from('student_parents').delete().in('student_id', studentIds);
    await db.from('serving_records').delete().in('student_id', studentIds);
  }

  await db.from('students').delete().in('institution_id', institutionIds);
  await db.from('meal_services').delete().in('institution_id', institutionIds);
  await db.from('classes').delete().in('institution_id', institutionIds);

  // The institution's own people, BEFORE the institution.
  //
  // app_users.institution_id is `on delete set null`, so deleting the
  // institution first nulls every staff row that pointed at it — and
  // app_users_staff_needs_institution then rejects the result, because a
  // school_admin or classroom_staff with no institution is not a valid row.
  // The delete is refused, PostgREST returns the refusal in `error`, and the
  // institution survives. Removing the accounts first means there is nothing
  // for that trigger-shaped constraint to act on.
  //
  // serving_records.recorded_by is `not null references app_users` with no
  // on-delete clause, so any serving this staff member recorded has to go
  // first — which the student sweep above already did.
  const people = await db.from('app_users').delete().in('institution_id', institutionIds);
  if (people.error) {
    throw new Error(
      `[e2e] teardown could not remove this institution's accounts — ${people.error.message}. ` +
        `Something they authored still exists, and the institution cannot be removed ` +
        `while they point at it.`,
    );
  }

  // Checked, unlike every teardown before it. A refused delete here means the
  // list above has missed a reference, and a silent failure would hand the
  // consequences to whichever spec runs next.
  const gone = await db.from('institutions').delete().in('id', institutionIds);
  if (gone.error) {
    throw new Error(
      `[e2e] teardown could not remove disposable institution(s) — ${gone.error.message}. ` +
        `Something still references them, and leaving them behind changes what the ` +
        `next spec sees.`,
    );
  }
}

/**
 * Wait until a screen has finished its first fetch.
 *
 * Every page in this app renders <Spinner/> while its data is still null, so
 * the first paint already contains one. A bare .count() taken the instant
 * after goto() therefore reads zero of everything — and a loop guarded by that
 * count does nothing at all, silently. The failure then surfaces twenty lines
 * later, on the step that needed the work the loop was supposed to do.
 *
 * Waiting for the shell first is what makes the spinner check meaningful: by
 * the time the navigation is visible, React has painted, so a spinner is in
 * the DOM if this screen is still loading.
 */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('.nav, .parent-nav').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.spinner')).toHaveCount(0, { timeout: 30_000 });
}

/**
 * A PostgREST client signed in as a real person.
 *
 * `adminDb()` holds the service key, and service_role is NOT a user: `auth.uid()`
 * is null behind it, so `app_current_role()` resolves to null and every
 * `app_is_super_admin()` gate in the schema refuses. That is correct — the
 * service key exists to bypass RLS on TABLES, not to impersonate an
 * administrator — but it means a fixture cannot set up state by calling the
 * product's own gated RPCs through it. Attempts to do so raise, and because
 * PostgREST returns the error in `error` rather than throwing, the damage shows
 * up later as a null id somewhere else.
 *
 * This signs in with a seeded account instead, so fixture setup goes through
 * exactly the authorization the product goes through.
 */
export async function signedInDb(email: string) {
  const url = process.env.E2E_SUPABASE_URL;
  const anon = process.env.E2E_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('E2E env incomplete');
  const db = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`fixture: could not sign in as ${email} — ${error.message}`);
  return db;
}

// Every role lands on its own first page. Routes reflect the CURRENT app:
// no /menu (retired); kitchen → /kitchen, ops → /ops, reports → /reports.
// The Driver's landing route moved from the /deliveries shell to the real
// /my-deliveries screen when that screen stopped being a placeholder, so the
// operational-spine routes belong here too — otherwise login() waits out its
// whole timeout for any role whose first page this pattern does not know.
const FIRST_PAGE =
  /^\/(dashboard|today|parent|classes|staff|students|status|kitchen|reports|ops|deliveries|meals|menu-builder|analytics|users|institutions|meal-plans|dietary|operations|delivery|my-deliveries|handover)/;

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator(SEL.email).fill(email);
  await page.locator(SEL.password).fill(PASS);
  await page.getByRole('button', { name: /enter the platform/i }).click();

  // Match on the PATHNAME via a predicate, not on a bare RegExp.
  //
  // waitForURL() tests a RegExp against the WHOLE url — "http://127.0.0.1:4173/
  // dashboard" — so the `^\/` anchor above could never match one. This helper
  // used to pass FIRST_PAGE directly, and the wait therefore ran to the full
  // 60s test timeout on EVERY login, for every role, in every spec. With
  // retries that is roughly 81 minutes of dead waiting, so the job hit its cap
  // before it could report anything. A predicate over url.pathname keeps the
  // anchored intent and cannot be misread the same way.
  //
  // The explicit timeout matters too: a sign-in that has not landed in 15s has
  // failed, and waiting the remaining 45s only delays the report.
  try {
    await page.waitForURL((url) => FIRST_PAGE.test(url.pathname), { timeout: 15_000 });
  } catch {
    // Say what actually happened rather than "timeout exceeded". The login form
    // renders its own error, and that error is usually the real story.
    const shown = await page
      .locator('[role="alert"], .error, .form-error')
      .first()
      .textContent()
      .catch(() => null);
    throw new Error(
      `[e2e] login did not reach a first page for ${email}. ` +
        `Landed on ${page.url()}` +
        (shown ? `; the page said: ${shown.trim()}` : '; the page showed no error'),
    );
  }
}

export const SEL = {
  email: 'input[autocomplete="email"]',
  password: 'input[autocomplete="current-password"]',
  roleChip: '.side-foot .u-role',
};
