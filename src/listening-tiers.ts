/*
  Honest Listening Now tiers — one label, one meaning, never faked.

  Apple Music can be verified live: the system player says a track is
  playing right now and the presence row was verified within the last
  60 seconds. Spotify cannot be verified that way — there is no
  Spotify OAuth and no synced playback in the app yet — so a Spotify
  song is never "verified live". It is one of the other tiers:

  - shared_just_now: the member shared/posted this song within the
    last hour. It was real, just now, but it is not a live listen.
  - on_repeat: the member declared this song "On Repeat this week"
    in OVRLEE. Declared taste, not a listen at all.
  - here_now: the member is active on OVRLEE, with no song to show.

  Every surface that shows a song next to a person (feed Listening
  Now, profile Hello Song) must use listeningTierFor + listeningTierLabel
  so the same song never gets a different, stronger claim elsewhere.
*/

export type ListeningTier = 'verified_live' | 'shared_just_now' | 'on_repeat' | 'here_now';

/** A shared song counts as "just now" for one hour after it was posted. */
export const SHARED_JUST_NOW_MS = 60 * 60 * 1000;

/** The tier for a person, in order of strength. Verified live wins only when it is actually verified. */
export function listeningTierFor(input: {
  verifiedLive: boolean;
  sharedAtMs?: number | null;
  nowMs?: number;
  hasOnRepeat: boolean;
}): ListeningTier {
  const now = input.nowMs ?? Date.now();
  if (input.verifiedLive) return 'verified_live';
  if (input.sharedAtMs && now - input.sharedAtMs <= SHARED_JUST_NOW_MS) return 'shared_just_now';
  if (input.hasOnRepeat) return 'on_repeat';
  return 'here_now';
}

export function listeningTierLabel(tier: ListeningTier): string {
  switch (tier) {
    case 'verified_live':
      return '● VERIFIED LIVE';
    case 'shared_just_now':
      return '♫ SHARED JUST NOW';
    case 'on_repeat':
      return '♫ ON REPEAT · DECLARED BY YOU';
    case 'here_now':
      return '● HERE NOW';
  }
}

/** One honest line explaining what the tier does — and does not — mean. */
export function listeningTierDescription(tier: ListeningTier): string {
  switch (tier) {
    case 'verified_live':
      return 'Verified playing right now on Apple Music.';
    case 'shared_just_now':
      return 'Shared on OVRLEE within the last hour — not a verified live listen.';
    case 'on_repeat':
      return 'Declared On Repeat this week — chosen by them, not verified listening.';
    case 'here_now':
      return 'Active on OVRLEE right now.';
  }
}
