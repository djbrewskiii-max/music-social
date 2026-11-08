-- Deleting a user-owned ListenBrainz connection deletes only its private
-- derived listening events/signals. Trigger runs with the migration owner's
-- privileges; the mobile user never receives raw-event DELETE privileges.
create or replace function public.ovrlee_cleanup_listenbrainz()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  delete from public.music_listening_events where user_id=old.user_id;
  delete from public.music_listening_artists where user_id=old.user_id;
  return old;
end;
$$;
revoke all on function public.ovrlee_cleanup_listenbrainz() from public,anon,authenticated;
create trigger ovrlee_clear_private_listening_on_unlink
after delete on public.member_listenbrainz_connections
for each row execute function public.ovrlee_cleanup_listenbrainz();
