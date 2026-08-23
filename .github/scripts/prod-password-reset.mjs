// Production password-reset verification, driven through the live product.
//
// Lives in the repository rather than being written into /tmp by the workflow,
// because Node resolves ESM imports relative to the SCRIPT'S own directory —
// a script in /tmp looks for /tmp/node_modules and throws ERR_MODULE_NOT_FOUND
// before the browser ever launches. That cost prod-browser-auth a whole run.
//
// Everything it touches, it creates. It does not reset, rename, deactivate or
// otherwise disturb any of the ten simulation personas.

import { chromium } from 'playwright';

const APP = process.env.APP;
const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.ANON_KEY;
const A_EMAIL = process.env.A_EMAIL;
const A_PASS = process.env.A_PASS;

const SEL = {
  email: 'input[autocomplete="email"]',
  password: 'input[autocomplete="current-password"]',
};

const stamp = Date.now();
const DISPOSABLE_EMAIL = `zz.verify.${stamp}@lunchboxconnect.com`;
const DISPOSABLE_NAME = `ZZ VERIFY ${stamp}`;

// Random per run. Never logged.
const rnd = () =>
  'Vz' + [...crypto.getRandomValues(new Uint8Array(15))].map((b) => (b % 36).toString(36)).join('') + '!7A';
const PASS_OLD = rnd();
const PASS_NEW = rnd();

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) console.log(`::error title=${name}::${detail || 'assertion failed'}`);
}

async function signIn(page, email, password) {
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator(SEL.email).fill(email);
  await page.locator(SEL.password).fill(password);
  await page.getByRole('button', { name: /enter the platform/i }).click();
}

// Landing is a CLIENT-SIDE redirect: Home resolves the role and navigates on.
// Measuring page.url() at domcontentloaded reads the page load, not the guard,
// so wait for a settled path that is neither / nor /login.
async function waitForLanded(page, ms = 20000) {
  await page.waitForURL((u) => u.pathname !== '/' && u.pathname !== '/login', { timeout: ms });
  return new URL(page.url()).pathname;
}

/** The auth API is the same endpoint the app uses, with no cookies at all. */
async function apiSignIn(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.status;
}

const browser = await chromium.launch();
let created = false;
let cleanedUp = false;

