-- First-run signup must produce exactly one real, uniquely named member.
-- Audited existing profiles before migration: no duplicate/missing IDs or
-- usernames; max name 11 chars, max username 10 chars.
alter table public.profiles alter column user_id set not null;
alter table public.profiles alter column username set not null;
alter table public.profiles alter column display_name set not null;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
 check(
   username ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
   and username !~ '[.]{2}'
   and username not in ('nowuser','listener','admin','support','undefined','null','deleted')
 );

alter table public.profiles drop constraint if exists profiles_display_name_format;
alter table public.profiles add constraint profiles_display_name_format
 check (length(btrim(display_name)) between 1 and 40);

create unique index if not exists profiles_user_id_unique on public.profiles(user_id);
create unique index if not exists profiles_username_unique_ci on public.profiles(lower(username));
