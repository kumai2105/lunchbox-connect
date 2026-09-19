import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Worker's runtime bindings must be DECLARED, not merely asserted.
 *
 * `worker/worker.ts` calls `env.ASSETS.fetch(request)` for every path outside
 * `/api/` — which is the entire site. That call only works if `wrangler.jsonc`
 * declares `assets.binding`. Wrangler happily serves assets without it, but the
 * Worker then receives NO bindings at all, so `env.ASSETS` is `undefined` and
 * every page request throws.
 *
 * This drifted silently once already, because `worker.ts` declares its own
 * local `interface Env { ASSETS: Fetcher }`. TypeScript believes that
 * declaration; the runtime does not. `pnpm typecheck` therefore passed on a
 * configuration that would have served a 500 to every visitor.
 *
 * So: cross-check the two files against each other rather than trusting either
 * alone. Proven against Wrangler 4 with `wrangler deploy --dry-run`, which
 * printed no bindings section before the fix and `env.ASSETS  Assets` after.
 */

/** Minimal JSONC reader: strips // comments and trailing commas, string-aware. */
function readJsonc(path: string): unknown {
  const src = readFileSync(path, 'utf8');
  let out = '';
  let inString = false;
  let inComment = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inComment) {
      if (ch === '\n') {
        inComment = false;
        out += ch;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += src[++i] ?? '';
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inComment = true;
      continue;
    }
    out += ch;
  }
  // trailing commas before } or ]
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

describe('worker runtime bindings are declared in wrangler.jsonc', () => {
  const config = readJsonc(new URL('../../wrangler.jsonc', import.meta.url).pathname) as {
    main?: string;
    assets?: { directory?: string; binding?: string; not_found_handling?: string };
  };
  const workerSource = readFileSync(
    new URL('../../worker/worker.ts', import.meta.url).pathname,
    'utf8',
  );

  it('reads the config at all (guards against the parser silently returning nothing)', () => {
    expect(config.main).toBe('worker/worker.ts');
  });

  it('declares every binding the Worker reads off env', () => {
    const used = [...workerSource.matchAll(/\benv\.([A-Z][A-Z0-9_]*)\b/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);

    const declared = new Set<string>();
    if (config.assets?.binding) declared.add(config.assets.binding);

    const undeclared = [...new Set(used)].filter((name) => !declared.has(name));
    expect(undeclared).toEqual([]);
  });

  it('serves the built SPA directory with SPA fallback', () => {
    // Direct asset delivery comes from `directory`; deep links that match no
    // file fall back to index.html via `not_found_handling`. Changing either
    // silently breaks refresh-on-a-deep-route, which looks like a routing bug.
    expect(config.assets?.directory).toBe('./dist');
    expect(config.assets?.not_found_handling).toBe('single-page-application');
  });
});
