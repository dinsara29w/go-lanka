# Security Architecture — Sri Lanka Tours Platform

**Status:** Draft for approval  
**Companion:** [implementation-plan.md](./implementation-plan.md)  
**Date:** 2026-10-22

## 1. Scope and Standard

This document covers the custom backend, admin application, public forms, database, file storage, AI route, deployment, and operational controls.

Target baseline:

- **OWASP ASVS Level 2** across the application
- **Level 3-style controls for authentication, administration, and secrets**
- OWASP Top 10 mitigations
- CIS-style host hardening
- Secure defaults, least privilege, fail-closed behaviour

No system is perfectly secure. The goal is to remove common classes of compromise, limit blast radius, detect abuse, and recover safely.

## 2. Principles

1. **No direct database exposure.** Browsers never receive database credentials or query the database directly.
2. **Defence in depth.** Application authorization plus separate database roles plus RLS.
3. **Least privilege.** Public, auth, admin, migration, and backup access are separated.
4. **Don’t invent cryptography.** Use Argon2id, Node’s CSPRNG, SHA-256, and AES-256-GCM through maintained libraries and standard APIs.
5. **Server is the trust boundary.** All authorization and pricing decisions happen server-side.
6. **Fail closed.** Missing secrets, invalid Turnstile, unknown session state, or failed verification denies access.
7. **Minimise data.** Collect only what the booking/contact/photo flows require.
8. **Minimise dependencies.** Every package increases supply-chain risk.
9. **Security is testable.** Each control has an automated or documented verification.
10. **Operable security.** Controls must work for non-technical admin staff and have recovery paths.

## 3. Trust Boundaries

```text
Untrusted: internet, public form input, uploaded files, AI output, email content

Boundary 1: Cloudflare -> origin
Boundary 2: Caddy -> Next.js application
Boundary 3: application -> PostgreSQL roles
Boundary 4: application -> filesystem
Boundary 5: application -> external services
Boundary 6: host SSH / deployment
Boundary 7: backups -> off-site storage
```

- The public site and admin share the application process, but admin data access uses a separate database pool and authorization path.
- The database has no public port.
- Uploaded files are never executed or served from a user-controlled path.
- External API responses are treated as untrusted.

## 4. Assets

- Admin credentials, MFA secrets, session tokens
- Customer booking PII (name, email, phone, country, travel plans)
- Photo submissions and moderation state
- Booking, availability, and pricing integrity
- Anthropic, Resend, exchange-rate, and database credentials
- Backups
- Site content and admin audit history
- Domain, DNS, Cloudflare, and VPS access

## 5. Threat Model

