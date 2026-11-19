-- GeoNames CC BY 4.0 city search index. Population centers, not device GPS.
-- Source: https://download.geonames.org/export/dump/
-- Attribution: https://www.geonames.org/about.html
create table if not exists public.world_city_directory (
  geoname_id bigint primary key,
  name text not null,
  ascii_name text not null,
  country text not null,
  country_code char(2) not null,
  region text,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  population bigint not null default 0 check(population >= 0),
  source_modified date,
  indexed_at timestamptz not null default now()
);
alter table public.world_city_directory enable row level security;
drop policy if exists "Authenticated members may search city names" on public.world_city_directory;
create policy "Authenticated members may search city names"
  on public.world_city_directory for select to authenticated using(true);
revoke all on public.world_city_directory from anon, authenticated;
grant select on public.world_city_directory to authenticated;
create index if not exists world_city_directory_name_prefix
  on public.world_city_directory (lower(name) text_pattern_ops);
create index if not exists world_city_directory_ascii_prefix
  on public.world_city_directory (lower(ascii_name) text_pattern_ops);
create index if not exists world_city_directory_country
  on public.world_city_directory (country_code, population desc);

create or replace function public.search_world_cities(
  p_name text, p_count integer default 30, p_country_code text default null
) returns table(
  geoname_id bigint, name text, country text, region text,
  country_code text, latitude double precision, longitude double precision,
  population bigint
) language sql stable security invoker set search_path=''
as $$
  with input as (
    select left(
      lower(regexp_replace(btrim(coalesce(p_name,'')),'[%_\\]','','g')),70
    ) as q
  )
  select c.geoname_id,c.name,c.country,c.region,c.country_code::text,
         c.latitude,c.longitude,c.population
  from public.world_city_directory c cross join input i
  where length(i.q)>=2
    and (lower(c.name) like i.q||'%' or lower(c.ascii_name) like i.q||'%')
    and (nullif(btrim(p_country_code),'') is null
      or c.country_code = upper(btrim(p_country_code)))
  order by
    case when lower(c.name)=i.q then 0
         when lower(c.ascii_name)=i.q then 1
         else 2 end,
    c.population desc,c.name asc,c.country asc
  limit greatest(1,least(coalesce(p_count,30),50));
$$;
revoke all on function public.search_world_cities(text,integer,text) from public,anon;
grant execute on function public.search_world_cities(text,integer,text) to authenticated;
