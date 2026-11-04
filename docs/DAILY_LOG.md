# Daily log

Newest first. One short block per day: **Done / Blocked / Next**. Times America/New_York.

---

## 2026-11-03

**Done**
- Privacy Policy (`/privacy`) and Terms of Service (`/terms`) added as prerendered pages in the Parker look (`src/components/LegalPage.astro`). Georgia law, Gordon County venue, Square as processor, Vercel/Neon/Resend as providers, admin-only cookies. Footer bottom links on every public page; legal line under the Book submit button. `/privacy-policy` and `/terms-of-service` redirect.
- Square now drives the public menu and hours. `/` and `/book` render on demand (CDN 60s) from the Square-synced `services` rows and Square location business hours; hero Today status and Hours list follow Square. Sync on connect, Sync now, settings save, webhook (`/api/square/webhook`), daily cron, and stale check on page load. `site.ts` no longer holds services or prices. Neon schema v3 (`003_square_catalog`).
- Docs pack added (`docs/` WIKI, RULES, NEXT, DAILY_LOG, DEPLOY, ROADMAP), README now points to the wiki. Same pattern as jeffcrowecre, PLP, C21 (Jeff: "easy repeatable process" for stylist sites).
- Empty admin card tightened in `src/styles/admin.css`: `.admin-shell` rows `auto auto` at all breakpoints (no `1fr`), `align-items: start` (mobile no longer `stretch`), `.admin-main` `align-self: start` + content height, `.admin-main > .card` content height, `.card-empty` class on empty Appointments / Inquiries / Clients cards (compact padding, not only `:has()`), closed `dialog.dlg` forced `display: none !important`. Dialogs confirmed outside `.card`.
- `vercel.json`: docs-only `ignoreCommand` (`scripts/vercel-ignore.sh`, copied from PLP). Crons unchanged.

**Blocked**
- None.

**Next**
- [NEXT.md](NEXT.md) top: Jeff verifies compact empty cards.

## 2026-11-02

**Done**
- Admin CRM shipped (Neon: clients, appointments, blocks, settings, services; Square booking + calendar blocks).
- Login 500s fixed with clearer DB errors + `/api/health`; Ben's login env set.
- Sign-out CSRF fixed (astro `site` = vercel.app for `checkOrigin`); Secure cookie cleared with matching attributes.
- Mobile admin nav: short labels, width containment; first attempt at the tall mobile header.