| Threat                            | Scenario                                                 | Primary controls                                                                                                 | Verification                  |
| --------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Credential stuffing / brute force | Automated login attempts                                 | Argon2id, generic errors, per-IP/per-account rate limits, lockout, mandatory MFA, Turnstile consideration, audit | Auth tests, rate-limit tests  |
| Session theft                     | XSS or network interception                              | HttpOnly/Secure/SameSite cookie, short idle timeout, rotation, revocation, CSP, no tokens in URLs/logs           | Cookie checks, XSS tests      |
| CSRF                              | Malicious site submits admin action                      | SameSite=Strict, session-bound CSRF token, Origin/Sec-Fetch-Site checks, no CORS                                 | CSRF integration tests        |
| XSS                               | Malicious review/photo caption/AI output                 | React escaping, no raw HTML, strict CSP, safe JSON-LD serialization, output validation                           | Payload tests, CSP scan       |
| SQL injection                     | Filter/search/input manipulation                         | Parameterized SQL only, no dynamic identifiers, least-privilege roles, input validation                          | SQLi tests, code review       |
| IDOR                              | Guessing booking/photo/admin IDs                         | Server-side authorization, object ownership checks, unguessable IDs, approved-only photo route                   | Authz tests                   |
| File upload attack                | Polyglot, SVG script, path traversal, decompression bomb | Magic bytes, decoding, size/pixel limits, re-encode, metadata strip, generated paths, no SVG/GIF                 | Upload abuse tests            |
| Malware in uploads                | Image containing payload                                 | Re-encode to WebP, no executable types, served with correct MIME/nosniff, private storage                        | Upload tests, file inspection |
| SSRF                              | User-controlled URL fetched by server                    | No user-supplied fetch URLs; fixed allowlist for exchange-rate host                                              | Code review, tests            |
| Prompt injection                  | User text tries to override AI instructions              | Treat input as data, no tools, bounded context, output schema, allowed-slug validation, cost/rate caps           | Adversarial AI tests          |
| Spam / email abuse                | Contact/booking/photo floods                             | Turnstile, honeypot, rate limits, body caps, Cloudflare, email quotas                                            | Abuse tests                   |
| DoS                               | Large requests, image bombs, AI cost abuse               | Body limits, pixel limits, timeouts, quotas, Cloudflare, DB pool limits                                          | Load/abuse tests              |
| Data exfiltration                 | DB or backup theft                                       | Separate roles, encryption at rest/off-site, encrypted backups, redacted logs, least privilege                   | Role tests, restore review    |
| Backup theft                      | Object storage compromise                                | Client-side encryption, separate credentials, retention, access logging                                          | Restore drill                 |
| Supply-chain compromise           | Malicious dependency/action                              | Minimal deps, lockfile, `npm ci`, audit, Dependabot, pinned CI actions, image scan                               | CI checks                     |
| Misconfiguration                  | Missing header, open DB port, debug mode                 | Infrastructure as code, security headers, compose review, staging, launch checklist                              | ASVS/ZAP scan                 |
| Insider / compromised admin       | Malicious or careless staff action                       | MFA, owner/admin roles, audit log, session revocation, least privilege                                           | Audit review                  |
| Account enumeration               | Login/reset reveals accounts                             | Generic responses, constant-time-ish flow, dummy hash, rate limits                                               | Auth tests                    |
| CSV injection                     | Admin exports malicious cell                             | Escape leading `=`, `+`, `-`, `@`, tab, CR                                                                       | Export tests                  |
| Email header injection            | Newlines in name/email fields                            | Strict Zod email/length validation, Resend API, no raw headers                                                   | Validation tests              |
| Open redirect                     | `next`/return URL abuse                                  | No user-controlled redirects; fixed destinations; allowlist                                                      | Route tests                   |

## 6. Authentication

### 6.1 Accounts

- Admin accounts only. There is no public registration or customer login.
- Roles:
  - `owner`: manage admins, security settings, audit log, all content/bookings.
  - `admin`: manage content/bookings/photos; no admin-user or security settings.
- Accounts are created by an owner invite or a one-time CLI bootstrap. No seeded password is committed.

### 6.2 Passwords

- Argon2id via `@node-rs/argon2`.
- Parameters calibrated on the production host to a target verification time of roughly 200–300 ms, with memory cost not less than 64 MiB.
- Minimum 12 characters, maximum 128, allow passphrases, no composition rules.
- Reject known common passwords and obvious site-specific values.
- Password change requires current password and a fresh MFA check.
- Password reset invalidates all existing sessions.
- Password hashes never leave the server and are never logged.

### 6.3 Login flow

1. Apply IP rate limit before password verification.
2. Validate email/password shape with Zod.
3. For unknown email, perform a dummy Argon2 verification to reduce timing differences.
4. Apply per-account throttling.
5. Verify password hash.
6. If valid and MFA enabled, require TOTP before creating a session.
7. On success:
   - reset failed-attempt counters
   - create a new session
   - rotate/clear pre-auth state
   - record audit event
8. Return generic failure messages for invalid credentials, unknown accounts, or disabled accounts.
9. Never log passwords, session tokens, MFA codes, or full emails.

### 6.4 MFA

