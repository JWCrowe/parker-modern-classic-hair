# Parker Modern Classic Hair

**Memory + hands → [docs/WIKI.md](docs/WIKI.md)** (rules, next, daily log, deploy record, roadmap). Read it first.

Website, booking, and admin panel for Ben's chair at 111 S Wall St Ste B, Calhoun, GA 30701.

- Astro 5 in server mode on Vercel (`@astrojs/vercel`). The marketing pages (`/`, `/book`) are prerendered static HTML; the APIs and `/admin` run as functions.
- Neon Postgres holds clients (CRM), appointments, blocks, and settings.
- Square Appointments is the source of truth for the schedule once connected. Google Calendar is an optional secondary. Resend sends email.
- All schedule math is in America/New_York.

## Run

Requires Node 20.6+.

```bash
npm install
cp .env.example .env     # fill in DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD at minimum
npm run seed             # runs db/migrations/*.sql and creates the admin if missing
npm run dev              # http://localhost:4321 , admin at /admin
npm run check            # type check
npm run build            # Vercel output in .vercel/output
```

`astro preview` is not supported by the Vercel adapter; use `npm run dev` locally, or `vercel dev`.

Run `npm run seed` once against each new database (it is safe to re-run). As a safety net, the middleware also applies the blocks and Square columns once per database (tracked by the `schema_version` setting), and the admin is created on the first login attempt if none exists.

## Environment

See `.env.example` for every key with placeholders. Summary:

