-- Extend manual and collected job records for local, overseas and remote vacancies.
-- Run once in Supabase SQL Editor before using the updated admin form or Excel template.

alter table public.jobs
  add column if not exists location_scope text not null default 'local',
  add column if not exists country text,
  add column if not exists remote_eligibility text,
  add column if not exists work_arrangement text,
  add column if not exists visa_work_authorization text;

alter table public.fetched_jobs
  add column if not exists location_scope text not null default 'local',
  add column if not exists country text,
  add column if not exists remote_eligibility text,
  add column if not exists work_arrangement text,
  add column if not exists visa_work_authorization text;

alter table public.jobs
  drop constraint if exists jobs_location_scope_check;
alter table public.jobs
  add constraint jobs_location_scope_check
  check (location_scope in ('local','rawalpindi','islamabad','international','remote_pakistan','remote_worldwide'));

alter table public.fetched_jobs
  drop constraint if exists fetched_jobs_location_scope_check;
alter table public.fetched_jobs
  add constraint fetched_jobs_location_scope_check
  check (location_scope in ('local','rawalpindi','islamabad','international','remote_pakistan','remote_worldwide'));

comment on column public.jobs.location_scope is
  'New listings use exactly three location types: Rawalpindi, Islamabad, or International. Legacy local and remote values remain accepted for existing records.';
comment on column public.jobs.country is 'Actual country for an on-site/hybrid vacancy; Pakistan or stated eligible region for remote vacancies.';
comment on column public.jobs.remote_eligibility is 'Explicit countries or residency regions eligible to apply for a remote vacancy.';
comment on column public.jobs.visa_work_authorization is 'Employer-stated visa sponsorship and work authorization requirements.';