- TOTP (RFC 6238) mandatory for every admin account.
- Secret generated server-side, displayed once as a QR code, encrypted with AES-256-GCM using `MFA_ENCRYPTION_KEY`.
- Accept ±1 time step for clock drift.
- Prevent replay of a previously used time step.
- Ten one-time recovery codes, stored only as hashes.
- Setup displays recovery codes once from a short-lived encrypted HttpOnly cookie (10 minutes); the plaintext codes are never stored in the database or written to logs.
- MFA verification attempts are rate-limited.
- Lost MFA requires owner-assisted reset with audit logging and identity verification outside the system.

### 6.5 Password reset and invites

- Token: 32 bytes from `crypto.randomBytes`, stored only as SHA-256 hash.
- Single-use, 30-minute expiry.
- Invite tokens use the same table with a `purpose` field.
- Reset links are served with `Referrer-Policy: no-referrer`.
- Reset request always returns a generic response.
- Rate-limited by IP and account.
- Successful reset revokes all sessions and requires MFA re-enrolment or re-verification as appropriate.

## 7. Sessions, Cookies, and CSRF

### 7.1 Sessions

- Opaque random 256-bit session token.
- Only SHA-256 token hash stored in `admin_sessions`.
- Login always creates a new session; never reuse a pre-auth identifier.
- Idle timeout: 60 minutes.
- Absolute timeout: 12 hours.
- Last-seen writes throttled to avoid unnecessary database writes.
- Session record includes IP hash and user-agent hash for audit, not hard binding.
- Logout revokes the session. “Sign out everywhere” revokes all sessions.
- Password change, role change, account disable, and reset revoke relevant sessions.

### 7.2 Cookie

Production admin cookie:

```text
Name:     __Host-gl_admin
Secure:   yes
HttpOnly: yes
SameSite: Strict
Path:     /
Domain:   omitted
```

The cookie is never placed in URLs, logs, or client-readable storage. Development may use a non-`__Host-` equivalent on localhost.

### 7.3 CSRF

- Synchronizer token bound to the session, stored as a hash.
- Included as a hidden field in forms and an `X-CSRF-Token` header for admin fetches.
- Validated with a timing-safe comparison on every state-changing admin request.
- Origin and `Sec-Fetch-Site` checked on mutations.
- No cross-origin CORS policy for authenticated endpoints; requests from other origins are rejected.
- `SameSite=Strict` is an additional layer, not the only control.

### 7.4 Admin response caching

- `Cache-Control: no-store` on admin pages, auth flows, and admin APIs.
- `X-Robots-Tag: noindex, nofollow` for admin.
- `robots.txt` disallows `/admin`.
- No admin data in shared caches.

## 8. Authorization

- Every admin page, Route Handler, and Server Action calls `requireAdmin()` or `requireOwner()`.
- Proxy may redirect early, but it is **not** the authorization boundary.
- The server layout validates the session and loads the current admin.
- Object-level checks happen in the service layer, using the authenticated admin ID.
- Public queries return only published/approved records.
- Hidden UI elements are convenience only; the API enforces the same rule.
- Audit entries record actor, action, entity, result, IP hash, and user-agent hash.

## 9. Database Security

### 9.1 Roles

| Role               | Purpose                                 | Restrictions                                                   |
| ------------------ | --------------------------------------- | -------------------------------------------------------------- |
| `golanka_migrator` | Migrations/seeding                      | Not used at runtime; separate credential                       |
| `golanka_public`   | Public reads and public write functions | No access to bookings, auth, audit, private photos             |
| `golanka_auth`     | Login/session/reset/MFA                 | Limited to auth tables and required columns                    |
| `golanka_admin`    | Authenticated admin content/bookings    | No DDL; no auth-secret access beyond required admin operations |

- Separate connection pools per role.
- `PUBLIC` schema creation revoked from all app roles.
- Runtime roles have no `CREATEROLE`, `SUPERUSER`, or `BYPASSRLS`.
- `MIGRATION_DATABASE_URL` exists only in the deployment/migration environment, never in the running app.
- PostgreSQL runs natively on the host and listens only on localhost/private host networking; it has no public port.
- TLS is required if the database ever moves off-host.

### 9.2 RLS

