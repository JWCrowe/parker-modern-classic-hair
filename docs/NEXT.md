# Next

Ordered. Delete line when shipped. Log [DAILY_LOG.md](DAILY_LOG.md).

---

- [ ] Square Developer Dashboard: add Production OAuth redirect `https://parker-modern-classic-hair.vercel.app/api/admin/square/callback`
- [ ] Ben: /admin/settings → Connect Square, confirm location + barber. Services and hours then sync on their own (no service map needed unless Settings shows a mismatch).
- [ ] Ben, in Square: each service bookable online for Ben at the Calhoun location, with price, duration, description; business hours posted on the location.
- [ ] **Jeff (optional, makes changes show in about a minute instead of 10):** Square Developer Dashboard, Webhooks, Production: add `https://parker-modern-classic-hair.vercel.app/api/square/webhook` with events `catalog.version.updated`, `location.updated`, `booking.created`, `booking.updated`; put its signature key in Vercel as `SQUARE_WEBHOOK_SIGNATURE_KEY` (Production) and redeploy.
- [x] Vercel: `SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET` (Production + Preview); redeployed 2026-11-03


- [ ] **Jeff:** hard-refresh `/admin/appointments`, `/admin/inquiries`, `/admin/clients` (desktop + phone) and confirm empty cards are compact after the 2026-11-03 CSS fix.
- [ ] **Jeff + Ben:** Square app connect for Ben (Sandbox first, then Production): set `SQUARE_*` env names in Vercel, Connect Square in `/admin/settings` (services and hours sync automatically).
- [ ] Resend: add + verify `parkermodernclassichair.com` (DNS records), then set `RESEND_FROM` to a parkermodernclassichair.com sender.
- [ ] **Jeff:** when ready, point DNS from Weebly to Vercel; then flip astro `site` + `PUBLIC_SITE_URL` to `https://parkermodernclassichair.com` and update Square/Google redirect URIs.
- [ ] Optional: Google Calendar OAuth (`GOOGLE_*`).
- [ ] Any remaining tall-box / mobile admin polish Jeff spots.
