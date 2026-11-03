# Security Verification Checklist

**Status:** Implementation verification complete; production infrastructure checks remain pending until the VPS/domain/Cloudflare/Resend/Anthropic credentials are provided.

Target baseline: OWASP ASVS Level 2 across the application, with Level 3-style controls for admin authentication, session handling, and infrastructure.

Legend: **Implemented/tested** means covered by code and automated tests; **pending production** means the code/config exists but has not been exercised on the real host.

## Authentication

- [x] Admin-only accounts; no public registration
- [x] Argon2id hashing with calibrated parameters
- [x] Password policy and common-password checks
- [x] TOTP MFA required
- [x] Encrypted TOTP secrets at rest
- [x] One-time hashed recovery codes
- [x] Opaque session tokens stored as hashes
- [x] Session rotation on login
- [x] Idle and absolute expiry
- [x] Session revocation and “revoke all others”
- [x] CSRF synchronizer token derived from the session
- [x] Same-origin checks
- [x] Login rate limits and lockout
- [x] Dummy hash verification for unknown accounts
- [x] Generic authentication errors
- [x] Single-use password reset/invite tokens
- [x] Setup recovery codes shown once, not stored in plaintext
- [ ] Verify production login rate limits with real IP headers (pending production)

## Authorization

- [x] `requireAdmin`/`requireOwner` on protected pages and actions
- [x] Owner-only team and audit areas
- [x] Separate runtime database roles
- [x] RLS enabled on all application tables
- [x] Public writes through `SECURITY DEFINER` functions only
- [x] Service-role/migration credentials absent from runtime app config
- [x] Tested anonymous/admin/owner access boundaries
- [x] Tested session expiry

## Input and output

- [x] Zod validation on public APIs and admin actions
- [x] Strict schemas and length caps
- [x] Request body-size limits
- [x] Parameterized SQL only
- [x] React escaping for user/admin content
- [x] CSP nonce and security headers
- [x] Safe JSON-LD serialization
- [x] CSV formula-injection escaping
- [x] HTML email escaping
- [x] CSV export restricted to authenticated admins

## Abuse and uploads

- [x] Turnstile on public contact, booking, photo, and AI routes
- [x] Honeypots on public forms
- [x] Database-backed rate limits
- [x] Idempotency keys for bookings
- [x] Upload MIME/magic-byte validation
- [x] Image decode, re-encode, metadata stripping
- [x] File-size and pixel limits
- [x] No SVG/GIF uploads
- [x] Random storage paths
- [x] Private UGC storage
- [x] Approved-only UGC image route, `no-store`
- [x] Admin uploads require session + CSRF
- [x] AI output schema and allowed-slug validation
- [x] AI input caps and daily quotas
- [x] AI price computation server-side only
- [x] PDF capability tokens hashed and expiring
- [x] Expired PDFs and rows covered by a scheduled retention cleanup

## Database and secrets

- [x] Postgres roles least privilege
- [x] Row-level security policies
- [x] Transactional booking capacity changes
- [x] Audit log append-only for application roles
- [x] Secrets only in server environment
- [x] `.env*` ignored except examples
- [x] Secret scan configured in CI (`gitleaks`)
- [x] Production dependency audit reports 0 vulnerabilities
- [ ] Verify DB is bound to loopback only on production host (pending production)
- [ ] Verify production backup/restore (pending production)
- [ ] Configure production backup role and off-site bucket (pending production)

## Infrastructure

- [x] Application security headers configured
- [x] CSP nonce baseline
- [x] App can build without local secrets
- [x] Systemd unit with non-root user, read-only filesystem, capability removal, resource protections
- [x] Caddy configuration for TLS/reverse proxy
- [x] Deployment runbook and rollback notes
- [ ] Harden VPS (SSH keys, firewall, fail2ban, unattended upgrades) (pending production)
- [ ] Cloudflare TLS Full (strict), WAF, origin restriction (pending production)
- [ ] Production Turnstile keys (pending client)
- [ ] Production Resend domain verification and DMARC (pending client)
- [ ] Anthropic API key and cost budget (pending client)
- [ ] Verify production CSP with real third-party Turnstile assets
- [ ] External penetration test or independent review (pending budget)

## Automated verification

| Check                       | Command                                                        | Result            |
| --------------------------- | -------------------------------------------------------------- | ----------------- |
| Lint                        | `npm run lint`                                                 | Pass              |
| Type check                  | `npm run typecheck`                                            | Pass              |
| Format                      | `npm run format:check`                                         | Pass              |
| Unit tests                  | `npm test`                                                     | 54 pass           |
| End-to-end                  | `npm run test:e2e`                                             | 24 pass           |
| Database RLS/workflow       | `npm run test:db`                                              | Pass              |
| Production build            | `npm run build`                                                | Pass              |
| Build without secrets       | `NEXT_STANDALONE=1 npm run build` with `.env.local` moved away | Pass              |
| Production dependency audit | `npm run audit:prod`                                           | 0 vulnerabilities |

The Playwright suite covers authentication, MFA/setup, session expiry, admin CRUD, image upload, CSRF rejection, currency switching, map keyboard selection, reviews/travel content, photo moderation, booking creation/status transitions, PDF capability expiry, custom quotes, AI fallback, public-page landmarks and heading structure, skip-link focus, form labels, and real 404 status for unknown package slugs.

## Known residual risks / exceptions

- **Live AI not exercised:** no `ANTHROPIC_API_KEY` locally; fallback is tested, but a real model response, cost, and latency have not been verified.
- **No external penetration test yet.**
- **ZAP baseline:** not run; it requires a staging deployment (pending production).
- **Lighthouse:** local mobile measurements show LCP < 0.5 s and CLS 0, but a full Lighthouse run against the production host is still pending.
- **Retention:** the cleanup route and daily timer exist; confirm both are enabled and monitored on the production host.
- **Single VPS:** no high availability; provider failure causes downtime.
- **Legal/privacy review pending.**
- **Real content/brand/photos not supplied.**
