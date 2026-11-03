import type { AstroCookies } from 'astro';

export function newState(cookies: AstroCookies, name: string, secure: boolean) {
  const s = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  cookies.set(name, s, { httpOnly: true, sameSite: 'lax', secure, path: '/api/admin', maxAge: 600 });
  return s;
}

export function checkState(cookies: AstroCookies, name: string, got: string | null) {
  const want = cookies.get(name)?.value;
  cookies.delete(name, { path: '/api/admin' });
  return Boolean(want && got && want === got);
}
