-- Respect a person's own group mute choice. Muting suppresses push
-- notifications, never messages, inbox access, or unread badges.
alter table public.conversation_members
  add column if not exists notifications_muted boolean not null default false;

create or replace function public.set_group_muted(
  p_conversation uuid,p_muted boolean
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Sign in required';end if;
  if p_muted is null then raise exception 'Choose mute on or off';end if;

  update public.conversation_members cm
    set notifications_muted=p_muted
    from public.conversations c
    where c.id=p_conversation and c.is_group
      and cm.conversation_id=c.id and cm.user_id=v_uid;
  if not found then raise exception 'Group unavailable';end if;
  return p_muted;
end;
$$;
revoke all on function public.set_group_muted(uuid,boolean) from public,anon;
grant execute on function public.set_group_muted(uuid,boolean) to authenticated;

-- The previous trigger only sent a push to user_one/user_two. Group
-- conversations have their recipients in conversation_members instead.
create or replace function private.on_message()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  c public.conversations%rowtype;
  recipient uuid;
  setting text;
  preview text;
  member record;
  title_text text;
begin
  select * into c from public.conversations where id=new.conversation_id;
  if not found then return new;end if;

  insert into public.conversation_reads(user_id,conversation_id,last_read_at)
  values(new.sender_id,new.conversation_id,new.created_at)
  on conflict(user_id,conversation_id)
  do update set last_read_at=greatest(
    public.conversation_reads.last_read_at,excluded.last_read_at
  );

  preview:=case
    when new.attachment is not null
      and coalesce((new.attachment->>'autoBody')::boolean,false)
      then 'Sent you ' || coalesce(new.attachment->>'title','music')
        || coalesce(' by '||nullif(new.attachment->>'artist',''),'')
    else left(new.body,140)
  end;

  if c.is_group then
    if not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id=new.conversation_id
        and cm.user_id=new.sender_id
    ) then
      raise exception 'Sender is not in this group';
    end if;
    title_text:=left(private.display_name(new.sender_id),42)
      || ' · ' || left(coalesce(nullif(btrim(c.title),''),'Group chat'),50);
    for member in
      select cm.user_id,ns.messages as setting
      from public.conversation_members cm
      left join public.notification_settings ns on ns.user_id=cm.user_id
      where cm.conversation_id=c.id
        and cm.user_id<>new.sender_id
        and not cm.notifications_muted
    loop
      if private.should_notify(member.user_id,new.sender_id,member.setting) then
        perform private.send_push(
          member.user_id,title_text,preview,
          pg_catalog.jsonb_build_object(
            'url','/chat?id='||c.id::text||'&isGroup=true',
            'kind','message',
            'conversationId',c.id::text
          )
        );
      end if;
    end loop;
    return new;
  end if;

  recipient:=case when c.user_one=new.sender_id
    then c.user_two else c.user_one end;
  select ns.messages into setting
    from public.notification_settings ns where ns.user_id=recipient;
  if private.should_notify(recipient,new.sender_id,setting) then
    perform private.send_push(
      recipient,private.display_name(new.sender_id),preview,
      pg_catalog.jsonb_build_object(
        'url','/chat?userId='||new.sender_id::text,
        'kind','message',
        'conversationId',new.conversation_id::text
      )
    );
  end if;
  return new;
end;
$$;
