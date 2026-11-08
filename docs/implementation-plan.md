# Implementation Plan — Sri Lanka Tours Platform

**Status:** P5 implementation complete — P0–P5 implemented, security-first  
**Source:** `instructions.md`  
**Date:** 2026-10-23

> This revision replaces the Supabase/BaaS architecture in the earlier draft. All product scope and behaviour in `instructions.md` still applies unless explicitly changed below. P0 is implemented, bootstrapped, migrated, seeded, and verified on the local PostgreSQL database. P1 adds the public foundation, contact flow, package listing, WhatsApp wiring and SEO basics. P2 adds the filterable catalogue, package detail pages, admin authentication, content CRUD, itinerary/gallery editing, image uploads, settings, sessions, team invitations and audit log. P3 adds availability management, public booking requests, transactional capacity handling, booking emails, admin booking workflows, status transitions and CSV export. P4 adds the district SVG map, reviews, the travel information hub, moderated photo submissions and public photo serving. P5 adds multi-currency, an exchange-rate cron, the AI tour builder with structured output and guarded fallback, expiring PDFs and custom quote requests.

## 1. Change of Direction

Supabase is no longer part of the architecture.

The replacement is:

- A custom backend built inside the Next.js server runtime
- PostgreSQL as the database
- Custom admin authentication and session management
- Local file storage with off-site encrypted backups
- A hardened single-VPS deployment
- Cloudflare in front of the origin
- Security treated as a release requirement, not a later hardening pass

Supabase access is no longer needed.

“Custom backend” here means a **modular monolith**: Next.js server code, Route Handlers, and Server Actions backed by PostgreSQL. Business logic lives in server-only modules and is never importable by client components. A separate API process is not recommended for this scale because it adds another attack surface, CORS/session complexity, and operational overhead without improving the security boundary. If a separate API service is required, the plan must be adjusted before P0.

## 2. Security Position

The target is **OWASP ASVS Level 2** across the application, with **Level 3-style controls for authentication and administration**. Security controls will be documented, tested, and verified before launch.

This does not mean “unbreakable.” It means:

- No BaaS control plane or exposed database API
- No direct database access from the browser
- Defence in depth: application authorization, least-privilege database roles, and RLS
- Established cryptography and authentication primitives; no custom crypto
- Secure defaults and fail-closed behaviour
- Every security-sensitive change reviewed and tested
- Independent penetration testing recommended before launch

Detailed threat model and controls: [security-architecture.md](./security-architecture.md).

## 3. Recommended Architecture

```text
Browser
  |
Cloudflare (TLS, WAF, DNS, DDoS, caching)
  |
Caddy (TLS termination, headers, reverse proxy)
  |
Next.js application (public site + admin + custom API)
  |-- PostgreSQL 17, native service on the host, no public port
  |-- Local media storage (public media + private submissions)
  |-- Resend (outbound email)
  |-- DeepSeek API (outbound AI)
  |-- Exchange-rate API (outbound)

Host systemd timers
  |-- rate/exchange-rate refresh
  |-- cleanup jobs
  |-- encrypted PostgreSQL + media backup -> off-site object storage
```

### Why this shape

- No monthly BaaS production plan.
- No PostgREST/anon-key exposure; all access is through validated server code.
- One deployable application is easier to keep patched and audited than several services.
- PostgreSQL remains available for transactions, constraints, RLS, and booking concurrency.
- The existing Contabo VPS is a deliberate single-node deployment. It is a single point of failure and requires disciplined operations.
- PostgreSQL runs natively on the VPS; local development uses the installed PostgreSQL 17 Windows service. Docker is not required for the database.

## 4. Cost Envelope

The VPS and domain are already purchased. Remaining incremental costs are backups, off-site storage, email, and monitoring:

| Item                       | Expected cost                    |
| -------------------------- | -------------------------------- |
| Contabo VPS                | Already purchased                |
| Domain                     | Already purchased                |
| Cloudflare DNS/WAF/TLS     | Free tier                        |
| Resend email               | Free tier if volume fits         |
| Cloudflare Turnstile       | Free                             |
| Off-site encrypted backups | Free/very low at expected volume |
| Uptime monitoring          | Free tier                        |

