#!/usr/bin/env bash
#
# Deploy the Jazeel site to a server already prepared by provision.sh.
#
#   SERVER=root@203.0.113.10 ./deploy.sh
#
# Run it from a clone of the repository, on your own machine. It builds on the
# server (so the build matches the machine that runs it), keeps the last five
# releases, and flips a symlink — so a bad deploy is one command to undo.
#
# It refuses to deploy if pre-flight reports a blocker.

set -euo pipefail

SERVER="${SERVER:-}"
APP_DIR="${APP_DIR:-/srv/jazeel}"
KEEP="${KEEP:-5}"

[[ -n "$SERVER" ]] || { echo "Set SERVER, e.g. SERVER=root@203.0.113.10 $0" >&2; exit 64; }
[[ -f package.json ]] || { echo "Run this from the repository root." >&2; exit 65; }

REL="$(date +%Y%m%d-%H%M%S)"
TARGET="$APP_DIR/releases/$REL"

echo "==> Shipping working tree (tracked files only) as $REL"
git archive --format=tar HEAD | ssh "$SERVER" "
  set -euo pipefail
  install -d -o jazeel -g jazeel '$TARGET'
  tar -x -C '$TARGET'
  chown -R jazeel:jazeel '$TARGET'
"

echo "==> Linking shared state and building"
ssh "$SERVER" "
  set -euo pipefail
  cd '$TARGET'
  ln -sfn '$APP_DIR/shared/data'    data
  ln -sfn '$APP_DIR/shared/uploads' public/uploads
  ln -sfn '$APP_DIR/shared/.env.local' .env.local
  chown -h jazeel:jazeel data public/uploads .env.local

  sudo -u jazeel npm ci --omit=dev --no-audit --no-fund
  sudo -u jazeel npm ci --no-audit --no-fund      # build needs the dev deps
  sudo -u jazeel npm run build
"

echo "==> Pre-flight"
if ! ssh "$SERVER" "cd '$TARGET' && sudo -u jazeel npm run --silent preflight"; then
  echo "" >&2
  echo "Pre-flight found a blocker. $TARGET is left in place, unlinked." >&2
  echo "Fix it and re-run, or remove that release directory." >&2
  exit 1
fi

echo "==> Switching over"
ssh "$SERVER" "
  set -euo pipefail
  ln -sfn '$TARGET' '$APP_DIR/current'
  systemctl restart jazeel
  systemctl enable jazeel >/dev/null
  sleep 3
  systemctl is-active --quiet jazeel || { journalctl -u jazeel -n 40 --no-pager; exit 1; }
  ls -1dt '$APP_DIR'/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
"

echo "==> Checking it answers"
ssh "$SERVER" "curl -fsS -o /dev/null -w 'localhost:3000 -> %{http_code}\n' http://127.0.0.1:3000/en"

cat <<EOF

Live as release $REL.

To roll back:
  ssh $SERVER "ln -sfn \$(ls -1dt $APP_DIR/releases/*/ | sed -n 2p) $APP_DIR/current && systemctl restart jazeel"
EOF
