-- Blocked time ranges Ben sets from the admin calendar.
-- Removes slots from public availability the same way appointments and Google busy times do.
create table if not exists blocks (
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
);
create index if not exists blocks_range_idx on blocks (starts_at, ends_at);
create index if not exists appointments_starts_idx on appointments (starts_at);
create index if not exists appointments_client_idx on appointments (client_id);
create index if not exists appointments_status_idx on appointments (status);
