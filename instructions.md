# AGENT INSTRUCTIONS: Sri Lanka Tours Platform

Read fully before coding. Build phase by phase (section 11). Stop after each phase and summarise.

## 1. Goal

Custom tour-booking website for a Sri Lankan tour operator (client: Mr. Gunarathne). First website, no legacy system.

- Purpose: direct bookings, 0% commission.
- Differentiators: interactive SVG map, AI Tour Builder.
- Users: international travelers, mostly mobile. Admin users: non-technical staff.
- Conversion events: booking/quote request, WhatsApp click.

## 2. Scope

### Build

Pages: `/` `/about` `/packages` `/packages/[slug]` `/map` `/reviews` `/travel-info` `/tour-builder` `/contact` `/privacy` `/terms` 404, plus `/admin/*`.

Features:

- Filterable package catalogue + detail pages
- Interactive Sri Lanka map
- Booking/quote request + availability calendar
- Multi-currency (LKR, USD, EUR, GBP)
- Reviews, travel info hub
- Photo wall (UGC, moderated)
- WhatsApp integration
- AI Tour Builder
- SEO/GEO/AEO technical foundation
- Admin panel

### Do NOT build (keep code extensible)

Multilingual, chatbot, weather-aware itineraries, loyalty/referral, PWA/offline, group/split payment, online payment gateway.

- Keep all UI copy in `src/content/strings.ts` (i18n-ready).
- Booking is request-based, no payments.

## 3. Stack

- Next.js App Router, TypeScript strict
- Tailwind + shadcn/ui
- Supabase: Postgres, Auth, Storage, RLS
- Zod + React Hook Form (shared schemas)
- Custom SVG map (no map API)
- Anthropic Claude API (server only)
- Resend (email), Cloudflare Turnstile (spam)
- `next/image`, WebP/AVIF
- Vitest, Playwright, ESLint, Prettier

Ask before adding any other dependency.

## 4. Structure

```
supabase/migrations/   # schema source of truth
supabase/seed.sql
src/app/(site)/        # public
src/app/admin/         # protected
src/app/api/           # tour-builder, bookings, rates, uploads, cron
src/components/        # ui, layout, map, packages, booking, tour-builder
src/lib/               # supabase, currency, ai, seo, validation
src/content/strings.ts
tests/
```

## 5. Data Model

All tables: `id uuid pk`, `created_at`, `updated_at`. RLS enabled on every table.

| Table                | Fields                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| destinations         | name, slug, region, description, hero_image, map_region_id, lat, lng, best_season, highlights[]                                                                                                                                 |
| packages             | title, slug, summary, duration_days, base_price_lkr, activities[], hero_image, gallery[], inclusions[], exclusions[], is_published, featured                                                                                    |
| package_destinations | package_id, destination_id                                                                                                                                                                                                      |
| itinerary_days       | package_id, day_number, title, description, destination_id, accommodation, meals                                                                                                                                                |
| availability         | package_id, date, capacity, booked, status(open/limited/closed)                                                                                                                                                                 |
| bookings             | reference, package_id?, type(package/custom), name, email, phone, country, travel_date, adults, children, message, custom_itinerary jsonb, status(new/confirmed/cancelled/completed), currency_shown, quoted_total, admin_notes |
| reviews              | package_id, author_name, country, rating, title, body, is_verified, is_published                                                                                                                                                |
| photo_submissions    | package_id, image_path, caption, submitter_name, status(pending/approved/rejected)                                                                                                                                              |
| exchange_rates       | base, usd, eur, gbp, fetched_at                                                                                                                                                                                                 |
| ai_sessions          | quiz_answers jsonb, itinerary jsonb, ip_hash                                                                                                                                                                                    |
| site_settings        | whatsapp_number, contact_email, phone, socials                                                                                                                                                                                  |
| admin_profiles       | user_id, role                                                                                                                                                                                                                   |

RLS:

- Public: SELECT published packages/destinations/reviews and approved photos only.
- Public writes (bookings, photo_submissions) go through validated server routes only.
- Admin role: full access.

## 6. Feature Rules

**Catalogue:** filters = destination, activity, duration. State in URL. Server-rendered.

**Package detail:** gallery, accordion itinerary, inclusions/exclusions, price, tour reviews, tour photos, availability calendar, booking form, WhatsApp button with prefilled package name.

**Map:**

- SVG island, clickable regions, data-driven from `destinations`.
- Click/tap opens card: images, description, best season, linked packages.
- Keyboard accessible, touch-friendly. Compact version on home page.

**Currency:**

- Store LKR. Display LKR/USD/EUR/GBP via header switcher, saved in cookie.
- Daily cron fetches rates into `exchange_rates`; fall back to last known rate.
- Default currency from country header, user can override.
- Show note: converted prices are indicative.

**Booking:**

- Fields: name, email, phone, country, travel_date, adults, children, message.
- Flow: Zod validate, insert `bookings`, email customer (reference), email admin, success page.
- Calendar shows open/limited/closed from `availability`.
- A request holds the date; `booked` increments only when admin sets `confirmed`.
- Spam: honeypot + Turnstile + rate limit.

