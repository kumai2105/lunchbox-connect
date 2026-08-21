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
2. **Read the production migration ledger FIRST, then apply only what is
   missing.** Do **not** replay a version that production has already applied
   merely because the file is still in the repository — re-running historical
   migrations is how a reviewed deployment gets corrupted.

   ```sql
   -- what production has actually applied, newest last
   select version, name
     from supabase_migrations.schema_migrations
    order by version;
   ```

   Compare that list against `supabase/migrations/` and apply **only the
   versions absent from the ledger**, in ascending order. `supabase db push`
   does this comparison for you and is the preferred path; applying files by
   hand means doing the comparison yourself first.

   The repository currently contains `0001`–`0038`. Which of those are pending
   depends on the ledger you just read — the expected pending set must agree
   with that verified state, not with any range quoted in a document. If the
   ledger disagrees with what you expect, stop and reconcile before applying
   anything.

   For reference, the corrected architecture arrived in migrations
   `0017`–`0038` (rotation engine, resolver
   lockdown, meal-service link, planning-RLS tightening, special-period fix,
   dashboard KPI, meal-library RPCs, `class_staff`, legacy-publish retirement,
   per-meal demand, analytics one-truth, served-meal integrity + role de-stale
   (**0029**); publishable future services + revision analytics + recording
   integrity (**0030**); the database-boundary lockdown — RPC-only
   `serving_records` writes, note-publish authority, tenant/eligibility
   triggers, meal-image storage visibility, and the Asia/Dubai operational date
   (**0031**); and the tenant-integrity + permission correction — student/class
   same-institution trigger, `student_parents` parent-role trigger, `class_staff`
   classroom-staff+same-institution trigger, removal of the invented School-Admin
   recording and note-publish authorities, and the honest `meal_production_demand`
   safety-note column rename (**0032**); and the client-boundary lockdown — no
   `app_users` self role/scope escalation, eligibility protected on INSERT as
   well as UPDATE, School Admin guardian writes closed, tenant invariants held
   from the referenced side, no generic hard delete of core historical
   entities, planning tables closed to downstream roles, the legacy `menus`
   surface made read-only, every new classroom record anchored to a published
   Meal Service, deterministic effective-dated planning, and `meal_services`
   writable only through the publishing RPC (**0033**); and the note-privacy /
   state-validity / atomicity pass — the retired legacy `serving_records.note`
   free text archived and closed to every client, a SERVED record required to
   carry a real outcome, a narrow `set_concern_observed` write path, atomic
   Menu resizing with the `rotation_slots.week_number <= rotations.week_count`
   invariant, the completed factual analytics view, and archive-only lifecycle
   for Meals / Menus / Kitchens (**0034**); the record-state semantics +
   slot/resize locking pass — the complete approved NOT_SERVED / exception /
   preference-reason rules, the parent-row lock that holds
   `rotation_slots.week_number <= rotations.week_count` under concurrency, and
   the scored-observation denominator (**0035**); and the boundary-closure pass
   — raw planning tables closed to everyone but the Super Admin, guardian UNLINK
   removed, linked-Parent identity for a School Admin, Kitchen master data
   closed, Production Demand limited to Super Admin + Kitchen, unpublished
   Classroom free text closed to School Admin, publish↔record serialization, and
   analytics that never count an exception as preference evidence (**0036**); and
   the closure sweep — a meal image referenced by any Meal Revision can no
   longer be deleted or overwritten, so historical Meal Services and the Parent
   record of what a child was actually served keep resolving to the real
   picture (**0037**); and the migration the CLI had been silently skipping —
   the role merge formerly named `0008b_role_merge.sql`, renamed so
   `supabase db push` stops ignoring it (**0038**)).
   They are idempotent where they touch data and **publish/assign nothing**.

   > ⚠️ **0034 moves data before it locks a column.** It COPIES every historical
   > `serving_records.note` value into `serving_record_note_archive` and only
   > then clears the column, so nothing is destroyed — retention/deletion is
   > still `NOT_YET_DEFINED`. Confirm the archive row count matches the number
   > of non-null legacy notes before you continue.

   > ⚠️ **0038 is a RENAME, not new work.** Production already holds this
   > migration under its old identity (version `20260818121633`, name
   > `0008b_role_merge`). The Supabase CLI was skipping the file because
   > `0008b` is not a digits-only prefix, so every CLI-built environment was
   > missing it. Renamed to `0038`, the version is one production has not seen,
   > so a push applies it once more. That is a no-op: the UPDATE matches no rows
   > (the merge happened on 2026-08-18) and the constraint it re-adds is
   > byte-for-byte what `0013_kitchen_entity.sql` already installed. Expect one
   > extra ledger row and no data or schema change.

   > ⚠️ **0037 removes a deletion authority, not data.** It replaces 0024's
   > blanket `for all` meal-images policy with reference-guarded UPDATE and
   > DELETE. Nothing already in the bucket is touched; an object no Meal
   > Revision references stays removable. If your operators relied on deleting
   > a referenced meal image, that is now refused by design — retention policy
   > for referenced images is still `NOT_YET_DEFINED`.

   > ⚠️ **0033 stops rather than guesses.** It refuses to apply if production
   > already holds two service-plan or rotation-assignment rows for the same
   > institution *and* effective date, and names them. That ambiguity must be
   > resolved by a human decision about which row is correct — the migration
   > will not pick one for you.
