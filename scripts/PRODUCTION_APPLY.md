# Applying LunchBox Connect to production

**Project:** `llnofriwvnerntrbpehc`

This document was regenerated from the corrected repository. It replaces an
earlier version that described migrations `0017`–`0020` **auto-publishing a
dated window and auto-assigning a rotation to every institution**. That
behaviour has been **removed** from the migrations — they no longer publish,
assign, or infer any business data. Do not follow older instructions.

> ⚠️ Nothing in this session pushed schema to production. The only production
> change made here was the **revert you approved** (see the remediation
> folder). Applying the migrations below is your decision.

---

## The rule the corrected architecture enforces

Migrations create **schema and engine only**. They never decide an
institution's contracted periods, never assign it a rotation, and never
publish meal services. All of that is business configuration you enter through
the Admin UI (Meal Library, Menu Builder, and each institution's **Service**
and **Calendar** tabs), or through the reviewed templates in `remediation/`.

```
Meal Library → Menu/Rotation → (Admin) Institution Rotation Assignment
  → Calendar exceptions → (Admin) Institution Service Plan
  → (Admin) Published dated Meal Services → Eligibility → Production Demand
  → Kitchen → Classroom → Parent → Analytics
```

A master menu does **not** determine an institution's contracted periods —
that is a contract, entered per institution.

---

## Current production state (as left by this session)

Establish ground truth first by running the read-only
`remediation/00_diagnose.sql`. As of the approved revert, production should
show:

- Resolver-RPC leak **closed** (the one required, approved security change).
- **0** institution service plans, **0** rotation assignments, **0** published
  meal services — institutions are intentionally *unconfigured* until their
  real agreements are entered.
- **Preserved:** meal library, rotation template, the legacy `menus` rows, and
  all serving-record history.

---

## Order of application

1. **Confirm ground truth** — run `remediation/00_diagnose.sql` (read-only).
2. **Apply the pending schema migrations** in numeric order. Migrations
   `0017`–`0028` carry the corrected architecture (rotation engine, resolver
   lockdown, meal-service link, planning-RLS tightening, special-period fix,
   dashboard KPI, meal-library RPCs, `class_staff`, legacy-publish retirement,
   per-meal demand, analytics one-truth). They are idempotent where they touch
   data and **publish/assign nothing**. Prefer the Supabase CLI
   (`supabase db push`) or apply each file in order; verify the ledger against
   `supabase/migrations/`.
3. **Enter business configuration** — for each institution whose agreement you
   can source from an authoritative record, set its service plan, rotation
   assignment, and publish window **through the Admin UI**, or via the
   reviewed `remediation/03_institution_config.TEMPLATE.sql` +
   `04_publish_explicit.TEMPLATE.sql` (drafts first, ≤90-day windows). Any
   institution you cannot source stays unconfigured — do not guess.

## Frontend deploy — sequence it with the migration

`.github/workflows/deploy.yml` builds and deploys the frontend to Cloudflare
on every push to `claude/new-session-k5dd5u` (when the `CLOUDFLARE_*` repo
secrets are set). The corrected frontend expects the `0021`–`0028` schema, so
**apply the migrations before — or together with — the frontend deploy**, or
the live app will call tables/RPCs (`class_staff`, `meal_production_demand`,
`save_meal`, the rebuilt `v_meal_performance`) that production does not yet
have.

## Transaction safety

Review-gate every data-touching step. The `remediation/` change scripts open a
transaction and **do not** `commit;` — you review the notices and commit or
roll back yourself. Note the Supabase **web SQL editor auto-commits** each run;
for a genuine checkpoint use `psql`.

See `remediation/README.md` for the per-script detail and the clone test
evidence.
