-- OVRLEE first-run identity and member-managed group conversations.
-- Existing finished profiles remain available; incomplete profiles are owner-only.
alter table public.profiles add column if not exists onboarding_complete boolean;
update public.profiles
  set onboarding_complete = (nullif(trim(coalesce(display_name,'')),'') is not null
    and nullif(trim(coalesce(username,'')),'') is not null)
  where onboarding_complete is null;
alter table public.profiles alter column onboarding_complete set default false;
alter table public.profiles alter column onboarding_complete set not null;

drop policy if exists "Signed-in users can read profiles" on public.profiles;
create policy "Members see finished profiles or their own setup"
 on public.profiles for select to authenticated
 using (onboarding_complete or user_id=(select auth.uid()));

alter table public.conversations
  add column if not exists image_url text,
  add column if not exists members_can_edit boolean not null default true,
  add column if not exists members_can_invite boolean not null default true;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('group-media','group-media',true,5242880,
  array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
drop policy if exists "OVRLEE group image public read" on storage.objects;
create policy "OVRLEE group image public read" on storage.objects
 for select to public using(bucket_id='group-media');
drop policy if exists "OVRLEE group image member upload" on storage.objects;
create policy "OVRLEE group image member upload" on storage.objects
 for insert to authenticated
 with check(bucket_id='group-media'
   and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.update_group_details(
 p_conversation uuid, p_title text, p_image_url text default null
) returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid := auth.uid(); v_can_edit boolean; v_role text;
begin
 if v_actor is null then raise exception 'Sign in required'; end if;
 select c.members_can_edit,cm.role into v_can_edit,v_role
   from public.conversations c
   join public.conversation_members cm on cm.conversation_id=c.id
   where c.id=p_conversation and c.is_group and cm.user_id=v_actor
   for update of c;
 if not found then raise exception 'Group unavailable'; end if;
 if not v_can_edit and v_role<>'admin' then raise exception 'Only admins can edit this group'; end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 60
   then raise exception 'Use a group name between 1 and 60 characters'; end if;
 if p_image_url is not null and p_image_url<>''
   and p_image_url !~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/group-media/'
   then raise exception 'Choose a photo uploaded through OVRLEE'; end if;
 update public.conversations
   set title=trim(p_title), image_url=nullif(p_image_url,'')
   where id=p_conversation and is_group;
end;
$$;
revoke all on function public.update_group_details(uuid,text,text) from public,anon;
grant execute on function public.update_group_details(uuid,text,text) to authenticated;

create or replace function public.invite_group_members(
 p_conversation uuid,p_member_ids uuid[]
) returns integer language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_role text;v_allowed boolean;
  v_person uuid;v_members uuid[];v_existing integer;v_added integer:=0;
begin
 if v_actor is null then raise exception 'Sign in required';end if;
 select cm.role,c.members_can_invite into v_role,v_allowed
   from public.conversations c
   join public.conversation_members cm on cm.conversation_id=c.id
   where c.id=p_conversation and c.is_group and cm.user_id=v_actor
   for update of c;
 if not found then raise exception 'Group unavailable';end if;
 if not v_allowed and v_role<>'admin' then raise exception 'Only admins can invite members';end if;
 select array_agg(distinct uid) into v_members from unnest(p_member_ids) uid
   where uid is not null and uid<>v_actor;
 if coalesce(array_length(v_members,1),0)<1 then raise exception 'Choose at least one person';end if;
 select count(*) into v_existing from public.conversation_members
   where conversation_id=p_conversation;
 if v_existing+coalesce(array_length(v_members,1),0)>20
   then raise exception 'A group can have at most 20 members';end if;
 foreach v_person in array v_members loop
   if not exists(select 1 from public.profiles p
      where p.user_id=v_person and p.onboarding_complete)
     then raise exception 'This member is not available';end if;
   if not exists(
     select 1 from public.user_follows a
       join public.user_follows b on b.follower_id=v_person and b.following_id=v_actor
       where a.follower_id=v_actor and a.following_id=v_person)
     or public.is_blocked_with(v_person)
     then raise exception 'You can invite mutual followers only';end if;
 end loop;
 foreach v_person in array v_members loop
   insert into public.conversation_members(conversation_id,user_id,role)
     values(p_conversation,v_person,'member')
     on conflict(conversation_id,user_id) do nothing;
   if found then v_added:=v_added+1;end if;
 end loop;
 return v_added;
end;
$$;
revoke all on function public.invite_group_members(uuid,uuid[]) from public,anon;
grant execute on function public.invite_group_members(uuid,uuid[]) to authenticated;

create or replace function public.set_group_permissions(
 p_conversation uuid,p_members_can_edit boolean,p_members_can_invite boolean
) returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if not exists(select 1 from public.conversation_members cm
    join public.conversations c on c.id=cm.conversation_id
    where c.id=p_conversation and c.is_group and cm.user_id=auth.uid() and cm.role='admin')
   then raise exception 'Only a group admin can change permissions';end if;
 update public.conversations set members_can_edit=p_members_can_edit,
   members_can_invite=p_members_can_invite
   where id=p_conversation and is_group;
end;
$$;
revoke all on function public.set_group_permissions(uuid,boolean,boolean) from public,anon;
grant execute on function public.set_group_permissions(uuid,boolean,boolean) to authenticated;

create or replace function public.set_group_member_role(
 p_conversation uuid,p_member_id uuid,p_make_admin boolean
) returns void language plpgsql security definer set search_path=''
as $$
declare v_role text;v_admin_count integer;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select role into v_role from public.conversation_members where
   conversation_id=p_conversation and user_id=auth.uid();
 if v_role<>'admin' or not exists(
   select 1 from public.conversations where id=p_conversation and is_group)
   then raise exception 'Only group admins can manage roles';end if;
 if not exists(select 1 from public.conversation_members
   where conversation_id=p_conversation and user_id=p_member_id)
   then raise exception 'Member not found';end if;
 select count(*) into v_admin_count from public.conversation_members
   where conversation_id=p_conversation and role='admin';
 if not p_make_admin and v_admin_count<=1
    and exists(select 1 from public.conversation_members
      where conversation_id=p_conversation and user_id=p_member_id and role='admin')
    then raise exception 'Promote another admin before removing the last admin';end if;
 update public.conversation_members set role=case when p_make_admin then 'admin' else 'member' end
   where conversation_id=p_conversation and user_id=p_member_id;
end;
$$;
revoke all on function public.set_group_member_role(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_group_member_role(uuid,uuid,boolean) to authenticated;

create or replace function public.remove_group_member(
 p_conversation uuid,p_member_id uuid
) returns void language plpgsql security definer set search_path=''
as $$
declare v_role text;v_target_role text;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select role into v_role from public.conversation_members
   where conversation_id=p_conversation and user_id=auth.uid();
 if v_role<>'admin' or not exists(
   select 1 from public.conversations where id=p_conversation and is_group)
   then raise exception 'Only group admins can remove members';end if;
 if p_member_id=auth.uid() then raise exception 'Use Leave Group instead';end if;
 select role into v_target_role from public.conversation_members
   where conversation_id=p_conversation and user_id=p_member_id;
 if v_target_role is null then raise exception 'Member unavailable';end if;
 if v_target_role='admin' then raise exception 'Demote this admin before removing them';end if;
 delete from public.conversation_members
   where conversation_id=p_conversation and user_id=p_member_id;
end;
$$;
revoke all on function public.remove_group_member(uuid,uuid) from public,anon;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated;

create or replace function public.leave_group_chat(
 p_conversation uuid
) returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_role text;v_next uuid;
begin
 if v_actor is null then raise exception 'Sign in required';end if;
 perform 1 from public.conversations c where id=p_conversation and is_group for update;
 if not found then raise exception 'Group unavailable';end if;
 select role into v_role from public.conversation_members
   where conversation_id=p_conversation and user_id=v_actor;
 if v_role is null then raise exception 'Not a member';end if;
 delete from public.conversation_members
   where conversation_id=p_conversation and user_id=v_actor;
 select cm.user_id into v_next from public.conversation_members cm
   where cm.conversation_id=p_conversation
   order by case when cm.role='admin' then 0 else 1 end, cm.joined_at asc
   limit 1;
 if v_next is null then
   delete from public.conversations where id=p_conversation;
 elsif v_role='admin' and not exists(
   select 1 from public.conversation_members where conversation_id=p_conversation and role='admin')
 then
   update public.conversation_members set role='admin'
     where conversation_id=p_conversation and user_id=v_next;
 end if;
end;
$$;
revoke all on function public.leave_group_chat(uuid) from public,anon;
grant execute on function public.leave_group_chat(uuid) to authenticated;

-- Old clients must not be able to remove other members simply because they were
-- the original creator, even after leaving the group.
drop policy if exists "Admins or users themselves can remove members"
  on public.conversation_members;
create policy "Members may remove their own group membership"
  on public.conversation_members for delete to authenticated
  using (user_id=(select auth.uid())
    and public.ovrlee_is_group_member(conversation_id));
