import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * PRODUCTION BUILD DEFAULTS — why these are here, and why they are safe.
 *
 * `src/lib/supabase.ts` reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, which
 * Vite bakes in at BUILD time. Until now the only place that supplied them was
 * the build step of `.github/workflows/deploy.yml`, so every build made anywhere
 * else produced a bundle with no backend at all. That is what Cloudflare's
 * Git-integration preview builds were shipping: the preview URLs posted on every
 * pull request served the app shell and then the "this environment needs
 * VITE_SUPABASE_URL" screen, and could not sign anyone in. A reviewer opening
 * one saw a broken product and no explanation.
 *
 * Neither value is a secret. The anon key is public by design — RLS is the
 * boundary, not secrecy — it already sits in plaintext in `deploy.yml` and
 * `prod-smoke.yml`, and it ships inside the JavaScript every visitor downloads.
 * The service-role key is the one that must never appear, and it does not.
 *
 * Three properties keep this from becoming a footgun:
 *
 *   1. It is a FALLBACK, never an override. If the variable is set, no define is
 *      emitted and Vite's own substitution wins untouched. `deploy.yml` sets
 *      both explicitly, so the release path is byte-for-byte unchanged.
 *
 *   2. It cannot reach the E2E bundle. `scripts/build-e2e.mjs` refuses to build
 *      unless E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY are present, refuses a
 *      URL matching the production project, and then spawns `vite build` with
 *      both VITE_ variables explicitly set — so by (1) the fallback never
 *      applies, and a seeded suite can never be pointed at production by it.
 *
 *   3. It is production-mode only. `pnpm dev` still renders the missing-config
 *      screen, so a developer has to say out loud which backend they are
 *      talking to rather than silently getting the live one.
 */
const PRODUCTION_SUPABASE_URL = 'https://llnofriwvnerntrbpehc.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsbm9mcml3dm5lcm50cmJwZWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNDUwNjAsImV4cCI6MjEwMjYyMTA2MH0.aE04Weq-Yu2ElnjxZS-JUIGDdC33tArSReeSjYhObYo';

export default defineConfig(({ mode }) => {
  // Same resolution Vite itself uses: real environment variables and any .env
  // files for this mode. Only a genuinely missing value gets a default.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const define: Record<string, string> = {};

  if (mode === 'production') {
    if (!env.VITE_SUPABASE_URL) {
      define['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(PRODUCTION_SUPABASE_URL);
    }
    if (!env.VITE_SUPABASE_ANON_KEY) {
      define['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(
        PRODUCTION_SUPABASE_ANON_KEY,
      );
    }
  }

  return {
    plugins: [react()],
    define,
    server: {
      host: true,
      port: 5173,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
