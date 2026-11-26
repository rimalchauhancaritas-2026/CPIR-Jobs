-- Private candidate Resume Library (PDF, DOC, DOCX).
-- Original files are stored unchanged in a private bucket and remain separate from cv_profiles.
create table if not exists public.candidate_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_type text not null check (file_type in ('pdf','doc','docx')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  storage_path text not null unique,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists candidate_resumes_user_created_idx on public.candidate_resumes(user_id, created_at desc);
create unique index if not exists candidate_resumes_one_default_per_user on public.candidate_resumes(user_id) where is_default = true;
alter table public.candidate_resumes enable row level security;
drop policy if exists "Candidates read own resume records" on public.candidate_resumes;
create policy "Candidates read own resume records" on public.candidate_resumes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Candidates add own resume records" on public.candidate_resumes;
create policy "Candidates add own resume records" on public.candidate_resumes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Candidates update own resume records" on public.candidate_resumes;
create policy "Candidates update own resume records" on public.candidate_resumes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Candidates delete own resume records" on public.candidate_resumes;
create policy "Candidates delete own resume records" on public.candidate_resumes for delete to authenticated using (user_id = (select auth.uid()));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidate-resumes','candidate-resumes',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Candidates read own resume objects" on storage.objects;
create policy "Candidates read own resume objects" on storage.objects for select to authenticated using (bucket_id='candidate-resumes' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Candidates upload own resume objects" on storage.objects;
create policy "Candidates upload own resume objects" on storage.objects for insert to authenticated with check (bucket_id='candidate-resumes' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Candidates update own resume objects" on storage.objects;
create policy "Candidates update own resume objects" on storage.objects for update to authenticated using (bucket_id='candidate-resumes' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='candidate-resumes' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Candidates delete own resume objects" on storage.objects;
create policy "Candidates delete own resume objects" on storage.objects for delete to authenticated using (bucket_id='candidate-resumes' and (storage.foldername(name))[1]=(select auth.uid())::text);
