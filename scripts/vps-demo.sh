#!/usr/bin/env bash
# Go Lanka: TEMPORARY demo on a fresh Ubuntu/Debian VPS. Run as root from the unzipped folder:
#   sudo DEEPSEEK_API_KEY=your-key ./scripts/vps-demo.sh
# It runs the site in development mode on port 3000 so Cloudflare's test spam-check keys work.
# Not for production: see docs/deployment.md for the real setup. Remove it with: ./scripts/vps-demo.sh remove
set -euo pipefail

SERVICE=go-lanka-demo
APP_USER=golankademo
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
say() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "Run this as root (use sudo)."; exit 1; }

if [ "${1:-}" = "remove" ]; then
  say "Removing the demo"
  systemctl disable --now "$SERVICE" 2>/dev/null || true
  rm -f "/etc/systemd/system/$SERVICE.service"
  systemctl daemon-reload
  sudo -u postgres psql -d postgres -c "DROP DATABASE IF EXISTS go_lanka_dev;" 2>/dev/null || true
  for role in golanka_migrator golanka_public golanka_auth golanka_admin; do
    sudo -u postgres psql -d postgres -c "DROP ROLE IF EXISTS $role;" 2>/dev/null || true
  done
  command -v ufw >/dev/null 2>&1 && ufw delete allow 3000/tcp >/dev/null 2>&1 || true
  echo "Demo removed. You can delete $APP_DIR and the user $APP_USER (userdel -r $APP_USER)."
  exit 0
fi

cd "$APP_DIR"
export DEBIAN_FRONTEND=noninteractive

say "Installing Node.js 24 and PostgreSQL"
apt-get update -y
apt-get install -y curl ca-certificates gnupg postgresql postgresql-contrib build-essential
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
systemctl enable --now postgresql

id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
as_app() { sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && $1"; }

say "Installing website packages (a few minutes)"
as_app "npm ci"

if [ ! -f .env.local ]; then
  say "Creating settings and passwords"
  as_app "npm run setup:local"
fi

if ! sudo -u postgres psql -d postgres -lqt | cut -d'|' -f1 | grep -qw go_lanka_dev; then
  say "Creating the database"
  sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 < db/bootstrap.local.sql
fi

say "Setting up the tables and the 8 destinations"
as_app "npm run db:migrate"

IP="$(curl -4 -fsS --max-time 8 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
set_env() { # set_env KEY VALUE
  if grep -q "^$1=" .env.local; then sed -i "s|^$1=.*|$1=$2|" .env.local; else printf "\n%s=%s\n" "$1" "$2" >> .env.local; fi
}
set_env NEXT_PUBLIC_SITE_URL "http://$IP:3000"
set_env ALLOWED_DEV_ORIGINS "$IP"

KEY="${DEEPSEEK_API_KEY:-}"
if [ -z "$KEY" ] && ! grep -Eq '^DEEPSEEK_API_KEY=.+' .env.local; then
  read -r -s -p "Paste your DeepSeek key (or press Enter to skip): " KEY; echo
fi
[ -z "$KEY" ] || set_env DEEPSEEK_API_KEY "$KEY"
chown "$APP_USER":"$APP_USER" .env.local
chmod 600 .env.local

say "Starting the website"
cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=Go Lanka temporary demo
After=network.target postgresql.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$(command -v npm) run dev -- -H 0.0.0.0 -p 3000
Restart=on-failure
Environment=NEXT_TELEMETRY_DISABLED=1

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now "$SERVICE"
command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active" && ufw allow 3000/tcp || true

say "Warming up pages so the first visit is fast"
for _ in $(seq 1 40); do curl -fsS -o /dev/null --max-time 60 http://127.0.0.1:3000/ && break; sleep 3; done
for path in /tour-builder /packages /map /about /contact /credits; do curl -fsS -o /dev/null --max-time 60 "http://127.0.0.1:3000$path" || true; done

printf "\n\033[1;32mDone.\033[0m Open  http://%s:3000\n" "$IP"
echo "If it does not load, open port 3000 in your hosting provider's firewall panel."
echo "To remove everything later: sudo $APP_DIR/scripts/vps-demo.sh remove"
