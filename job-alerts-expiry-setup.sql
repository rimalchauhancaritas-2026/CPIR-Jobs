-- Caritas Youth Jobs Portal: job alerts and expiry archive (migration v1)
-- Run this once in Supabase SQL Editor. Existing jobs and CV data are preserved.

-- Employment arrangement is separate from the existing job category.
alter table public.jobs
  add column if not exists employment_type text;

alter table public.jobs
  drop constraint if exists jobs_employment_type_check;

alter table public.jobs
  add constraint jobs_employment_type_check
  check (
    employment_type is null or
    employment_type in ('Full-time','Part-time','Internship','Contract','Temporary','Volunteer')
  );

-- Add an explicit status for jobs whose application deadline has passed.
alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('draft','published','archived','expired'));

create index if not exists jobs_deadline_status_idx
  on public.jobs(status, deadline);

-- Candidate-controlled email alert preferences. Alerts are OFF until candidates opt in.
create table if not exists public.job_alert_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  categories text[] not null default '{}',
  cities text[] not null default '{}',
  employment_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_alert_preferences enable row level security;

drop policy if exists "Candidates read own job alert preferences" on public.job_alert_preferences;
create policy "Candidates read own job alert preferences"
  on public.job_alert_preferences for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Candidates insert own job alert preferences" on public.job_alert_preferences;
create policy "Candidates insert own job alert preferences"
  on public.job_alert_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Candidates update own job alert preferences" on public.job_alert_preferences;
create policy "Candidates update own job alert preferences"
  on public.job_alert_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Service-side delivery log prevents the same email event being sent repeatedly.
-- No client policies are created: only trusted backend/service-role code should access it.
create table if not exists public.job_alert_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  event_type text not null check (
    event_type in ('new_job','deadline_3_days','deadline_today','admin_expiry')
  ),
  recipient_email text not null,
  sent_at timestamptz not null default now(),
  unique (job_id, event_type, recipient_email)
);

alter table public.job_alert_events enable row level security;
