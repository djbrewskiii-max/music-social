# OVRLEE worldwide city directory — deployment and acceptance

**State:** schema and app client are committed; hosted index exists but has **0 rows** until import. Do not call worldwide location support launched until a verified import and an on-device test.

## License, privacy and approach

The free data source is [GeoNames](https://www.geonames.org/export/) under [CC BY 4.0](https://www.geonames.org/about.html). The app credits GeoNames in Settings. OVRLEE hosts the dataset in Supabase and does not rely on GeoNames public web API requests or GPS. GeoNames provides city/administrative-center coordinates rather than home addresses; city selection is optional during signup.

## One-time import

1. Use a terminal with Node 20+ and the macOS `unzip` command available. Check the connected Supabase project you intend to populate. Estimate its free-plan database quota and read current billing/usage before proceeding.
2. From the repository root, run `node scripts/import-geonames-cities.mjs`. This downloads official GeoNames `cities1000.zip`, `countryInfo.txt` and `admin1CodesASCII.txt`, inspects matches and **does not write any rows**.
3. Only when the dry run looks correct, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as temporary local shell environment variables. Obtain the secret key from Supabase's protected project configuration. **Never paste it into ChatGPT, git, a screenshot, Expo `.env`, a client app, or CI logs.** Run `node scripts/import-geonames-cities.mjs --apply`. The `--apply` flag is mandatory for changes.
4. Watch progress. Import is idempotent by GeoNames ID and batches 400 rows at a time. If it stops, rerun with `--apply`; existing IDs are updated. Confirm counts with `select count(*),count(distinct country_code) from public.world_city_directory;`.
5. Test `select name,region,country from public.search_world_cities('Manch',30,null);` and `select * from public.search_world_cities('Accra',30,'GH');`, plus São Paulo, Ottawa, Lagos, Tokyo, Hartford/Manchester CT and small towns. Check US/UK duplicate cities and consistent region labels.
6. In the compatible iPhone `preview` build, verify city search after a real sign-in, light/dark/system theme switching with modal open, keyboard behavior and error/no-results states. Selecting an option should store a *city-center* coordinate and canonical label. Nearby visibility remains opt-in.
7. Record the dataset import date and row count, monitor database storage and API request counts, and repeat on a scheduled cadence appropriate for location changes.

## Safety properties

- The app uses `supabase.rpc('search_world_cities')`, which is an indexed `SECURITY INVOKER` database function returning at most 50 matches to authenticated members.
- `anon` has no raw table read access or function execution permission; `authenticated` may read but cannot insert/edit directory rows. Writes require the protected server-side service key.
- The client retains a short offline directory as a fallback. No city result is treated as proof of the phone's current location.
- The official `cities1000` dataset includes populated places with more than roughly 1,000 people and administrative centers. It is not every village, ZIP code or municipal boundary. A smaller settlement can remain absent; we must not promise universal coverage.
- The city search RPC handles prefixes and ASCII names. Alias/misspelling coverage, pagination and stronger rate limiting remain optional future improvements.

## Rollout gates

- [x] Source license and credit validated
- [x] Indexed table, RLS and query RPC created in hosted Supabase
- [x] Import script committed, defaults to dry run
- [x] Query tested with synthetic Manchester CT, Manchester UK and Accra rows, rolled back
- [ ] Real official GeoNames rows imported and reviewed (current hosted count: **0**)
- [ ] Verify DB usage and search latency at full populated size
- [ ] Test full real-world queries and light/dark/system screens on actual iPhone
- [ ] Publish compatible preview OTA and complete device acceptance
