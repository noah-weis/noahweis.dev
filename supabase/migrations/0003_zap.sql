-- ZAP: trip reimbursement schema + RLS.

create extension if not exists "uuid-ossp";

-- ---------- tables ----------

create table zap_trips (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null check (length(name) between 1 and 80),
  created_by  text not null references allowed_emails(email),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create table zap_trip_members (
  trip_id     uuid not null references zap_trips(id) on delete cascade,
  email       text not null references allowed_emails(email),
  joined_at   timestamptz not null default now(),
  primary key (trip_id, email)
);

create index zap_trip_members_email_idx on zap_trip_members (email);

create table zap_receipts (
  id            uuid primary key default uuid_generate_v4(),
  trip_id       uuid not null references zap_trips(id) on delete cascade,
  uploaded_by   text not null references allowed_emails(email),
  payer_email   text not null references allowed_emails(email),
  storage_path  text not null,
  label         text not null default '',
  receipt_date  date not null default current_date,
  total_cents   integer not null check (total_cents >= 0),
  split_mode    text not null check (split_mode in ('flat', 'itemized')),
  created_at    timestamptz not null default now()
);

create index zap_receipts_trip_idx on zap_receipts (trip_id);

create table zap_receipt_members (
  receipt_id  uuid not null references zap_receipts(id) on delete cascade,
  email       text not null references allowed_emails(email),
  primary key (receipt_id, email)
);

create table zap_receipt_items (
  id            uuid primary key default uuid_generate_v4(),
  receipt_id    uuid not null references zap_receipts(id) on delete cascade,
  description   text not null default '',
  amount_cents  integer not null check (amount_cents >= 0),
  position      integer not null
);

create index zap_receipt_items_receipt_idx on zap_receipt_items (receipt_id);

create table zap_receipt_item_members (
  item_id  uuid not null references zap_receipt_items(id) on delete cascade,
  email    text not null references allowed_emails(email),
  primary key (item_id, email)
);

create table zap_settlements (
  id           uuid primary key default uuid_generate_v4(),
  trip_id      uuid not null references zap_trips(id) on delete cascade,
  from_email   text not null references allowed_emails(email),
  to_email     text not null references allowed_emails(email),
  amount_cents integer not null check (amount_cents > 0),
  created_at   timestamptz not null default now(),
  paid_at      timestamptz not null default now()
);

create index zap_settlements_trip_idx on zap_settlements (trip_id);

-- ---------- helpers ----------

create or replace function is_zap_trip_member(p_trip_id uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from zap_trip_members
    where trip_id = p_trip_id and email = auth_email()
  );
$$;

create or replace function is_enabled_allowed_email(p_email text) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from allowed_emails
    where email = p_email and enabled = true
  );
$$;

-- BEFORE INSERT: force created_by to the JWT email so the client can't spoof
-- it and so the SELECT RLS check on the RETURNING row can trust it. Falls
-- through for non-JWT callers (service role / direct SQL) so test seeding
-- and admin tools can still set created_by explicitly.
create or replace function zap_set_trip_creator() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth_email() <> '' then
    new.created_by := auth_email();
  end if;
  return new;
end;
$$;

create trigger zap_trips_set_creator
  before insert on zap_trips
  for each row execute function zap_set_trip_creator();

-- AFTER INSERT: add the creator as a trip member. Note this runs *after*
-- PostgREST's RETURNING evaluation, so the SELECT policy on zap_trips
-- includes a `created_by = auth_email()` fallback to let the creator see
-- their brand-new row before the member row exists.
create or replace function zap_add_creator_as_member() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into zap_trip_members (trip_id, email)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;

create trigger zap_trips_add_creator
  after insert on zap_trips
  for each row execute function zap_add_creator_as_member();

-- ---------- RLS ----------

alter table zap_trips              enable row level security;
alter table zap_trip_members       enable row level security;
alter table zap_receipts           enable row level security;
alter table zap_receipt_members    enable row level security;
alter table zap_receipt_items      enable row level security;
alter table zap_receipt_item_members enable row level security;
alter table zap_settlements        enable row level security;

