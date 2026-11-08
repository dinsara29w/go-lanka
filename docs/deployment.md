# Deployment and Operations

This is the production runbook for the Contabo VPS and purchased domain. It is written for a native deployment: Node.js application under systemd, native PostgreSQL, Caddy, and Cloudflare. The app has no Vercel-only dependency.

Do not place production secrets in the repository. Run the commands below as an administrator on the VPS.

## 1. Target topology

```text
Cloudflare (TLS, WAF, DNS)
  |
Caddy :443 -> 127.0.0.1:3000
  |
Node.js / systemd (user: golanka)
  |-- PostgreSQL 17 on 127.0.0.1:5432
  |-- /var/lib/golanka/media
  |-- Resend / DeepSeek / exchange-rate API (outbound)
  |
systemd timers -> rates refresh / encrypted backup
  |
encrypted off-site backup (R2/B2)
```

- PostgreSQL is not exposed publicly.
- The app binds to loopback only; Caddy is the only public HTTP endpoint.
- Cloudflare proxies the domain and the origin firewall can be restricted to Cloudflare.

## 2. Prerequisites

- Ubuntu LTS or equivalent VPS with at least 4 GB RAM.
- Domain DNS managed by Cloudflare (or a DNS provider that supports the required records).
- SSH key access.
- A local copy of this repository.
- Production values for the `.env.production.example` variables.
- DeepSeek API key, Resend domain/API key, Turnstile production keys.
- A production Supabase replacement is not required.

## 3. Base host hardening

```bash
sudo apt update && sudo apt full-upgrade -y
sudo timedatectl set-timezone UTC
sudo apt install -y curl git ca-certificates ufw fail2ban unattended-upgrades rclone age
sudo dpkg-reconfigure --priority=low unattended-upgrades

sudo adduser --system --group --home /opt/golanka golanka
sudo usermod -aG www-data golanka

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

SSH hardening:

- Install the operator’s public key for a non-root user.
- Disable root login and password authentication in `/etc/ssh/sshd_config`.
- Restrict SSH to known addresses where practical.
- Run `sudo sshd -t` before restarting SSH.
- Enable fail2ban for SSH and keep its logs monitored.

PostgreSQL must listen only on loopback:

```conf
# /etc/postgresql/17/main/postgresql.conf
listen_addresses = 'localhost'
password_encryption = 'scram-sha-256'
```

Keep `pg_hba.conf` restricted to local Unix/loopback connections with `scram-sha-256`.

## 4. PostgreSQL database and roles

Install PostgreSQL 17 using the official repository for the distribution. Create a separate production database and roles equivalent to `db/bootstrap.local.sql`, using new random passwords stored in a password manager.

Required runtime roles:

- `golanka_migrator` — DDL/migrations only, never used by the running app.
- `golanka_public` — public reads and public write functions.
- `golanka_auth` — auth/session/MFA tables only.
- `golanka_admin` — authenticated admin content and bookings.

Create a backup role with read-only access, for example membership in `pg_read_all_data`, and use that role only for `pg_dump`.

Run migrations with the migration role:

```bash
MIGRATION_DATABASE_URL='postgresql://golanka_migrator:...@localhost:5432/golanka_prod' \
  npm run db:migrate
