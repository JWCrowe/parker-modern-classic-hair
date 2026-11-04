-- Square drives the public menu. Sync copies each bookable Square service variation into services.
alter table services add column if not exists square_item_id text;
alter table services add column if not exists price_varies boolean not null default false;
alter table services add column if not exists synced_at timestamptz;