3. **Deploy and verify the `admin-create-user` Edge Function** — the only
   server-side account-provisioning path. A new frontend/DB release must **not**
   run against a stale copy of this function, so deploy it in the same release,
   after the migrations and before (or together with) the frontend deploy:
   - Set its secrets in the production project (the function reads them from the
     Deno environment; the service-role key is used **only** here, never in the
     frontend):
     ```
     supabase secrets set \
       SUPABASE_URL=https://llnofriwvnerntrbpehc.supabase.co \
       SUPABASE_ANON_KEY=<production anon key> \
       SUPABASE_SERVICE_ROLE_KEY=<production service-role key> \
       --project-ref llnofriwvnerntrbpehc
     ```
     (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are all
     required — the function returns `500 missing server env` without them.)
   - Deploy the function:
     ```
     supabase functions deploy admin-create-user --project-ref llnofriwvnerntrbpehc
     ```
   - **Verify** it is live and enforcing authorization before relying on it:
     an unauthenticated `POST` must return `401`, and a non-admin caller `403`
     (the function re-checks the caller's role server-side; the frontend gate is
     not the boundary). Only then is Admin-driven provisioning safe.
4. **Enter business configuration** — for each institution whose agreement you
   can source from an authoritative record, set its service plan, rotation
   assignment, and publish window **through the Admin UI**, or via the
   reviewed `remediation/03_institution_config.TEMPLATE.sql` +
   `04_publish_explicit.TEMPLATE.sql` (drafts first, ≤90-day windows). Any
   institution you cannot source stays unconfigured — do not guess.

## Backend readiness gate (the deploy will refuse without it)

`.github/workflows/deploy.yml` will not build or publish a frontend until the
operator attests which migration production actually holds. Set
`BACKEND_READY_MIGRATION` — a repository variable, or the `workflow_dispatch`
input — to the highest migration version applied to production (e.g. `0038`)
after completing steps 1–3 above and the Edge Function deploy below. If it is
missing, or lower than the newest migration in the repository, the job fails
with an explicit message instead of shipping a frontend against an older
backend. It is an attestation only: nothing in the workflow mutates production
data, and seeded production E2E is deliberately not part of the gate.

## Frontend deploy — sequence it with the migration

`.github/workflows/deploy.yml` builds and deploys the frontend to Cloudflare.
The deploy is **release-gated**: it runs only after typecheck, lint, unit tests
and a production build all pass, and only on an explicit release trigger
(a `v*` tag push or a manual `workflow_dispatch`) — never merely because a
branch was pushed. The corrected frontend expects the `0021`–`0038` schema and
the deployed `admin-create-user` Edge Function (steps 2–3 above), so **apply the
migrations and deploy the function before — or together with — the frontend
deploy**, or the live app will call tables/RPCs (`class_staff`,
`meal_production_demand`, `save_meal`, the rebuilt `v_meal_performance`) or an
account-provisioning function that production does not yet have.

## Transaction safety

Review-gate every data-touching step. The `remediation/` change scripts open a
transaction and **do not** `commit;` — you review the notices and commit or
roll back yourself. Note the Supabase **web SQL editor auto-commits** each run;
for a genuine checkpoint use `psql`.

See `remediation/README.md` for the per-script detail and the clone test
evidence.