- RLS enabled on all application tables. Runtime roles are subject to it; the migration owner bypasses it only outside the running application.
- Public role policies expose only published packages/destinations/reviews/travel-info/settings, and public availability is exposed through a validated function.
- Public booking/photo writes go through `SECURITY DEFINER` functions.
- Functions:
  - fixed `search_path`
  - validate inputs and constraints
  - revoke execute from `PUBLIC`
  - grant execute only to the required role
- Auth role can read only the credential fields and manage only its own flow tables.
- Admin role can read/write content, bookings, availability, reviews, photos, settings, and audit inserts.
- Audit log is insert/select only for application roles; update/delete revoked.

### 9.3 Query rules

- Parameterized queries only.
- No string interpolation into SQL.
- No dynamic table/column identifiers from request data.
- Transactions for multi-step invariants.
- `statement_timeout`, `lock_timeout`, and idle-in-transaction timeout set at the role/pool level.
- Bounded connection pools.
- Row locking or advisory locks for booking capacity changes.
- Database constraints back up application validation.

## 10. Input, Output, and Browser Security

### 10.1 Validation

- Zod schemas shared between client and server.
- Strict object shapes where appropriate; unknown fields rejected or stripped.
- Length caps on every string and array.
- Format validation for email, phone, country, dates, slugs, currency, and enums.
- Content-Type checked.
- Request body size capped before expensive parsing.
- File uploads handled by a dedicated streaming/size-limited path.

### 10.2 XSS

- React escaping for all text.
- No `dangerouslySetInnerHTML` for user/admin content.
- Travel information stored as structured blocks, not raw HTML.
- JSON-LD serialized with `<`, `>`, `&`, and line separators escaped.
- AI output rendered as text and validated; never injected as HTML.
- CSP with nonces and `strict-dynamic`; no broad `unsafe-inline` for scripts.
- Inline styles limited to what the framework requires; evaluated during CSP testing.

### 10.3 SQL injection

- Covered by section 9.3.
- Search/filter/sort values mapped through allowlists, never used as SQL identifiers.

### 10.4 SSRF and redirects

- No user-supplied URLs are fetched.
- Exchange-rate host is a fixed allowlist entry.
- Anthropic and Resend base URLs are fixed by the SDK/provider.
- No open redirects; success/return paths are fixed constants.
- Canonical URLs use `NEXT_PUBLIC_SITE_URL`, not the request Host header.

### 10.5 CSV export

- Cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with a single quote and quoted.
- Export requires an authenticated admin and CSRF-safe request semantics.
- `Content-Disposition: attachment`.
- No formula execution on open.

## 11. File Upload Security

Accepted public photo types: JPEG, PNG, WebP only.

Limits:

- 5 MB uploaded size
- Maximum 40 megapixels
- Maximum dimension 4096 px after resize
- No SVG, GIF, HEIC, or video

Pipeline:

1. For public UGC, Turnstile + rate limit before accepting bytes. Admin uploads require a session, same-origin request and CSRF token.
2. Enforce request size before full buffering.
3. Verify extension, declared MIME, and magic bytes.
4. Decode with `sharp`; reject decode failure.
5. Re-encode to WebP.
6. Strip all metadata, including EXIF/GPS.
7. Generate a random UUID filename; never use the submitted filename.
8. Write to a private directory using an atomic temp-file move.
9. Store metadata and status in the database.
10. Serve only approved images through an application route that checks status.
11. Delete rejected files on retention cleanup.

Additional rules:

- Resolve and verify the final path remains inside the media root.
- Serve with `X-Content-Type-Options: nosniff`, correct `Content-Type`, and no executable content.
- Admin media is re-encoded the same way.
- Alt text is required for admin-uploaded content; UGC alt text is set or approved by moderation.
- Consent confirmation is required before accepting a photo submission.
- Rejected private files are inaccessible via direct URL.
- Approved image responses recheck moderation status and use `Cache-Control: no-store`, so withdrawing approval takes effect immediately.
- Reviews and travel information are admin-only writes; there is no public review or content-write endpoint.

## 12. Abuse and Rate Limiting

Controls:

