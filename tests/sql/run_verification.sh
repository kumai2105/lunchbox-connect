#!/usr/bin/env bash
# =====================================================================
# Reproduce the database verification on a throwaway PostgreSQL 16.
#
#   ./tests/sql/run_verification.sh
#
# It builds a real cluster, applies supabase/migrations/*.sql VERBATIM,
# then runs every check. Exit code 0 only if every assertion passed.
#
# Why not just point at the hosted project: this proves the migrations
# replay cleanly from nothing, and it runs with no network and no
# credentials, so CI and a laptop get the same answer. The RLS checks
# use `set local role authenticated` + a forged request.jwt.claims,
# which is exactly the context PostgREST executes queries in.
# =====================================================================
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDIR=${PGDIR:-/var/lib/postgresql/lbcverify}
PGPORT=${PGPORT:-5433}
SOCK=${SOCK:-/tmp}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

RUNAS=""
[ "$(id -u)" -eq 0 ] && RUNAS="su postgres -c"
run() { if [ -n "$RUNAS" ]; then su postgres -c "$1"; else bash -c "$1"; fi; }

if ! "$PGBIN/pg_isready" -h "$SOCK" -p "$PGPORT" >/dev/null 2>&1; then
  echo "==> initialising cluster at $PGDIR"
  rm -rf "$PGDIR"; mkdir -p "$PGDIR"
  [ -n "$RUNAS" ] && chown postgres:postgres "$PGDIR"
  chmod 700 "$PGDIR"
  run "$PGBIN/initdb -D $PGDIR -U postgres --auth=trust -E UTF8 --locale=C" >/dev/null
  run "$PGBIN/pg_ctl -D $PGDIR -o '-p $PGPORT -k $SOCK' -l $PGDIR/server.log start" >/dev/null
  sleep 2
fi

PSQL="psql -h $SOCK -p $PGPORT -U postgres -q -v ON_ERROR_STOP=1"

echo "==> rebuilding database 'lbc' from scratch"
$PSQL -d postgres -c "drop database if exists lbc;" -c "create database lbc;"
$PSQL -d lbc -f "$HERE/00_supabase_shim.sql" >/dev/null

echo "==> applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  $PSQL -d lbc -f "$f" >/dev/null
  echo "    ok $(basename "$f")"
done

echo "==> seeding baseline actors"
$PSQL -d lbc -f "$HERE/01_actors.sql" >/dev/null

fail=0
for suite in verify_golden_path verify_rls_cross_portal verify_menu_cutover; do
  echo
  echo "==================== $suite ===================="
  # NOTE: ON_ERROR_STOP is deliberately ON. A failed assertion RAISEs, which
  # aborts, which must fail this script — a suite that "mostly passed" is a
  # failed suite.
  if psql -h "$SOCK" -p "$PGPORT" -U postgres -d lbc -v ON_ERROR_STOP=1 \
       -f "$HERE/$suite.sql" 2>&1 | sed 's/^psql:[^ ]* //' | grep -E 'NOTICE|ERROR'; then :; fi
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then fail=1; fi
done

echo
if [ "$fail" -ne 0 ]; then echo "RESULT: FAILED"; exit 1; fi
echo "RESULT: all database verification suites passed"
