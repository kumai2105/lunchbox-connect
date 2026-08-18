# CLAUDE CODE — LunchBox Connect v2 Go-Live Runbook

You are taking a corrected-but-never-run codebase live against a REAL Supabase
project. Three deploy-blocking SQL bugs were already fixed (see "Fixes applied"
below). Your job: run it against the live project, fix anything that still
surfaces, and prove the core flow works. Do NOT declare success without the
evidence each step names.

## The project (real values — already provided by the owner)
- Supabase Project URL: `https://llnofriwvnerntrbpehc.supabase.co`
- Project ref: `llnofriwvnerntrbpehc`
- You still need from the owner (ask, do not guess):
  - the **service_role key** (Settings → API) — used only for `supabase secrets set`
  - the **anon key** (Settings → API) — used in `.env`
  - the **database password** they set when creating the project (for `supabase link`)

## Honesty rules (this project has been burned 3 times by false "passing")
- Every prior version was declared passing but had errors proving it never ran
  against a real database. Do not repeat that. Show real command output.
- Do not invent business rules, roles, statuses, or features. If something is
  marked NOT_YET_DEFINED, leave it a shell. See `docs/BUILD_STATUS.md`.
- If a migration/deploy fails, STOP, show the exact error, fix the cause, re-run.

## Fixes already applied (verify they're present, don't redo)
1. `0002_core_tables.sql` — replaced invalid `implies` in a CHECK with valid
   boolean SQL; named the constraint `app_users_staff_needs_institution`.
2. `0008_role_model_alignment.sql` — now ONLY adds the missing enum role values
   (Postgres forbids using a new enum value in the same transaction).
3. `0008b_role_merge.sql` — NEW: does the teacher/nurse → classroom_staff data
   merge and re-adds the scope constraint (separate transaction, so it's legal).
   The impossible `ALTER TYPE ... DROP VALUE` lines were removed (Postgres has no
   such command; legacy values stay in the enum, unused).

---

## Steps

### 1. Install
```bash
pnpm install
```

### 2. Link the project
```bash
supabase link --project-ref llnofriwvnerntrbpehc
```
(Enter the database password when prompted.)

### 3. Apply the database — THE moment of truth
```bash
supabase db push
```
Gate: all 12 migrations apply with no error. This has NEVER succeeded before, so
watch closely. If any migration errors:
- read the actual Postgres error,
- fix that migration (not the spec),
- re-run. Common remaining risks to expect and fix forward:
  - a policy or view referencing a column/role name that changed,
  - an RLS helper referencing `classroom_staff` in a spot that runs before 0008b.
Report exactly what (if anything) you had to fix.

### 4. Frontend env
Create `.env`:
```
VITE_SUPABASE_URL=https://llnofriwvnerntrbpehc.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from owner>
```

### 5. First real full check (never done before)
```bash
pnpm typecheck && pnpm lint && pnpm test:unit
```
Fix any type errors properly (no @ts-ignore, no weakening tsconfig). Show output.

### 6. Deploy the account-creation function + its secret
```bash
supabase functions deploy admin-create-user
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role key from owner>
```

### 7. Bootstrap the first Super Admin (once, by hand)
- In the Supabase dashboard create an auth user (email + password); note its UUID.
- SQL editor:
```sql
insert into app_users (user_id, role, full_name, email)
values ('<uuid>', 'super_admin', 'Owner', '<that email>');
```
Gate: one super_admin row exists.

### 8. Run it
```bash
pnpm dev
```
Sign in as the super admin. Confirm the admin portal loads with no console errors.

### 9. Smoke-test the real chain (this is the proof)
In the app, as super admin:
1. Create an institution → a class → a student → assign student to class → set
   the student eligible (ACTIVE_BILLABLE_TO_NURSERY).
2. Users: create a classroom_staff (assign to the class) and a parent (link to
   the student).
3. Menu: add one item and set an active week.
4. Sign in as classroom staff → Today → record a meal outcome + a note → publish note.
5. Sign in as the parent → confirm they see the child, the meal outcome, the
   PUBLISHED note (not any unpublished note), and the active-week menu.
Gate: each works against the live DB. Report any failure with the real error.

### 10. Boundary + safety tests
```bash
pnpm test:e2e
```
And run `tests/sql/notes_safety.sql` in the SQL editor (expect: note cannot become
parent-visible without review).

## Report back to the owner in plain English
- Did `db push` succeed? What (if anything) did you fix?
- Did the smoke test (step 9) work end to end?
- What is live and working vs still broken vs still a shell.
Do not self-certify release — that's the owner's decision (docs/14).
