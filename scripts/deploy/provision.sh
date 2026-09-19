#!/usr/bin/env bash
#
# Provision a fresh Ubuntu 22.04/24.04 server to run the Jazeel site.
#
# Run as root on the server, once:
#
#   DOMAIN=jazeeluae.com ./provision.sh
#
# It installs Node 22 and Caddy, creates a service user, lays out /srv/jazeel,
# writes a systemd unit and a Caddy site that terminates TLS automatically, and
# sets up a nightly database backup. It does NOT fetch the app — deploy.sh does
# that, and it does not start anything until the app is there.
#
# Why Caddy rather than nginx: certificates are obtained and renewed with no
# extra moving parts, which matters when nobody is going to babysit this.

set -euo pipefail

DOMAIN="${DOMAIN:-}"
APP_USER="${APP_USER:-jazeel}"
APP_DIR="${APP_DIR:-/srv/jazeel}"
NODE_MAJOR="${NODE_MAJOR:-22}"

[[ $EUID -eq 0 ]] || { echo "Run this as root." >&2; exit 1; }
[[ -n "$DOMAIN" ]] || { echo "Set DOMAIN, e.g. DOMAIN=jazeeluae.com $0" >&2; exit 64; }

echo "==> Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https sqlite3 ufw

echo "==> Node $NODE_MAJOR"
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
node -v

echo "==> Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

echo "==> Service user and layout"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR" "$APP_DIR/releases" "$APP_DIR/shared" "$APP_DIR/shared/data" "$APP_DIR/shared/uploads" "$APP_DIR/backups"

# The database and anything uploaded through the admin live in shared/ and are
# symlinked into each release, so a deploy never touches them.

if [[ ! -f "$APP_DIR/shared/.env.local" ]]; then
  cat > "$APP_DIR/shared/.env.local" <<EOF
# Filled in by provision.sh. Set SMTP before enquiries can be emailed.
DATABASE_PATH=$APP_DIR/shared/data/jazeel.db
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
ADMIN_EMAIL=management@$DOMAIN
ADMIN_PASSWORD=CHANGE_ME_BEFORE_STARTING
IP_HASH_SALT=$(head -c 32 /dev/urandom | base64)
TRUSTED_PROXY_HOPS=1

# ENQUIRY_TRANSPORT=smtp
# SMTP_URL=smtps://management@$DOMAIN:APP_PASSWORD@smtp.office365.com:465
# ENQUIRY_RECIPIENT=management@$DOMAIN
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/shared/.env.local"
  chmod 600 "$APP_DIR/shared/.env.local"
  echo "    wrote $APP_DIR/shared/.env.local — put the real admin password in it"
fi

echo "==> systemd unit"
cat > /etc/systemd/system/jazeel.service <<EOF
[Unit]
Description=Jazeel website
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/current
EnvironmentFile=$APP_DIR/shared/.env.local
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start
Restart=always
RestartSec=3

# It serves static pages out of SQLite. It needs nothing else on this machine.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/shared $APP_DIR/current/.next/cache
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

echo "==> Caddy site"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN, www.$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000

	# The app sets its own CSP, HSTS, X-Frame-Options and Permissions-Policy.
	# Caddy must not add or duplicate them.

	log {
		output file /var/log/caddy/jazeel.log {
			roll_size 20mb
			roll_keep 10
		}
	}
}
EOF
install -d -o caddy -g caddy /var/log/caddy
caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy >/dev/null

echo "==> Nightly backup"
cat > /etc/cron.daily/jazeel-backup <<EOF
#!/bin/sh
# Online backup — sqlite3 .backup is safe while the site is serving.
d=\$(date +%Y-%m-%d)
sqlite3 "$APP_DIR/shared/data/jazeel.db" ".backup '$APP_DIR/backups/jazeel-\$d.db'" 2>/dev/null || exit 0
find "$APP_DIR/backups" -name 'jazeel-*.db' -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/jazeel-backup

echo "==> Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80,443/tcp >/dev/null
ufw --force enable >/dev/null

cat <<EOF

Provisioned for $DOMAIN.

Nothing is serving yet, on purpose. Next:

  1. Put the real admin password in $APP_DIR/shared/.env.local
  2. Point DNS at this server (see DNS.md)
  3. Run deploy.sh from your machine

Caddy will get the certificate itself the first time the domain resolves here.
EOF
