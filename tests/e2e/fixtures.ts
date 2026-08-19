import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright/test';

export const PASS = process.env.E2E_PASSWORD ?? 'E2e-pass!12345';

export const e2eReady = Boolean(
  process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
);

export function seeded(): Record<string, string> {
  const file = path.join(__dirname, '.seeded.json');
  if (!fs.existsSync(file)) throw new Error('.seeded.json missing — run global-setup first');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
}

export function adminDb() {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('E2E env incomplete');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator(SEL.email).fill(email);
  await page.locator(SEL.password).fill(PASS);
  await page.getByRole('button', { name: /enter the platform/i }).click();
  // Every role lands on its own first page. Routes reflect the CURRENT app:
  // no /menu (retired); kitchen → /kitchen, ops → /ops, reports → /reports.
  await page.waitForURL(
    /^\/(dashboard|today|parent|classes|staff|students|status|kitchen|reports|ops|deliveries|meals|menu-builder|analytics|users|institutions)/,
  );
}

export const SEL = {
  email: 'input[autocomplete="email"]',
  password: 'input[autocomplete="current-password"]',
  roleChip: '.side-foot .u-role',
};