| Key | Needed | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon connection string |
| `AUTH_SECRET` | yes | Signs the admin session cookie (`openssl rand -base64 48`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | first run | Seeds Ben's login. Change the password later in /admin/settings |
| `PUBLIC_SITE_URL` | yes | Origin used in email links |
| `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_NOTIFY_EMAIL` | optional | Email. Without a key, emails are logged and everything still works |
| `SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `SQUARE_REDIRECT_URI` | for Square | Square OAuth app |
| `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_TEAM_MEMBER_ID` | optional | Sandbox shortcut: skip OAuth with a personal token |
| `SQUARE_SELLER_LEVEL_WRITES` | optional | `true` only on Appointments Plus/Premium |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | optional | Google Calendar |
| `CRON_SECRET` | on Vercel | Protects the daily Square sync cron |

## How booking works

`/book` loads open days and times from `GET /api/availability` and submits to `POST /api/bookings`.

- **Square mode** (Square connected, a location picked, and the service mapped to a Square service): times come from Square `SearchAvailability`, minus Ben's local blocks and Google busy times. The booking is created in Square (customer found or created by email or phone), then mirrored into Neon. If Square's booking acceptance is automatic, the client sees "You're booked"; if manual, they see "Request received" and Ben accepts it in the Square app. If the Square call fails, the request is saved locally as an inquiry so no lead is lost.
- **Local mode** (no Square): times come from the posted hours in `src/data/site.ts` minus existing appointments, blocks, and Google busy times. Every booking lands as an **inquiry** that Ben confirms or declines in /admin/inquiries.
- Slots are 30 minutes apart, at least 60 minutes out, up to 60 days ahead. The server re-checks the slot on submit and returns 409 if it was taken.
- A hidden `website` honeypot field drops bot submissions.
- The confirmation screen only says "You're booked" when the status really is confirmed. Text, Email, and Call buttons stay as a backup.

## Admin (`/admin`)

Login is Ben's own (email + password, bcrypt, 14 day httpOnly session). Pages:

- **Dashboard**: new inquiries, cuts this week/month/year, revenue this month/year, today's schedule and blocks, past appointments to wrap up.
- **Calendar**: day and week views showing appointments (inquiry, confirmed, completed, no show), blocks, closed hours, and Google busy. Tap an empty spot (or the all-day row, or Block time) to create a block; tap a block to edit or delete; tap an appointment to confirm, complete, no show, or cancel. Phones open in day view.
- **Inquiries**: Confirm or Decline. Square pending bookings link to the Square app instead, because Square's API cannot accept a booking.
- **Appointments**: Upcoming, Past, Completed, Cancelled, No shows, plus **Log a visit** for walk-ins and phone bookings.
- **Clients**: search, visit count, last visit, value this year, lifetime value. The client page has full history, what they book, and notes.
- **Settings**: Square connect/disconnect, location, barber, service mapping, sync and full import; Google connect/disconnect; email status; password change.

### CRM rules

- A **visit** is an appointment with status `completed`. Inquiries, confirmed, cancelled, and no shows do not count.
- **Year value** = sum of `price_cents` of completed appointments in the current calendar year in America/New_York. **Lifetime value** is the same with no date limit.
- Square bookings that are ACCEPTED and already in the past count as completed. Ben can still mark no show or undo.
- Clients are matched by Square customer id, then email, then the last 10 phone digits, so one person stays one record.

### Blocks

`blocks` table (`db/migrations/001_blocks.sql`): all day (NY midnight to midnight, end date inclusive) or a start and end time, with an optional label and notes. Blocks remove slots from `/api/availability` in both modes and, if Google is connected, can add a busy event there. **Square has no API for blocked time**, so blocks only affect this website. If Ben's Square booking page is also live, he adds the same time off in Square.

## Square setup

1. Create an app at https://developer.squareup.com/apps. Under OAuth, add the redirect URL `https://<your-domain>/api/admin/square/callback` (and `http://localhost:4321/api/admin/square/callback` for Sandbox testing).
2. Set `SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET` (use the Sandbox credentials with `sandbox`, the Production ones with `production`).
3. In /admin/settings press **Connect Square**, then pick the location and barber and match each site service to its Square service. Save. A full import of the last year runs on connect.
4. Sync: admin pages pull fresh bookings when the last sync is older than 3 minutes, and the Vercel cron (`vercel.json`, daily) syncs too.

Scopes requested: `APPOINTMENTS_READ`, `APPOINTMENTS_WRITE`, `APPOINTMENTS_ALL_READ`, `APPOINTMENTS_BUSINESS_SETTINGS_READ`, `CUSTOMERS_READ`, `CUSTOMERS_WRITE`, `ITEMS_READ`, `MERCHANT_PROFILE_READ`, `EMPLOYEES_READ` (+ `APPOINTMENTS_ALL_WRITE` when `SQUARE_SELLER_LEVEL_WRITES=true`). Access tokens refresh automatically.

## Google Calendar setup (optional)

1. Google Cloud Console: create a project and enable the Google Calendar API.
2. OAuth consent screen: External; scopes `calendar.events` and `calendar.freebusy`; add Ben's Google account as a test user (or publish the app).
3. Credentials: OAuth client ID, type Web application, redirect URI `https://<your-domain>/api/admin/google/callback` (plus the localhost one for dev).
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, redeploy, and press **Connect Google Calendar** in /admin/settings.

When connected, Google busy times hide slots, confirmed local bookings and blocks are written to Ben's calendar, and declines or cancellations remove them. Square bookings are not written to Google by this app (Square has its own Google sync), so nothing doubles up.

## Email (Resend)

- New booking: an alert to `ADMIN_NOTIFY_EMAIL` (or `ADMIN_EMAIL`) and a "Request received" or "You're booked" email to the client if they left an email.
- Confirm, decline, and cancel from admin email the client.
- No `RESEND_API_KEY`: emails are printed to the server log as `[email:dev]` and requests still succeed.
- **Domain note:** only the PLP domains are verified in the Resend account right now. Use `RESEND_FROM=... <onboarding@resend.dev>` for tests (it only delivers to the Resend account owner's address). To email real clients, add and verify `parkermodernclassichair.com` in Resend (DNS records), then set `RESEND_FROM=Parker Modern Classic Hair <book@parkermodernclassichair.com>`.

## Code map

- `src/data/site.ts`: services, prices, durations, hours, contact info, reviews, gallery. Single source for the marketing pages.
- `src/middleware.ts`: admin auth guard, lazy schema migration, no-store and noindex headers.
- `src/lib/`: `db`, `auth`, `time` (NY helpers), `availability`, `appointments`, `blocks`, `clients`, `crm`, `square`, `square-sync`, `google`, `email`, `http`, `env`, `oauth-state`.
- `src/pages/api/`: `availability`, `bookings`, `auth/*`, `admin/*` (appointments, clients, blocks, password, google, square), `cron/square-sync`.
- `src/pages/admin/`: login, dashboard, calendar, inquiries, appointments, clients, settings. Styles in `src/styles/admin.css`.
- `db/migrations/`: `000_init.sql` (base tables + services), `001_blocks.sql`, `002_square.sql`. `scripts/seed.mjs` runs them.

## Design system

- Type: **Anton** (condensed display), **Instrument Serif** italic (accents), **Archivo** (body/UI).
- Color: ink `#0a0908`, charcoal `#121110`, brass `#c9a25a`, cream `#efe6d2`. The admin uses the same tokens.

## Assets (`public/`)

- `logo-white.png`, `logo-black.png`, `ben-headshot.jpg`: originals, kept.
- `logo-cream.png`, `logo-brass.png`: transparent versions generated from `logo-white.png` for use on dark backgrounds.
- `ben-portrait.jpg`: portrait crop of `ben-headshot.jpg` used in the About section.
- `og.jpg`: 1200x630 social share image. `favicon.svg`: brass framed P mark.

## Content to do

- Replace the Unsplash style reference images in `gallery` (`src/data/site.ts`) with real photos of Ben's cuts. They are labeled "Style reference imagery" on the site until then.
- Replace the hero image (`heroImage`) with a real shot of the shop or chair.
- A dedicated professional photo of Ben would beat the cropped headshot.
