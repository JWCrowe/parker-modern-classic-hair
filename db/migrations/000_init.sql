-- Base schema. Safe to re-run.
create extension if not exists pgcrypto;

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null default 'Ben',
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_email_lower_uidx on clients (lower(email)) where email is not null and email <> '';
create unique index if not exists clients_phone_uidx on clients (phone) where phone is not null and phone <> '';

create table if not exists services (
  id text primary key,
  name text not null,
  description text not null default '',
  duration_min integer not null,
  price_cents integer not null,
  active boolean not null default true,
  sort_order integer not null default 0
);

insert into services (id, name, description, duration_min, price_cents, sort_order) values
  ('mens', 'Men''s Haircut', 'Classic or modern cut, finished with a hot towel and style.', 30, 3800, 1),
  ('beard', 'Beard', 'Shape, line up, and trim.', 30, 2500, 2),
  ('combo', 'Men''s Haircut & Beard', 'The full service: cut plus beard.', 60, 5500, 3),
  ('kids', 'Kid''s Haircut', 'Cuts for the little guys.', 30, 3500, 4),
  ('womens', 'Women''s Haircut', 'Short cuts and trims.', 60, 5500, 5)
on conflict (id) do nothing;

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  service_id text not null references services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'inquiry' check (status in ('inquiry', 'confirmed', 'completed', 'cancelled', 'no_show')),
  price_cents integer not null,
  notes text not null default '',
  google_event_id text,
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_starts_idx on appointments (starts_at);
create index if not exists appointments_client_idx on appointments (client_id);
create index if not exists appointments_status_idx on appointments (status);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
