-- =====================================================================
--  JLR TRACKER - update: client email -> site (mail intake)
--  Mail with attachments from a client's saved email address is picked up
--  every minute (Google Apps Script on the office mailbox), the files are
--  stored with the client, and the month's "Pending data" work is marked
--  "Data received - Email".
--  Needs update-client-portal.sql (client-docs bucket, client_uploads) and
--  update-followups.sql. Run once in Supabase > SQL Editor. Safe to re-run.
-- =====================================================================

-- 1. Settings (one row). key_hash = SHA-256 of the intake key; the key itself is never stored.
create table if not exists public.mail_settings (
  id             int primary key default 1 check (id = 1),
  enabled        boolean not null default false,
  key_hash       text,
  key_set_at     timestamptz,
  subject_filter text,                 -- optional: only mail whose subject has one of these words (comma separated)
  mailbox        text,                 -- shown on screen only, e.g. data@yourfirm.in
  last_mail_at   timestamptz,
  last_error     text
);
insert into public.mail_settings (id) values (1) on conflict (id) do nothing;
alter table public.mail_settings enable row level security;
revoke all on public.mail_settings from anon, authenticated;   -- only the functions below / the service role

-- 2. One row per email received
create table if not exists public.mail_inbox (
  id           uuid primary key default gen_random_uuid(),
  msg_id       text not null unique,                 -- mailbox message id (stops duplicates)
  received_at  timestamptz not null default now(),
  from_email   text not null,
  from_name    text,
  subject      text,
  snippet      text,
  client_id    uuid references public.clients(id) on delete cascade,
  period       date,                                 -- month the data is for (first day)
  period_guess boolean not null default false,       -- true = not in the subject, assumed previous month
  task_ids     uuid[] not null default '{}',         -- work marked "data received"
  files        jsonb not null default '[]'::jsonb,   -- [{name, path, size, mime, kind}]
  status       text not null default 'New' check (status in ('New', 'Done', 'Ignored')),
  note         text,
  handled_by   uuid references public.profiles(id) on delete set null,
  handled_at   timestamptz
);
create index if not exists mail_inbox_recv on public.mail_inbox(received_at desc);
create index if not exists mail_inbox_client on public.mail_inbox(client_id);
alter table public.mail_inbox enable row level security;
drop policy if exists mi_read on public.mail_inbox;
drop policy if exists mi_upd on public.mail_inbox;
create policy mi_read on public.mail_inbox for select to authenticated using (public.can_client_login(client_id));
create policy mi_upd  on public.mail_inbox for update to authenticated using (public.can_client_login(client_id)) with check (public.can_client_login(client_id));
grant select, update (status, note, handled_by, handled_at) on public.mail_inbox to authenticated;
revoke all on public.mail_inbox from anon;

-- emailed files also show on the work item, next to files uploaded in the client portal
alter table public.client_uploads add column if not exists source text not null default 'Portal';

-- 3. Admin functions (the key is made in the browser; only its hash comes here)
create or replace function public.mail_admin_status() returns json
language plpgsql security definer set search_path = public as $$
declare s public.mail_settings;
begin
  if not public.is_admin() then raise exception 'Only an admin can see mail settings'; end if;
  select * into s from public.mail_settings where id = 1;
  return json_build_object('enabled', s.enabled, 'key_set', s.key_hash is not null, 'key_set_at', s.key_set_at,
    'subject_filter', s.subject_filter, 'mailbox', s.mailbox, 'last_mail_at', s.last_mail_at, 'last_error', s.last_error,
    'today', (select count(*) from public.mail_inbox where received_at >= current_date),
    'new', (select count(*) from public.mail_inbox where status = 'New'));
end $$;
create or replace function public.mail_admin_set_key(p_hash text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can change the mail key'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Bad key'; end if;
  update public.mail_settings set key_hash = p_hash, key_set_at = now() where id = 1;
end $$;
create or replace function public.mail_admin_save(p_enabled boolean, p_filter text, p_mailbox text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can change mail settings'; end if;
  update public.mail_settings set enabled = p_enabled, subject_filter = nullif(btrim(p_filter), ''), mailbox = nullif(btrim(p_mailbox), '') where id = 1;
end $$;
revoke all on function public.mail_admin_status() from public, anon;
revoke all on function public.mail_admin_set_key(text) from public, anon;
revoke all on function public.mail_admin_save(boolean, text, text) from public, anon;
grant execute on function public.mail_admin_status() to authenticated;
grant execute on function public.mail_admin_set_key(text) to authenticated;
grant execute on function public.mail_admin_save(boolean, text, text) to authenticated;

select 'Mail intake ready' as result;
