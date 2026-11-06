-- OVRLEE Milestone 11: public, opt-in personal Overly trait.
-- Run against the existing Supabase project before deploying client code
-- that selects or writes profiles.overly_trait.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS overly_trait text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_overly_trait_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_overly_trait_length
  CHECK (overly_trait IS NULL OR char_length(overly_trait) <= 40);
