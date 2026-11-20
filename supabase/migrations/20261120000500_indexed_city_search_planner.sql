-- Force a per-query indexed prefix plan for an interactive signup picker.
-- Stable SQL RPC parameters previously used a generic plan (~180 ms at 34k rows).
-- %L quotes every generated literal; the raw user string never becomes SQL.
create or replace function public.search_world_cities(
  p_name text,p_count integer default 30,p_country_code text default null
) returns table(
  geoname_id bigint,name text,country text,region text,
  country_code text,latitude double precision,longitude double precision,
  population bigint
) language plpgsql stable security invoker set search_path=''
as $$
declare q text; sql_stmt text; target_country text;
begin
  q:=left(lower(regexp_replace(btrim(coalesce(p_name,'')),
    '[%_\\]','','g')),70);
  if char_length(q)<2 then return;end if;
  target_country:=nullif(upper(btrim(p_country_code)),'');
  if target_country is not null and target_country !~ '^[A-Z]{2}$'
    then return;end if;
  sql_stmt:=pg_catalog.format(
    'select c.geoname_id,c.name,c.country,c.region,c.country_code::text,
       c.latitude,c.longitude,c.population
     from public.world_city_directory c
     where (lower(c.name) like %L or lower(c.ascii_name) like %L)',
    q||'%',q||'%');
  if target_country is not null then
    sql_stmt:=sql_stmt||pg_catalog.format(' and c.country_code = %L',target_country);
  end if;
  sql_stmt:=sql_stmt||pg_catalog.format(
    ' order by case when lower(c.name)=%L then 0
         when lower(c.ascii_name)=%L then 1 else 2 end,
       c.population desc,c.name asc,c.country asc limit %s',
     q,q,greatest(1,least(coalesce(p_count,30),50)));
  return query execute sql_stmt;
end;
$$;
revoke all on function public.search_world_cities(text,integer,text) from public,anon;
grant execute on function public.search_world_cities(text,integer,text) to authenticated;
