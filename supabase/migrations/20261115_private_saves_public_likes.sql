-- Post activity: private bookmarks, public likes (respecting member blocks).
-- Applied and policy-verified on the connected preview database on 2026-11-15.
begin;
alter table public.collection_saves enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists "See saves" on public.collection_saves;
drop policy if exists "Only owner can read saved posts" on public.collection_saves;
create policy "Only owner can read saved posts"
  on public.collection_saves for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can read likes" on public.post_likes;
drop policy if exists "Public member likes except blocked relationships" on public.post_likes;
create policy "Public member likes except blocked relationships"
  on public.post_likes for select to authenticated
  using (not public.is_blocked_with(user_id));

create index if not exists post_likes_owner_history_idx
  on public.post_likes(user_id,created_at desc);
create index if not exists private_saves_owner_history_idx
  on public.collection_saves(user_id,created_at desc);
create index if not exists post_replies_owner_history_idx
  on public.post_replies(user_id,created_at desc);
commit;
