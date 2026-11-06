# Spotify public playlist exploration prototype

## What was actually tested

- Official Spotify-hosted public playlist embed:
  https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M
- Official oEmbed metadata endpoint for the same sample:
  https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Fplaylist%2F37i9dQZF1DXcBWIGoYBM5M
- The hosted embed contains a playlist title and a navigable track list in Spotify's user interface. The oEmbed endpoint supplies a title and artwork image. This is not a licensed machine-readable feed of all tracks.

## What's built (does not require new native module)

- `src/app/spotify-explore.tsx`: real public playlist URL text field (prefilled with an actual public demo playlist), asynchronous Spotify oEmbed preview metadata, open the Spotify-hosted playlist in an in-app Safari View Controller using existing `expo-web-browser`, and an independent song search/match panel using OVRLEE's catalog search and the signed-in viewer's **own** music DNA.
- Accessible from Settings → Explore a public Spotify playlist, or from featured Spotify playlist cards on OVRLEE profiles.
- In OVRLEE search, explicitly pick a song seen in Spotify's player, then compare that song/artist to *your own existing OVRLEE music history*, and open artist discovery.
- This is intentionally a **manual recognition prototype**. Playlist tracks are not imported, indexed, or scraped; no claim of automatic matching is made. The user must type or search the song. No changes to In Rotation, Core Four, Last Played, or the other member's music DNA are made.

## Why the distinction matters

- Spotify's supported Embeds and oEmbed permit interactive viewing and basic link previews.
- The iframe API supports playback controls and limited playback events, but it is not a general-purpose, complete playlist-track extraction API.
- Spotify's developer policy §II.13 restricts analyzing Spotify content to build derived profiles/user metrics. Automatically scanning public playlists into OVRLEE Music DNA or comparing users' interests needs a policy-compliant source or explicit Spotify permission; visibility in the Spotify UI does not itself supply that grant.
- OVRLEE should not automate extracting playlist HTML. This prototype demonstrates the viewing experience and the music-match UX separately, to make the feasibility gap concrete.

## Acceptance test on iPhone

1. Update branch, reload Expo (no new EAS build).
2. Go to Settings → Explore a public Spotify playlist.
3. Confirm the default Today’s Top Hits artwork and title load from Spotify oEmbed (if online).
4. Tap View the Actual Playlist to open the Spotify-hosted track-list sheet. Test scrolling/playback and dismissing it.
5. Return to OVRLEE. Type the name of a song visible in Spotify. Pick a result from the catalog.
6. See whether it matches your own OVRLEE Music DNA songs or artists. Tap artist discovery.
7. If you've featured a playlist in Spotify Showcase, tap that playlist card on your profile to open this same explorer.
8. Do not expect tracks to appear automatically, or Last Played/In Rotation to change.

## Next technical decision

- If public Spotify identity can be accessed with authorized read-only Web API permissions and the policy use is approved, design automatic suggestions; otherwise continue provider-independent OVRLEE Music DNA and explicit share/import experiences.
- User-requested “give us a public username and scan all visible playlists” remains **not implemented**. Avoid presenting the showcase or this explorer as that feature.
