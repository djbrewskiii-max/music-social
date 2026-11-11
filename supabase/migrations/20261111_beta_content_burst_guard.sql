-- Conservative, backend-enforced abuse throttle for beta users.
create index if not exists posts_author_created_beta_idx
  on public.posts(user_id,created_at desc);
create index if not exists post_replies_author_created_beta_idx
  on public.post_replies(user_id,created_at desc);
create index if not exists messages_sender_created_beta_idx
  on public.messages(sender_id,created_at desc);

create or replace function private.ovrlee_guard_content_burst()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  who uuid; recent_count integer; max_count integer;
  kind text := TG_TABLE_NAME;
begin
  if auth.role() is distinct from 'authenticated' then return new; end if;
  who := case when kind='messages' then new.sender_id else new.user_id end;
  if who is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(kind),pg_catalog.hashtext(who::text)
  );
  if kind='posts' then
    max_count:=16;
    select count(*) into recent_count from public.posts
      where user_id=who and created_at>now()-interval '5 minutes';
  elsif kind='post_replies' then
    max_count:=45;
    select count(*) into recent_count from public.post_replies
      where user_id=who and created_at>now()-interval '5 minutes';
  elsif kind='messages' then
    max_count:=100;
    select count(*) into recent_count from public.messages
      where sender_id=who and created_at>now()-interval '5 minutes';
  else
    return new;
  end if;
  if recent_count>=max_count then
    raise exception 'Too many messages or posts in a short time. Please try again in a few minutes.'
      using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.ovrlee_guard_content_burst() from public,anon,authenticated;

drop trigger if exists ovrlee_posts_burst_guard on public.posts;
create trigger ovrlee_posts_burst_guard before insert on public.posts
  for each row execute function private.ovrlee_guard_content_burst();
drop trigger if exists ovrlee_replies_burst_guard on public.post_replies;
create trigger ovrlee_replies_burst_guard before insert on public.post_replies
  for each row execute function private.ovrlee_guard_content_burst();
drop trigger if exists ovrlee_messages_burst_guard on public.messages;
create trigger ovrlee_messages_burst_guard before insert on public.messages
  for each row execute function private.ovrlee_guard_content_burst();
