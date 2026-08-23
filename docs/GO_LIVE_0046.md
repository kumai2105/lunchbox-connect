# Taking 0043–0046 live

Everything is built, verified and pushed. What remains needs two credentials
that only you can create, and then four clicks.

**Verified commit:** `c0a77d44b720f5b0cb85d051de041ab9784a8377` — 100/100 browser
tests (run `32643257414`), 23 SQL suites, 280 assertions, 520 matrix checks,
125 unit tests, typecheck, lint and build all clean.

**Production right now:** frontend `2793a90c`, database `0042`. Untouched by any
of this closure. It is internally consistent and working.

---

## Why I could not do this part

This session cannot reach Supabase at all. The network policy answers `403` to
`CONNECT` for `*.supabase.co` and `api.supabase.com`, there is no Supabase CLI
in the environment, and the Supabase connector needs an interactive
authorisation a background session cannot perform.

GitHub Actions **can** reach Supabase, so the apply lives there:
`.github/workflows/prod-apply-migrations.yml`. It is registered and ready.

I ran it once already, on a push. It failed at the first gate and told us
something worth knowing rather than guessing:

```
::error::SUPABASE_ACCESS_TOKEN is not set.
::error::SUPABASE_DB_PASSWORD is not set.
```

That is now a **measured fact**, not an assumption. Both secrets are absent.

---

## Step 1 — add two repository secrets (about two minutes)

GitHub → your repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Add both:

| Secret                  | Where to get it                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard → your avatar → **Account** → **Access Tokens** → Generate new token                                                                                                                                        |
| `SUPABASE_DB_PASSWORD`  | The database password for project `llnofriwvnerntrbpehc`. Supabase → Project Settings → Database. If you no longer have it, reset it there — resetting is safe and does not affect the anon or service-role keys the app uses. |

Neither is ever printed by the workflow. Only their presence is.

## Step 2 — run the apply

GitHub → **Actions** → **Production apply — migrations and Edge Functions** →
**Run workflow**, on branch `claude/new-session-k5dd5u`.

In the **confirm** box type the project ref exactly:

```
llnofriwvnerntrbpehc
```

Leave **deploy_functions** ticked. Anything other than that exact ref runs the
preflight and applies nothing — that is deliberate, so a stray click cannot
change the live database.

What it does, in order:

1. Reads the live migration ledger and prints what is pending.
2. **Captures a recovery point before touching anything** — a schema dump
   carrying the previous body of every authorization helper `0044` reissues,
   uploaded as a 90-day artifact. That is what makes `0044` reversible without
   a data dump. It is a schema dump, not a data dump, and says so.
3. Applies `0043`, `0044`, `0045`, `0046`.
4. Verifies the remote ledger actually reached `0046` — and fails loudly if not,
   because the frontend's failure mode against a lagging backend is silent.
5. Deploys `admin-create-user`, `admin-set-password` and `admin-set-active`.

### One thing to check in that run's log

The step **"Are the function secrets in place?"** lists the function secrets by
name. `SUPABASE_SERVICE_ROLE_KEY` must be among them, or the three functions
will run but fail. If it is missing:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<the service role key> \
  --project-ref llnofriwvnerntrbpehc
```

That key is a full bypass of every RLS policy in the project. It belongs in the
function environment and nowhere else — never in a frontend build, never in a
repository variable that reaches a bundle.

## Step 3 — let the frontend follow

Only after step 2 has gone green.

Set the repository **variable** (not secret) `BACKEND_READY_MIGRATION` to:

```
0046
```

Settings → Secrets and variables → Actions → **Variables** tab.

Then GitHub → Actions → **Deploy to Cloudflare** → Run workflow, on commit
`c0a77d44b720f5b0cb85d051de041ab9784a8377` — the same commit the browser gate
ran against.

## Step 4 — prove it against the live site

Dispatch **Production smoke (read-only)** and **Production browser auth
(read-only)**. The second one drives a real browser through sign-in, refresh,
sign-out, refusal of a protected route, and sign-in again, against
`https://www.lunchboxconnect.com`.

---

## The order is not negotiable

**migrations → Edge Functions → frontend.**

If the frontend goes first, the failure is silent rather than loud.
`app_users.active` and `institutions.active` do not exist at `0042`; `select *`
returns rows without them; `undefined` is falsy; and **every account would
render as "Deactivated" and every institution as "Archived"** on the live site.
Meal saves would fail against a missing `meal_periods`.

The Deploy workflow already refuses to run until `BACKEND_READY_MIGRATION`
attests the applied ceiling. That gate exists for exactly this. Do not defeat
it.

---

## If you would rather I did steps 2–4

Add the two secrets and say so. I can dispatch the workflows and read the
results from here — it is only the direct database connection I cannot make.

## If something goes wrong

The recovery point is attached to the apply run as
`production-recovery-point-<run id>`, kept 90 days. `0044` is additive (new
nullable columns, new functions, new triggers), `0045` replaces `save_meal`,
and `0046` adds one trigger — all reversible. Nothing in this batch drops a
column, drops a table, or deletes a row.
