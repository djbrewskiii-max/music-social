/*
  Artist rooms — PARTIAL, deliberately.
  What is built here: the shape of an artist-hosted First Listen room
  (an unreleased snippet or a new album, a Q&A where fans reply with a
  song, and an artist reply back with a song) and the checklist that
  has to be true before one is offered. What is NOT built: an artist
  portal, an upload flow for unreleased audio, artist verification, or
  any payment / ticketing. Those need product, legal and moderation
  decisions first — an unreleased track must not be uploaded to OVRLEE
  on a promise. Start with one local / independent artist a month, in
  an ordinary First Listen room, with the artist as host. See
  docs/creative-ideas-implementation.md.
*/

export type ArtistRoomProposal = {
  artistName: string;
  albumTitle: string;
  releaseDate: string;
  hostUserId: string | null;
  isIndependent: boolean;
  hasRightsToShareSnippet: boolean;
  moderatorApproved: boolean;
};

export const ARTIST_ROOM_CHECKLIST: string[] = [
  'The artist (or their representative) has agreed in writing to host the room.',
  'Any unreleased audio is shared only as a link to the artist\u2019s own service, or not at all — never uploaded to OVRLEE.',
  'The artist understands fans will reply with songs and that replies are public to room members.',
  'A named moderator is assigned to the room, with report / block tools ready.',
  'The room is labelled as artist-hosted, with the artist\u2019s name, not as an official OVRLEE release.',
];

export function artistRoomReady(proposal: ArtistRoomProposal): boolean {
  return proposal.isIndependent && proposal.hasRightsToShareSnippet && proposal.moderatorApproved && !!proposal.hostUserId;
}

export function artistRoomPrompt(artistName: string): string {
  return `What song of yours should a new fan hear first — and what song inspired it? Reply with a song.`;
}