-- zap_trips
-- The `created_by = auth_email()` fallback ensures the creator can see their
-- trip on the INSERT-RETURNING round-trip before the AFTER trigger inserts
-- their member row. In steady state everyone reads via is_zap_trip_member.
create policy zap_trips_select on zap_trips
  for select using (
    is_zap_trip_member(id) or created_by = auth_email()
  );

create policy zap_trips_insert on zap_trips
  for insert to authenticated
  with check (is_enabled_allowed_email(auth_email()));

create policy zap_trips_update on zap_trips
  for update using (is_zap_trip_member(id)) with check (is_zap_trip_member(id));

create policy zap_trips_delete on zap_trips
  for delete using (is_zap_trip_member(id));

-- zap_trip_members
create policy zap_trip_members_select on zap_trip_members
  for select using (is_zap_trip_member(trip_id));

-- The creator-add trigger inserts the first row using security-definer context,
-- so this policy only has to cover subsequent member adds by existing members.
create policy zap_trip_members_insert on zap_trip_members
  for insert to authenticated
  with check (
    is_zap_trip_member(trip_id)
    and is_enabled_allowed_email(email)
  );

create policy zap_trip_members_delete on zap_trip_members
  for delete using (is_zap_trip_member(trip_id));

-- zap_receipts
create policy zap_receipts_all on zap_receipts
  for all using (is_zap_trip_member(trip_id)) with check (is_zap_trip_member(trip_id));

-- zap_receipt_members
create policy zap_receipt_members_all on zap_receipt_members
  for all using (
    exists (select 1 from zap_receipts r where r.id = receipt_id and is_zap_trip_member(r.trip_id))
  ) with check (
    exists (select 1 from zap_receipts r where r.id = receipt_id and is_zap_trip_member(r.trip_id))
  );

-- zap_receipt_items
create policy zap_receipt_items_all on zap_receipt_items
  for all using (
    exists (select 1 from zap_receipts r where r.id = receipt_id and is_zap_trip_member(r.trip_id))
  ) with check (
    exists (select 1 from zap_receipts r where r.id = receipt_id and is_zap_trip_member(r.trip_id))
  );

-- zap_receipt_item_members
create policy zap_receipt_item_members_all on zap_receipt_item_members
  for all using (
    exists (
      select 1 from zap_receipt_items i
      join zap_receipts r on r.id = i.receipt_id
      where i.id = item_id and is_zap_trip_member(r.trip_id)
    )
  ) with check (
    exists (
      select 1 from zap_receipt_items i
      join zap_receipts r on r.id = i.receipt_id
      where i.id = item_id and is_zap_trip_member(r.trip_id)
    )
  );

-- zap_settlements
create policy zap_settlements_all on zap_settlements
  for all using (is_zap_trip_member(trip_id)) with check (is_zap_trip_member(trip_id));

-- ---------- storage bucket ----------

-- Create the bucket via SQL so it survives db resets without depending on the
-- HTTP Storage API being reachable during a restart.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zap-receipts', 'zap-receipts', false, 20971520,
        array['image/png', 'image/jpeg', 'image/heic', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage objects are stored in the storage.objects table; RLS is added here so
-- only trip members can read or write within a trip's path.

-- Path convention: "<trip_uuid>/<receipt_uuid>.<ext>"
-- The first path segment (split_part(name, '/', 1)) is the trip_id.

create policy zap_receipts_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'zap-receipts'
    and is_zap_trip_member((split_part(name, '/', 1))::uuid)
  );

create policy zap_receipts_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'zap-receipts'
    and is_zap_trip_member((split_part(name, '/', 1))::uuid)
  );

create policy zap_receipts_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'zap-receipts'
    and is_zap_trip_member((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'zap-receipts'
    and is_zap_trip_member((split_part(name, '/', 1))::uuid)
  );

create policy zap_receipts_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'zap-receipts'
    and is_zap_trip_member((split_part(name, '/', 1))::uuid)
  );
