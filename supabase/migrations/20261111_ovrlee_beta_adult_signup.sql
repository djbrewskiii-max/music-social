-- OVRLEE 18+ closed beta
-- IMPORTANT: Enable this function in Dashboard > Authentication > Hooks > Before User Created.
-- A birth-date declaration is not independent age verification.
create or replace function public.ovrlee_beta_adult_signup(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dob_text text;
  dob date;
begin
  dob_text := event->'user'->'user_metadata'->>'beta_birth_date';
  if dob_text is null or dob_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400, 'message', 'Enter your birth date before signing up.'
    ));
  end if;
  begin
    dob := pg_catalog.to_date(dob_text, 'YYYY-MM-DD');
  exception when others then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400, 'message', 'Enter a valid birth date.'
    ));
  end;
  if pg_catalog.to_char(dob, 'YYYY-MM-DD') <> dob_text
     or dob < date '1900-01-01'
     or dob > (current_date - interval '18 years')::date then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Registration is unavailable for this beta.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.ovrlee_beta_adult_signup(jsonb) from public, anon, authenticated;
grant execute on function public.ovrlee_beta_adult_signup(jsonb) to supabase_auth_admin;
