# Handoff: Parker admin, CRM, and Square booking

Project: `/workspace/parker-modern-classic-hair` (not a git repo on the box; parent ships it). Build: `npm run build` passes, `npm run check` reports 0 errors.

The Neon database is migrated (`000_init`, `001_blocks`, `002_square`) and Ben's admin login is seeded from the `ADMIN_*` values in the local `.env`. Test data from verification was deleted.

## What changed

**Config**
- `astro.config.mjs`: `output: 'server'`, `@astrojs/vercel` adapter, `security.checkOrigin`.
- `package.json`: added deps (`@astrojs/vercel`, `@neondatabase/serverless`, `bcryptjs`, `jose`, `googleapis`, `resend`), dev deps (`@astrojs/check`, `typescript`, `@types/node`), scripts `seed` and `check`.
- `tsconfig.json`, `vercel.json` (daily cron at 09:00 UTC hitting `/api/cron/square-sync`), `.env.example`, `.gitignore` (adds `.vercel`).

**Database**
- `db/migrations/000_init.sql`: base tables (admins, clients, services, appointments, settings) plus the 5 services.
- `db/migrations/001_blocks.sql`: the blocks table.
- `db/migrations/002_square.sql`: Square id, version, and status columns.
- `scripts/seed.mjs`: runs the migrations and creates the admin if missing.

**Server code**
- `src/middleware.ts`, `src/env.d.ts`.
- `src/lib/`: `env`, `db`, `time`, `auth`, `http`, `email`, `google`, `square`, `square-sync`, `clients`, `availability`, `appointments`, `blocks`, `crm`, `oauth-state`.
- APIs:
  - `src/pages/api/availability.ts` and `bookings.ts`
  - `auth/{login,logout,me}`
  - `admin/appointments/{index,[id]}`, `admin/clients/{index,[id]}`, `admin/blocks/{index,[id]}`
  - `admin/password`
  - `admin/google/{start,callback,disconnect}`
  - `admin/square/{start,callback,disconnect,sync,config}`
  - `cron/square-sync`

**Admin UI**
- `src/layouts/AdminLayout.astro`, `src/styles/admin.css`, `src/scripts/admin.ts`, `src/components/admin/ApptActions.astro`.
- `src/pages/admin/`: `login`, `index` (dashboard), `calendar` (day and week, blocks), `inquiries`, `appointments`, `clients/index`, `clients/[id]`, `settings`.

**Public site**
- `src/pages/book.astro`: real availability and a real POST. The done screen says "Request received" plus the status, and only says "You're booked" once the booking is confirmed. A honeypot field is added. Text, Email, and Call stay as backups. The localStorage code is removed.
- `src/pages/index.astro`: now prerendered.

**Docs**
- `README.md`.

## Key routes

- Public: `/`, `/book`, `GET /api/availability`, `POST /api/bookings`.
- Admin: `/admin/login`, `/admin`, `/admin/calendar`, `/admin/inquiries`, `/admin/appointments`, `/admin/clients`, `/admin/clients/:id`, `/admin/settings`.
- OAuth: `/api/admin/square/start` → `/api/admin/square/callback`, and `/api/admin/google/start` → `/api/admin/google/callback`.

## Env needed in Vercel (Production and Preview)

Required:
- `DATABASE_URL`
- `AUTH_SECRET` (new random value)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`
- `PUBLIC_SITE_URL=https://parkermodernclassichair.com`
- `CRON_SECRET` (new random value)

Email:
- `RESEND_API_KEY`, `RESEND_FROM`, and optionally `ADMIN_NOTIFY_EMAIL`.

Square:
- `SQUARE_ENVIRONMENT` (`sandbox` first, then `production`)
- `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`
- Optional: `SQUARE_REDIRECT_URI`, and `SQUARE_SELLER_LEVEL_WRITES=true` only if Ben is on Appointments Plus or Premium.
- Sandbox shortcut that skips OAuth: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_TEAM_MEMBER_ID`.

Google (optional):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_REDIRECT_URI`.

