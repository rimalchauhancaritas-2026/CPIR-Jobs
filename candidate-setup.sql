-- Caritas Youth Jobs Portal: candidate accounts and CV builder
-- Run once in Supabase SQL Editor after the existing supabase-schema.sql.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.cv_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  city text,
  address text,
  website text,
  summary text not null,
  education text not null,
  experience text,
  skills text not null,
  languages text,
  certifications text,
  references_text text,
  updated_at timestamptz not null default now()
);
create index if not exists cv_profiles_updated_idx on public.cv_profiles(updated_at desc);

-- Create a basic candidate profile automatically whenever an account is registered.
create or replace function public.handle_new_candidate()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(user_id,full_name,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''))
  on conflict(user_id) do update set
    full_name=excluded.full_name,email=excluded.email,updated_at=now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_candidate on auth.users;
create trigger on_auth_user_created_candidate
after insert on auth.users
for each row execute procedure public.handle_new_candidate();

alter table public.profiles enable row level security;
alter table public.cv_profiles enable row level security;

drop policy if exists "Candidates read own profile" on public.profiles;
create policy "Candidates read own profile" on public.profiles for select to authenticated
using (user_id=(select auth.uid()) or public.is_portal_admin());
drop policy if exists "Candidates insert own profile" on public.profiles;
create policy "Candidates insert own profile" on public.profiles for insert to authenticated
with check (user_id=(select auth.uid()));
drop policy if exists "Candidates update own profile" on public.profiles;
create policy "Candidates update own profile" on public.profiles for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "Admins read candidate profiles" on public.profiles;
create policy "Admins read candidate profiles" on public.profiles for select to authenticated
using (public.is_portal_admin());

drop policy if exists "Candidates read own CV" on public.cv_profiles;
create policy "Candidates read own CV" on public.cv_profiles for select to authenticated
using (user_id=(select auth.uid()) or public.is_portal_admin());
drop policy if exists "Candidates insert own CV" on public.cv_profiles;
create policy "Candidates insert own CV" on public.cv_profiles for insert to authenticated
with check (user_id=(select auth.uid()));
drop policy if exists "Candidates update own CV" on public.cv_profiles;
create policy "Candidates update own CV" on public.cv_profiles for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "Admins read candidate CVs" on public.cv_profiles;
create policy "Admins read candidate CVs" on public.cv_profiles for select to authenticated
using (public.is_portal_admin());

-- Keep profile identity fields synchronized if a candidate changes their auth email.
create or replace function public.sync_candidate_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email=coalesce(new.email,''),updated_at=now()
  where user_id=new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_updated_candidate on auth.users;
create trigger on_auth_user_updated_candidate
after update of email on auth.users
for each row execute procedure public.sync_candidate_email();
