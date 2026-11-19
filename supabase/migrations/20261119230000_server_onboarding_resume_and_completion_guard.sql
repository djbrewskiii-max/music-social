-- First-run checkpoints persist across devices. Never trust a client-set
-- onboarding_complete flag without validating the five music selections.
alter table public.profiles add column if not exists onboarding_stage text;
alter table public.profiles drop constraint if exists profiles_onboarding_stage_check;
alter table public.profiles add constraint profiles_onboarding_stage_check
  check (onboarding_stage is null or onboarding_stage in
    ('setup-profile','pick-artists','core-four','rotation-setup','connect-music'));

create or replace function public.guard_profile_completion()
returns trigger
language plpgsql security invoker set search_path=''
as $$
begin
  if new.onboarding_complete
     and (TG_OP='INSERT' or not coalesce(old.onboarding_complete,false)) then
    if new.user_id is null
       or nullif(btrim(coalesce(new.display_name,'')),'') is null
       or nullif(btrim(coalesce(new.username,'')),'') is null
       or (select count(*) from public.music_taste_artists
           where user_id=new.user_id and source='favorite')<5 then
      raise exception 'Finish your name, username and five favorite artists first'
        using errcode='23514';
    end if;
  end if;
  if new.onboarding_complete then new.onboarding_stage:=null; end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_completion on public.profiles;
create trigger profiles_guard_completion
 before insert or update of onboarding_complete,onboarding_stage on public.profiles
 for each row execute function public.guard_profile_completion();
