# RETIRED — do not follow this runbook

This go-live runbook described an **obsolete** deployment workflow (a
never-run codebase, the legacy `menus`/notes flow, and a `supabase db push`
sequence that predates the corrected architecture). Following it now would
apply outdated steps to production. It has been retired so nobody acts on it.

**Use these instead:**

- **`scripts/PRODUCTION_APPLY.md`** — the current, authoritative apply order:
  migrations create schema only (they publish/assign nothing); service plans,
  rotation assignments and publishing are done through the Admin UI or the
  reviewed `remediation/` templates; and it explains sequencing the frontend
  deploy after the database migration.
- **`docs/VERIFICATION_FINAL.md`** — what has been executed and verified on the
  final commit, and the production status.
- **`remediation/README.md`** — the separated, review-gated production scripts.

Nothing in this file should be executed.