A managed database or platform-as-a-service is intentionally avoided. The existing VPS must be hardened; a single node has no high availability.

## 5. Stack

| Layer          | Choice                                                            |
| -------------- | ----------------------------------------------------------------- |
| Frontend       | Next.js App Router, React, TypeScript strict                      |
| Styling        | Tailwind CSS, shadcn/ui                                           |
| Backend        | Next.js Route Handlers, Server Actions, server-only service layer |
| Database       | PostgreSQL 17                                                     |
| DB access      | `pg` with parameterized SQL and repository/service modules        |
| Migrations     | Versioned SQL migrations via `node-pg-migrate`                    |
| Validation     | Zod shared between client and server                              |
| Forms          | React Hook Form + Zod resolver                                    |
| Admin auth     | Custom: Argon2id, TOTP MFA, opaque server-side sessions           |
| Sessions       | Random 256-bit tokens, SHA-256 hash stored in DB                  |
| Storage        | Local filesystem with an abstractions layer; off-site backup      |
| Images         | `sharp` re-encoding, metadata stripping, WebP conversion          |
| Email          | Resend                                                            |
| Bot protection | Cloudflare Turnstile + honeypot + rate limits                     |
| AI             | DeepSeek chat completions API via server-only `fetch`             |
| Reverse proxy  | Caddy                                                             |
| Deployment     | Contabo VPS; hardened app container or systemd service (P6)       |
| Database host  | Native PostgreSQL 17 on the VPS; native Windows service locally   |
| CI             | GitHub Actions                                                    |
| Monitoring     | UptimeRobot or equivalent, structured logs, backup alerts         |

## 6. Routes

### Public

- `/`
- `/about`
- `/packages`
- `/packages/[slug]`
- `/map`
- `/reviews`
- `/travel-info`
- `/tour-builder`
- `/contact`
- `/privacy`
- `/terms`
- `/booking/success`
- 404
- `/photos/[id]` — approved photo only
- `/media/...` — admin-uploaded public media only

### Admin

- `/admin/login`
- `/admin`
- `/admin/packages`
- `/admin/packages/[id]`
- `/admin/destinations`
- `/admin/bookings`
- `/admin/availability`
- `/admin/reviews`
- `/admin/photos`
- `/admin/travel-info`
- `/admin/settings`
- `/admin/settings/team` — owner only
- `/admin/settings/sessions`
- `/admin/audit` — owner only

Admin user management and audit visibility are additions required by custom authentication and the security requirement. They are not customer-facing scope expansion.

### API

| Route                        | Method | Notes                                  |
| ---------------------------- | ------ | -------------------------------------- |
| `/api/contact`               | POST   | Rate-limited, Turnstile, email         |
| `/api/bookings`              | POST   | Rate-limited, Turnstile, transactional |
| `/api/photos`                | POST   | Upload, re-encode, private storage     |
| `/api/tour-builder`          | POST   | SSE progress + validated JSON result   |
| `/api/cron/rates`            | POST   | Bearer secret, exchange-rate refresh   |
| `/api/cron/retention`        | POST   | Bearer secret, retention cleanup       |
| `/admin/bookings/export`     | GET    | Authenticated, role-checked CSV        |
| `/admin/photos/[id]/preview` | GET    | Authenticated private preview          |
| `/admin/uploads`             | POST   | Authenticated admin image upload       |

Admin mutations use Server Actions. Public writes use Route Handlers.

## 7. Folder Structure

