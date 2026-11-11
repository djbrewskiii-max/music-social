-- Applied to hosted Supabase 2026-11-11.
-- Keep other members' group chats intact if their creator deletes an account.
alter table public.conversations drop constraint conversations_created_by_fkey;
alter table public.conversations
  add constraint conversations_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
