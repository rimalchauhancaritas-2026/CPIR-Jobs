-- Add an optional CNIC field to candidate CV profiles.
-- Existing candidate records remain valid; the field may be left blank.
alter table public.cv_profiles
  add column if not exists cnic text;

comment on column public.cv_profiles.cnic is
  'Optional CNIC number supplied by the candidate for inclusion in their CV.';