```

Do not place `MIGRATION_DATABASE_URL` in the running app environment.

Seed baseline settings:

```bash
MIGRATION_DATABASE_URL='...' npm run db:seed
```

## 5. Application deployment

Place the application under `/opt/golanka/current`, owned by `golanka`, with the environment file readable only by that user:

```bash
sudo install -d -o golanka -g golanka -m 0750 /opt/golanka/current
sudo install -d -o golanka -g golanka -m 0750 /var/lib/golanka /var/lib/golanka/media
sudo install -d -m 0750 /etc/golanka
sudo install -o root -g golanka -m 0640 .env.production /etc/golanka/golanka.env
```

Build a standalone artifact:

```bash
npm ci
NEXT_STANDALONE=1 npm run build
```

Copy the standalone output, static assets, and public assets to `/opt/golanka/current`:

```bash
sudo rsync -a --delete .next/standalone/ /opt/golanka/current/
sudo rsync -a .next/static/ /opt/golanka/current/.next/static/
sudo rsync -a public/ /opt/golanka/current/public/
sudo chown -R golanka:golanka /opt/golanka/current
```

Install the service:

```bash
sudo cp ops/systemd/golanka.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now golanka
sudo systemctl status golanka
```

The service binds to `127.0.0.1:3000`, runs as `golanka`, uses a read-only system filesystem with explicit media/cache write paths, and has no added capabilities.

## 6. Caddy and Cloudflare

Install Caddy from the official repository. Set the domain through a systemd environment file so the Caddyfile remains generic:

```bash
sudo install -d -m 0750 /etc/caddy
echo 'SITE_DOMAIN=your-domain.example' | sudo tee /etc/caddy/caddy.env
sudo mkdir -p /etc/systemd/system/caddy.service.d
sudo tee /etc/systemd/system/caddy.service.d/environment.conf >/dev/null <<'EOF'
[Service]
EnvironmentFile=/etc/caddy/caddy.env
EOF
sudo systemctl daemon-reload
sudo systemctl restart caddy
sudo caddy validate --config /etc/caddy/Caddyfile
```

Initial certificate issuance is easiest with the DNS record in **DNS-only** mode, then switch to **Proxied** after Caddy has a valid certificate. Cloudflare TLS must be **Full (strict)** or use a Cloudflare Tunnel.

Cloudflare checklist:

- Proxy A/AAAA records; do not expose the origin hostname elsewhere.
- SSL/TLS mode: Full (strict).
- Always Use HTTPS enabled.
- WAF managed rules and rate limiting on `/admin/login`, `/api/bookings`, `/api/photos`, and `/api/tour-builder`.
- Cache rules must exclude `/admin`, `/api`, `/photos/*` (until approved-photo caching is reviewed), and authenticated responses.
- Restrict origin port 80/443 to Cloudflare IP ranges, or use a Cloudflare Tunnel.
- Set `TRUST_PROXY=cloudflare` in `.env.production`.
- Verify `CF-Connecting-IP` is only trusted when the origin is unreachable directly.

## 7. Exchange rates and cron

The free provider is `https://open.er-api.com/v6/latest/LKR`. The cron endpoint is `POST /api/cron/rates` and requires the `CRON_SECRET` bearer token.

Install the rate timer:

```bash
sudo cp ops/systemd/golanka-rates.service ops/systemd/golanka-rates.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now golanka-rates.timer
```

The app’s `.env` must contain `CRON_SECRET`; do not expose it to the browser.

### Retention cleanup

`POST /api/cron/retention` uses the same bearer token. It deletes expired itinerary PDFs from private storage and their database rows, then removes expired rate-limit entries, stale sessions and tokens, AI sessions older than 30 days and audit rows older than 365 days.

```bash
sudo cp ops/systemd/golanka-retention.service ops/systemd/golanka-retention.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now golanka-retention.timer
```

Run it manually after a restore or before changing retention periods:

```bash
sudo systemctl start golanka-retention.service
journalctl -u golanka-retention.service --no-pager
```

## 8. Backups

Install the backup script and timer:

```bash
sudo install -m 0700 ops/scripts/golanka-backup /usr/local/bin/golanka-backup
sudo install -m 0600 ops/systemd/golanka-backup.service ops/systemd/golanka-backup.timer /etc/systemd/system/
```

Create `/etc/golanka/backup.env` (mode 0600) with:

```env
BACKUP_DATABASE_URL=postgresql://golanka_backup:...@localhost:5432/golanka_prod
BACKUP_AGE_RECIPIENT=age1...
BACKUP_RCLONE_REMOTE=r2:golanka-backups
STORAGE_ROOT=/var/lib/golanka/media
```

Requirements:

- `age` public key for encryption; keep the private key offline and separate from the VPS.
- `pg_dump` custom format plus media archive.
- Off-site storage with separate write-only credentials.
- 30-day daily retention; add weekly/monthly retention if required.
- Test restore into an isolated database and media directory. Do not consider backups valid until a restore succeeds.
- Backups contain PII, password hashes, and UGC. They must remain encrypted and private.

## 9. First admin account

Create the owner account from the application directory on the server:

```bash
npm run create-admin -- owner@example.com
```

The script prints a single-use setup link. Deliver it through a secure channel; it expires in 24 hours. The setup flow creates the password, enrols TOTP MFA, and shows recovery codes once.

Additional admins are invited by the owner from `/admin/team`. Production Resend must be configured before using team invitations.

## 10. Deployment verification

- `curl -I https://your-domain/` shows HSTS, CSP, frame denial, and nosniff.
- `/api/health` returns 200.
- `/admin` redirects to login when unauthenticated.
- Admin setup/MFA/login works.
- Contact, booking, photo, and tour-builder forms reject invalid/oversized/unverified requests.
- Exchange rates are present and the currency switch works.
- The rates and retention timers have run successfully (`systemctl list-timers`).
- Expired itinerary PDFs are removed from `STORAGE_ROOT/private/documents`.
- Uploaded images are re-encoded and served from the expected routes.
- Backup timer runs and a restore drill succeeds.
- `npm run audit:prod` reports no high/critical production advisories.
- Cloudflare origin access is restricted.
- Cron secret is present and not browser-visible.

## 11. Rollback

- Keep the previous `/opt/golanka/releases/<timestamp>` build and switch a `current` symlink.
- Database migrations should be forward-only where practical; take a backup before deploy.
- Roll back the application release, not the database, unless a tested migration rollback exists.
- Revoke/rotate credentials if a deploy exposes secrets.

## 12. Still required before production

- Domain name, VPS SSH access, Cloudflare account, production PostgreSQL database, Resend domain, production Turnstile keys, DeepSeek API key, and brand/legal/content inputs.
- Final `.env.production` values.
- Verified backup destination and restore drill.
- External penetration test or documented security review.