try {
  // ---------------------------------------------------------------- 1. admin
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, A_EMAIL, A_PASS);
    const landed = await waitForLanded(page);
    record('admin signs in to production', true, `landed on ${landed}`);

    // ------------------------------------------------ 2. create a disposable
    await page.goto(`${APP}/users`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '+ Create account', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill(DISPOSABLE_NAME);
    await page.getByLabel('Email', { exact: true }).fill(DISPOSABLE_EMAIL);
    await page.getByLabel('Password (min 8)', { exact: true }).fill(PASS_OLD);
    // ROLE: classroom_staff.
    //
    // Only five roles are offered for provisioning at all. provisionableRoles()
    // keeps a role only if some nav entry is NOT `shell: true` — Decision 040,
    // "a role is offered for provisioning only when it has a screen" — which
    // excludes viewer, operations_manager, finance_owner and driver, whose one
    // nav entry each is still a placeholder.
    //
    // This was `viewer` for exactly one run, and the reasoning was wrong. I
    // argued viewer was safe because prod-browser-auth proves the viewer
    // persona signs in and lands correctly. True, and irrelevant: that is
    // evidence about an account that ALREADY EXISTS, not about whether one can
    // be CREATED. The dialog never offered the option and selectOption timed
    // out looking for it.
    //
    // Of the five, `parent` is the only one needing no second field — but a
    // guardian account exists so someone can see what their child is served,
    // so manufacturing one with nothing linked is not a fixture to create on
    // purpose. classroom_staff needs an institution and nothing else, and a
    // staff account that exists before it is assigned to any class is an
    // entirely ordinary thing rather than a contradiction.
    await page.getByLabel('Role', { exact: true }).selectOption('classroom_staff');

    // Institution: the first real option after the "Select…" placeholder. Read
    // from the live list rather than hard-coded, so this cannot go stale if the
    // institutions change.
    const inst = page.getByLabel(/^Institution/);
    await inst.selectOption({ index: 1 });
    const instName = await inst.locator('option:checked').innerText();
    console.log(`disposable staff account will be attached to: ${instName.trim()}`);

    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    const row = page.locator('tr', { hasText: DISPOSABLE_EMAIL });
    await row.waitFor({ state: 'visible', timeout: 30000 });
    created = true;
    record('disposable account created through the product', true, DISPOSABLE_EMAIL);
    await ctx.close();
  }

  // ------------------------------- 3. baseline: the OLD password really works
  {
    const status = await apiSignIn(DISPOSABLE_EMAIL, PASS_OLD);
    record(
      'baseline — the original password is accepted before the reset',
      status === 200,
      `auth API HTTP ${status}`,
    );
    if (status !== 200) throw new Error('baseline failed; the rest would prove nothing');
  }

  // --------------------------------------------- 4. reset it via Set password
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, A_EMAIL, A_PASS);
    await waitForLanded(page);
    await page.goto(`${APP}/users`, { waitUntil: 'domcontentloaded' });

    const row = page.locator('tr', { hasText: DISPOSABLE_EMAIL });
    await row.waitFor({ state: 'visible', timeout: 30000 });
    await row.getByRole('button', { name: 'Set password', exact: true }).click();
    await page.getByLabel('New password (min 8)', { exact: true }).fill(PASS_NEW);
    await page.getByLabel(/Reason/).fill('production verification — disposable fixture');
    await page.locator('.modal').getByRole('button', { name: 'Set password', exact: true }).click();

    // The dialog closes on success. If the Edge Function refused, it stays open
    // and shows the refusal — so surface that text rather than a bare timeout.
    try {
      await page.locator('.modal').waitFor({ state: 'detached', timeout: 30000 });
      record('Set password completed in the live product', true);
    } catch {
      const text = await page.locator('.modal').innerText().catch(() => '(modal unreadable)');
      record('Set password completed in the live product', false, text.replace(/\s+/g, ' ').slice(0, 300));
      throw new Error('the reset did not complete');
    }
    await ctx.close();
  }

  // ------------------------------------- 5. NEW password accepted, fresh both
  {
    const status = await apiSignIn(DISPOSABLE_EMAIL, PASS_NEW);
    record('new password accepted (auth API, no session)', status === 200, `HTTP ${status}`);

    const ctx = await browser.newContext(); // a genuinely fresh browser context
    const page = await ctx.newPage();
    await signIn(page, DISPOSABLE_EMAIL, PASS_NEW);
    let landed = null;
    try {
      landed = await waitForLanded(page);
    } catch {
      /* stays null */
    }
    record(
      'new password accepted (fresh browser session)',
      landed !== null,
      landed ? `landed on ${landed}` : 'never left /login',
    );
    await ctx.close();
  }

  // ------------------------------------------------ 6. OLD password rejected
  {
    const status = await apiSignIn(DISPOSABLE_EMAIL, PASS_OLD);
    record('old password rejected (auth API)', status === 400 || status === 401, `HTTP ${status}`);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, DISPOSABLE_EMAIL, PASS_OLD);
    let landed = null;
    try {
      landed = await waitForLanded(page, 8000);
    } catch {
      /* expected */
    }
    record(
      'old password rejected (fresh browser session)',
      landed === null,
      landed ? `WRONGLY landed on ${landed}` : 'stayed unauthenticated',
    );
    await ctx.close();
  }

  // ------------------------------------------------------------ 7. clean up
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, A_EMAIL, A_PASS);
    await waitForLanded(page);
    await page.goto(`${APP}/users`, { waitUntil: 'domcontentloaded' });
    const row = page.locator('tr', { hasText: DISPOSABLE_EMAIL });
    await row.waitFor({ state: 'visible', timeout: 30000 });
    await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await page.getByLabel(/Reason/).fill('production verification finished — disposable fixture');
    await page.locator('.modal').getByRole('button', { name: 'Deactivate', exact: true }).click();
    await page
      .locator('tr', { hasText: DISPOSABLE_EMAIL })
      .filter({ hasText: 'Deactivated' })
      .waitFor({ state: 'visible', timeout: 30000 });
    cleanedUp = true;
    record('disposable account deactivated afterwards', true);
    await ctx.close();
  }
} catch (err) {
  console.log(`::error::${err.message}`);
} finally {
  await browser.close();
}

console.log('\n────────────────────────────────────────────────');
// Only report debris that actually exists. Saying "deactivate it by hand"
// about an account that was never created sends someone hunting for nothing.
if (!created) {
  console.log('no disposable account was created — nothing to clean up');
} else {
  console.log(`disposable account: ${DISPOSABLE_EMAIL}`);
  console.log(`cleaned up: ${cleanedUp ? 'yes (deactivated)' : 'NO — deactivate it by hand'}`);
}
console.log('the two passwords used were random per run and are not printed anywhere.');
console.log('────────────────────────────────────────────────');

const failed = results.filter((r) => !r.ok);
if (failed.length || results.length < 8) {
  console.log(`::error::${failed.length} assertion(s) failed, ${results.length} of 8 ran.`);
  process.exit(1);
}
console.log('ALL PRODUCTION PASSWORD-RESET ASSERTIONS PASSED');
