-- Register public job feeds whose providers explicitly permit reuse with attribution.
-- Sources remain disabled until the collector adapters are implemented and tested.
-- Only Pakistan-eligible remote vacancies will be considered by the collector.

insert into public.collector_sources
  (source_key, display_name, access_method, access_status, feed_url,
   enabled, schedule_enabled, region_scope, notes)
values
  (
    'jobicy',
    'Jobicy (Remote Jobs)',
    'api',
    'approved',
    'https://jobicy.com/api/jobs?count=200',
    false,
    false,
    array['Pakistan','Worldwide remote']::text[],
    'Provider documentation permits job-board and aggregator use without a separate agreement. Preserve Jobicy attribution and each canonical Jobicy listing URL; apply clicks must go to the original listing. Public API; no key required. Collector must include only roles whose eligibility explicitly includes Pakistan or worldwide applicants.'
  ),
  (
    'remoteok',
    'Remote OK (Remote Jobs)',
    'rss',
    'approved',
    'https://remoteok.com/remote-jobs.rss',
    false,
    false,
    array['Pakistan','Worldwide remote']::text[],
    'Provider FAQ publishes a free RSS feed for public use. Credit Remote OK and link directly to each original job listing; do not use the Remote OK logo without written permission. Collector must include only roles whose eligibility explicitly includes Pakistan or worldwide applicants.'
  )
on conflict (source_key) do nothing;

comment on column public.collector_sources.region_scope is
  'Allowed location labels for a source; remote feeds may use Pakistan/Worldwide remote only when explicit eligibility is confirmed.';
