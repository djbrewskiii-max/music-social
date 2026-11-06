-- Selected city center only (no GPS). International Nearby matching.
alter table public.profiles
  add column if not exists city_lat double precision,
  add column if not exists city_lon double precision,
  add column if not exists city_country_code text;

comment on column public.profiles.city_lat is 'Approximate center latitude of user-selected city (not device location)';
comment on column public.profiles.city_lon is 'Approximate center longitude of user-selected city (not device location)';
comment on column public.profiles.city_country_code is 'ISO 3166-1 alpha-2 code for chosen city';

update public.profiles set city_lat = 40.7128, city_lon = -74.0060, city_country_code = 'US'
  where city in ('NYC, New York', 'New York, NY') and city_lat is null;
update public.profiles set city_lat = 34.0522, city_lon = -118.2437, city_country_code = 'US'
  where city in ('Los Angeles, CA', 'Los Angeles, California') and city_lat is null;
