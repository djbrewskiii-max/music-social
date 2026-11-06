-- Applied to production Supabase on 2026-11-06.
-- Account-wide timestamp of when the user reviewed private music suggestions.
create table if not exists public.music_suggestion_review_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_reviewed_at timestamptz not null default now()
);
alter table public.music_suggestion_review_state enable row level security;
revoke all on public.music_suggestion_review_state from anon;
grant select,insert,update on public.music_suggestion_review_state to authenticated;
create policy "suggestion_review_owner_select" on public.music_suggestion_review_state
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "suggestion_review_owner_insert" on public.music_suggestion_review_state
 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "suggestion_review_owner_update" on public.music_suggestion_review_state
 for update to authenticated using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
