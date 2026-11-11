-- Applied to hosted Supabase 2026-11-11.
-- Private moderation intake; clients can submit but not browse/edit reports.
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','hate_or_abuse','other')),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  unique (reporter_id,post_id)
);
create index if not exists post_reports_review_idx
  on public.post_reports(status,created_at desc);
alter table public.post_reports enable row level security;
revoke all on public.post_reports from anon,authenticated;
grant insert on public.post_reports to authenticated;
create policy "Members can report posts"
on public.post_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and reporter_id <> reported_user_id
  and status = 'open'
  and exists (
    select 1 from public.posts p
    where p.id=post_id and p.user_id=reported_user_id
  )
);
comment on table public.post_reports is
 'Moderation intake. Members can report; only trusted service roles can review.';
