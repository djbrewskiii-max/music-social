-- Applied to OVRLEE Supabase 2026-11-11.
-- Replies can address specific comments, including Song Replies, within a post.
alter table public.post_replies
  add column if not exists parent_reply_id uuid;
alter table public.post_replies
  add constraint post_replies_post_id_id_unique unique(post_id,id);
alter table public.post_replies
  add constraint post_replies_parent_post_fk
  foreign key (post_id,parent_reply_id)
  references public.post_replies(post_id,id)
  on delete set null (parent_reply_id);
alter table public.post_replies
  add constraint post_replies_no_self_reply
  check (parent_reply_id is null or parent_reply_id <> id);
create index if not exists post_replies_parent_reply_id_idx
  on public.post_replies(parent_reply_id)
  where parent_reply_id is not null;
comment on column public.post_replies.parent_reply_id is
  'Optional parent reply; composite foreign key enforces same-post threading.';
