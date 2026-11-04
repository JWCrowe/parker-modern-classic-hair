# Next

Ordered. Delete line when shipped. Log [DAILY_LOG.md](DAILY_LOG.md).

---

- [ ] Square Developer Dashboard: add Production OAuth redirect `https://parker-modern-classic-hair.vercel.app/api/admin/square/callback`
- [ ] Ben: /admin/settings → Connect Square, then location + team member + service map
- [x] Vercel: `SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET` (Production + Preview); redeployed 2026-11-03


- [ ] **Jeff:** hard-refresh `/admin/appointments`, `/admin/inquiries`, `/admin/clients` (desktop + phone) and confirm empty cards are compact after the 2026-11-03 CSS fix.
- [ ] **Jeff + Ben:** Square app connect for Ben (Sandbox first, then Production): set `SQUARE_*` env names in Vercel, Connect Square in `/admin/settings`, map services.
- [ ] Resend: add + verify `parkermodernclassichair.com` (DNS records), then set `RESEND_FROM` to a parkermodernclassichair.com sender.
- [ ] **Jeff:** when ready, point DNS from Weebly to Vercel; then flip astro `site` + `PUBLIC_SITE_URL` to `https://parkermodernclassichair.com` and update Square/Google redirect URIs.
- [ ] Optional: Google Calendar OAuth (`GOOGLE_*`).
- [ ] Any remaining tall-box / mobile admin polish Jeff spots.
