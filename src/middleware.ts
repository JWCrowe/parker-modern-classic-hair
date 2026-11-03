import { defineMiddleware } from 'astro:middleware';
import { readSession } from './lib/auth';
import { ensureSchema } from './lib/db';

const PUBLIC_ADMIN = new Set(['/admin/login', '/admin/login/']);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  ctx.locals.admin = null;
  if (ctx.isPrerendered) return next();

  const isAdminPage = path === '/admin' || path.startsWith('/admin/');
  const isAdminApi = path.startsWith('/api/admin/');
  const isApi = path.startsWith('/api/');

  if (isApi || isAdminPage) {
    try {
      await ensureSchema();
    } catch (e) {
      console.error('[schema]', (e as Error).message);
    }
  }

  if (isAdminPage || isAdminApi || path.startsWith('/api/auth/')) {
    ctx.locals.admin = await readSession(ctx.cookies).catch(() => null);
  }

  if (isAdminApi && !ctx.locals.admin) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  if (isAdminPage && !PUBLIC_ADMIN.has(path) && !ctx.locals.admin) {
    return ctx.redirect(`/admin/login?next=${encodeURIComponent(path + ctx.url.search)}`);
  }

  const res = await next();
  if (isAdminPage || isApi) {
    res.headers.set('cache-control', 'no-store');
    if (isAdminPage) {
      res.headers.set('x-robots-tag', 'noindex, nofollow');
      res.headers.set('x-frame-options', 'DENY');
    }
  }
  return res;
});
