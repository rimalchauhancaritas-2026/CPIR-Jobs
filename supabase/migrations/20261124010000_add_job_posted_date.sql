-- Add the original publication date for each vacancy.
alter table public.jobs
  add column if not exists posted_at date;

comment on column public.jobs.posted_at is
  'Date the employer originally published the vacancy; separate from the application deadline.';
