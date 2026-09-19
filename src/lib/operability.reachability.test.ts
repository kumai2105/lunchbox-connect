import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FOUR APPROVED OPERATIONAL ACTIONS MUST STAY REACHABLE BY A HUMAN.
 *
 * Each of these existed in the database for a whole release, was exported from
 * the api layer, was covered by SQL assertions — and could not be performed by
 * anyone using the product. The automated end-to-end test called the RPC
 * directly, so it proved the RULE worked while proving nothing about whether
 * an operator could reach it. An independent inspection found all four, and
 * the honest reading is that "the backend supports it" had been standing in
 * for "the business can do it".
 *
 * This is deliberately NOT a rule that every export in api.ts must be called
 * by a component. Plenty of them legitimately are not: helpers, functions used
 * only by other api functions, and reads composed inside larger calls. A blunt
 * rule like that produces a failing test with an obvious wrong answer
 * (delete the export), which is how a test stops being read.
 *
 * It is a named list of the actions a person has to be able to take, and it
 * fails when one of them loses its way in.
 */

const OPERATIONAL_ACTIONS: Array<{ fn: string; action: string }> = [
  {
    fn: 'bulkAssignStudentMealPlan',
    action: 'A Super Admin assigns a Meal Plan to many Students at once',
  },
  { fn: 'assignManifestDriver', action: 'A dispatcher names the Driver for a delivery run' },
  { fn: 'advanceIssue', action: 'An operational issue is actioned, acknowledged and closed' },
  { fn: 'correctOperationalRecord', action: 'A Super Admin corrects an allow-listed record' },
];

/** Every .tsx under src — the files a person can actually interact with. */
function componentSources(dir: string, out: Array<{ path: string; text: string }> = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      componentSources(path, out);
    } else if (entry.endsWith('.tsx')) {
      out.push({ path, text: readFileSync(path, 'utf8') });
    }
  }
  return out;
}

describe('approved operational actions have a human way in', () => {
  const sources = componentSources('src');

  it.each(OPERATIONAL_ACTIONS)('$fn — $action', ({ fn }) => {
    // Imported from the api layer by a component, AND called there. Importing
    // without calling is how a wired-up screen becomes a dead one.
    const users = sources.filter((s) => {
      if (!new RegExp(`\\b${fn}\\b`).test(s.text)) return false;
      const imported = new RegExp(
        `import\\s*\\{[^}]*\\b${fn}\\b[^}]*\\}\\s*from\\s*'[^']*lib/api'`,
        's',
      );
      const called = new RegExp(`\\b${fn}\\s*\\(`);
      return imported.test(s.text) && called.test(s.text);
    });

    expect(
      users.map((s) => s.path),
      `${fn} is exported from the api layer but no component imports and calls it, so the ` +
        `only way to perform this action is an RPC from outside the product`,
    ).not.toEqual([]);
  });

  it('the correction UI offers only fields the database allows', () => {
    // correct_operational_record is an allow-list, not a row editor. Every
    // field name the interface passes it must be one the database accepts, or
    // the operator is offered a refusal.
    const allowed = new Set(['delivery_point', 'description', 'category']);
    const offered = new Set<string>();
    for (const { text } of sources) {
      for (const m of text.matchAll(/kind:\s*'correct',[\s\S]{0,400}?field:\s*'([a-z_]+)'/g)) {
        offered.add(m[1]);
      }
    }
    expect(offered.size, 'no correction call sites found — the UI has gone').toBeGreaterThan(0);
    expect([...offered].filter((f) => !allowed.has(f))).toEqual([]);
  });
});
