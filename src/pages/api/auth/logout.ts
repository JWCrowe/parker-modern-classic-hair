import type { APIRoute } from 'astro';
import { clearSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect, request, url }) => {
  clearSession(cookies, url.protocol === 'https:');
  const wantsJson =
    (request.headers.get('content-type') || '').includes('application/json') ||
    (request.headers.get('accept') || '').includes('application/json');
  if (wantsJson) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  return redirect('/admin/login', 303);
};
