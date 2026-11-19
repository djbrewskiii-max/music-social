-- Original first-party music questions for OVRLEE's official @ovrlee account.
-- Auto-posting intentionally disabled until beta conversation moderation is ready.
alter table public.posts add column if not exists post_kind text not null default 'music';
alter table public.posts drop constraint if exists posts_post_kind_check;
alter table public.posts add constraint posts_post_kind_check
 check (post_kind in ('music','aux_prompt'));

create table if not exists private.ovrlee_aux_prompt_config(
 id integer primary key check(id=1),
 enabled boolean not null default false
);
insert into private.ovrlee_aux_prompt_config(id,enabled)
 values(1,false) on conflict(id) do nothing;

create table if not exists private.ovrlee_aux_prompt_templates(
 seq integer primary key check(seq between 1 and 28),
 question text not null check(length(question) between 15 and 240)
);
insert into private.ovrlee_aux_prompt_templates(seq,question) values
  (1,'Which song deserves a second chance from everyone who skipped it?'),
  (2,'What album do you wish you could hear for the first time again?'),
  (3,'What''s a song you love but would never hand over the aux to?'),
  (4,'Which artist has never made a bad opening track?'),
  (5,'What song sounds completely different after you''ve lived a little?'),
  (6,'Name a song that instantly takes you back to a specific place.'),
  (7,'What song would you play to introduce someone to your taste?'),
  (8,'What''s an album that grew on you months after release?'),
  (9,'Whose feature verse quietly stole the whole song?'),
  (10,'Which song deserves a live performance in a tiny room?'),
  (11,'What song can turn a bad commute into a movie scene?'),
  (12,'What artist do you defend even when your friends disagree?'),
  (13,'What is the best last track on any album?'),
  (14,'Which underrated collaboration should happen next?'),
  (15,'What''s your favorite song by an artist you''re not usually into?'),
  (16,'What''s a song you heard once and immediately had to find?'),
  (17,'Which album has the strongest three-song run?'),
  (18,'What''s a song that makes you nostalgic for a time you never lived?'),
  (19,'Which artist''s deep cuts beat their biggest hits?'),
  (20,'What''s a song you associate with an unforgettable night?'),
  (21,'Which album did you initially misunderstand?'),
  (22,'What is a song you would keep even if you could only save ten?'),
  (23,'What song would make the perfect soundtrack to a late-night drive?'),
  (24,'Who''s an artist you discovered through someone else''s post?'),
  (25,'Which song would win in a battle of iconic intros?'),
  (26,'What song completely changed your opinion of an artist?'),
  (27,'Which album art perfectly captures how the music feels?'),
  (28,'What''s one song you need everyone on OVRLEE to hear this week?')
on conflict(seq) do update set question=excluded.question;

create table if not exists private.ovrlee_aux_prompt_publications(
 local_date date not null,
 slot smallint not null check(slot between 1 and 2),
 post_id uuid not null references public.posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(local_date,slot)
);
revoke all on private.ovrlee_aux_prompt_config from public,anon,authenticated;
revoke all on private.ovrlee_aux_prompt_templates from public,anon,authenticated;
revoke all on private.ovrlee_aux_prompt_publications from public,anon,authenticated;

create or replace function private.ovrlee_publish_aux_prompt(
 p_date date,p_slot smallint
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_official uuid;v_question text;v_post uuid;v_today date;
begin
  v_today=(now() at time zone 'America/New_York')::date;
  if p_slot not in (1,2) or p_date<>v_today then
    raise exception 'Only current-day OVRLEE questions may be published';
  end if;
  if not exists(select 1 from private.ovrlee_aux_prompt_config
    where id=1 and enabled) then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('ovrlee-aux-prompt'),pg_catalog.hashtext(p_date::text||p_slot::text)
  );
  select post_id into v_post from private.ovrlee_aux_prompt_publications
    where local_date=p_date and slot=p_slot;
  if found then return v_post; end if;
  select p.user_id into v_official from public.profiles p
    where lower(p.username)='ovrlee' and p.onboarding_complete=true
    order by p.created_at asc limit 1;
  if v_official is null then raise exception 'Verified @ovrlee member must exist'; end if;
  select question into v_question from private.ovrlee_aux_prompt_templates
    where seq=(((extract(doy from p_date)::integer-1)*2+p_slot-1)%28)+1;
  if not found then raise exception 'Question template unavailable';end if;
  insert into public.posts(
    user_id,body,song_title,artist_name,music_items,post_kind
  ) values (
    v_official,v_question,'','', '[]'::jsonb,'aux_prompt'
  ) returning id into v_post;
  insert into private.ovrlee_aux_prompt_publications(local_date,slot,post_id)
    values(p_date,p_slot,v_post);
  return v_post;
end;
$$;
revoke all on function private.ovrlee_publish_aux_prompt(date,smallint)
  from public,anon,authenticated;
-- After moderation/device acceptance: owner may opt in to two daily questions.
-- Example scheduling (run intentionally, not as part of this migration):
-- update private.ovrlee_aux_prompt_config set enabled=true where id=1;
-- select cron.schedule('ovrlee-aux-question-midday','0 16 * * *',
--   $$select private.ovrlee_publish_aux_prompt((now() at time zone 'America/New_York')::date,1);$$);
-- select cron.schedule('ovrlee-aux-question-evening','0 23 * * *',
--   $$select private.ovrlee_publish_aux_prompt((now() at time zone 'America/New_York')::date,2);$$);
-- Confirm timezone and DST behavior before scheduling. Prefer an hourly UTC
-- checker of America/New_York local time if exact local clock is required.