- Cloudflare Turnstile on contact, booking, photo upload, and optionally tour builder.
- Server-side Turnstile verification with action and hostname checks; fail closed.
- Cloudflare's public test keys are accepted only when the configured site hostname is localhost/127.0.0.1. A production domain rejects them.
- Honeypot field on public forms.
- Body-size caps and JSON shape checks.
- Database-backed atomic rate limits.
- Booking creation is a `SECURITY DEFINER` database function with row locking; pending requests count as holds; confirmation increments `booked` only after the admin confirms; cancellation decrements it atomically.
- Booking requests carry a high-entropy idempotency key to prevent duplicate submissions. Dates and package publication are rechecked server-side.
- Cloudflare edge protections and origin firewall.
- Email sending quotas.
- AI daily token/cost budget.
- Idempotency keys for booking submissions.

Proposed defaults, configurable:

| Endpoint       | Limit                              |
| -------------- | ---------------------------------- |
| Contact        | 5/hour per IP + per email hash     |
| Booking        | 5/hour per IP + per email hash     |
| Photo upload   | 3/day per IP                       |
| Tour builder   | 5/day per IP + global daily budget |
| Admin login    | 5/15 min per IP and per account    |
| MFA verify     | 5/15 min per session/account       |
| Password reset | 3/hour per IP and per account      |

Rate-limit keys use hashed IPs, not raw IPs. Cleanup runs daily.

## 13. AI Security

- Anthropic API called only from the server.
- API key never in `NEXT_PUBLIC_*`, client bundles, logs, or error messages.
- System prompt defines task and constraints; user free text is serialized as data, not concatenated into instructions.
- Context includes only published destinations/packages.
- No tools, browsing, shell, or external callbacks are exposed to the model.
- Output must match the Zod schema.
- Every destination slug and package slug must exist in the supplied context.
- Activities are checked against the known activity vocabulary.
- Price range is computed in code from package data; model output cannot set prices.
- One retry on schema failure, then a safe fallback with contact link.
- Input length, output tokens, request duration, and daily spend are capped.
- Session logs contain quiz answers and itinerary, hashed IP, no name/email.
- Model output is rendered as text and links are constructed server-side from validated slugs.
- Turnstile, a 5/day per-IP limit, and a 100/day global limit protect the AI route.
- PDFs are stored privately; download links use 32-byte capability tokens stored only as hashes, expire after seven days, and are served with `no-store` and `Content-Disposition: attachment`.
- Quote creation rechecks the stored AI session, revalidates contact/travel data, applies Turnstile and rate limits, and creates a custom booking.
- The exchange-rate provider URL is server-configured and validated; cron calls require the `CRON_SECRET` bearer header. Currency cookies are limited to the four allowed codes.
- Currency is a display preference only; bookings and stored prices remain LKR or explicitly recorded quoted currency.
- Privacy policy discloses that trip preferences are sent to Anthropic and that generated PDFs/session data are retained temporarily.

## 14. Email Security

- Resend with a verified sending domain.
- SPF, DKIM, and DMARC configured and monitored.
- From address fixed by configuration; user input never controls it.
- User input escaped in HTML and plain-text templates.
- No attachments or remote content fetched from user input.
- Reset links use single-use tokens and no-referrer policy.
- Rate limits prevent email flooding.
- Bounce/complaint handling documented.
- No secrets, password hashes, or session tokens in email.

## 15. Headers, Cookies, and CSP

Production headers:

```text
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Content-Security-Policy: nonce-based, strict-dynamic, explicit connect/img/frame allowlists
```

- HSTS preload only after all subdomains are HTTPS-ready.
- CSP starts in report-only during development, then enforced before launch.
- CSP report endpoint is rate-limited and must not log PII.
- Turnstile and any other third-party origins are explicitly allowlisted.
- Admin/auth responses: `Cache-Control: no-store`.
- Cookie rules are covered in section 7.
- `/.well-known/security.txt` provides a security contact.

## 16. Infrastructure Security

### Host

