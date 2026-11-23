-- Smart Job Collector engine foundation
-- Run once in Supabase SQL Editor after smart-job-collector-setup.sql.
-- All live sources start disabled.

alter table public.fetched_jobs
  add column if not exists is_demo boolean not null default false;

create table if not exists public.collector_sources (
  source_key text primary key,
  display_name text not null,
  access_method text not null default 'not_configured'
    check (access_method in ('not_configured','rss','api','partner_feed','email_alert','manual_test')),
  access_status text not null default 'permission_pending'
    check (access_status in ('permission_pending','approved','not_permitted','testing')),
  feed_url text,
  enabled boolean not null default false,
  schedule_enabled boolean not null default false,
  region_scope text[] not null default array['Islamabad','Rawalpindi']::text[],
  notes text,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collector_sources_schedule_requires_enabled
    check (schedule_enabled = false or enabled = true),
  constraint collector_sources_enabled_requires_approval
    check (enabled = false or access_status = 'approved')
);

create table if not exists public.collector_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text references public.collector_sources(source_key) on delete set null,
  run_mode text not null default 'live'
    check (run_mode in ('live','sample')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','partial','failed')),
  items_seen integer not null default 0,
  items_inserted integer not null default 0,
  items_duplicates integer not null default 0,
  items_out_of_region integer not null default 0,
  items_expired integer not null default 0,
  summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists collector_runs_started_at_idx
  on public.collector_runs(started_at desc);
create index if not exists collector_sources_enabled_idx
  on public.collector_sources(enabled, schedule_enabled);

alter table public.collector_sources enable row level security;
alter table public.collector_runs enable row level security;

drop policy if exists "Admins can manage collector sources" on public.collector_sources;
create policy "Admins can manage collector sources"
  on public.collector_sources for all to authenticated
  using (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));

drop policy if exists "Admins can manage collector runs" on public.collector_runs;
create policy "Admins can manage collector runs"
  on public.collector_runs for all to authenticated
  using (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid()));

insert into public.collector_sources
  (source_key, display_name, access_method, access_status, enabled, schedule_enabled, notes)
values
  ('njp','National Jobs Portal','not_configured','permission_pending',false,false,'Awaiting confirmation of an approved API, feed or written permission.'),
  ('rozee','ROZEE.PK','not_configured','permission_pending',false,false,'Partner/API/feed access must be confirmed before automated collection.'),
  ('mustakbil','Mustakbil','not_configured','not_permitted',false,false,'Automated harvesting is disabled. Use only a provider-approved integration.'),
  ('indeed','Indeed Pakistan','not_configured','permission_pending',false,false,'Automated access remains disabled unless expressly authorized.'),
  ('newspapers','Newspaper vacancy feeds','not_configured','permission_pending',false,false,'Configure only a licensed/approved RSS or publisher feed.'),
  ('employers','Employer career pages and feeds','not_configured','permission_pending',false,false,'Add each employer separately when an approved feed or API is available.')
on conflict (source_key) do nothing;

comment on table public.collector_sources is
  'Approved source registry for the Smart Job Collector. No source is enabled by default.';
comment on table public.collector_runs is
  'Audit history for live and sample collector runs. Sample runs never fetch external websites.';
