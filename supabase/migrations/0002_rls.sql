-- Helper: extract the signed-in user's email from the JWT.
create or replace function auth_email() returns text
language sql stable
set search_path = public, pg_temp
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Helper: is the current user an admin?
create or replace function is_admin() returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select is_admin from allowed_emails where email = auth_email() and enabled = true),
    false
  )
$$;

-- ---------- allowed_emails ----------
alter table allowed_emails enable row level security;

create policy allowed_emails_self_select on allowed_emails
  for select using (email = auth_email());

create policy allowed_emails_admin_select on allowed_emails
  for select using (is_admin());

create policy allowed_emails_admin_insert on allowed_emails
  for insert with check (is_admin());

create policy allowed_emails_admin_update on allowed_emails
  for update using (is_admin()) with check (is_admin());

create policy allowed_emails_admin_delete on allowed_emails
  for delete using (is_admin());

-- ---------- user_app_permissions ----------
alter table user_app_permissions enable row level security;

create policy user_app_permissions_self_select on user_app_permissions
  for select using (email = auth_email());

create policy user_app_permissions_admin_all on user_app_permissions
  for all using (is_admin()) with check (is_admin());

-- ---------- events ----------
alter table events enable row level security;

-- Restrict to authenticated role so the anon role cannot insert at all.
-- Service role bypasses RLS entirely, so Edge Functions are unaffected.
create policy events_self_insert on events
  for insert
  to authenticated
  with check (email = auth_email() or email is null);

create policy events_admin_select on events
  for select using (is_admin());