```text
db/
  migrations/
  seed.sql
  seed.dev.sql
docs/
ops/
  docker/
  caddy/
  systemd/
  backup/
scripts/
src/
  app/
    (site)/
    admin/
    api/
  components/
    ui/
    layout/
    map/
    packages/
    booking/
    tour-builder/
    admin/
  content/
    strings.ts
    map-regions.ts
  lib/
    currency/
    dates/
    seo/
    validation/
    client/
  server/
    db/
      pools.ts
      query.ts
      transaction.ts
    auth/
      password.ts
      sessions.ts
      mfa.ts
      csrf.ts
      require-admin.ts
      reset.ts
      audit.ts
    repositories/
    services/
      bookings.ts
      availability.ts
      ai.ts
      photos.ts
      content.ts
    security/
      rate-limit.ts
      request.ts
      headers.ts
      redact.ts
    storage/
    email/
    ai/
  proxy.ts
tests/
  unit/
  integration/
  e2e/
```

Rules:

- `src/server/*` imports `server-only`.
- `src/lib/*` is client-safe.
- No database imports from client components.
- Business logic lives in services, not route handlers or components.
- Route handlers and Server Actions stay thin: authenticate, validate, call service, serialize response.

## 8. Data Model

### 8.1 Content and operations

| Table                  | Notes                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `destinations`         | Name, slug, region, description, hero image + alt, map region ID, coordinates, best season, highlights, timestamps                                                               |
| `packages`             | Title, slug, summary, duration, LKR base price, activities, hero image + alt, gallery JSONB `{path,alt}`, inclusions, exclusions, publication/featured flags                     |
| `package_destinations` | Composite primary key                                                                                                                                                            |
| `itinerary_days`       | Unique `(package_id, day_number)`                                                                                                                                                |
| `availability`         | Unique `(package_id, date)`, capacity/booked constraints, status enum                                                                                                            |
| `bookings`             | Unique reference, package nullable, type, contact fields, travel date, party size, message, custom itinerary JSONB, status, currency, quoted total, admin notes, idempotency key |
| `reviews`              | Package, author, country, rating 1–5, title, body, verification/publication flags                                                                                                |
| `photo_submissions`    | Package optional, image path, caption, alt text, submitter name, consent flag, status                                                                                            |
| `exchange_rates`       | Base LKR, USD/EUR/GBP rates, fetched timestamp                                                                                                                                   |
| `ai_sessions`          | Quiz JSON, itinerary JSON, hashed IP, timestamps                                                                                                                                 |
| `site_settings`        | WhatsApp, contact email, phone, socials                                                                                                                                          |
| `travel_info_sections` | Slug, title, summary, structured content JSONB, FAQ JSONB, order, publication                                                                                                    |
| `rate_limits`          | Atomic fixed-window counters for public and auth routes                                                                                                                          |

### 8.2 Authentication and security

| Table                      | Notes                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `admin_users`              | Email, password hash, role, active flag, MFA encrypted secret, MFA state, failed attempts, lock state, last login |
| `admin_sessions`           | Token hash, CSRF secret hash, admin ID, idle/absolute expiry, IP hash, user-agent hash, revoked timestamp         |
| `admin_password_tokens`    | Hashed single-use reset/invite token, expiry, purpose, used timestamp                                             |
| `admin_mfa_recovery_codes` | Hashed one-time recovery codes                                                                                    |
| `admin_audit_log`          | Actor, action, entity, IP hash, user-agent hash, metadata, timestamp                                              |

### 8.3 Database roles and RLS

Runtime roles:

| Role               | Access                                                           |
| ------------------ | ---------------------------------------------------------------- |
| `golanka_public`   | SELECT published public views; EXECUTE specific public functions |
| `golanka_auth`     | Limited access to admin credential/session/reset/MFA tables      |
| `golanka_admin`    | Content, booking, availability, review, photo and settings CRUD  |
| `golanka_migrator` | Schema owner; used only for migrations/seeding, never by the app |

- RLS enabled on every table, including auth tables.
- Public writes to bookings and photos go through `SECURITY DEFINER` functions with fixed `search_path`, input checks, and revoked `PUBLIC` execute.
- Public role cannot SELECT bookings, sessions, admin users, audit logs, or private photo records.
- Admin actions still check session and role in the application; RLS is a second boundary.
- Runtime roles have no DDL rights and no direct internet-facing database access.
- Database is bound to localhost/private host networking; it has no public port.

