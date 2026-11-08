# Go Lanka — Sri Lanka Tours Platform

Custom, security-first tour-booking platform. No BaaS: the backend is application code backed by PostgreSQL.

**Current status:** P0–P6 implementation complete. The public site, admin panel, booking flow, AI tour builder, multi-currency support, accessibility/SEO foundation, retention cleanup and deployment runbooks are implemented on local PostgreSQL. Launch now depends on production infrastructure (VPS, Cloudflare, Resend, Turnstile, DeepSeek), a restore drill, an external security review, and client-supplied brand/content/legal copy. Live AI generation requires a `DEEPSEEK_API_KEY`; without it the builder degrades to a contact fallback.

## Documentation

- [Implementation plan](./docs/implementation-plan.md)
- [Deployment and operations](./docs/deployment.md)
- [Handover guide](./docs/handover.md)
- [Security architecture](./docs/security-architecture.md)
- [Security checklist](./docs/security-checklist.md)
- [Incident response](./docs/incident-response.md)
- [AI tour builder and PDF notes](./docs/ai-tour-builder.md)
- [Original brief](./instructions.md)

## Requirements

- Node.js 24+
- npm 11+
- PostgreSQL 17 running locally (native service is used; Docker is optional)
- A domain and Contabo VPS are available for later deployment

The local PostgreSQL service is `postgresql-x64-17`. Its binaries are at:

```text
C:\Program Files\PostgreSQL\17\bin\
```

## Local setup

The repository deliberately does not contain `.env.local` or database passwords.

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Generate local-only database credentials and secrets:

   ```powershell
   npm run setup:local
   ```

   This creates `.env.local` and `db/bootstrap.local.sql`. Both are gitignored. The script refuses to overwrite existing files.

3. Create the development database and least-privilege roles. Run this in your terminal and enter the PostgreSQL superuser password when prompted:

   ```powershell
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d postgres -f "C:\Projects\Go Lanka\db\bootstrap.local.sql"
   ```

4. Apply migrations:

   ```powershell
   npm run db:migrate
   ```

