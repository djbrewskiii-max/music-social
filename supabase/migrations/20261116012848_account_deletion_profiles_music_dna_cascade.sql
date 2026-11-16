-- Applied to hosted Supabase project on November 15, 2026.
-- Migration recorded as 20261116012848 / account_deletion_profiles_music_dna_cascade.
-- Prior verification found no orphan user IDs in either table.
-- Fixes deletion of personal profile and music-taste data when Auth user is deleted.
alter table public.profiles
  add constraint profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.music_dna
  add constraint music_dna_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
