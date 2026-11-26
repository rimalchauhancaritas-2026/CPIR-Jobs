-- Multiple roles per sub-admin. Keep role_id as a legacy compatibility field.
alter table public.portal_admin_accounts
  add column if not exists role_ids text[] not null default '{}';

update public.portal_admin_accounts
set role_ids = array[role_id]
where coalesce(array_length(role_ids, 1), 0) = 0
  and role_id is not null;

create or replace function public.has_portal_permission(permission_key text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_portal_main_admin()
    or exists (
      select 1
      from public.portal_admin_accounts a
      cross join lateral unnest(
        case when coalesce(array_length(a.role_ids, 1), 0) > 0
          then a.role_ids else array[a.role_id] end
      ) assigned(role_id)
      join public.portal_admin_roles r on r.id = assigned.role_id
      where a.user_id = auth.uid()
        and a.is_active = true
        and a.must_change_password = false
        and (
          coalesce((r.permissions ->> '*')::boolean, false)
          or coalesce((r.permissions ->> permission_key)::boolean, false)
        )
    );
$$;

grant execute on function public.has_portal_permission(text) to authenticated;
