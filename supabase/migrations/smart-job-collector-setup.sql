-- Smart Job Collector review queue
-- Run once in Supabase SQL Editor. Does not enable any external source scraping.
create table if not exists public.fetched_jobs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  external_id text,
  title text,
  organization text,
  category text,
  city text,
  area text,
  qualification text,
  experience text,
  employment_type text,
  salary text,
  posted_date date,
  deadline date,
  source_url text,
  apply_url text,
  description text,
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review','duplicate','expired','rejected','imported')),
  fetched_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_notes text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists fetched_jobs_source_external_id_uidx
  on public.fetched_jobs(source_name, external_id)
  where external_id is not null and external_id <> '';
create index if not exists fetched_jobs_fetched_at_idx on public.fetched_jobs(fetched_at desc);
create index if not exists fetched_jobs_review_status_idx on public.fetched_jobs(review_status);
alter table public.fetched_jobs enable row level security;
drop policy if exists "Admins can manage fetched jobs" on public.fetched_jobs;
create policy "Admins can manage fetched jobs"
  on public.fetched_jobs for all to authenticated
  using (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));
