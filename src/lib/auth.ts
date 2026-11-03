import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import type { AstroCookies } from 'astro';
import { sql } from './db';
import { env, requireEnv } from './env';

export const SESSION_COOKIE = 'pm_session';
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export type Admin = { id: string; email: string; name: string };

function key() {
  const s = requireEnv('AUTH_SECRET');
  if (s.length < 16) throw new Error('AUTH_SECRET must be at least 16 characters');
  return new TextEncoder().encode(s);
}

export async function createSession(cookies: AstroCookies, admin: Admin, secure: boolean) {
  const token = await new SignJWT({ email: admin.email, name: admin.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: MAX_AGE });
}

export function clearSession(cookies: AstroCookies, secure = true) {
  // Match the attributes used in createSession so browsers actually drop the Secure cookie.
  cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0, expires: new Date(0) });
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function readSession(cookies: AstroCookies): Promise<Admin | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return { id: payload.sub, email: String(payload.email || ''), name: String(payload.name || 'Ben') };
  } catch {
    return null;
  }
}

/** Create the single admin from ADMIN_EMAIL / ADMIN_PASSWORD if no admin exists yet. */
export async function seedAdminIfMissing(): Promise<'created' | 'exists' | 'no-env'> {
  const q = sql();
  const existing = await q`select id from admins limit 1`;
  if (existing.length) return 'exists';
  const email = env('ADMIN_EMAIL')?.trim().toLowerCase();
  const password = env('ADMIN_PASSWORD');
  if (!email || !password) return 'no-env';
  const hash = await bcrypt.hash(password, 12);
  await q`insert into admins (email, password_hash, name) values (${email}, ${hash}, ${env('ADMIN_NAME') || 'Ben'})
    on conflict (email) do nothing`;
  return 'created';
}

let dummyHash: string | null = null;

export async function verifyLogin(email: string, password: string): Promise<Admin | null> {
  const rows = await sql()`select id, email, name, password_hash from admins where lower(email) = ${email.trim().toLowerCase()} limit 1`;
  // Always run a compare so timing does not reveal whether the email exists.
  dummyHash ??= await bcrypt.hash('not-a-real-password', 12);
  const hash = rows[0]?.password_hash || dummyHash;
  const ok = await bcrypt.compare(password, hash);
  if (!rows.length || !ok) return null;
  return { id: rows[0].id, email: rows[0].email, name: rows[0].name };
}

export async function changePassword(adminId: string, current: string, next: string) {
  const rows = await sql()`select password_hash from admins where id = ${adminId}`;
  if (!rows.length || !(await bcrypt.compare(current, rows[0].password_hash))) return false;
  const hash = await bcrypt.hash(next, 12);
  await sql()`update admins set password_hash = ${hash} where id = ${adminId}`;
  return true;
}
