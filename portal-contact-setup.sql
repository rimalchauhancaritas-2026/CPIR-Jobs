-- Run this once in Supabase SQL Editor to enable editable Contact Us details.
create table if not exists public.portal_contact (
  id integer primary key default 1 check (id = 1),
  email text,
  phone text,
  address text,
  facebook_url text,
  instagram_url text,
  website_url text,
  extra text,
  updated_at timestamptz not null default now()
);
alter table public.portal_contact enable row level security;
drop policy if exists "Anyone can read portal contact" on public.portal_contact;
create policy "Anyone can read portal contact" on public.portal_contact
  for select to anon, authenticated using (true);
drop policy if exists "Admins can insert portal contact" on public.portal_contact;
create policy "Admins can insert portal contact" on public.portal_contact
  for insert to authenticated with check (public.is_portal_admin());
drop policy if exists "Admins can update portal contact" on public.portal_contact;
create policy "Admins can update portal contact" on public.portal_contact
  for update to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());
