-- Daily Drop: one @ovrlee question a day, answered with songs.
-- A Daily Drop is an ordinary post (post_kind='daily_drop') so Song Replies,
-- reporting, blocking and notifications apply exactly as for any post.
-- Automatic publishing is OFF by default. Do NOT enable it until the
-- moderation / device acceptance in docs/daily-drop-v1.md is done.
-- This migration is NOT yet applied to live Supabase. It needs Chanel's
-- approval and a Supabase apply step (CLI / dashboard) — see the doc.

alter table public.posts add column if not exists post_kind text not null default 'music';
alter table public.posts drop constraint if exists posts_post_kind_check;
alter table public.posts add constraint posts_post_kind_check
  check (post_kind in ('music','aux_prompt','daily_drop'));

create table if not exists private.ovrlee_daily_drop_config(
  id integer primary key check(id=1),
  enabled boolean not null default false
);
insert into private.ovrlee_daily_drop_config(id,enabled)
  values(1,false) on conflict(id) do nothing;

create table if not exists private.ovrlee_daily_drop_templates(
  seq integer primary key check(seq between 1 and 21),
  question text not null check(length(question) between 15 and 240)
);
insert into private.ovrlee_daily_drop_templates(seq,question) values
  (1,'What song got you through this week?'),
  (2,'What song would you play at 2am in the car, windows down?'),
  (3,'What song reminds you of home, wherever home is now?'),
  (4,'What song do you play when you need to feel like yourself again?'),
  (5,'What song would you put on to win over a room full of strangers?'),
  (6,'What song is your perfect Sunday morning?'),
  (7,'What song do you wish was playing when you walked into a room?'),
  (8,'What song makes a rainy day feel like a film?'),
  (9,'What song did a friend show you that changed your taste?'),
  (10,'What song would you play for someone hearing your favourite artist for the first time?'),
  (11,'What song is stuck in your head right now, and are you mad about it?'),
  (12,'What song would be the closing track of your life so far?'),
  (13,'What song do you turn up even when you are trying to be calm?'),
  (14,'What song sounds best when nobody else is around to judge it?'),
  (15,'What song would you send to someone you miss, with no words attached?'),
  (16,'What song instantly puts you in a summer mood, whatever the weather?'),
  (17,'What song do you play when you finally finish something hard?'),
  (18,'What song deserves to be heard by everyone on OVRLEE today?'),
  (19,'What song would you choose as the soundtrack to your city?'),
  (20,'What song did you love first — the one that started all of this?'),
  (21,'What song do you keep coming back to, even though you know every word?')
on conflict(seq) do update set question=excluded.question;

create table if not exists private.ovrlee_daily_drop_publications(
  local_date date not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(local_date)
);
revoke all on private.ovrlee_daily_drop_config from public,anon,authenticated;
revoke all on private.ovrlee_daily_drop_templates from public,anon,authenticated;
revoke all on private.ovrlee_daily_drop_publications from public,anon,authenticated;

create or replace function private.ovrlee_publish_daily_drop(
  p_date date
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_official uuid;v_question text;v_post uuid;v_today date;
begin
  v_today=(now() at time zone 'America/New_York')::date;
  if p_date<>v_today then
    raise exception 'Only today''s Daily Drop may be published';
  end if;
  if not exists(select 1 from private.ovrlee_daily_drop_config
    where id=1 and enabled) then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('ovrlee-daily-drop'),pg_catalog.hashtext(p_date::text)
  );
  select post_id into v_post from private.ovrlee_daily_drop_publications
    where local_date=p_date;
  if found then return v_post; end if;
  select p.user_id into v_official from public.profiles p
    where lower(p.username)='ovrlee' and p.onboarding_complete=true
    order by p.created_at asc limit 1;
  if v_official is null then raise exception 'Verified @ovrlee member must exist'; end if;
  select question into v_question from private.ovrlee_daily_drop_templates
    where seq=((extract(doy from p_date)::integer-1)%21)+1;
  if not found then raise exception 'Question template unavailable';end if;
  insert into public.posts(
    user_id,body,song_title,artist_name,music_items,post_kind
  ) values (
    v_official,v_question,'','', '[]'::jsonb,'daily_drop'
  ) returning id into v_post;
  insert into private.ovrlee_daily_drop_publications(local_date,post_id)
    values(p_date,v_post);
  return v_post;
end;
$$;
revoke all on function private.ovrlee_publish_daily_drop(date)
  from public,anon,authenticated;
-- After moderation/device acceptance: owner may opt in to one daily question.
-- Example scheduling (run intentionally, not as part of this migration):
-- update private.ovrlee_daily_drop_config set enabled=true where id=1;
-- select cron.schedule('ovrlee-daily-drop-morning','0 13 * * *',
--   $$select private.ovrlee_publish_daily_drop((now() at time zone 'America/New_York')::date);$$);
-- 13:00 UTC is 09:00 in New York in standard time; confirm DST before scheduling.
