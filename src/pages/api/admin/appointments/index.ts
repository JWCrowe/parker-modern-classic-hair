import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { upsertClient } from '../../../../lib/clients';
import { bad, json, normPhone, readJson, str } from '../../../../lib/http';
import { isDateKey, nyToUtc, parseHHMM } from '../../../../lib/time';

// GET /api/admin/appointments?from=ISO&to=ISO&status=inquiry
export const GET: APIRoute = async ({ url }) => {
  const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString();
  const to = url.searchParams.get('to') || new Date(Date.now() + 60 * 86400000).toISOString();
  const status = url.searchParams.get('status');
  const rows = await sql()`select a.id, a.starts_at, a.ends_at, a.status, a.price_cents, a.notes, a.source, a.square_booking_id, a.square_status,
      s.name as service_name, c.id as client_id, c.name as client_name, c.phone as client_phone, c.email as client_email
    from appointments a join services s on s.id = a.service_id join clients c on c.id = a.client_id
    where a.starts_at >= ${from} and a.starts_at < ${to} and (${status}::text is null or a.status = ${status})
    order by a.starts_at asc limit 1000`;
  return json({ appointments: rows });
};

// POST /api/admin/appointments  Log a walk-in or phone booking Ben took outside the site.
// { clientId? | name, phone?, email?, service, date, time, status?: 'completed'|'confirmed', price_cents?, notes? }
export const POST: APIRoute = async ({ request }) => {
  const b = await readJson(request);
  if (!b) return bad('Send JSON.');
  const minutes = parseHHMM(b.time);
  if (!isDateKey(b.date) || minutes == null) return bad('Pick a date and time.');
  const svc = (await sql()`select * from services where id = ${str(b.service, 60)}`)[0];
  if (!svc) return bad('Pick a service.');
  const status = ['completed', 'confirmed', 'no_show'].includes(b.status) ? b.status : 'completed';
  let clientId = str(b.clientId, 60);
  if (clientId) {
    const ok = await sql()`select id from clients where id = ${clientId}`;
    if (!ok.length) return bad('Client not found.', 404);
  } else {
    const name = str(b.name, 120);
    if (!name) return bad('Add the client name.');
    const phone = str(b.phone, 40);
    if (phone && normPhone(phone).length !== 10) return bad('Phone should be 10 digits.');
    clientId = (await upsertClient({ name, phone: phone || null, email: str(b.email, 200) || null })).id;
  }
  const startsAt = nyToUtc(b.date, minutes);
  const endsAt = new Date(startsAt.getTime() + Number(svc.duration_min) * 60000);
  const price = Number.isFinite(Number(b.price_cents)) && b.price_cents !== '' && b.price_cents != null ? Math.max(0, Math.round(Number(b.price_cents))) : Number(svc.price_cents);
  const rows = await sql()`insert into appointments (client_id, service_id, starts_at, ends_at, status, price_cents, notes, source)
    values (${clientId}, ${svc.id}, ${startsAt.toISOString()}, ${endsAt.toISOString()}, ${status}, ${price}, ${str(b.notes, 1000)}, 'admin') returning id`;
  return json({ ok: true, id: rows[0].id }, 201);
};
