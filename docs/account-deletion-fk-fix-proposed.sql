-- PROPOSED ONLY — NOT APPLIED TO THE LIVE DATABASE.
-- OVRLEE closed beta account-deletion verification, November 15, 2026.
-- Evidence: public.profiles and public.music_dna have user_id but no FK to
-- auth.users; no cleanup trigger was found; both tables currently have zero
-- user IDs without a matching auth.users row.
--
-- Before running: back up the database; inspect existing constraints and
-- verify there are zero orphan user IDs with the SELECT queries below.
-- Apply in a maintenance window / reviewed Supabase migration, and
-- test deleting a DISPOSABLE account end-to-end. Do not test on real accounts.

select 'profiles' as source, count(*) as orphan_rows
from public.profiles p
where p.user_id is not null
  and not exists (select 1 from auth.users u where u.id = p.user_id)
union all
select 'music_dna', count(*)
from public.music_dna d
where not exists (select 1 from auth.users u where u.id = d.user_id);

-- The proposed forward-only migration:
alter table public.profiles
  add constraint profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.music_dna
  add constraint music_dna_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- After migration: inspect pg_constraint for confdeltype='c' on both FKs.
-- Test deleting a disposable account containing profile and music_dna.
-- Do not claim comprehensive cleanup based only on adding these two FKs:
-- check uploads, all other user-owned rows, authentication, and cached links.
