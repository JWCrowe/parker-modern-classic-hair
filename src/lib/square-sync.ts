import { sql } from './db';
import { upsertClient } from './clients';
import { getSquareConn, listBookings, getCustomers, mapSquareStatus, updateSquareConn, type SquareService } from './square';
import { displayName, syncSquareCatalog } from './catalog';

async function serviceIdFor(variationId: string | undefined, catalog: SquareService[]) {
  if (!variationId) return { id: 'mens', price: 0 };
  const rows = await sql()`select id, price_cents from services where square_variation_id = ${variationId} limit 1`;
  const sqs = catalog.find((s) => s.variationId === variationId);
  if (rows.length) return { id: rows[0].id as string, price: sqs?.priceCents ?? Number(rows[0].price_cents) };
  // Service that is no longer (or never was) offered online: keep an inactive row so CRM history stays complete.
  const id = `sq_${variationId}`.slice(0, 60);
  const name = sqs ? displayName(sqs) : 'Square service';
  await sql()`insert into services (id, name, description, duration_min, price_cents, active, sort_order, square_variation_id)
    values (${id}, ${name}, 'Imported from Square', ${sqs?.durationMin || 30}, ${sqs?.priceCents || 0}, false, 99, ${variationId})
    on conflict (id) do nothing`;
  return { id, price: sqs?.priceCents || 0 };
}

/** Pull Square bookings into Neon (appointments + clients). Past ACCEPTED bookings become `completed` visits. */
export async function syncSquareBookings(opts: { pastDays: number; futureDays: number }) {
  const c = await getSquareConn();
  if (!c?.access_token) return { skipped: true as const };
  const started = Date.now();
  const from = new Date(Date.now() - opts.pastDays * 86400000);
  const to = new Date(Date.now() + opts.futureDays * 86400000);
  try {
    // Services and hours first, so the public menu and booking use the same Square variation ids.
    const cat = await syncSquareCatalog();
    const catalog: SquareService[] = 'services' in cat ? cat.services : [];
    const bookings = await listBookings({ from, to, locationId: c.location_id });
    const custIds = [...new Set(bookings.map((b) => b.customer_id).filter(Boolean))] as string[];
    const existing = custIds.length ? await sql()`select square_customer_id, id from clients where square_customer_id = any(${custIds})` : [];
    const known = new Map(existing.map((r) => [r.square_customer_id, r.id]));
    const toFetch = custIds.filter((id) => !known.has(id));
    const customers = toFetch.length ? await getCustomers(toFetch) : {};
    let upserts = 0;
    for (const b of bookings) {
      if (b.all_day) continue;
      let clientId = b.customer_id ? known.get(b.customer_id) : undefined;
      if (!clientId) {
        const cu = b.customer_id ? customers[b.customer_id] : null;
        const name = cu ? [cu.given_name, cu.family_name].filter(Boolean).join(' ') || cu.company_name || cu.email_address || 'Square client' : 'Square client';
        const client = await upsertClient({ name, email: cu?.email_address, phone: cu?.phone_number, squareCustomerId: b.customer_id || null });
        clientId = client.id;
        if (b.customer_id) known.set(b.customer_id, client.id);
      }
      const seg = b.appointment_segments?.[0];
      const svc = await serviceIdFor(seg?.service_variation_id, catalog);
      const minutes = (b.appointment_segments || []).reduce((t: number, s: any) => t + Number(s.duration_minutes || 0) + Number(s.intermission_minutes || 0), 0) || 30;
      const startsAt = new Date(b.start_at);
      const endsAt = new Date(startsAt.getTime() + minutes * 60000);
      let status: string = mapSquareStatus(b.status);
      if (status === 'confirmed' && endsAt.getTime() < Date.now()) status = 'completed';
      await sql()`insert into appointments (client_id, service_id, starts_at, ends_at, status, price_cents, notes, source, square_booking_id, square_version, square_status, team_member_id)
        values (${clientId}, ${svc.id}, ${startsAt.toISOString()}, ${endsAt.toISOString()}, ${status}, ${svc.price}, ${b.customer_note || ''}, 'square', ${b.id}, ${b.version}, ${b.status}, ${seg?.team_member_id || null})
        on conflict (square_booking_id) where square_booking_id is not null do update set
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          service_id = excluded.service_id,
          square_version = excluded.square_version,
          square_status = excluded.square_status,
          team_member_id = excluded.team_member_id,
          -- Ben's local calls (completed / no-show / confirmed) win unless Square says it was cancelled.
          status = case
            when excluded.status = 'cancelled' then 'cancelled'
            when appointments.status in ('completed', 'no_show') and excluded.status in ('confirmed', 'completed') then appointments.status
            when appointments.status = 'confirmed' and excluded.status = 'inquiry' then appointments.status
            else excluded.status end,
          price_cents = case when appointments.price_cents = 0 then excluded.price_cents else appointments.price_cents end,
          updated_at = now()`;
      upserts++;
    }
    const menu = 'summary' in cat ? `${cat.summary}. ` : 'error' in cat ? `Menu sync failed: ${cat.error}. ` : '';
    const summary = `${menu}${upserts} bookings synced (${opts.pastDays}d back, ${opts.futureDays}d ahead) in ${Math.round((Date.now() - started) / 100) / 10}s`;
    const patch: any = { last_sync_at: new Date().toISOString(), last_sync_summary: summary, last_error: null };
    if (opts.pastDays >= 300) patch.last_full_sync_at = patch.last_sync_at;
    await updateSquareConn(patch);
    return { ok: true as const, count: upserts, summary };
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[square sync]', msg);
    await updateSquareConn({ last_error: `Sync failed: ${msg}` }).catch(() => {});
    return { ok: false as const, error: msg };
  }
}

/** Cheap sync used on admin page loads: only when the last one is older than 3 minutes. */
export async function syncIfStale() {
  const c = await getSquareConn().catch(() => null);
  if (!c?.access_token) return;
  const last = c.last_sync_at ? Date.parse(c.last_sync_at) : 0;
  if (Date.now() - last < 3 * 60000) return;
  const full = !c.last_full_sync_at;
  await syncSquareBookings(full ? { pastDays: 365, futureDays: 62 } : { pastDays: 14, futureDays: 45 });
}
