-- Milestone 14: opt-in city-area discovery.
-- Existing members are not automatically included in Nearby search.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nearby_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.nearby_visible IS
  'Opt-in for being included in location-based Nearby discovery; not a statement about profile secrecy.';
