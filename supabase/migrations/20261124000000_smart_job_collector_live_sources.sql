-- Live connectors for the Smart Job Collector.
-- Public feeds permit job discovery when attribution and canonical links are retained.
-- Both sources remain disabled until an administrator enables them in the Source Registry.

alter table public.fetched_jobs
  add column if not exists location_scope text,
  add column if not exists country text,
  add column if not exists remote_eligibility text,
  add column if not exists work_arrangement text,
  add column if not exists visa_work_authorization text;

insert into public.collector_sources
  (source_key, display_name, access_method, access_status, feed_url, enabled, schedule_enabled, notes)
values
  ('jobicy', 'Jobicy', 'api', 'approved', 'https://jobicy.com/api/jobs?count=200', false, false,
   'Public Jobs API permits use in job discovery products and job boards. Preserve Jobicy attribution and canonical Jobicy listing links. Public feed is limited to jobs published in the last 7 days; do not poll more frequently than hourly.'),
  ('remoteok', 'Remote OK', 'rss', 'approved', 'https://remoteok.com/remote-jobs.rss', false, false,
   'Public RSS feed. Credit Remote OK by name and link each listing to its original Remote OK job URL. Do not use the Remote OK logo without written permission.')
on conflict (source_key) do update set
  display_name = excluded.display_name,
  access_method = excluded.access_method,
  access_status = excluded.access_status,
  feed_url = excluded.feed_url,
  notes = excluded.notes,
  updated_at = now();

comment on column public.fetched_jobs.location_scope is
  'Portal classification: rawalpindi, islamabad, or international. Remote feed jobs are classified as international.';
