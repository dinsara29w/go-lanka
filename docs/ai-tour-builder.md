# AI Tour Builder and PDF Output — Requirements Notes

**Status:** P5 implemented using the current destination/package data. Structured hotel/meal catalogue and final PDF branding remain to be supplied.

## Implemented in P5

- Server-only DeepSeek call (`deepseek-chat`, OpenAI-compatible chat completions in JSON mode); the output is validated with the same Zod schema.
- Context is limited to published destinations, packages, activities and existing itinerary accommodation/meals.
- User free text is passed as JSON data; prompt injection is treated as untrusted input.
- Travel dates, days, group size, pace, budget and must-see slugs are validated.
- Invalid model output retries once, then falls back to a contact prompt.
- Prices are computed in code from the client rate card, never from model output (see "Pricing" below).
- Itinerary sessions are stored without Turnstile tokens; IPs are hashed.
- A designed PDF is generated with `pdf-lib` and served through a 7-day expiring capability link.
- “Request this quote” creates a custom booking with the generated itinerary and sends customer/admin emails.
- The PDF template uses neutral colours and standard fonts because brand assets are pending.

## Using it, and what it needs

**For visitors:** open **AI tour builder** in the top menu (or tap a place on the home page). Pick places, set days, budget, meal plan and vehicle, press **Build my itinerary**, then send the quote request.

**For the site owner,** the builder only works when all of these are in place:

1. **Places in the database.** `npm run db:migrate` adds the eight main places. More can be added in `/admin/destinations`. Published packages are optional.
2. **An AI key.** Put `DEEPSEEK_API_KEY=...` in `.env.local` (locally) or the server settings (live), then restart.
3. **The spam check.** Locally use Cloudflare's test keys (see `.env.example`); the live site needs real Turnstile keys.
4. **Rates.** Hotel rates and vehicles in `/admin/rates` (added with sample values by the migrations).

While the site runs on your computer, the tour builder page shows a "Setup checklist" if any of these is missing. Visitors never see it.

## Pricing (client rate card, November 2026)

All values are edited in `/admin/rates`; the starting values come from the client.

| Item        | Rule                                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hotel       | Per person per night, bed and breakfast: Economy Rs 15,000, Mid-range Rs 60,000, Luxury Rs 125,000. Children pay the child rate (default 50%).                                                                                     |
| Meal plan   | Applied to the hotel total: room only −10%, bed and breakfast 0%, half board +5%, full board +10%.                                                                                                                                 |
| With driver | The traveller picks a vehicle that seats the group: tuk tuk Rs 100/km, car Rs 180/km, van Rs 250/km, bus Rs 300/km, charged on the AI-estimated route distance. An optional driver allowance per day can be set.                   |
| Self-drive  | Bike Rs 1,500/day, tuk tuk Rs 2,000/day, car Rs 6,000/day, each with 200 km/day included. Extra km use that vehicle type's with-driver per-km rate (tuk tuk Rs 100, car Rs 180); the bike has none, so the team confirms extra km. |

Vehicle seats (tuk tuk 2, bike 2, car 3, van 9, bus 30) are suggested values for the client to confirm. The selected package is the AI's route basis only; its daily rate is no longer part of the quote. The team reviews every quote before it is sent.

## Current understanding

1. The admin maintains structured tour data:
   - tour locations / destinations
   - hotels near those locations
   - meals and dietary options
   - activities and other tour-related data
2. The visitor supplies interests and trip constraints.
3. The server builds a full itinerary using only admin-managed data.
4. The result is presented as a well-structured, designed PDF.

## Impact on the data model

The existing schema already supports:

- `destinations`
- `packages`
- `package_destinations`
- `itinerary_days` with `accommodation` and `meals`
- `availability`, pricing and reviews

It does **not** yet have a first-class hotel catalogue or structured meal options. Before P5 we need to decide whether to add:

- `hotels` linked to destinations, with room/meal/pricing details
- `destination_meals` or a meal catalogue with dietary attributes
- structured activity records rather than free-text arrays

P2 can proceed with package/destination CRUD and the existing itinerary fields. The structured hotel/meal schema will be added when the client supplies details, so the admin UI can support the AI builder without guessing the business model.

## Impact on P5

- AI context must be built from published admin-managed destinations, hotels, meals, activities and package pricing.
- The model may only select records that exist in that context.
- Prices must be calculated in code, not generated by the model.
- PDF generation must happen server-side.
- PDF download links must be unguessable and expire.
- The PDF must be branded and structured, with a disclaimer that the final itinerary is confirmed by the team.
- The PDF must not expose admin-only notes or internal data.
- Generation must be rate-limited and cost-capped.

## Open questions before P5

- Exact hotel fields: name, location, room types, meal plan, price band, images, booking notes
- Exact meal fields: meal type, cuisine, dietary/allergy handling, included vs optional
- Whether hotels and meals are priced separately or bundled into package pricing
- How the AI should balance travel time, pace, season and budget
- Required PDF sections, branding, logo, fonts, colours and language
- Whether the PDF is downloadable immediately or emailed after review
- ~~Retention policy for generated PDFs and AI sessions~~ — implemented: PDFs expire after 7 days and are removed after a one-day grace period; AI sessions are deleted after 30 days by `POST /api/cron/retention`
- Whether the user can edit the itinerary before requesting a quote

## Dependency decisions deferred

PDF generation and any structured hotel/meal admin UI require a schema/API design session with the client first. No additional PDF dependency will be added until that design is approved.
