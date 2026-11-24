-- Stage 1: secure foundation for role-based administrator accounts.
-- Does not create Auth users or store passwords. Account provisioning is added
-- through a protected server-side function in Stage 2.

create table if not exists public.portal_admin_roles (
  id text primary key,
  label text not null,
  description text not null default '',
  permissions jsonb not null default '{}'::jsonb,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.portal_admin_roles (id,label,description,permissions,is_system)
values
 ('super_admin','Main Admin','Full control of the portal.', '{"*":true}'::jsonb,true),
 ('jobs_manager','Jobs Manager','Create and manage job listings.', '{"jobs.view":true,"jobs.create":true,"jobs.edit":true,"jobs.import":true,"jobs.publish":true,"jobs.archive":true}'::jsonb,true),
 ('users_manager','CV & Users Manager','Manage registered candidate accounts and CV records.', '{"users.view":true,"users.manage":true,"cv.view":true}'::jsonb,true),
 ('content_manager','Content Manager','Manage public portal content and contact information.', '{"content.view":true,"content.edit":true,"contact.edit":true}'::jsonb,true),
 ('job_reviewer','Job Reviewer','Review collected jobs before import or publication.', '{"collector.view":true,"collector.review":true,"jobs.view":true}'::jsonb,true),
 ('reports_viewer','Reports Viewer','View portal reports and statistics.', '{"reports.view":true}'::jsonb,true)
on conflict (id) do update set
 label=excluded.label,
 description=excluded.description,
 permissions=excluded.permissions,
 updated_at=now();

create table if not exists public.portal_admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role_id text not null references public.portal_admin_roles(id),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  photo_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Exactly one existing legacy admin is automatically designated Main Admin.
-- If multiple legacy admins exist, leave designation unset for explicit setup.
create table if not exists public.portal_admin_settings (
  singleton boolean primary key default true check (singleton),
  main_admin_user_id uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.portal_admin_settings(singleton,main_admin_user_id)
select true, (select ap.user_id from public.admin_profiles ap limit 1)
where (select count(*) from public.admin_profiles)=1
on conflict (singleton) do nothing;

-- Keep legacy administrator authorization intact while the admin interface
-- and all existing write paths are migrated to permission checks in Stage 3.
insert into public.portal_admin_accounts(user_id,display_name,role_id,is_active,must_change_password)
select ap.user_id, coalesce(u.raw_user_meta_data->>'full_name','Main Administrator'),
       'super_admin', true, false
from public.admin_profiles ap
join auth.users u on u.id=ap.user_id
where (select count(*) from public.admin_profiles)=1
on conflict (user_id) do nothing;

create table if not exists public.portal_admin_activity (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.portal_admin_roles enable row level security;
alter table public.portal_admin_accounts enable row level security;
alter table public.portal_admin_settings enable row level security;
alter table public.portal_admin_activity enable row level security;

create or replace function public.is_portal_main_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
 select exists (
   select 1 from public.portal_admin_settings s
   where s.singleton=true and s.main_admin_user_id=auth.uid()
 );
$$;

create or replace function public.has_portal_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
 select
   public.is_portal_main_admin()
   or exists (
     select 1
     from public.portal_admin_accounts a
     join public.portal_admin_roles r on r.id=a.role_id
     where a.user_id=auth.uid()
       and a.is_active=true
       and coalesce((r.permissions->>'*')::boolean,false)
          or (
            a.user_id=auth.uid()
            and a.is_active=true
            and coalesce((r.permissions->>permission_key)::boolean,false)
          )
   );
$$;

drop policy if exists "Authenticated users can view administrator roles" on public.portal_admin_roles;
create policy "Authenticated users can view administrator roles"
on public.portal_admin_roles for select to authenticated using (auth.uid() is not null);

drop policy if exists "Main admin manages administrator roles" on public.portal_admin_roles;
create policy "Main admin manages administrator roles"
on public.portal_admin_roles for all to authenticated
using (public.is_portal_main_admin())
with check (public.is_portal_main_admin());

drop policy if exists "Admins can view own account or main admin can view all" on public.portal_admin_accounts;
create policy "Admins can view own account or main admin can view all"
on public.portal_admin_accounts for select to authenticated
using (user_id=auth.uid() or public.is_portal_main_admin());

drop policy if exists "Main admin manages administrator accounts" on public.portal_admin_accounts;
create policy "Main admin manages administrator accounts"
on public.portal_admin_accounts for all to authenticated
using (public.is_portal_main_admin())
with check (public.is_portal_main_admin());

drop policy if exists "Main admin views administrator activity" on public.portal_admin_activity;
create policy "Main admin views administrator activity"
on public.portal_admin_activity for select to authenticated
using (public.is_portal_main_admin());

grant select on public.portal_admin_roles to authenticated;
grant select on public.portal_admin_accounts to authenticated;
grant select on public.portal_admin_activity to authenticated;
grant execute on function public.is_portal_main_admin() to authenticated;
grant execute on function public.has_portal_permission(text) to authenticated;

comment on table public.portal_admin_accounts is
'Role-based portal admin account metadata. Passwords are managed only by Supabase Auth and never stored here.';
comment on column public.portal_admin_accounts.must_change_password is
'When true, the administrator must set a new password before using the admin workspace.';
