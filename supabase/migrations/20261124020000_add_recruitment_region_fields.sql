-- Recruitment region and application eligibility fields for Caritas jobs.
-- Run once in Supabase SQL Editor before deploying the matching website update.

alter table public.jobs
  add column if not exists recruitment_region text not null default 'city_specific',
  add column if not exists application_eligibility text,
  add column if not exists application_instructions text;

alter table public.fetched_jobs
  add column if not exists recruitment_region text not null default 'city_specific',
  add column if not exists application_eligibility text,
  add column if not exists application_instructions text;

-- Existing international listings remain international; other existing listings
-- keep the safe city-specific default until an administrator reviews them.
update public.jobs
set recruitment_region = 'international'
where location_scope = 'international';

update public.fetched_jobs
set recruitment_region = 'international'
where location_scope = 'international';

alter table public.jobs
  drop constraint if exists jobs_recruitment_region_check;
alter table public.jobs
  add constraint jobs_recruitment_region_check
  check (recruitment_region in (
    'city_specific','punjab','sindh','khyber_pakhtunkhwa',
    'balochistan','nationwide','international','needs_review'
  ));

alter table public.fetched_jobs
  drop constraint if exists fetched_jobs_recruitment_region_check;
alter table public.fetched_jobs
  add constraint fetched_jobs_recruitment_region_check
  check (recruitment_region in (
    'city_specific','punjab','sindh','khyber_pakhtunkhwa',
    'balochistan','nationwide','international','needs_review'
  ));

-- Pakistan-wide is a portal grouping for domestic vacancies outside the
-- Rawalpindi/Islamabad city-specific options. It does not replace the city field.
alter table public.jobs
  drop constraint if exists jobs_location_scope_check;
alter table public.jobs
  add constraint jobs_location_scope_check
  check (location_scope in (
    'local','rawalpindi','islamabad','pakistan','international',
    'remote_pakistan','remote_worldwide'
  ));

alter table public.fetched_jobs
  drop constraint if exists fetched_jobs_location_scope_check;
alter table public.fetched_jobs
  add constraint fetched_jobs_location_scope_check
  check (location_scope in (
    'local','rawalpindi','islamabad','pakistan','international',
    'remote_pakistan','remote_worldwide'
  ));

comment on column public.jobs.recruitment_region is
  'Recruitment coverage, independent of actual city: city_specific, Punjab, Sindh, Khyber Pakhtunkhwa, Balochistan, nationwide Pakistan, international, or needs_review.';
comment on column public.jobs.application_eligibility is
  'Domicile, district, province, CNIC or other applicant eligibility stated in the original advertisement.';
comment on column public.jobs.application_instructions is
  'Verified instructions for applying, including district quota or regional application steps when specified.';
