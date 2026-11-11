-- Applied to hosted Supabase 2026-11-11.
-- Private moderation intake for received direct and group-chat messages.
create table if not exists public.message_reports(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reason text not null check(reason in ('spam','harassment','hate_or_abuse','other')),
  status text not null default 'open'
    check(status in ('open','reviewing','resolved','dismissed')),
  unique(reporter_id,message_id)
);
create index if not exists message_reports_review_idx
  on public.message_reports(status,created_at desc);
alter table public.message_reports enable row level security;
revoke all on public.message_reports from anon,authenticated;
grant insert on public.message_reports to authenticated;
create policy "Participants may report received messages" on public.message_reports
for insert to authenticated
with check(
  reporter_id=(select auth.uid())
  and reporter_id<>reported_user_id
  and status='open'
  and exists(
    select 1 from public.messages m
    where m.id=message_id
      and m.sender_id=reported_user_id
      and m.conversation_id=conversation_id
  )
);
comment on table public.message_reports is
  'Private DM/group moderation intake. Authenticated users can submit only.';
