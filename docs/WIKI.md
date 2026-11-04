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
| Stack | Astro 5 `output: 'server'` + `@astrojs/vercel` (Node functions). `/` and `/book` prerendered; `/admin` + `/api` serverless |
| Database | Neon Postgres, project `twilight-mouse-67054832`: clients (CRM), appointments, blocks, settings, services. Env `DATABASE_URL` |
| Schedule | **Square Appointments is source of truth when connected.** Google Calendar optional secondary. Resend optional email |
| Without Square | Local inquiry mode: every booking lands as an inquiry; Ben confirms or declines in `/admin/inquiries` |
| With Square | Bookings created in Square, mirrored to Neon. Pending (manual-accept) Square bookings can't be accepted via our API; Ben accepts in the Square app |
| Live host | https://parker-modern-classic-hair.vercel.app (Vercel project `parker-modern-classic-hair`). `parkermodernclassichair.com` is still on **Weebly** until DNS moves; astro `site` = vercel.app URL so `checkOrigin` passes |
| Repo | https://github.com/JWCrowe/parker-modern-classic-hair (`main` = production) |

## Services

Source: `src/data/site.ts` + `services` table (`db/migrations/000_init.sql`).

| Service | Price | Length |
|--|--|--|
| Men's Haircut | $38 | 30m |
| Beard | $25 | 30m |
| Men's Haircut & Beard | $55 | 60m |
| Kid's Haircut | $35 | 30m |
| Women's Haircut | $55 | 60m |

## Routes

- **Public:** `/`, `/book`, `GET /api/availability`, `POST /api/bookings`, `GET /api/health`. No admin links in public nav.
- **Admin (Ben only):** `/admin/login`, `/admin` (dashboard), `/admin/calendar` (+ blocks), `/admin/inquiries`, `/admin/appointments`, `/admin/clients`, `/admin/settings`. Login seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`; session signed with `AUTH_SECRET`.
- **OAuth:** Square + Google under `/api/admin/square/*`, `/api/admin/google/*`.
- **Cron:** `/api/cron/square-sync` daily (`vercel.json`), protected by `CRON_SECRET`.

## Env (names only)

`DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `PUBLIC_SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_NOTIFY_EMAIL`, `SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `SQUARE_REDIRECT_URI`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_TEAM_MEMBER_ID`, `SQUARE_SELLER_LEVEL_WRITES`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `CRON_SECRET`. Placeholders in `.env.example`.

## Code map

- `src/pages/`: marketing (`index`, `book`), `admin/*`, `api/*`
- `src/lib/`: db, auth, time (NY), availability, appointments, blocks, clients, crm, square, square-sync, google, email, http, env, oauth-state
- `src/data/site.ts`: services, hours, contact, gallery
- `src/styles/admin.css`: admin design system (same ink / brass / cream tokens as `global.css`)
- `db/migrations/`: `000_init`, `001_blocks`, `002_square`; `scripts/seed.mjs` runs them + seeds admin
- `vercel.json`: cron + docs-only `ignoreCommand` (`scripts/vercel-ignore.sh`, copied from PLP)
- Setup detail (Square, Google, Resend, booking flow): root [README.md](../README.md)

## Sister sites (same docs pattern)

jeffcrowecre, property-landing-pages (PLP), c21theavenues office site. New stylist sites clone this repo + this `docs/` pack ([ROADMAP.md](ROADMAP.md)).
