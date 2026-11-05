-- =====================================================================
--  JLR TRACKER - update v17 (Session 1, 5 Nov 2026)
--   1. Renewals & expiry tracker  (DSC, GST LUT, Udyam, IEC, FSSAI, trade licence, PT ...)
--   2. Tax payment intimation      (GST cash payable, TDS by 7th, advance tax)
--   3. New client onboarding       (KYC documents, engagement letter, fee agreement)
--  Needs the earlier updates (roles: is_manager(), portal logins: can_client_login()).
--  Run once in Supabase > SQL Editor. Safe to re-run.
-- =====================================================================

-- ---------- 1. RENEWALS ----------
create table if not exists public.renewals (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  kind          text not null,                          -- DSC, GST LUT, Udyam, IEC, FSSAI, Trade licence, Professional tax, other
  holder        text,                                   -- e.g. DSC holder (director) name
  ref_no        text,                                   -- licence / registration / ARN no.
  issued_on     date,
  expires_on    date,                                   -- blank = no expiry (e.g. Udyam)
  repeat_months int  not null default 12,               -- suggested next validity when renewed
  assigned_to   uuid references public.profiles(id) on delete set null,
  status        text not null default 'Active' check (status in ('Active', 'Renewal in progress', 'Not renewing', 'Closed')),
  reminders     jsonb not null default '{}'::jsonb,     -- {"30":"2026-11-05","15":…,"7":…,"0":…} date each client reminder was sent
  history       jsonb not null default '[]'::jsonb,     -- earlier periods [{issued_on, expires_on, renewed_on, by}]
  remarks       text,
  created_by    uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists renewals_exp on public.renewals(expires_on);
create index if not exists renewals_client on public.renewals(client_id);
alter table public.renewals enable row level security;
drop policy if exists rn_sel on public.renewals;
drop policy if exists rn_ins on public.renewals;
drop policy if exists rn_upd on public.renewals;
drop policy if exists rn_del on public.renewals;
create policy rn_sel on public.renewals for select to authenticated using (public.can_client_login(client_id));
create policy rn_ins on public.renewals for insert to authenticated with check (public.can_client_login(client_id));
create policy rn_upd on public.renewals for update to authenticated using (public.can_client_login(client_id)) with check (public.can_client_login(client_id));
create policy rn_del on public.renewals for delete to authenticated using (public.is_manager());
grant select, insert, update, delete on public.renewals to authenticated;
revoke all on public.renewals from anon;

-- ---------- 2. TAX PAYMENT INTIMATIONS ----------
create table if not exists public.tax_intimations (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  kind         text not null check (kind in ('GST', 'TDS', 'ADV')),
  period       text not null,                           -- 'Oct 2026' (GST/TDS) or 'TY 2026-27 · 15 Dec' (advance tax)
  due_date     date,
  amounts      jsonb not null default '{}'::jsonb,      -- GST {ig,cg,sg,cs} · TDS {tds,tcs,interest} · ADV {est,paid_before,pct}
  total        numeric(14,2) not null default 0,
  sent_on      date,
  sent_via     text,                                    -- WhatsApp / Email
  sent_by      uuid references public.profiles(id) on delete set null,
  sent_count   int not null default 0,
  paid_on      date,
  paid_amount  numeric(14,2),
  challan      text,                                    -- CIN / CPIN / BSR-challan no.
  remarks      text,
  updated_at   timestamptz not null default now(),
  unique (client_id, kind, period)
);
create index if not exists ti_due on public.tax_intimations(due_date);
alter table public.tax_intimations enable row level security;
drop policy if exists ti_sel on public.tax_intimations;
drop policy if exists ti_ins on public.tax_intimations;
drop policy if exists ti_upd on public.tax_intimations;
drop policy if exists ti_del on public.tax_intimations;
create policy ti_sel on public.tax_intimations for select to authenticated using (public.can_client_login(client_id));
create policy ti_ins on public.tax_intimations for insert to authenticated with check (public.can_client_login(client_id));
create policy ti_upd on public.tax_intimations for update to authenticated using (public.can_client_login(client_id)) with check (public.can_client_login(client_id));
create policy ti_del on public.tax_intimations for delete to authenticated using (public.is_manager());
grant select, insert, update, delete on public.tax_intimations to authenticated;
revoke all on public.tax_intimations from anon;

-- ---------- 3. NEW CLIENT ONBOARDING ----------
create table if not exists public.onboarding (
  client_id    uuid primary key references public.clients(id) on delete cascade,
  items        jsonb not null default '[]'::jsonb,      -- [{k, label, grp, done, on, by, na, note}]
  fees         jsonb not null default '[]'::jsonb,      -- [{work, amount, freq}]  (fee agreement)
  letter       jsonb not null default '{}'::jsonb,      -- {date, scope, terms, sent_on, signed_on}
  status       text not null default 'In progress' check (status in ('In progress', 'Completed')),
  started_on   date not null default current_date,
  completed_on date,
  created_by   uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now()
);
alter table public.onboarding enable row level security;
drop policy if exists ob_sel on public.onboarding;
drop policy if exists ob_ins on public.onboarding;
drop policy if exists ob_upd on public.onboarding;
drop policy if exists ob_del on public.onboarding;
create policy ob_sel on public.onboarding for select to authenticated using (public.can_client_login(client_id));
create policy ob_ins on public.onboarding for insert to authenticated with check (public.is_manager());
create policy ob_upd on public.onboarding for update to authenticated using (public.can_client_login(client_id)) with check (public.can_client_login(client_id));
create policy ob_del on public.onboarding for delete to authenticated using (public.is_manager());
grant select, insert, update, delete on public.onboarding to authenticated;
revoke all on public.onboarding from anon;

-- Office-wide onboarding list (admin can edit on the Onboarding page). NULL = built-in list.
alter table public.settings add column if not exists onboard_items jsonb;

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists renewals_touch on public.renewals;
create trigger renewals_touch before update on public.renewals for each row execute function public.touch_updated_at();
drop trigger if exists ti_touch on public.tax_intimations;
create trigger ti_touch before update on public.tax_intimations for each row execute function public.touch_updated_at();
drop trigger if exists ob_touch on public.onboarding;
create trigger ob_touch before update on public.onboarding for each row execute function public.touch_updated_at();
