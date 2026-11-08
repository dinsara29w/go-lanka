# Handover Guide

## Admin access

1. Open `https://<domain>/admin/setup?token=...` from the owner invite.
2. Set a strong password and enrol TOTP MFA.
3. Store recovery codes offline. They are shown once.
4. Sign in at `/admin/login` with email, password, and authenticator code.

The owner can invite additional admins from `/admin/team`. Every admin must complete MFA setup.

## Daily admin tasks

| Task                                                      | Location                    |
| --------------------------------------------------------- | --------------------------- |
| Publish or edit packages                                  | `/admin/packages`           |
| Edit itineraries and galleries                            | Package editor              |
| Manage destinations and map districts                     | `/admin/destinations`       |
| Set dates and capacity                                    | `/admin/availability`       |
| Review requests, notes, confirm/cancel/complete           | `/admin/bookings`           |
| Publish verified reviews                                  | `/admin/reviews`            |
| Moderate traveller photos                                 | `/admin/photos`             |
| Edit visa/money/weather/safety/packing/transport guidance | `/admin/travel-info`        |
| Update WhatsApp, contact details and social links         | `/admin/settings`           |
| Hotel rates, meal-plan percentages and vehicles           | `/admin/rates`              |
| Revoke sessions                                           | `/admin/sessions`           |
| Review admin activity                                     | `/admin/audit` (owner only) |

## Content rules

- Do not enter unverified visa, safety, or pricing facts. Mark them TODO and have the client approve them.
- Every image requires meaningful alt text.
- Photo submissions are private until approved.
- Prices are entered in LKR. USD/EUR/GBP are display conversions and are indicative.
- AI-generated itineraries are suggestions only; staff must confirm every final itinerary.

## Booking workflow

1. A customer submits a request from a package page.
2. Pending requests count against capacity but do not increment `booked`.
3. Staff contact the customer and confirm the final details.
4. Confirming increments `booked`; cancelling a confirmed booking decrements it.
5. Completed bookings retain their history.
6. Export CSV only from an authenticated admin session.

## Operations

- App service: `systemctl status golanka`
- Logs: `journalctl -u golanka -f`
- Caddy: `systemctl status caddy`
- Database: native PostgreSQL 17, loopback only.
- Cron: `golanka-rates.timer`, `golanka-retention.timer`, `golanka-backup.timer`
- Health: `GET /api/health`
- Check timer failures with `systemctl --failed` and `journalctl -u golanka-backup -u golanka-rates -u golanka-retention`.
- Deployment: see [deployment.md](./deployment.md).
- Security checklist: see [security-checklist.md](./security-checklist.md).
- Incident response: see [incident-response.md](./incident-response.md).

## Secret rotation

At minimum rotate:

- admin passwords and MFA secrets after suspected compromise
- `IP_HASH_SECRET` and `MFA_ENCRYPTION_KEY` only with a planned re-encryption/migration procedure
- database role passwords
- `DEEPSEEK_API_KEY`, `RESEND_API_KEY`, `EXCHANGE_RATE_API_KEY`, `CRON_SECRET`
- Turnstile keys
- backup storage credentials

Rotating `MFA_ENCRYPTION_KEY` without re-encrypting existing MFA secrets will lock admins out. Rotating `IP_HASH_SECRET` invalidates session/CSRF hashes and existing PDF links. Treat both as planned migrations.

## Known limitations

- Structured hotel/meal catalogues are not yet modelled.
- PDF branding is neutral.
- Live AI requires a DeepSeek API key with credit.
- No analytics provider is configured.
- Single VPS, no high availability.
- Legal/privacy text is not approved.
- Retention is automated: PDFs expire after 7 days and are deleted after a 1-day grace period; AI sessions are deleted after 30 days; audit rows after 365 days.
