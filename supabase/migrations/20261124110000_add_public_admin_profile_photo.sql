insert into storage.buckets (id, name, public)
values ('portal-profile-photos', 'portal-profile-photos', true)
on conflict (id) do update set public = excluded.public;

create table if not exists public.portal_admin_public_profile (
 id boolean primary key default true check (id = true),
 photo_url text,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.portal_admin_public_profile enable row level security;
grant select on public.portal_admin_public_profile to anon, authenticated;
grant insert, update, delete on public.portal_admin_public_profile to authenticated;
drop policy if exists "Anyone can view public admin profile photo" on public.portal_admin_public_profile;
create policy "Anyone can view public admin profile photo" on public.portal_admin_public_profile for select to anon, authenticated using (true);
drop policy if exists "Admins can manage public admin profile photo" on public.portal_admin_public_profile;
create policy "Admins can manage public admin profile photo" on public.portal_admin_public_profile for all to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()))
with check (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));
drop policy if exists "Admins can upload public admin profile photo" on storage.objects;
create policy "Admins can upload public admin profile photo" on storage.objects for insert to authenticated
with check (bucket_id = 'portal-profile-photos' and exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));
drop policy if exists "Admins can read public admin profile photo object" on storage.objects;
create policy "Admins can read public admin profile photo object" on storage.objects for select to authenticated
using (bucket_id = 'portal-profile-photos' and exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));
drop policy if exists "Admins can update public admin profile photo" on storage.objects;
create policy "Admins can update public admin profile photo" on storage.objects for update to authenticated
using (bucket_id = 'portal-profile-photos' and exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()))
with check (bucket_id = 'portal-profile-photos' and exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));
drop policy if exists "Admins can delete public admin profile photo" on storage.objects;
create policy "Admins can delete public admin profile photo" on storage.objects for delete to authenticated
using (bucket_id = 'portal-profile-photos' and exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));