### 8.4 Booking rules

- Request creates a pending booking and counts as a hold against effective capacity.
- `availability.booked` increments only when an admin confirms.
- Confirmation/cancellation runs in a transaction with row/advisory locking.
- Idempotency key prevents duplicate submissions.
- `quoted_total` is stored in the booking’s `currency_shown` currency.
- Packages with booking history are archived, not hard-deleted.

## 9. Authentication and Administration

Detailed design is in [security-architecture.md](./security-architecture.md).

Summary:

- Admin accounts only; no public registration.
- Roles: `owner` and `admin`.
- Argon2id password hashes, calibrated server-side.
- TOTP MFA mandatory for all admins; recovery codes hashed and one-time.
- Opaque sessions with hashed tokens, rotation, idle and absolute expiry, revocation.
- Session cookie: `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Strict`.
- CSRF synchronizer token plus Origin/Sec-Fetch-Site checks on state-changing admin requests.
- Login rate limits per IP and per account; generic errors; dummy hash verification for unknown accounts.
- Password reset and invite tokens hashed, single-use, short-lived.
- Owner-only admin user management and audit log.
- Admin pages noindex and no-store.
- Every admin Route Handler/Server Action calls `requireAdmin()`/`requireOwner()`.

## 10. Security Controls

- Threat model maintained in `security-architecture.md`.
- Parameterized SQL only; no string-built queries or dynamic identifiers from user input.
- Zod validation with length caps and strict object shapes.
- React escaping; no raw HTML; JSON-LD safely serialized.
- CSP with nonces, HSTS, frame denial, nosniff, referrer and permissions policies.
- Cloudflare Turnstile on public forms, honeypots, body-size caps, and rate limits.
- Upload validation by size, extension, MIME, magic bytes, decoding, and re-encoding.
- No SVG/GIF uploads; EXIF/metadata stripped; private UGC storage.
- AI input treated as data, output schema-validated, model pricing ignored, slugs checked against published data.
- Secrets server-side only, validated at startup, never logged.
- Least-privilege database roles; service/migration credentials separated.
- No PII in logs; salted IP hashes only.
- Encrypted off-site backups with restore tests.
- VPS hardening, container hardening, firewall, SSH keys only, automatic updates.
- Dependency audit, secret scanning, SAST/ZAP checks, and pre-launch security review.

## 11. Delivery Phases

### P0 — Setup and Security Foundation

1. Initialise git, Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, ESLint, Prettier.
2. Configure neutral design tokens and typed `strings.ts`; mark brand values TODO.
3. Add environment validation and `.env.example`. `.env.local` stays gitignored.
4. Provision local PostgreSQL 17 natively and create the development database and roles.
5. Create PostgreSQL migrations for schema, roles, grants, RLS, functions, triggers, indexes, and storage layout.
6. Implement auth primitives: Argon2id, sessions, CSRF, TOTP MFA, reset/invite tokens, audit log, `requireAdmin`/`requireOwner`.
7. Add rate-limit functions and cleanup.
8. Add secure headers/CSP baseline, request IDs, structured logging, and redaction.
9. Add a hardened Dockerfile, Caddy configuration, and deployment skeleton for the app.
10. Add CI: lint, typecheck, unit tests, build, dependency audit, secret scan, migration test.
11. Finalise threat model and security acceptance checklist.
12. Public layout shell and WhatsApp/contact placeholders.

**Gate:** migration succeeds from empty DB; roles and RLS verified; auth primitives tested; CI passes; no secrets committed; security headers present.

**Blockers:** the main local PostgreSQL service still needs the one-time bootstrap. Dependencies, hosting, role model, and storage decisions are approved.

### P1 — Foundation

1. Home, About, Contact, 404, basic package list, WhatsApp button, site-wide layout.
2. Contact API with Zod, Turnstile, honeypot, rate limit, email delivery, generic responses.
3. SEO basics: metadata, canonical, OG/Twitter defaults, `TravelAgency` JSON-LD, robots/sitemap baseline.
4. Legal placeholders clearly marked.
5. Empty/loading/error states.
6. Security tests for contact abuse and header/cookie behaviour.