5. Start the app:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`.

6. Create the first owner account. The script creates an invite link; no password is printed:

   ```powershell
   npm run create-admin -- owner@example.com
   ```

   Open the printed setup link within 24 hours. The setup flow creates the password, enrols TOTP MFA, and displays one-time recovery codes.

   For this local environment the owner account `admin@golanka.com` already exists. A fresh setup link is written to `.data/admin-invite.txt` (gitignored). If it expires, regenerate it with:

   ```powershell
   npm run invite:admin -- admin@golanka.com
   ```

## Booking workflow

- Admin publishes dates and capacity under `/admin/availability`.
- The public package page shows a calendar and booking request form.
- Pending requests count as holds; `booked` increments only when an admin confirms.
- Admin confirm, cancel and complete actions are atomic and audited.
- Customer and admin notification emails are sent through Resend; local development writes them to the outbox.
- `/admin/bookings` supports search, status filtering, notes, status changes and CSV export.

## Content and media

- The interactive map uses district geometry derived from Natural Earth Admin-1 data (public domain) in `src/content/map-regions.ts`. Destinations reference a district through `map_region_id`; the admin destination form provides the district selector.
- Reviews are admin-curated. Published reviews appear on `/reviews` and package pages, and package pages expose an AggregateRating JSON-LD block.
- Travel information sections are managed under `/admin/travel-info`; structured content and FAQs are public only when published.
- Photo submissions are stored privately under `.data/media/private/`, re-encoded to WebP with metadata stripped, and served only after admin approval. The public image route is `no-store` so rejected photos stop being served immediately.
- Admin moderation is at `/admin/photos`; approved photo metadata is exposed through a public database function, but image bytes are always served through an approval-checking route.

## AI tour builder and currency

- `/tour-builder` collects destinations, budget tier, meal plan, vehicle (with a driver or self-drive), days and nights, month, group size and notes.
- The server builds context only from published destinations, packages, activities and itinerary accommodation/meals.
- DeepSeek is called server-side in JSON mode and the output is validated; the model cannot set prices. The quote is computed in code from the client rate card (hotel tier, meal plan, vehicle) in `/admin/rates`. See [AI tour builder notes](./docs/ai-tour-builder.md).
- Invalid or failed model output retries once, then falls back to a contact prompt.
- Generated PDFs are stored privately and served through expiring capability links. They contain the itinerary, computed price range and the AI disclaimer.
- “Request this quote” creates a custom booking with the generated itinerary.
- Multi-currency uses LKR as the stored base. `npm run rates:refresh` fetches USD/EUR/GBP from the free `open.er-api.com` provider; the daily cron route is `/api/cron/rates`.
- If no current rate exists, prices fall back to LKR.
- Live AI generation requires `DEEPSEEK_API_KEY`. Without it, `/tour-builder` shows the safe contact fallback instead of making a model call.
- Run `npm run rates:refresh` after setup to populate exchange rates; production should call `/api/cron/rates` daily with the configured cron secret.
- Retention cleanup runs from `POST /api/cron/retention` with the same secret. It deletes expired PDFs (after a one-day grace period), rate-limit rows, stale sessions/tokens, AI sessions older than 30 days and audit rows older than 365 days. Production schedules it with `golanka-retention.timer`.

## Development integrations

- The local `.env.local` uses Cloudflare Turnstile's official test keys. They are accepted only for localhost; a production domain must use real Turnstile keys.
- Without `RESEND_API_KEY` and `EMAIL_FROM`, contact and booking emails are written as JSON files under `.data/mail/` instead of being sent. That directory is gitignored and contains test PII; never commit it.
- To test real email delivery, configure `RESEND_API_KEY`, `EMAIL_FROM`, and `ADMIN_NOTIFICATION_EMAIL`, then verify the sending domain with Resend.
- Site settings currently contain no public contact details or WhatsApp number. Editable values are available under `/admin/settings`; the contact page shows a placeholder and the WhatsApp button stays hidden until they are entered.
- Admin package and destination image uploads are re-encoded to WebP and stored under `.data/media/public/`. The media route serves only files below that directory.
- The owner invite link and `.data` directory are gitignored. Do not commit or email production setup links.

## Scripts

| Command                         | Purpose                                               |
| ------------------------------- | ----------------------------------------------------- |
| `npm run dev`                   | Development server                                    |
| `npm run build`                 | Production build                                      |
| `npm run start`                 | Start the production build                            |
| `npm run lint`                  | ESLint                                                |
| `npm run typecheck`             | TypeScript without emitting                           |
| `npm test`                      | Vitest                                                |
| `npm run test:e2e`              | Playwright                                            |
| `npm run test:db`               | RLS/workflow smoke test against a local test database |
| `npm run db:migrate`            | Apply database migrations                             |
| `npm run db:rollback`           | Roll back the latest migration                        |
| `npm run create-admin -- email` | Create an owner invite                                |
| `npm run invite:admin -- email` | Regenerate an existing admin setup link               |
| `npm run rates:refresh`         | Refresh stored exchange rates                         |
| `npm run setup:local`           | Generate local secrets and bootstrap SQL              |
| `npm run audit:prod`            | Audit production dependencies only                    |

## Security boundaries

- `src/server/*` is server-only; it must not be imported by client components.
- The public, auth, and admin database roles are separate. No runtime role owns the schema.
- Public writes use `SECURITY DEFINER` functions; they do not receive direct table access.
- The migration role is never used by the running app.
- Admin authentication uses Argon2id, TOTP MFA, opaque sessions, CSRF tokens, and audit logging.
- Service secrets remain in `.env.local` on the server.
- CSP, HSTS (production), frame denial, MIME-sniffing protection, and other security headers are applied in `src/proxy.ts`.
- Uploaded files are re-encoded and stored outside any executable path.

## Current phase notes

- Brand assets, real packages, destination data, photos, and legal copy are not yet supplied. Placeholder copy is marked in `src/content/strings.ts` and page components.
- The WhatsApp button stays hidden until a real number is configured in site settings.
- Indexing is disabled unless `NEXT_PUBLIC_ALLOW_INDEXING=true`; enable it only when production content and legal pages are approved.
- The local PostgreSQL superuser password is never needed by the application, migrations, or scripts. Only the bootstrap step needs it.
- Production must set `TRUST_PROXY=cloudflare`, use `https://` in `NEXT_PUBLIC_SITE_URL`, and restrict the origin firewall to Cloudflare or use a Cloudflare Tunnel.
