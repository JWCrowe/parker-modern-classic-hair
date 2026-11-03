import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { getAppointment, setStatus, STATUSES, type Status } from '../../../../lib/appointments';
import { bad, json, readJson, str } from '../../../../lib/http';

export const GET: APIRoute = async ({ params }) => {
  const a = await getAppointment(params.id!);
  return a ? json({ appointment: a }) : bad('Not found', 404);
};

// PATCH { status?, notify?, price_cents?, notes? }
export const PATCH: APIRoute = async ({ params, request, url }) => {
  const b = await readJson(request);
  if (!b) return bad('Send JSON.');
  const id = params.id!;
  const a = await getAppointment(id);
  if (!a) return bad('Not found', 404);
  if (b.price_cents != null) {
    const p = Math.round(Number(b.price_cents));
    if (!Number.isFinite(p) || p < 0) return bad('Price looks wrong.');
    await sql()`update appointments set price_cents = ${p}, updated_at = now() where id = ${id}`;
  }
  if (typeof b.notes === 'string') await sql()`update appointments set notes = ${str(b.notes, 2000)}, updated_at = now() where id = ${id}`;
  if (b.status) {
    if (!STATUSES.includes(b.status)) return bad('Unknown status.');
    const r = await setStatus(id, b.status as Status, { notify: b.notify !== false, origin: url.origin });
    if ('error' in r) return bad(r.error!, 409);
    return json({ ok: true, emailed: r.emailed });
  }
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params }) => {
  const a = await getAppointment(params.id!);
  if (!a) return bad('Not found', 404);
  if (a.square_booking_id) return bad('This booking lives in Square. Cancel it instead of deleting.', 409);
  await sql()`delete from appointments where id = ${params.id!}`;
  return json({ ok: true });
};
