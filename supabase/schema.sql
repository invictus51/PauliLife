create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9._-]{3,20}$')
);

alter table public.profiles add column if not exists full_name text;
update public.profiles
set full_name = coalesce(nullif(btrim(full_name), ''), username)
where full_name is null or btrim(full_name) = '';
alter table public.profiles alter column full_name set not null;

create unique index if not exists one_ecopaulinia_admin_only
  on public.profiles (is_admin)
  where is_admin = true;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  reporter_username text not null,
  reporter_name text not null,
  category text not null,
  description text,
  latitude double precision not null,
  longitude double precision not null,
  status text not null default 'Recebida',
  forwarded_to text,
  forwarded_at timestamptz,
  protocol text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports add column if not exists reporter_name text;
alter table public.reports add column if not exists description text;
update public.reports
set reporter_name = coalesce(nullif(btrim(reporter_name), ''), nullif(reporter_username, ''), 'Morador')
where reporter_name is null or btrim(reporter_name) = '';
alter table public.reports alter column reporter_name set not null;
alter table public.reports alter column description drop not null;

alter table public.reports drop constraint if exists report_status_allowed;

update public.reports
set category = case
  when category = 'Poluição da água' or category ilike '%esgoto%' or category ilike '%efluente%' then 'Poluição da água'
  when category ilike '%queimada%' or category ilike '%fumaça%' then 'Queimada'
  else 'Descarte irregular de lixo'
end
where category not in ('Descarte irregular de lixo', 'Poluição da água', 'Queimada');

update public.reports
set status = case when status in ('Resolvida', 'Concluída') then 'Concluída' else 'Recebida' end
where status not in ('Recebida', 'Concluída');

alter table public.reports drop constraint if exists report_category_length;
alter table public.reports drop constraint if exists report_description_length;
alter table public.reports drop constraint if exists report_status_allowed;
alter table public.reports drop constraint if exists report_category_allowed;
alter table public.reports drop constraint if exists report_status_simple_allowed;
alter table public.reports add constraint report_category_allowed
  check (category in ('Descarte irregular de lixo', 'Poluição da água', 'Queimada'));
alter table public.reports add constraint report_status_simple_allowed
  check (status in ('Recebida', 'Concluída'));

alter table public.reports alter column status set default 'Recebida';
create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_status_idx on public.reports (status);

create or replace function public.handle_new_ecopaulinia_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
  v_legacy_username text;
begin
  v_full_name := btrim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'full_name', ''), '\s+', ' ', 'g'));
  if char_length(v_full_name) < 2 or char_length(v_full_name) > 100 then
    raise exception 'Informe um nome entre 2 e 100 caracteres.';
  end if;

  v_legacy_username := 'usr' || substr(replace(new.id::text, '-', ''), 1, 16);
  insert into public.profiles (id, username, full_name, is_admin)
  values (new.id, v_legacy_username, v_full_name, false);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ecopaulinia on auth.users;
create trigger on_auth_user_created_ecopaulinia
  after insert on auth.users
  for each row execute procedure public.handle_new_ecopaulinia_user();

create or replace function public.prepare_ecopaulinia_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_full_name text;
begin
  if (select auth.uid()) is null or new.user_id is distinct from (select auth.uid()) then
    raise exception 'É necessário entrar na conta para registrar uma denúncia.';
  end if;

  if new.category not in ('Descarte irregular de lixo', 'Poluição da água', 'Queimada') then
    raise exception 'Tipo de denúncia inválido.';
  end if;

  select p.username, p.full_name into v_username, v_full_name
  from public.profiles p
  where p.id = (select auth.uid());

  if v_full_name is null then
    raise exception 'Perfil de usuário não encontrado.';
  end if;

  new.reporter_username := v_username;
  new.reporter_name := v_full_name;
  new.description := null;
  new.status := 'Recebida';
  new.forwarded_to := null;
  new.forwarded_at := null;
  new.protocol := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prepare_ecopaulinia_report_trigger on public.reports;
create trigger prepare_ecopaulinia_report_trigger
  before insert on public.reports
  for each row execute procedure public.prepare_ecopaulinia_report();

create or replace function public.set_ecopaulinia_report_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_ecopaulinia_report_updated_at_trigger on public.reports;
create trigger set_ecopaulinia_report_updated_at_trigger
  before update on public.reports
  for each row execute procedure public.set_ecopaulinia_report_updated_at();

create or replace function public.is_ecopaulinia_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_admin = true
  );
$$;

revoke all on function public.is_ecopaulinia_admin() from public;
grant execute on function public.is_ecopaulinia_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.reports enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select (id, full_name, is_admin) on table public.profiles to authenticated;
drop policy if exists "profile_read_own" on public.profiles;
create policy "profile_read_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

revoke all on table public.reports from anon, authenticated;
grant select (id, reporter_name, category, latitude, longitude, status, created_at, updated_at)
  on table public.reports to anon, authenticated;
grant insert (user_id, category, latitude, longitude)
  on table public.reports to authenticated;
grant update (status) on table public.reports to authenticated;
grant delete on table public.reports to authenticated;

drop policy if exists "reports_public_read" on public.reports;
create policy "reports_public_read" on public.reports
  for select to anon, authenticated using (true);

drop policy if exists "users_insert_own_report" on public.reports;
create policy "users_insert_own_report" on public.reports
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'Recebida');

drop policy if exists "only_admin_updates_reports" on public.reports;
create policy "only_admin_updates_reports" on public.reports
  for update to authenticated
  using ((select public.is_ecopaulinia_admin()))
  with check ((select public.is_ecopaulinia_admin()));

drop policy if exists "only_admin_deletes_reports" on public.reports;
create policy "only_admin_deletes_reports" on public.reports
  for delete to authenticated
  using ((select public.is_ecopaulinia_admin()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
exception when undefined_object then
  raise notice 'Publicação supabase_realtime não encontrada. Habilite a tabela reports em Database > Publications.';
end;
$$;