- Ubuntu LTS or equivalent, minimal installed packages.
- SSH key-only authentication; root login disabled; non-root deploy user.
- UFW/firewall allows only SSH and HTTP/HTTPS, with SSH restricted where possible.
- Origin HTTP/HTTPS restricted to Cloudflare IP ranges, or access only via Cloudflare Tunnel.
- fail2ban for SSH and auth abuse.
- unattended-upgrades enabled; reboot window documented.
- Time synchronization enabled.
- No database port exposed.
- Disk usage and log rotation monitored.
- Host snapshots plus application-level backups.

### Cloudflare

- DNS proxied through Cloudflare.
- TLS: Full (Strict) or Tunnel; no Flexible mode.
- WAF managed rules and rate limiting where available.
- No direct origin hostname/public IP in DNS records.
- Only trust `CF-Connecting-IP` when the request originates from a Cloudflare IP.
- CAA and DNSSEC configured.
- Cache rules exclude `/admin`, `/api`, auth, and personalized responses.
- HSTS configured at origin and/or edge.

### Caddy

- Automatic TLS certificate management.
- HTTP to HTTPS redirect.
- Security headers.
- Request size and timeout limits.
- Reverse proxy to app over private network.
- No directory listing.
- Admin and API not cached publicly.

### Container / native service

- Official pinned base images; prefer digest pinning.
- App container runs as non-root.
- Read-only root filesystem; writable only for required temp/media paths.
- `no-new-privileges`, drop all capabilities, add back only required ones.
- CPU/memory limits and health checks.
- No Docker socket mount.
- PostgreSQL is native on the host, not in a container. It listens only on localhost/private host networking; the app connects over that private path.
- Secrets supplied at runtime, not baked into images.
- Image scanning in CI.
- Log rotation configured.
- If the app is later run under systemd instead of a container, apply equivalent `ProtectSystem`, `ProtectHome`, `PrivateTmp`, `NoNewPrivileges`, user, and resource limits.

## 17. Secrets Management

- Secrets live in a host env file with mode `600` owned by the deploy user, or Docker secrets.
- `.env*` files are gitignored; `.env.example` contains placeholders only.
- Only `NEXT_PUBLIC_*` values are browser-visible.
- Startup validation rejects missing or malformed secrets in production.
- Secrets never appear in logs, errors, client components, source maps, or build output.
- Database role passwords are distinct and long.
- `MIGRATION_DATABASE_URL` is absent from the running app environment.
- `IP_HASH_SECRET` and `MFA_ENCRYPTION_KEY` are 32-byte random values.
- Rotation procedure documented for all keys; sessions revoked as needed.
- GitHub Actions uses environment-scoped secrets, minimal permissions, and pinned action SHAs.

## 18. Logging, Monitoring, and Privacy

### Logging

- Structured JSON logs to stdout with request ID.
- No passwords, tokens, cookies, MFA codes, raw IPs, full emails, phone numbers, messages, or uploaded content.
- Redaction allowlist enforced in the logger.
- Security events recorded in `admin_audit_log`:
  - login success/failure
  - MFA success/failure
  - logout and revocation
  - password reset
  - admin/user changes
  - CRUD changes to content/bookings
  - status transitions
  - CSV exports
  - settings changes
- Audit rows are append-only for app roles.

### Monitoring

- Uptime check for homepage and health endpoint.
- Disk, memory, DB connections, backup success, and certificate expiry alerts.
- Error-rate monitoring from logs; no external error tracker unless approved.
- Periodic review of failed logins, rate-limit spikes, and AI spend.

### Privacy

- Privacy policy discloses data collected, processors (Anthropic, Resend, hosting, Cloudflare), retention, and deletion request process.
- Data minimisation: no unnecessary account data, no analytics cookies in v1.
- Essential cookies only: admin session, CSRF, currency preference.
- Photo consent and rights confirmation required.
- Retention defaults (to be legally reviewed):
  - rate limits: 24 hours
  - AI sessions: 30 days
  - rejected photo files: 30 days
  - audit logs: 12 months
  - bookings: business/legal requirement, to be confirmed
  - backups: 30–90 days
