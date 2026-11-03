import type { APIRoute } from 'astro';
import { createSession, seedAdminIfMissing, verifyLogin } from '../../../lib/auth';
import { bad, json, readJson, str } from '../../../lib/http';

const attempts = new Map<string, { n: number; t: number }>();

export const POST: APIRoute = async ({ request, cookies, url, clientAddress }) => {
  const body = await readJson(request);
  const email = str(body?.email, 200);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) return bad('Enter your email and password.');

  const ip = (() => {
    try {
      return clientAddress || 'x';
    } catch {
      return 'x';
    }
  })();
  const a = attempts.get(ip);
  if (a && a.n >= 8 && Date.now() - a.t < 15 * 60000) return bad('Too many tries. Wait 15 minutes and try again.', 429);

  await seedAdminIfMissing().catch((e) => console.error('[seed]', e.message));
  const admin = await verifyLogin(email, password);
  if (!admin) {
    attempts.set(ip, { n: (a && Date.now() - a.t < 15 * 60000 ? a.n : 0) + 1, t: Date.now() });
    return bad('That email and password do not match.', 401);
  }
  attempts.delete(ip);
  await createSession(cookies, admin, url.protocol === 'https:');
  return json({ ok: true, admin: { email: admin.email, name: admin.name } });
};
