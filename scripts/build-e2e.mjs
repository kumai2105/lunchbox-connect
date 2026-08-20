/**
 * Builds the browser bundle for the E2E run, pointed at the SAME approved
 * non-production Supabase project the fixtures seed.
 *
 * Why this exists: `pnpm build` reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY,
 * while the fixtures read E2E_SUPABASE_URL / E2E_SUPABASE_*. Nothing mapped one
 * to the other, so CI built a bundle with NO Supabase config at all — it fell
 * back to `placeholder.supabase.co` and rendered "Waiting for the backend",
 * while the seeder happily populated a real project. The specs could only ever
 * fail, and for a reason unrelated to whatever they were testing.
 *
 * Three refusals are enforced here, before a single byte is compiled.
 */
import { spawnSync } from 'node:child_process';

const PRODUCTION_PROJECT_REFS = ['llnofriwvnerntrbpehc'];

const url = process.env.E2E_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`[e2e-build] ${message}`);
  process.exit(1);
}

if (!url || !anonKey) {
  fail(
    'E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY are required to build the E2E bundle. ' +
      'Without them the app would talk to a placeholder host while the fixtures seed a real ' +
      'project. E2E stays BLOCKED_BY_ENVIRONMENT until an approved non-production target exists.',
  );
}

// (1) Never build a bundle pointed at production.
for (const ref of PRODUCTION_PROJECT_REFS) {
  if (url.includes(ref)) {
    fail(`REFUSING to build an E2E bundle against the production project (matched "${ref}").`);
  }
}

// (2) The service-role key must NEVER enter the browser bundle. It bypasses
// RLS entirely, and anything in the bundle is public. Catch the paste-into-the-
// wrong-variable mistake by decoding the JWT role claim rather than trusting
// the variable's name.
function jwtRole(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).role ?? null;
  } catch {
    return null;
  }
}
if (jwtRole(anonKey) === 'service_role') {
  fail(
    'E2E_SUPABASE_ANON_KEY carries the service_role claim. The service-role key bypasses RLS ' +
      'and must never ship in a browser bundle. Use the project ANON key.',
  );
}
if (serviceKey && anonKey === serviceKey) {
  fail('E2E_SUPABASE_ANON_KEY is identical to the service-role key. Refusing to build.');
}

// (3) Only then: build with the E2E project mapped onto the Vite variables.
const res = spawnSync('vite', ['build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey },
  shell: process.platform === 'win32',
});
process.exit(res.status ?? 1);
