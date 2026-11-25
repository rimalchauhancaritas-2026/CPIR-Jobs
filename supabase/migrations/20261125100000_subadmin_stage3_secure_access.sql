-- Stage 3: enforce active sub-admin status and role permissions in the database.
-- The legacy is_portal_admin() helper remains Main-Admin-only, so older broad
-- policies cannot accidentally grant every sub-admin full administrator access.

create or replace function public.has_portal_permission(permission_key text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_portal_main_admin()
    or exists (
      select 1
      from public.portal_admin_accounts a
      join public.portal_admin_roles r on r.id = a.role_id
      where a.user_id = auth.uid()
        and a.is_active = true
        and a.must_change_password = false
        and (
          coalesce((r.permissions ->> '*')::boolean, false)
          or coalesce((r.permissions ->> permission_key)::boolean, false)
        )
    );
$$;

create or replace function public.is_portal_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.portal_admin_settings s
    where s.singleton = true and s.main_admin_user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_portal_admin() from public;
grant execute on function public.is_portal_admin() to anon, authenticated;

create or replace function public.complete_subadmin_password_change()
returns boolean
language plpgsql security definer set search_path = public
as $$
declare changed integer;
begin
  if auth.uid() is null or public.is_portal_main_admin() then
    raise exception 'This password-change action is only for an active sub-admin.';
  end if;
  update public.portal_admin_accounts
     set must_change_password = false, updated_at = now()
   where user_id = auth.uid() and is_active = true and must_change_password = true;
  get diagnostics changed = row_count;
  if changed = 1 then
    insert into public.portal_admin_activity(actor_user_id, target_user_id, action, details)
    values(auth.uid(), auth.uid(), 'subadmin_password_changed', '{}'::jsonb);
    return true;
  end if;
  if exists (select 1 from public.portal_admin_accounts where user_id = auth.uid() and is_active = true and must_change_password = false) then
    return true;
  end if;
  raise exception 'Your administrator account is inactive or unavailable.';
end;
$$;
revoke all on function public.complete_subadmin_password_change() from public;
grant execute on function public.complete_subadmin_password_change() to authenticated;

-- Jobs: explicit role grants. The existing public published-jobs policy remains.
drop policy if exists "Subadmins view jobs by role" on public.jobs;
create policy "Subadmins view jobs by role" on public.jobs
for select to authenticated using (public.has_portal_permission('jobs.view'));
drop policy if exists "Subadmins create jobs by role" on public.jobs;
create policy "Subadmins create jobs by role" on public.jobs
for insert to authenticated with check (public.has_portal_permission('jobs.create'));
drop policy if exists "Subadmins update jobs by role" on public.jobs;
create policy "Subadmins update jobs by role" on public.jobs
for update to authenticated
using (public.has_portal_permission('jobs.edit') or public.has_portal_permission('jobs.publish') or public.has_portal_permission('jobs.archive'))
with check (public.has_portal_permission('jobs.edit') or public.has_portal_permission('jobs.publish') or public.has_portal_permission('jobs.archive'));
drop policy if exists "Subadmins delete jobs by role" on public.jobs;
create policy "Subadmins delete jobs by role" on public.jobs
for delete to authenticated using (public.has_portal_permission('jobs.archive'));

-- Candidate directory and CVs are readable only by assigned users managers.
drop policy if exists "Subadmins view candidate profiles by role" on public.profiles;
create policy "Subadmins view candidate profiles by role" on public.profiles
for select to authenticated using (public.has_portal_permission('users.view'));
drop policy if exists "Subadmins view candidate CVs by role" on public.cv_profiles;
create policy "Subadmins view candidate CVs by role" on public.cv_profiles
for select to authenticated using (public.has_portal_permission('cv.view'));

-- Contact details are public-read but only assigned content managers can edit.
drop policy if exists "Subadmins insert portal contact by role" on public.portal_contact;
create policy "Subadmins insert portal contact by role" on public.portal_contact
for insert to authenticated with check (public.has_portal_permission('contact.edit'));
drop policy if exists "Subadmins update portal contact by role" on public.portal_contact;
create policy "Subadmins update portal contact by role" on public.portal_contact
for update to authenticated
using (public.has_portal_permission('contact.edit'))
with check (public.has_portal_permission('contact.edit'));

-- Smart Job Collector review queue. Source registry configuration remains Main-Admin-only.
drop policy if exists "Subadmins view fetched jobs by role" on public.fetched_jobs;
create policy "Subadmins view fetched jobs by role" on public.fetched_jobs
for select to authenticated using (public.has_portal_permission('collector.view'));
drop policy if exists "Subadmins review fetched jobs by role" on public.fetched_jobs;
create policy "Subadmins review fetched jobs by role" on public.fetched_jobs
for update to authenticated
using (public.has_portal_permission('collector.review'))
with check (public.has_portal_permission('collector.review'));
drop policy if exists "Subadmins view collector runs by role" on public.collector_runs;
create policy "Subadmins view collector runs by role" on public.collector_runs
for select to authenticated using (public.has_portal_permission('collector.view'));
drop policy if exists "Subadmins add collector run records by role" on public.collector_runs;
create policy "Subadmins add collector run records by role" on public.collector_runs
for insert to authenticated with check (public.has_portal_permission('collector.review'));

grant execute on function public.has_portal_permission(text) to authenticated;
