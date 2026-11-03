import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/http';
import { normalizeDatabaseUrl, sql } from '../../lib/db';

export const GET: APIRoute = async () => {
  const keys = ['DATABASE_URL', 'AUTH_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'PUBLIC_SITE_URL', 'CRON_SECRET', 'RESEND_API_KEY'] as const;
  const present: Record<string, boolean> = {};
  for (const k of keys) present[k] = Boolean(env(k)?.length);

  let db: 'ok' | 'fail' | 'skipped' = 'skipped';
  let dbError: string | null = null;
  let adminCount: number | null = null;
  if (present.DATABASE_URL) {
    try {
      const rows = await sql()`select count(*)::int as n from admins`;
      adminCount = rows[0]?.n ?? 0;
      db = 'ok';
    } catch (e) {
      db = 'fail';
      dbError = (e as Error).message.slice(0, 180);
    }
  }

  return json({
    ok: present.DATABASE_URL && present.AUTH_SECRET && db === 'ok',
    present,
    db,
    dbError,
    adminCount,
    databaseUrlLooksLike: present.DATABASE_URL
      ? (() => {
          try {
            const u = new URL(normalizeDatabaseUrl(env('DATABASE_URL')!));
            return { host: u.hostname, db: u.pathname.replace(/^\//, ''), hasSsl: u.searchParams.get('sslmode') === 'require' };
          } catch {
            return { host: null, db: null, hasSsl: false };
          }
        })()
      : null,
  });
};
