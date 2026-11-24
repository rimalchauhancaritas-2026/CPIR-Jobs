# Smart Job Collector — live feed activation

This release adds two public feeds:

- **Jobicy API** — may be used in job discovery products and job boards with attribution and canonical Jobicy links. Its public feed covers jobs published in the last 7 days and must not be polled more than once per hour.
- **Remote OK RSS** — credit Remote OK by name and link each listing to its original Remote OK job page. Do not use its logo without written permission.

Both source records are created as **Approved but Disabled**. No source is fetched until an administrator enables it and checks **Include in daily schedule** in Admin Portal → Smart Job Collector.

## Deploy the Edge Function

1. In Supabase Dashboard, open **Edge Functions**.
2. Create a function named \`smart-job-collector\`.
3. Paste the contents of \`supabase/functions/smart-job-collector/index.ts\`.
4. Deploy it.
5. In the function's Secrets settings, add \`COLLECTOR_CRON_SECRET\` with a long random value. Keep this value private. Supabase provides the project URL and service-role key to Edge Functions automatically.

The function accepts only POST requests with the matching \`x-collector-secret\` header. It fetches only Jobicy and Remote OK when both **Enabled** and **Include in daily schedule** are checked. All new records are inserted as \`needs_review\`; no public job is created or published.

## Schedule after testing

After deploying and testing the function once, enable the Supabase **Cron**, **Vault**, and **pg_net** extensions. Store the project URL, service-role key, and same collector secret in Vault. Then schedule a daily call at 01:00 UTC (06:00 Pakistan time). Replace the placeholder values below with your actual secrets:

\`\`\`sql
select vault.create_secret('https://gcbrecumvyiqsaiqdkhc.supabase.co', 'cpir_project_url');
select vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'cpir_service_role_key');
select vault.create_secret('YOUR_COLLECTOR_CRON_SECRET', 'cpir_collector_cron_secret');

select cron.schedule(
  'cpir-smart-job-collector-daily',
  '0 1 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cpir_project_url')
      || '/functions/v1/smart-job-collector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cpir_service_role_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cpir_service_role_key'),
      'x-collector-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cpir_collector_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
\`\`\`

Do not run the schedule SQL until the Edge Function is deployed and a manual test succeeds. Never put the service-role key or collector secret in website JavaScript, GitHub files, or screenshots.

## Important review limitation

These feeds do not consistently provide verified application deadlines. The collector leaves the deadline blank rather than inventing one. Staff must check the original listing and add a valid deadline before moving a vacancy into Draft jobs. The original source name and link are retained for attribution and verification.