## What Jeff needs to do next

1. **Square app** at https://developer.squareup.com/apps:
   - Create the app ("Parker Modern Classic Hair").
   - **Sandbox tab:** copy the Sandbox Application ID and Secret. Under OAuth, add the redirect URLs `https://<preview-or-prod-domain>/api/admin/square/callback` and `http://localhost:4321/api/admin/square/callback`. Set `SQUARE_ENVIRONMENT=sandbox` and test with a Sandbox seller account. In the Sandbox test account dashboard, enable Appointments and create the services.
   - **Production tab:** copy the Production Application ID and Secret. Under OAuth, add the redirect URL `https://parkermodernclassichair.com/api/admin/square/callback`. Switch the env to `production` with the Production credentials, redeploy, and have Ben press **Connect Square** in /admin/settings while signed in to his own Square account.
   - After connecting, pick the location and Ben as the barber in Settings, match the 5 site services to his Square services, and save.
2. **Ben, in the Square Dashboard:**
   - Turn on Square Appointments (the free plan works) and online booking for the Calhoun location.
   - Create each service (Men's Haircut, Beard, Men's Haircut & Beard, Kid's Haircut, Women's Haircut) as an appointment service with the right price and duration, bookable online by Ben.
   - Choose booking acceptance. With **Automatic**, website clients see "You're booked". With **Manual**, they see "Request received" and Ben accepts in the Square app, because the API cannot accept a booking.
   - Turn **off** "require card on file / no-show fee" for online booking, since the site cannot collect cards.
   - Time off: blocks he creates in /admin/calendar hide times on the website only. Square has no blocked-time API, so if his Square booking page stays live, he should add the same time off in Square too.
3. **Google OAuth client** (optional, only if Ben wants his personal Google busy times respected):
   - In Google Cloud, create a project, enable the Calendar API, and set up an External consent screen with the scopes `calendar.events` and `calendar.freebusy`. Add Ben as a test user, or publish the app.
   - Create a Web OAuth client with redirect URI `https://parkermodernclassichair.com/api/admin/google/callback` (plus the localhost one for dev).
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and have Ben press Connect.
4. **Resend domain:**
   - Right now only the PLP domains are verified. Until this domain is verified, use `onboarding@resend.dev`, which only delivers to the Resend account owner.
   - Add `parkermodernclassichair.com` in Resend, add its DNS records, and verify it.
   - Then set `RESEND_FROM=Parker Modern Classic Hair <book@parkermodernclassichair.com>` and `RESEND_API_KEY` in Vercel.
5. **Vercel:**
   - Add the env vars above and deploy.
   - `vercel.json` registers the daily cron. Vercel sends `CRON_SECRET` as a Bearer token automatically once the variable is set.
   - Run `npm run seed` (with a production `.env`) if the production database is different from the one already migrated.
6. Give Ben his login (the seeded `ADMIN_EMAIL` and `ADMIN_PASSWORD`, shared privately) and have him change the password in Settings.

## Behavior notes and limits

- **Without Square,** the site runs in local mode: posted hours minus appointments, blocks, and Google busy times. Every booking is an inquiry that Ben confirms or declines in admin, and both actions email the client.
- **With Square,** bookings are created in Square and mirrored to Neon. If Square errors, the request is saved locally as an inquiry with a note, so no lead is lost.
- **Pending Square bookings** cannot be confirmed from our admin, because the API makes booking status read-only. The admin links to the Square app instead. Cancel and decline from our admin do cancel in Square.
- **Mirror refresh:** it refreshes on admin page loads (when older than 3 minutes), on the daily cron, and from the Sync buttons in Settings.
- **Visits and value** count only `completed` appointments. Past ACCEPTED Square bookings count as completed. Year value uses the America/New_York calendar year.
- **Walk-ins and phone bookings** can be added with "Log a visit" on /admin/appointments.
- **Rate limiting:** login has a per-instance limit (8 bad attempts per 15 minutes per IP).