**Gate:** public flows tested at 375px/desktop; no PII logs; contact abuse controls verified.

**Blockers:** brand design assets and approved About/legal copy.

### P2 — Packages and Admin

1. Filterable catalogue with URL state and server rendering.
2. Package detail: gallery, itinerary, inclusions/exclusions, price, WhatsApp prefill.
3. Admin login, MFA enrolment, reset flow, session management.
4. Admin shell, dashboard, package CRUD, destination CRUD, itinerary editor, gallery ordering.
5. Image upload: server validation, re-encode, metadata strip, required alt text, preview.
6. Settings module and owner-only team management.
7. Audit log UI and immutable audit writes.
8. Authorization tests: anonymous, admin, owner, IDOR, CSRF, session expiry, file upload.

**Gate:** drafts never public; auth bypass tests fail closed; upload tests reject malformed/polyglot files; every admin mutation audited.

### P3 — Booking

1. Availability admin calendar with capacity, status and bulk editing.
2. Public availability calendar using date-only values in UTC.
3. Booking API with shared Zod schema, Turnstile, honeypot, rate limits, idempotency.
4. Transactional booking function with pending-hold accounting and concurrency tests.
5. Reference generation, customer email, admin notification, success page.
6. Admin bookings: filters, detail, notes, status transitions, CSV export.
7. Confirm/cancel transaction maintains `booked` correctly.
8. Tests: oversell prevention, duplicate submissions, closed dates, race conditions, CSV injection.

**Gate:** concurrent requests cannot oversell; status transitions are atomic; email failures do not lose bookings; CSV cells are escaped.

**Blockers:** Resend domain verification and booking-hold policy confirmation.

### P4 — Content

1. Licensed/public-domain Sri Lanka geometry converted to static SVG; approved region mapping.
2. Accessible, touch-friendly map with keyboard operation and compact home version.
3. Reviews admin CRUD, public page, package sections, AggregateRating when eligible.
4. Travel info hub with structured content editor and FAQ sections.
5. Photo wall: consent, Turnstile, upload re-encode, private storage, moderation, approved-only serving.
6. Tests: unapproved photo access denied, upload abuse, XSS in captions, map keyboard navigation.

**Gate:** UGC cannot become public without approval; uploaded files never execute; map is operable without a mouse; facts marked TODO are not published.

**Blockers:** map geometry/licence, destination content, photos/stock decision, UGC terms.

### P5 — AI, PDF and Currency

1. Currency cookie, country default, header switcher, indicative-price note.
2. Exchange-rate provider adapter, daily cron, last-known fallback, response validation.
3. Add structured hotel/meal/activity data to the admin model after client confirms the exact fields (see `docs/ai-tour-builder.md`).
4. Tour builder quiz and SSE generation route.
5. Server-only DeepSeek prompt with published destinations, hotels, meals, activities, packages and pricing context; input caps; no tools; output schema; one retry; fallback.
6. Server-side price range from admin pricing data; ignore model pricing.
7. Server-side PDF generation with a designed itinerary layout, branded cover, day cards, map/pins where feasible, price range, disclaimer and expiry-limited download.
8. Quote request creates custom booking with itinerary JSON and links the generated PDF.
9. AI session logging with hashed IP only; retention cleanup for sessions and PDFs.
10. Tests: malformed JSON, invalid slugs, prompt injection, timeout, cost cap, PDF generation, download authorization, fallback.

**Gate:** API key absent from client bundle; malicious output cannot produce executable/unknown links; PDFs contain no admin-only data; download links expire; quotas enforced; provider outage degrades safely.

**Blockers:** exchange-rate provider, AI pricing formula, DeepSeek budget, hotel/meal data model, PDF branding and required sections.

### P6 — Launch

