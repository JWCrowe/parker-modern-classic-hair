# Wiki

**Memory + hands.** Jeff points here; Grok **reads, executes, writes back**. Chat is ephemeral.

**If Grok needs Jeff:** alert clearly, log Blocked, stop.

| Page | Job |
|------|-----|
| This file | System map |
| [RULES.md](RULES.md) | How we work |
| [NEXT.md](NEXT.md) | Ordered do-list, delete lines when done |
| [DAILY_LOG.md](DAILY_LOG.md) | What changed each day |
| [DEPLOY.md](DEPLOY.md) | **What shipped** (this chat, grok.com, Jeff, local) |
| [ROADMAP.md](ROADMAP.md) | Future only |

**Session start:** [NEXT.md](NEXT.md) top item, ship, delete line, [DAILY_LOG](DAILY_LOG.md) + [DEPLOY](DEPLOY.md) if it hit `main`.

---

## Product

| | |
|--|--|
| What | **Parker Modern Classic Hair**, Ben's chair. Marketing site + online booking + Ben's admin CRM |
| Address | 111 S Wall St Ste B, Calhoun, GA 30701 |
| Timezone | America/New_York (all schedule math) |
| Stack | Astro 5 `output: 'server'` + `@astrojs/vercel` (Node functions). `/` and `/book` render on demand (CDN cached 60s) so the Square menu and hours are always current; `/admin` + `/api` serverless |
| Database | Neon Postgres, project `twilight-mouse-67054832`: clients (CRM), appointments, blocks, settings, services. Env `DATABASE_URL` |
| Schedule | **Square Appointments is the only calendar and booking source of truth.** No Google Calendar (Ben does not set it up; no Settings section). Resend optional email |
| Without Square | Local inquiry mode: every booking lands as an inquiry; Ben confirms or declines in `/admin/inquiries` |
| With Square | Bookings created in Square, mirrored to Neon. Pending (manual-accept) Square bookings can't be accepted via our API; Ben accepts in the Square app |
| Live host | https://parker-modern-classic-hair.vercel.app (Vercel project `parker-modern-classic-hair`). `parkermodernclassichair.com` is still on **Weebly** until DNS moves; astro `site` = vercel.app URL so `checkOrigin` passes |
| Repo | https://github.com/JWCrowe/parker-modern-classic-hair (`main` = production) |

## Services and hours (Square drives them)

**Ben only manages services and hours in Square Appointments.** No one edits `site.ts` or the admin for a menu change.

- **Services:** every Square appointment service variation that is bookable online, at the picked location, by the picked barber, is copied into the `services` table (name, description, price, duration, Square variation id + version). New services appear, renamed or repriced ones update, removed or not-bookable ones drop off the public menu (rows kept inactive for visit history). First sync reuses the original `mens`, `beard`, ... rows by name so past visits stay linked. Code: `src/lib/catalog.ts` (`syncSquareCatalog`).
- **Hours:** the Square location's business hours (Dashboard: Account and Settings, Locations, Business hours) are stored in settings key `square_hours`. They drive the hero "Today" status (open now, closed now, opens tomorrow), the Hours list on `/` and `/book`, the admin calendar grid, and local-mode slots. Square-mode slots come from Square `SearchAvailability`, which already follows Ben's Square schedule.
- **Booking:** `/book` uses the same synced rows, so each service id maps to its Square variation id; price, duration, and the booking all match.
- **Sync triggers:** Connect Square, admin **Sync now**, saving location or barber in Settings, Square webhooks (`/api/square/webhook`: `catalog.version.updated`, `location.updated`, `booking.created`, `booking.updated`), the daily cron, and a stale check on public page loads (older than 10 minutes). With webhooks on, changes show in about a minute; without, in about 10 minutes.
- **Before Square is connected:** the site shows the starter `services` rows already in Neon in request mode (Ben confirms each booking), with fallback hours from `site.ts` (`fallbackHours`). If Square has no business hours posted, the fallback hours stay and Settings says so.

## Routes

- **Public:** `/`, `/book`, `GET /api/availability`, `POST /api/bookings`, `GET /api/health`, `POST /api/square/webhook` (signed by Square). No admin links in public nav.
- **Admin (Ben only):** `/admin/login`, `/admin` (dashboard), `/admin/calendar` (+ blocks), `/admin/inquiries`, `/admin/appointments`, `/admin/clients`, `/admin/settings`. Login seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`; session signed with `AUTH_SECRET`.
- **OAuth:** Square under `/api/admin/square/*`. Google OAuth code (`/api/admin/google/*`, `src/lib/google.ts`) is left in unused; `/api/admin/google/start` just returns to Settings.
- **Cron:** `/api/cron/square-sync` daily (`vercel.json`), protected by `CRON_SECRET`. Refreshes menu + hours, then bookings.

## Env (names only)

`DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `PUBLIC_SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_NOTIFY_EMAIL`, `SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `SQUARE_REDIRECT_URI`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_TEAM_MEMBER_ID`, `SQUARE_SELLER_LEVEL_WRITES`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `CRON_SECRET`. Placeholders in `.env.example`.

## Code map

- `src/pages/`: marketing (`index`, `book`), `admin/*`, `api/*`
- `src/lib/`: db, auth, time (NY), availability, appointments, blocks, clients, crm, square, square-sync, catalog (Square menu + hours), open-status (browser safe open or closed text), google, email, http, env, oauth-state
- `src/data/site.ts`: contact, reviews, gallery, fallback hours (no services or prices)
- `src/styles/admin.css`: admin design system (same ink / brass / cream tokens as `global.css`)
- `db/migrations/`: `000_init`, `001_blocks`, `002_square`, `003_square_catalog`; `scripts/seed.mjs` runs them + seeds admin
- `vercel.json`: cron + docs-only `ignoreCommand` (`scripts/vercel-ignore.sh`, copied from PLP)
- Setup detail (Square, Google, Resend, booking flow): root [README.md](../README.md)

## Sister sites (same docs pattern)

jeffcrowecre, property-landing-pages (PLP), c21theavenues office site. New stylist sites clone this repo + this `docs/` pack ([ROADMAP.md](ROADMAP.md)).

## Legal pages

- `/privacy` and `/terms` (prerendered, `src/components/LegalPage.astro`); `/privacy-policy` and `/terms-of-service` redirect there. Linked in the footer and under the Book form submit.
- If data handling changes (new analytics, new processor, SMS reminders), update `/privacy` and its Last updated date.