**Reviews:** per-package + public page, rating, country, verified badge (admin-set), feeds AggregateRating schema.

**Photo wall:**

- Upload: JPG/PNG/WebP, max 5 MB, server-validated, re-encode, strip EXIF.
- Status `pending` until admin approves. Nothing public before approval.

**Travel info hub:** admin-editable blocks: visa, money, weather by season, safety, packing, transport. FAQ-style headings. Mark facts `TODO: verify before launch`.

**WhatsApp:** floating button on all pages, link `https://wa.me/<number>?text=<prefill>`, number from `site_settings`.

**Admin (`/admin`):**

- Supabase Auth email/password, rate-limited, role check in middleware and RLS.
- Modules: Dashboard, Packages (+itinerary editor, gallery), Destinations (+map region), Bookings (filter, status, notes, CSV export), Availability (calendar, bulk set), Reviews, Photo moderation, Settings.
- Confirm before deletes. Image upload with preview and required alt text.

## 7. AI Tour Builder (`/tour-builder`)

Flow:

1. Quiz: interests, budget, days, pace, travel month, group size, optional must-see destinations.
2. Server generates day-by-day itinerary.
3. Result: itinerary, map pins, price range, "Request This Quote" button.
4. Quote saves a `bookings` row with `type=custom` and itinerary JSON.

Rules:

- Claude API from server route only. Model from env `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`).
- Pass real `destinations` and `packages` data as context. Model may only use destinations/activities present in that data.
- Require JSON output; validate with Zod. On failure: retry once, then show fallback with contact link.
- Schema: `days[]{day,title,destination_slug,activities[],overnight,notes}`, `estimated_price_lkr_range`, `suggested_package_slugs[]`.
- Compute price range in code from package pricing, never from model output.
- Treat user free-text as data, not instructions. Cap input lengths. Rate limit per IP.
- Log to `ai_sessions` with hashed IP only.
- Show disclaimer: AI suggestion, final itinerary confirmed by team.
- Show progress/streaming while generating.

## 8. SEO / GEO / AEO

- SSR pages, clean URLs, unique title + meta description per page, canonical, OG/Twitter cards.
- `sitemap.xml`, `robots.txt`, `/llms.txt` (business, packages, key pages).
- JSON-LD: TravelAgency/LocalBusiness, TouristTrip, Review/AggregateRating, FAQPage, BreadcrumbList.
- Direct-answer FAQ sections on info hub and package pages.
- Targets: LCP < 2.5s, CLS < 0.1, Lighthouse mobile >= 90.

## 9. Security

- HTTPS + HSTS, security headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- Zod validation on every API route and server action.
- RLS on all tables. Service-role key server-side only, never in client bundle.
- Rate limit: booking, upload, review, AI, login.
- Upload checks: MIME, size, extension, re-encode.
- No PII in logs. Daily DB backups.

## 10. Env Vars (`.env.example`)

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5-5
RESEND_API_KEY=
ADMIN_NOTIFICATION_EMAIL=
EXCHANGE_RATE_API_KEY=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
CRON_SECRET=
```

## 11. Phases

**P0 Setup:** init app, Supabase migrations + RLS + seed, layout, design tokens, strings.ts, lint/CI.
**P1 Foundation:** Home, About, Contact (form + email), basic package list, WhatsApp button, SEO basics.
**P2 Packages + Admin:** filterable catalogue, detail pages, admin auth, packages/destinations CRUD, image upload, itinerary editor.
**P3 Booking:** availability calendar + admin editor, booking flow, emails, bookings admin, spam protection.
**P4 Content:** SVG map, reviews, travel info hub, photo wall + moderation.
**P5 AI + Currency:** multi-currency + cron, tour builder quiz/route/quote.
**P6 Launch:** schema, sitemap, llms.txt, accessibility, Lighthouse, Playwright (booking, AI builder, admin login, photo upload), deploy, handover notes.

## 12. Definition of Done (each phase)

- `lint` and `build` pass
- Phase flows tested
- Works at 375px and desktop
- No secrets committed, `.env.example` current
- Empty/loading/error states handled
- Summary: built, remaining, assumptions made

## 13. Rules

- No out-of-scope features (section 2).
- Simple readable code. Small components. Business logic in `src/lib/`.
- Never hardcode admin-controlled content (prices, contacts, destinations).
- Mark placeholder content `TODO: client to confirm`.
- On ambiguity: state the assumption in the phase summary, do not guess silently.

## 14. Open Items (blockers, do not invent)

- Brand: name, logo, colours, fonts
- Real packages, prices, itineraries
- Map destination list + descriptions
- Photos (or use stock)
- Domain, WhatsApp number, contact email
- Hosting decision: Vercel Pro vs cheaper host (budget Rs. 28,000/yr)
- Supabase paid plan for production
- Resend domain verification