1. Full metadata, canonicals, OG images, JSON-LD, sitemap, robots, `llms.txt`, FAQ sections.
2. Fix the streamed dynamic-route soft 404 so unknown package slugs return HTTP 404, not only the not-found UI with noindex.
3. Accessibility audit and fixes.
4. Performance/Lighthouse audit; image and bundle optimisation.
5. OWASP ASVS checklist, ZAP baseline, dependency audit, secret scan.
6. Backup restore drill and retention verification.
7. VPS hardening, firewall, SSH keys, fail2ban, unattended upgrades.
8. Production deployment on the Contabo VPS, Caddy, Cloudflare DNS/WAF, TLS strict mode.
9. Resend domain verification, SPF/DKIM/DMARC, Turnstile production keys.
10. Cron scheduling and backup monitoring.
11. Incident response runbook and handover documentation.
12. External penetration test if budget permits.

**Gate:** all security checklist items pass; restore test succeeds; production smoke test passes; handover complete.

**Blockers:** production secrets, Resend domain, Cloudflare account, exchange provider, legal approval, real content/photos, off-site backup account.

## 12. Definition of Done — Every Phase

- `lint`, `typecheck`, unit tests, and `build` pass.
- New migrations apply cleanly to an empty database.
- Security acceptance checks for the phase pass.
- No secrets or PII committed or logged.
- Works at 375px and desktop.
- Empty, loading, and error states handled.
- Phase summary states what was built, what remains, assumptions, and blockers.
- No out-of-scope features.

## 13. Dependencies Requiring Approval

**Core stack**

- `next`, `react`, `react-dom`, `typescript`
- Tailwind CSS and shadcn/ui dependencies
- `zod`, `react-hook-form`, `@hookform/resolvers`
- `pg`
- `@node-rs/argon2` — Argon2id password hashing
- `otplib` — TOTP
- `qrcode` — MFA enrolment QR
- `sharp` — image processing
- `file-type` — magic-byte validation
- `resend` — transactional email
- `pino` — structured logging
- `server-only` — server/client boundary protection

**Development**

- `vitest`, `@playwright/test`
- `node-pg-migrate`
- `tsx`
- ESLint, Prettier
- Type packages (`@types/pg`, `@types/qrcode`, etc.)
- Supabase packages are removed.

No additional dependency should be added without approval.

## 14. Environment Variables

```env
NODE_ENV=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

PUBLIC_DATABASE_URL=
AUTH_DATABASE_URL=
ADMIN_DATABASE_URL=
MIGRATION_DATABASE_URL=        # migrations/seeds only, never runtime

IP_HASH_SECRET=
MFA_ENCRYPTION_KEY=            # 32-byte base64 key

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
RESEND_API_KEY=
EMAIL_FROM=
ADMIN_NOTIFICATION_EMAIL=
EXCHANGE_RATE_API_KEY=
EXCHANGE_RATE_API_URL=
CRON_SECRET=

STORAGE_ROOT=
LOG_LEVEL=
```

Only `NEXT_PUBLIC_*` values may reach the browser. Database URLs, MFA key, scanning secret, and API keys remain server-side.

## 15. Open Items

| Item                                         | Needed by |
| -------------------------------------------- | --------- |
| Cloudflare account access and DNS records    | P1/P6     |
| Off-site backup account (R2/B2)              | P6        |
| Brand name, logo, colours, fonts             | P1        |
| Real packages, prices, itineraries           | P2/P3     |
| Destination list and descriptions            | P4        |
| Client sign-off on district mapping/coverage | P4        |
| Photos or approved stock                     | P1/P4     |
| Review content and verified travel facts     | P4/P6     |
| WhatsApp number and contact email            | P1        |
| Resend domain verification                   | P3/P6     |
| DeepSeek API key and production budget       | P5/P6     |
| AI price-range formula sign-off              | P5        |
| Hotel and meal data model                    | P5        |
| PDF branding and required sections           | P5        |
| Generated PDF/session retention              | P6        |
| Legal copy, privacy retention, UGC terms     | P6        |
| Admin user list                              | P2        |
| External penetration-test budget             | P6        |

## 16. Confirmed Decisions

