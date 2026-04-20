-- Allowlist: who is permitted to sign in.
create table allowed_emails (
  email           text primary key,
  label           text,
  is_admin        boolean not null default false,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- Per-user app permissions. Admins bypass this table.
create table user_app_permissions (
  email     text references allowed_emails(email) on delete cascade,
  app_slug  text not null,
  primary key (email, app_slug)
);

-- Generic event log. Written by logEvent() from any app.
create table events (
  id          bigserial primary key,
  email       text references allowed_emails(email) on delete set null,
  app_slug    text,
  event_name  text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index events_created_at_idx  on events (created_at desc);
create index events_email_idx       on events (email);
create index events_app_slug_idx    on events (app_slug);
create index events_event_name_idx  on events (event_name);

-- Trigger: keep allowed_emails.last_sign_in_at in sync with sign-in events,
-- so the client never needs update permission on allowed_emails.
create or replace function bump_last_sign_in() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.event_name = 'signed_in' and new.email is not null then
    update allowed_emails
    set last_sign_in_at = new.created_at
    where email = new.email;
  end if;
  return new;
end;
$$;

create trigger events_bump_last_sign_in
  after insert on events
  for each row execute function bump_last_sign_in();
