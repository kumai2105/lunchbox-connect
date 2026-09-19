#!/usr/bin/env bash
#
# Put the Jazeel build on GitHub, from the bundle.
#
#   ./push-to-github.sh https://github.com/kumai2105/jazeel-web.git
#
# Create the repository first at https://github.com/new — name it jazeel-web,
# set it to PRIVATE, and add no README, no .gitignore and no licence, so the
# first push is not rejected for diverging.
#
# Needs: git, and jazeel-web.bundle in the same folder as this script.
# Safe to re-run: it clones to a fresh folder and refuses to clobber one.

set -euo pipefail

REMOTE="${1:-}"
if [[ -z "$REMOTE" ]]; then
  echo "usage: $0 <git remote url>" >&2
  echo "   eg: $0 https://github.com/kumai2105/jazeel-web.git" >&2
  exit 64
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE="$HERE/jazeel-web.bundle"
DEST="$HERE/jazeel-web"

[[ -f "$BUNDLE" ]] || { echo "Can't find $BUNDLE — put the bundle next to this script." >&2; exit 66; }
[[ -e "$DEST" ]] && { echo "$DEST already exists. Move it aside and re-run." >&2; exit 65; }

echo "Verifying the bundle..."
git bundle verify "$BUNDLE"

echo "Cloning..."
git clone "$BUNDLE" "$DEST"
cd "$DEST"

git remote remove origin
git remote add origin "$REMOTE"

BRANCH="$(git symbolic-ref --short HEAD)"
echo "Pushing $BRANCH and all tags to $REMOTE"
git push -u origin "$BRANCH"
git push --tags origin 2>/dev/null || true

cat <<EOF

Done. $(git rev-list --count HEAD) commits are on GitHub.

What did NOT go up, deliberately — .gitignore excludes it:
  .env.local      the admin password and site configuration
  data/*.db       the database: 82 draft menu items, 11 pages, the settings
  public/uploads  anything uploaded through the admin

Those are in jazeel-web-full.tar.gz instead. Keep that somewhere private;
it is what makes a clone runnable.

The 21 photographs ARE in the repository. Several show identifiable guests,
which is why the repository must stay private until the consent question is
settled.
EOF