1. **Backend shape:** modular monolith; no Supabase/BaaS.
2. **Hosting:** existing Contabo VPS; domain already purchased.
3. **Database:** native PostgreSQL 17, installed locally as the Windows service; production native on the VPS.
4. **Admin security:** mandatory TOTP MFA and `owner`/`admin` roles approved.
5. **Storage:** local disk plus encrypted off-site backup approved.
6. **Dependencies:** approved; production dependency audit is clean.
7. **PDF generation:** server-side `pdf-lib` with a neutral template until brand assets are supplied.
8. **Exchange rates:** free `open.er-api.com` provider, stored rates with last-known fallback.
9. **AI provider:** DeepSeek (`deepseek-chat`) replaces Anthropic, at the client's request (2026-11-08). Called with plain `fetch`; no SDK dependency.
10. **Quote pricing:** client rate card in `/admin/rates` (hotel tier per person per night, meal-plan percentage, chosen vehicle). See [ai-tour-builder.md](./ai-tour-builder.md).
11. **AI data scope:** current published destinations/packages/itinerary accommodation and meals; structured hotel/meal catalogues remain a later extension.

## 17. Phase Status and Next Step

P0–P6 implementation is complete. P6 code and documentation deliverables are in place; the remaining launch items require production infrastructure and client inputs.

- P0: application scaffold, PostgreSQL roles/RLS/functions, auth/session/MFA/CSRF foundation, security headers, CI, Docker/Caddy skeleton
- P1: home, about, contact form and API, basic package list, WhatsApp/site-settings wiring, loading/error/404 states, metadata, canonical URLs, TravelAgency JSON-LD, sitemap and robots
- P2: URL-driven catalogue filters, package detail pages, admin login/MFA/setup/reset, package and destination CRUD, itinerary and gallery editors, validated image uploads, media serving, settings, sessions, owner team invitations and audit log
- P3: monthly availability calendar and bulk date/capacity editor, public booking calendar and request form, transactional capacity/hold handling, idempotent booking creation, customer/admin emails, generic success page, admin booking search/filter/detail, notes, confirm/cancel/complete transitions and CSV export
- P4: district-level interactive SVG map (Natural Earth public-domain geometry), compact home map, reviews CRUD/public pages/AggregateRating, admin-editable travel information with FAQ schema, private photo submissions, moderation, approved-only public image serving and traveller photo sections
- P5: LKR-based multi-currency with country/cookie defaults and a free-provider rates cron; AI tour-builder quiz, guarded structured output, context-limited generation, computed price ranges, expiring PDFs, fallback handling and custom quote bookings
- P6: complete per-page metadata and canonicals, OG image, sitemap, robots, `llms.txt`, TravelAgency/TouristTrip/Review/AggregateRating/FAQPage/BreadcrumbList JSON-LD, and visible FAQ sections; real HTTP 404 for unknown package slugs; accessibility fixes for heading structure, landmarks, skip link and form error association; mobile vitals measured locally (LCP < 0.5 s, CLS 0); scheduled PDF/session/rate-limit retention; systemd units for rates, retention and backups; VPS, Cloudflare, backup and rollback runbooks; OWASP-aligned verification checklist, incident response and handover documentation
- Local PostgreSQL bootstrapped, migrated and seeded
- Unit, database security, and Playwright tests pass, including currency conversion, PDF generation, custom quote booking, map keyboard selection, review/travel creation, photo moderation, booking creation, oversell prevention, status transitions, CSV export, CSRF rejection, session expiry, public-page accessibility and real package 404 status
- Production build works without local secrets
- Production dependency audit reports 0 vulnerabilities

Live AI generation was exercised against DeepSeek on 2026-11-08. A production DeepSeek key and real hotel/meal data remain launch inputs.

Remaining launch work is operational and client-dependent: provision the VPS/database/Cloudflare/Resend/Turnstile production values, run the restore drill, complete the external penetration review, and replace placeholder brand, content, photos and legal copy. See [deployment.md](./deployment.md) and [handover.md](./handover.md).
