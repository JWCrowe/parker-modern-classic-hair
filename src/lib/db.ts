import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { requireEnv } from './env';

let _sql: NeonQueryFunction<false, false> | null = null;

/** Neon serverless driver does not need channel_binding; strip it if present. */
export function normalizeDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch {
    return raw.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '');
  }
}

export function sql() {
  if (!_sql) _sql = neon(normalizeDatabaseUrl(requireEnv('DATABASE_URL')));
  return _sql;
}

// Idempotent schema upgrades the app needs at runtime (also run by `npm run seed`).
const SCHEMA_VERSION = 3;
let ready: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!ready) {
    const q = sql();
    ready = (async () => {
      const v = await q`select value from settings where key = 'schema_version'`;
      if (v.length && Number(v[0].value) >= SCHEMA_VERSION) return;
      await q`create table if not exists blocks (
        id uuid primary key default gen_random_uuid(),
        starts_at timestamptz not null,
        ends_at timestamptz not null,
        all_day boolean not null default false,
        title text not null default '',
        notes text not null default '',
        google_event_id text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint blocks_range_check check (ends_at > starts_at)
      )`;
      await q`create index if not exists blocks_range_idx on blocks (starts_at, ends_at)`;
      await q`alter table appointments add column if not exists square_booking_id text`;
      await q`alter table appointments add column if not exists square_version integer`;
      await q`alter table appointments add column if not exists square_status text`;
      await q`alter table appointments add column if not exists team_member_id text`;
      await q`create unique index if not exists appointments_square_booking_uidx on appointments (square_booking_id) where square_booking_id is not null`;
      await q`alter table clients add column if not exists square_customer_id text`;
      await q`create unique index if not exists clients_square_customer_uidx on clients (square_customer_id) where square_customer_id is not null`;
      await q`alter table services add column if not exists square_variation_id text`;
      await q`alter table services add column if not exists square_variation_version bigint`;
      await q`alter table services add column if not exists square_item_id text`;
      await q`alter table services add column if not exists price_varies boolean not null default false`;
      await q`alter table services add column if not exists synced_at timestamptz`;
      await q`insert into settings (key, value) values ('schema_version', ${JSON.stringify(SCHEMA_VERSION)}::jsonb)
        on conflict (key) do update set value = excluded.value, updated_at = now()`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export type Settings = Record<string, any>;

export async function getSetting<T = any>(key: string): Promise<T | null> {
  const rows = await sql()`select value from settings where key = ${key}`;
  return rows.length ? (rows[0].value as T) : null;
}

export async function setSetting(key: string, value: unknown) {
  await sql()`insert into settings (key, value, updated_at) values (${key}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

export async function deleteSetting(key: string) {
  await sql()`delete from settings where key = ${key}`;
}
