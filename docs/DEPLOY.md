# Deploy

**What shipped to `main` / production.** Newest first. By: this chat, grok.com, Jeff, local. Docs-only commits skip the Vercel build.

| Date | Commit | What | By | Notes |
|------|--------|------|----|-------|
| 2026-11-03 | `8c4fad2` | Docs pack + empty admin card height fix (shell rows auto/auto, main align start, `.card-empty`) + docs-only ignoreCommand | this chat | No Neon/env change. Push-triggered prod build Ready (Mac `vercel --prod` returned Not authorized). New CSS verified in live bundle; `/api/health` ok. |
| 2026-11-02 | `f544649` | Stop admin shell from stretching the mobile header tall | this chat | No Neon/env change |
| 2026-11-02 | `3b4d1d3` | Mobile admin nav: short labels + width containment | this chat | No Neon/env change |
| 2026-11-02 | `85a2361` / `e19ce49` | Sign-out CSRF fix + Secure cookie clear; mobile nav overflow | this chat | `site` set to vercel.app |
| 2026-11-02 | `ed5f37d` | Admin login 500s: clearer DB errors + `/api/health` | this chat | Admin env names set in Vercel |
| 2026-11-02 | `6feb257` | Admin CRM + Square booking + calendar blocks | this chat | Neon migrations 000-002 |

| 2026-11-03 | `7c9ed0b` redeploy after Square OAuth env (`SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET` on Production+Preview; no access token) | this chat | Env via Vercel UI + CLI. Push-triggered Production Ready. No Neon change. |
