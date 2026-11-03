import { sql } from './db';

// Year boundaries are New York calendar years. Visits and value count only `completed` appointments.
export async function listClients(search = '') {
  const q = `%${search.trim().toLowerCase()}%`;
  return (await sql()`
    with y as (select (date_trunc('year', now() at time zone 'America/New_York') at time zone 'America/New_York') as start)
    select c.id, c.name, c.email, c.phone, c.square_customer_id, c.created_at,
      count(a.id) filter (where a.status = 'completed')::int as visit_count,
      max(a.starts_at) filter (where a.status = 'completed') as last_visit,
      min(a.starts_at) filter (where a.status in ('inquiry', 'confirmed') and a.starts_at > now()) as next_visit,
      coalesce(sum(a.price_cents) filter (where a.status = 'completed' and a.starts_at >= y.start), 0)::int as year_value,
      coalesce(sum(a.price_cents) filter (where a.status = 'completed'), 0)::int as lifetime_value,
      count(a.id) filter (where a.status = 'completed' and a.starts_at >= y.start)::int as year_visits
    from clients c cross join y left join appointments a on a.client_id = c.id
    where ${search} = '' or lower(c.name) like ${q} or lower(coalesce(c.email, '')) like ${q} or regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') like ${'%' + search.replace(/\D/g, '') + '%'} and ${search.replace(/\D/g, '')} <> ''
    group by c.id, y.start
    order by year_value desc, lifetime_value desc, c.name asc
    limit 2000`) as any[];
}

export async function getClient(id: string) {
  const rows = await listClientsById(id);
  if (!rows) return null;
  const history = await sql()`select a.id, a.starts_at, a.ends_at, a.status, a.price_cents, a.notes, a.source, a.square_booking_id, a.square_status, s.name as service_name, s.id as service_id
    from appointments a join services s on s.id = a.service_id where a.client_id = ${id} order by a.starts_at desc`;
  const byService = await sql()`select s.name, count(*)::int as n, coalesce(sum(a.price_cents), 0)::int as cents
    from appointments a join services s on s.id = a.service_id where a.client_id = ${id} and a.status = 'completed' group by s.name order by n desc`;
  return { client: rows, history: history as any[], byService: byService as any[] };
}

async function listClientsById(id: string) {
  const r = await sql()`
    with y as (select (date_trunc('year', now() at time zone 'America/New_York') at time zone 'America/New_York') as start)
    select c.*,
      count(a.id) filter (where a.status = 'completed')::int as visit_count,
      count(a.id) filter (where a.status = 'no_show')::int as no_shows,
      max(a.starts_at) filter (where a.status = 'completed') as last_visit,
      coalesce(sum(a.price_cents) filter (where a.status = 'completed' and a.starts_at >= y.start), 0)::int as year_value,
      coalesce(sum(a.price_cents) filter (where a.status = 'completed'), 0)::int as lifetime_value
    from clients c cross join y left join appointments a on a.client_id = c.id
    where c.id = ${id} group by c.id, y.start`;
  return (r[0] as any) || null;
}

export async function dashboardStats() {
  const r = await sql()`
    with b as (
      select
        (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York') as day,
        (date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York') as week,
        (date_trunc('month', now() at time zone 'America/New_York') at time zone 'America/New_York') as month,
        (date_trunc('year', now() at time zone 'America/New_York') at time zone 'America/New_York') as year
    )
    select
      (select count(*)::int from appointments where status = 'inquiry' and starts_at > now() - interval '1 day') as inquiries,
      (select count(*)::int from appointments, b where status = 'completed' and starts_at >= b.week) as cuts_week,
      (select count(*)::int from appointments, b where status = 'completed' and starts_at >= b.month) as cuts_month,
      (select count(*)::int from appointments, b where status = 'completed' and starts_at >= b.year) as cuts_year,
      (select coalesce(sum(price_cents), 0)::int from appointments, b where status = 'completed' and starts_at >= b.month) as revenue_month,
      (select coalesce(sum(price_cents), 0)::int from appointments, b where status = 'completed' and starts_at >= b.year) as revenue_year,
      (select count(distinct client_id)::int from appointments, b where status = 'completed' and starts_at >= b.year) as clients_year,
      (select count(*)::int from appointments where status = 'confirmed' and starts_at > now()) as upcoming
    from b`;
  return r[0] as Record<string, number>;
}

/** Past confirmed local appointments Ben has not marked yet. */
export async function needsWrapUp() {
  return (await sql()`select a.id, a.starts_at, s.name as service_name, c.name as client_name, a.price_cents
    from appointments a join services s on s.id = a.service_id join clients c on c.id = a.client_id
    where a.status = 'confirmed' and a.ends_at < now() order by a.starts_at desc limit 20`) as any[];
}
