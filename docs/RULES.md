# Rules

1. **No bloat, docs or code.** Short files. Prefer links over copy. Prefer a small patch over a new module.
2. **Token efficiency (Grok).** Short answers; no wiki recaps; tools only when needed; amend docs instead of narrating; one tight patch.
3. **Memory + hands.** [WIKI](WIKI.md) + Rules + [NEXT](NEXT.md) + [DAILY_LOG](DAILY_LOG.md) + [DEPLOY](DEPLOY.md) + [ROADMAP](ROADMAP.md). Read first, execute, write back. Chat is not the record.
4. **Grok keeps the files current.** Same session after material change.
5. **Alert Jeff when help is required.** Blocked: say so, log Blocked, stop.
6. **Session order.** [NEXT.md](NEXT.md) top item, ship, delete line, [DAILY_LOG.md](DAILY_LOG.md). If code/docs hit `main`: also a row in [DEPLOY.md](DEPLOY.md) (by: this chat, grok.com, Jeff, local).
7. **Multi-surface work.** Work may land from xAI chat, grok.com, or Jeff local. **DEPLOY is the single ship record** so sessions do not collide or assume the other already deployed.
8. **Capture new facts.** Amend the owning page same session.
9. **Living wiki.** Amend before create; a new doc needs a wiki link in the same commit.
10. **Docs set.** Wiki, Rules, Next, Daily log, Deploy, Roadmap.
11. **Roadmap / Next shrink.** Delete the line when shipped.
12. **Fast + cheap.** Keep Neon + Vercel cheap: tight queries, no polling, CDN-cached marketing pages (60s), minimal JS. Docs-only commits skip the Vercel build (`scripts/vercel-ignore.sh`).
13. **No secrets in docs or chat.** Env var names only; never DSNs, tokens, keys, or passwords.
14. **Docs stream: autonomy.** Docs edits + push to `main` without re-asking. Code deploys are fine when Jeff asked for the work. Commits as `JWCrowe <crowejeffery@gmail.com>`.
15. **Admin is Ben only.** Login seeded from `ADMIN_*`; no open signup. Public site is marketing + book only; no admin links in public nav.
16. **No em dashes in client-facing copy** (Jeff hard rule).
17. **Square is source of truth when connected.** Never invent availability Square doesn't have. Square also drives the public menu (services, prices, durations) and hours: never hardcode them in `site.ts` or page copy; Ben changes them in Square only.
18. **Mobile-first admin.** 44px tap targets, no horizontal blowout, empty states compact (never viewport-tall).
