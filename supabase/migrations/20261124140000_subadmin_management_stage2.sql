-- Stage 2: support secure Main Admin management of sub-admin identities.
-- Sub-admins are created inactive until Stage 3 permission enforcement is deployed.
alter table public.portal_admin_accounts
  add column if not exists email text;

update public.portal_admin_accounts a
set email = lower(u.email)
from auth.users u
where u.id = a.user_id
  and (a.email is null or a.email = '');

alter table public.portal_admin_accounts
  alter column email set not null;

create unique index if not exists portal_admin_accounts_email_lower_uidx
  on public.portal_admin_accounts (lower(email));

comment on column public.portal_admin_accounts.email is
'Administrator sign-in email, synchronized at account provisioning by the trusted Edge Function.';
