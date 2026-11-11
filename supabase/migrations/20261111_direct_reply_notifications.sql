-- OVRLEE: notify post author and parent-comment author without duplicates.
-- Applied to Supabase on 2026-11-11.
create or replace function private.on_post_reply()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare post_author uuid; parent_author uuid;
begin
  select p.user_id into post_author from public.posts p where p.id = new.post_id;
  if new.parent_reply_id is not null then
    select r.user_id into parent_author from public.post_replies r
      where r.id = new.parent_reply_id and r.post_id = new.post_id;
  end if;
  insert into public.notifications (recipient_id,actor_id,type,post_id,reply_id)
    select distinct recipients.user_id,new.user_id,'reply',new.post_id,new.id
    from (values(post_author),(parent_author)) as recipients(user_id)
    where recipients.user_id is not null and recipients.user_id <> new.user_id;
  return new;
end;
$fn$;

create or replace function private.on_notification()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  s public.notification_settings%rowtype;
  setting text;
  actor_name text; msg text; link text;
  reply_tx text; song_title text; song_artist text; parent_author uuid;
begin
  select * into s from public.notification_settings where user_id = new.recipient_id;
  setting := case new.type when 'like' then s.likes
    when 'reply' then s.replies else s.follows end;
  if not private.should_notify(new.recipient_id,new.actor_id,setting) then return new; end if;
  if new.type='like' and exists(
    select 1 from public.notifications n
    where n.recipient_id=new.recipient_id and n.post_id=new.post_id
      and n.type='like' and n.pushed_at>now()-interval '15 minutes'
  ) then return new; end if;
  actor_name := private.display_name(new.actor_id);
  if new.type='reply' then
    select left(r.body,110),left(r.song_title,100),left(r.song_artist,100),parent.user_id
      into reply_tx,song_title,song_artist,parent_author
      from public.post_replies r
      left join public.post_replies parent on parent.id=r.parent_reply_id
      where r.id=new.reply_id;
    if song_title is not null then
      reply_tx := '♫ ' || song_title ||
        case when song_artist is not null then ' — ' || song_artist else '' end ||
        case when reply_tx is not null and reply_tx <> '♫'
          then ' · ' || left(reply_tx,55) else '' end;
    end if;
  end if;
  msg := case new.type
    when 'like' then actor_name || ' liked your post.'
    when 'reply' then actor_name ||
      case when parent_author=new.recipient_id
        then ' replied to your comment: ' else ' replied: ' end || coalesce(reply_tx,'')
    when 'follow' then actor_name || ' started following you.'
    when 'mutual' then actor_name || ' followed you back. You''re mutuals now.'
  end;
  link := case when new.type in ('like','reply')
    then '/post?postId=' || new.post_id::text ||
      case when new.reply_id is not null then '&focusReplyId='||new.reply_id::text else '' end
    else '/profile?userId=' || new.actor_id::text end;
  update public.notifications set pushed_at=now() where id=new.id;
  perform private.send_push(new.recipient_id,'OVRLEE',msg,
    jsonb_build_object('url',link,'kind','activity'));
  return new;
end;
$fn$;
