import type { APIRoute } from 'astro';
import { changePassword } from '../../../lib/auth';
import { bad, json, readJson } from '../../../lib/http';

export const POST: APIRoute = async ({ request, locals }) => {
  const b = await readJson(request);
  const current = typeof b?.current === 'string' ? b.current : '';
  const next = typeof b?.next === 'string' ? b.next : '';
  if (next.length < 10) return bad('Use at least 10 characters for the new password.');
  const ok = await changePassword(locals.admin!.id, current, next);
  return ok ? json({ ok: true }) : bad('Current password is wrong.', 401);
};
