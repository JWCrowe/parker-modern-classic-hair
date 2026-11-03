-- Square is the source of truth for bookings. Neon mirrors Square for the CRM (visits, yearly value).
alter table appointments add column if not exists square_booking_id text;
alter table appointments add column if not exists square_version integer;
alter table appointments add column if not exists square_status text;
alter table appointments add column if not exists team_member_id text;
create unique index if not exists appointments_square_booking_uidx on appointments (square_booking_id) where square_booking_id is not null;
alter table clients add column if not exists square_customer_id text;
create unique index if not exists clients_square_customer_uidx on clients (square_customer_id) where square_customer_id is not null;
alter table services add column if not exists square_variation_id text;
alter table services add column if not exists square_variation_version bigint;