- Data-subject requests handled by a documented contact process.

## 19. Backups and Recovery

- Nightly PostgreSQL dump.
- Nightly media snapshot/tar.
- Encrypt before upload with `age` or equivalent; encryption keys kept offline/separate.
- Off-site storage in a separate provider/account with write-only credentials.
- Retention: daily 14–30 days, weekly 8–12 weeks, monthly as required.
- Backups include PII and password hashes; bucket is private and encrypted.
- Restore runbook and quarterly restore drill.
- Backup success/failure alerts.
- Environment secrets backed up separately in a password manager, not in the database backup.
- Documented RPO/RTO targets, subject to budget: target RPO 24 hours, RTO same business day for a small deployment.

## 20. Supply Chain and Secure Development

- Commit lockfile; CI uses `npm ci`.
- CI fails on high-severity production dependency advisories. Full audits are reviewed; the known dev-only `eslint-config-next`/`braces` advisory is documented here and does not enter the production bundle.
- Dependabot is configured for npm and GitHub Actions.
- Minimal dependency policy; new dependencies require approval.
- GitHub Actions are pinned by commit SHA with least-privilege `GITHUB_TOKEN`.
- Secret scanning runs in CI with `gitleaks`.
- Branch protection and review before production deploy.
- No production secrets in local development.
- Separate staging/production databases and keys.
- Security acceptance checklist in every phase.
- Migration review for grants, functions, and RLS changes.

## 21. Security Verification Before Launch

- OWASP ASVS Level 2 checklist completed.
- Authentication tests:
  - brute force/rate limits
  - password reset enumeration and token reuse
  - MFA replay and recovery codes
  - session fixation, expiry, revocation
  - CSRF rejection
  - cookie flags
- Authorization tests:
  - anonymous vs admin vs owner
  - admin route bypass attempts
  - IDOR on bookings/photos
  - unapproved photo access
- Injection/XSS tests on filters, forms, captions, content, AI output.
- Upload tests: spoofed MIME, SVG, polyglot, oversized, decompression bomb, path traversal.
- Booking concurrency and oversell tests.
- Rate-limit and Turnstile failure tests.
- CSV formula-injection test.
- Header/CSP/cookie review.
- OWASP ZAP baseline scan against staging.
- Dependency audit, secret scan, container image scan.
- Backup restore drill.
- VPS, container, or systemd hardening checklist.
- External penetration test if budget allows.
- Incident response contact and runbook verified.

## 22. Incident Response

Minimum runbook:

1. Triage severity and affected accounts/systems.
2. Contain: disable affected admin, revoke sessions, block IPs, take site to maintenance if needed.
3. Preserve evidence: logs, audit rows, relevant backups; do not overwrite.
4. Rotate affected secrets: DB passwords, session/MFA keys, AI/email/API keys.
5. Restore from a verified backup if integrity is affected.
6. Notify the client and, where legally required, affected users/regulators.
7. Write a postmortem with root cause and control changes.
8. Re-test the affected control and update the threat model.

Security contact to be published in `/.well-known/security.txt` once the domain is known.

## 23. Residual Risks and Accepted Trade-offs

- **Single VPS:** no high availability; hardware/provider failure causes downtime. Mitigated by backups and monitoring, not eliminated.
- **Self-managed infrastructure:** the team owns patching, hardening, and incident response; a managed platform would shift some of this but exceed the budget.
- **Budget-limited testing:** external penetration testing may not fit the budget; at minimum, ASVS review, automated scans, and internal adversarial testing are required.
- **Cloudflare free tier:** some advanced WAF/rate-limiting features are unavailable.
- **Admin usability:** mandatory MFA and short sessions add friction; recovery procedures must be documented.
- **AI provider dependency:** outages, model changes, and data-processing terms are outside our control.
- **No absolute security:** controls reduce risk but cannot guarantee against unknown vulnerabilities or compromised endpoints.
- **Legal retention:** booking/PII retention must be confirmed by the client/legal adviser before launch.
