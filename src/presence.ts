import { requireNativeModule } from 'expo-modules-core';
import {
  AppState,
  AppStateStatus,
} from 'react-native';

import { Catalog } from '@wwdrew/expo-apple-music';

import { supabase } from './supabase';
import { getMusicProvider } from './music-provider';

type SystemSong = {
  id?: string;
  title?: string;
  artistName?: string;
  albumTitle?: string;
  artworkUrl?: string;
};

type SystemPlaybackState = {
  playbackStatus?: string;
  playbackRate?: number;
  hasCurrentEntry?: boolean;
  itemType?: string;
  currentSong?: SystemSong;
};

type ExpoAppleMusicNativeModule = {
  getSystemPlaybackState:
    () => Promise<SystemPlaybackState>;
};

const AppleMusicNative =
  requireNativeModule<ExpoAppleMusicNativeModule>(
    'ExpoAppleMusic'
  );

type SpotifyPlaybackEvent = {
  uri?: string;
  title?: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  isPaused?: boolean;
  source?: string;
};

type SpotifyNativeModule = {
  isConnected: () => boolean;
  connect: () => Promise<boolean>;
  addListener: (name: string, callback: (event: any) => void) => { remove: () => void };
};

let spotifyNative: SpotifyNativeModule | null = null;
let spotifySubscriptions: { remove: () => void }[] = [];
let spotifyLastTrackURI: string | null = null;
let spotifyLastPlaying = false;
let spotifyWriteQueue: Promise<void> = Promise.resolve();
let spotifyConnecting = false;
// Only reconnect after this process has observed a successful native authorization/connection.
// Avoid calling connect() without an access token on cold starts.
let spotifyAuthorizedThisSession = false;

const getSpotifyNative = (): SpotifyNativeModule | null => {
  if (spotifyNative) return spotifyNative;
  try {
    spotifyNative = requireNativeModule<SpotifyNativeModule>('NowSpotify');
    return spotifyNative;
  } catch {
    // Old iPhone builds do not contain this native module yet.
    return null;
  }
};

const saveSpotifyPlayback = async (event: SpotifyPlaybackEvent) => {
  if (currentAppState !== 'active') return;
  if (await getMusicProvider() !== 'spotify') return;
  const title = event.title?.trim();
  const artist = event.artist?.trim();
  if (!title || !artist || !event.uri) return;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return;

  const now = new Date().toISOString();
  const playing = event.isPaused === false;
  const newPlayingTrack = playing &&
    (spotifyLastTrackURI !== event.uri || !spotifyLastPlaying);

  const { error: presenceError } = await supabase.from('listening_presence').upsert({
    user_id: user.id,
    song_title: title,
    artist_name: artist,
    apple_music_id: null,
    artwork_url: null,
    is_playing: playing,
    last_verified_playing_at: playing ? now : null,
    recognition_source: null,
    last_active_at: now,
    updated_at: now,
  }, { onConflict: 'user_id' });

  if (presenceError) {
    console.log('Spotify presence save error:', presenceError.message);
    return;
  }

  spotifyLastTrackURI = event.uri;
  spotifyLastPlaying = playing;
  if (!newPlayingTrack) return;

  // Live observations, not an imported Spotify listening history.
  const { data: existing, error: readError } = await supabase
    .from('music_dna')
    .select('user_id, recent_tracks')
    .eq('user_id', user.id)
    .maybeSingle();
  if (readError) {
    console.log('Spotify recent tracks read error:', readError.message);
    return;
  }

  type RecentTrack = { id?: string; song: string; artist: string; artworkUrl?: string };
  const previous: RecentTrack[] = Array.isArray(existing?.recent_tracks)
    ? (existing.recent_tracks as RecentTrack[]) : [];
  const observed: RecentTrack = { id: event.uri, song: title, artist };
  const sameTrack = (a: RecentTrack, b: RecentTrack) =>
    a.song.toLowerCase() === b.song.toLowerCase() &&
    a.artist.toLowerCase() === b.artist.toLowerCase();
  const next = previous[0] && sameTrack(previous[0], observed)
    ? [{ ...previous[0], ...observed }, ...previous.slice(1)]
    : [observed, ...previous];

  const query = existing
    ? supabase.from('music_dna').update({ recent_tracks: next.slice(0, 50), updated_at: now }).eq('user_id', user.id)
    : supabase.from('music_dna').insert({
        user_id: user.id, top_artists: [], top_songs: [],
        recent_tracks: next.slice(0, 50), updated_at: now,
      });
  const { error: historyError } = await query;
  if (historyError) console.log('Spotify recent tracks save error:', historyError.message);
};

const queueSpotifyPlayback = (event: SpotifyPlaybackEvent) => {
  spotifyWriteQueue = spotifyWriteQueue
    .catch(() => {})
    .then(() => saveSpotifyPlayback(event))
    .catch((error) => console.log('Spotify playback event error:', error));
};

const markSpotifyNotPlaying = async () => {
  spotifyLastPlaying = false;
  if (await getMusicProvider() !== 'spotify') return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('listening_presence')
    .update({ is_playing: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) console.log('Spotify disconnect presence error:', error.message);
};

const startSpotifyListeners = () => {
  const native = getSpotifyNative();
  if (!native || spotifySubscriptions.length) return;
  spotifySubscriptions.push(
    native.addListener('onTrack', (event: SpotifyPlaybackEvent) => {
      queueSpotifyPlayback(event);
    }),
    native.addListener('onConnection', (event: { connected?: boolean }) => {
      if (event.connected) spotifyAuthorizedThisSession = true;
      if (!event.connected) {
        spotifyWriteQueue = spotifyWriteQueue.then(markSpotifyNotPlaying);
      }
    }),
    native.addListener('onError', (event: { message?: string }) => {
      console.log('Spotify App Remote:', event.message || 'Unknown error');
    })
  );
};

const reconnectSpotifyIfPossible = async () => {
  if (spotifyConnecting || currentAppState !== 'active' || !spotifyAuthorizedThisSession) return;
  if (await getMusicProvider() !== 'spotify') return;
  const native = getSpotifyNative();
  if (!native || native.isConnected()) return;
  spotifyConnecting = true;
  try {
    // Only reconnects an existing authorized session; never launches Spotify automatically.
    await native.connect();
  } catch (error) {
    console.log('Spotify reconnect unavailable:', error);
  } finally {
    spotifyConnecting = false;
  }
};

const HEARTBEAT_MS = 15_000;

let heartbeat:
  | ReturnType<typeof setInterval>
  | null = null;

let appStateSubscription:
  | { remove: () => void }
  | null = null;

let currentAppState: AppStateStatus =
  AppState.currentState;

let started = false;

const artworkCache =
  new Map<string, string | null>();

const formatArtworkUrl = (
  url?: string | null,
  width = 600,
  height = 600
) => {
  if (!url) {
    return null;
  }

  return url
    .replace('{w}', String(width))
    .replace('{h}', String(height));
};

const getCatalogArtwork =
  async (
    appleMusicId?: string
  ): Promise<string | null> => {
    if (!appleMusicId) {
      return null;
    }

    if (
      artworkCache.has(
        appleMusicId
      )
    ) {
      return (
        artworkCache.get(
          appleMusicId
        ) ?? null
      );
    }

    try {
      const result =
        await Catalog.getByIds(
          'songs',
          [appleMusicId]
        );

      const catalogSong =
        result.songs?.[0];

      const artwork =
        formatArtworkUrl(
          catalogSong?.artworkUrl
        );

      artworkCache.set(
        appleMusicId,
        artwork
      );

      if (artwork) {
        console.log(
          '🖼️ CATALOG ARTWORK FOUND:',
          appleMusicId
        );
      } else {
        console.log(
          '⚠️ NO CATALOG ARTWORK:',
          appleMusicId
        );
      }

      return artwork;
    } catch (error) {
      console.log(
        'Catalog artwork lookup error:',
        error
      );

      return null;
    }
  };

const getSystemPlayback =
  async (): Promise<SystemPlaybackState | null> => {
    try {
      return await AppleMusicNative.getSystemPlaybackState();
    } catch (error) {
      console.log(
        'System playback read error:',
        error
      );

      return null;
    }
  };

/*
 * APP PRESENCE
 *
 * This is intentionally separate from
 * Apple Music playback.
 *
 * If NOW is open in the foreground,
 * last_active_at should stay fresh even
 * if MusicKit/native playback detection
 * temporarily fails.
 */
const refreshAppActivity =
  async () => {
    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        return;
      }

      const now =
        new Date().toISOString();

      const {
        data: existingPresence,
        error: existingError,
      } = await supabase
        .from(
          'listening_presence'
        )
        .select('user_id')
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle();

      if (existingError) {
        console.log(
          'Presence activity lookup error:',
          existingError.message
        );
        return;
      }

      /*
       * Existing users simply get a fresh
       * foreground heartbeat.
       */
      if (existingPresence) {
        const {
          error: activityError,
        } = await supabase
          .from(
            'listening_presence'
          )
          .update({
            last_active_at:
              now,
          })
          .eq(
            'user_id',
            user.id
          );

        if (activityError) {
          console.log(
            'App activity update error:',
            activityError.message
          );
        }

        return;
      }

      /*
       * Normally a connected Apple Music
       * user already has a presence row.
       *
       * This fallback creates one so app
       * presence itself does not depend on
       * successful playback detection.
       */
      const {
        error: insertError,
      } = await supabase
        .from(
          'listening_presence'
        )
        .insert({
          user_id:
            user.id,

          song_title:
            null,

          artist_name:
            null,

          artwork_url:
            null,

          apple_music_id:
            null,

          is_playing:
            false,

          last_active_at:
            now,

          last_verified_playing_at:
            null,

          updated_at:
            now,
        });

      if (insertError) {
        console.log(
          'App activity insert error:',
          insertError.message
        );
      }
    } catch (error) {
      console.log(
        'App activity refresh error:',
        error
      );
    }
  };

// Shazam confirms identification, not ongoing playback.
export const publishRecognizedSong = async (match: {
  title: string; artist: string; appleMusicId?: string; isrc?: string;
}): Promise<void> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in to share recognized music.');
  if (!match.title?.trim() || !match.artist?.trim()) throw new Error('Missing song details.');
  const provider = await getMusicProvider();
  if (provider !== 'spotify') return; // Apple Music has its own verified tracking.
  const now = new Date().toISOString();
  const artwork = match.appleMusicId ? await getCatalogArtwork(match.appleMusicId) : null;
  const { error: writeError } = await supabase.from('listening_presence').upsert({
    user_id: user.id,
    song_title: match.title.trim(),
    artist_name: match.artist.trim(),
    apple_music_id: match.appleMusicId || null,
    artwork_url: artwork,
    is_playing: false,
    last_verified_playing_at: null,
    recognition_source: 'shazam',
    last_active_at: now,
    updated_at: now,
  }, { onConflict: 'user_id' });
  if (writeError) throw new Error(writeError.message);

  // Keep the profile's existing Music DNA and only update recent_tracks.
  // Shazam identification is not proof of continuous playback.
  type RecentTrack = {
    id?: string;
    song: string;
    artist: string;
    artworkUrl?: string;
  };

  const { data: existingDNA, error: readError } = await supabase
    .from('music_dna')
    .select('user_id, recent_tracks')
    .eq('user_id', user.id)
    .maybeSingle();

  if (readError) {
    throw new Error('Song shared to NOW, but Recent Tracks could not be read: ' + readError.message);
  }

  const previous: RecentTrack[] = Array.isArray(existingDNA?.recent_tracks)
    ? (existingDNA.recent_tracks as RecentTrack[])
    : [];

  const recognized: RecentTrack = {
    ...(match.appleMusicId ? { id: match.appleMusicId } : {}),
    song: match.title.trim(),
    artist: match.artist.trim(),
    ...(artwork ? { artworkUrl: artwork } : {}),
  };

  const sameTrack = (a: RecentTrack, b: RecentTrack) =>
    a.song.trim().toLocaleLowerCase() === b.song.trim().toLocaleLowerCase() &&
    a.artist.trim().toLocaleLowerCase() === b.artist.trim().toLocaleLowerCase();

  // Do not add a second entry when the same song is recognized consecutively.
  // Keep existing entries and artwork when the new match has no artwork.
  const first = previous[0];
  const updated = first && sameTrack(first, recognized)
    ? [{ ...first, ...recognized }, ...previous.slice(1)]
    : [recognized, ...previous];

  // Only write the history and timestamp; preserve existing artist/song DNA.
  // Supabase UPDATE can succeed with zero affected rows, so require a returned row.
  const nextRecentTracks = updated.slice(0, 50);
  const historyQuery = existingDNA
    ? supabase
        .from('music_dna')
        .update({ recent_tracks: nextRecentTracks, updated_at: now })
        .eq('user_id', user.id)
    : supabase
        .from('music_dna')
        .insert({
          user_id: user.id,
          top_artists: [],
          top_songs: [],
          recent_tracks: nextRecentTracks,
          updated_at: now,
        });

  const { data: savedDNA, error: historyError } = await historyQuery
    .select('user_id, recent_tracks')
    .maybeSingle();

  if (historyError) {
    throw new Error(
      'Song shared to NOW, but Recent Tracks could not be saved: ' +
        historyError.message
    );
  }

  if (!savedDNA || savedDNA.user_id !== user.id) {
    throw new Error(
      'Song shared to NOW, but Recent Tracks save affected zero visible rows. ' +
        'Check music_dna RLS and the signed-in user.'
    );
  }

  const savedTracks: RecentTrack[] = Array.isArray(savedDNA.recent_tracks)
    ? (savedDNA.recent_tracks as RecentTrack[])
    : [];

  if (!savedTracks[0] || !sameTrack(savedTracks[0], recognized)) {
    throw new Error(
      'Song shared to NOW, but Recent Tracks verification failed: ' +
        'the recognized song was not first in the returned history.'
    );
  }

  console.log('✅ SHAZAM RECENT TRACKS SAVED:', recognized.song, '—', recognized.artist);
};

export const refreshPresence =
  async () => {
    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        return;
      }

      // Spotify users are not monitored by Apple Music playback detection.
      // Preserve their last Shazam recognition instead of overwriting it.
      if (await getMusicProvider() === 'spotify') return;
      const playback =
        await getSystemPlayback();

      /*
       * A failed native read does NOT mean
       * the user left NOW and does NOT mean
       * their music stopped.
       *
       * App activity has already been
       * handled separately.
       */
      if (!playback) {
        return;
      }

      const now =
        new Date().toISOString();

      const song =
        playback.currentSong;

      const isVerifiedPlaying =
        playback.playbackStatus ===
          'playing' &&
        playback.playbackRate !== 0 &&
        playback.hasCurrentEntry ===
          true &&
        playback.itemType ===
          'song' &&
        !!song?.title &&
        !!song?.artistName;

      if (
        isVerifiedPlaying &&
        song
      ) {
        let artwork =
          formatArtworkUrl(
            song.artworkUrl
          );

        if (
          !artwork &&
          song.id
        ) {
          artwork =
            await getCatalogArtwork(
              song.id
            );
        }

        const livePresence: {
          user_id: string;
          song_title: string;
          artist_name: string;
          apple_music_id:
            | string
            | null;
          is_playing: boolean;
          last_active_at: string;
          last_verified_playing_at: string;
          updated_at: string;
          artwork_url?:
            | string
            | null;
        } = {
          user_id:
            user.id,

          song_title:
            song.title!,

          artist_name:
            song.artistName!,

          apple_music_id:
            song.id || null,

          is_playing:
            true,

          last_active_at:
            now,

          last_verified_playing_at:
            now,

          updated_at:
            now,
        };

        (livePresence as typeof livePresence & { recognition_source: string | null }).recognition_source = null;

        if (artwork) {
          livePresence.artwork_url =
            artwork;
        }

        /*
         * Never leave the previous song's
         * artwork attached to a new song.
         */
        if (!artwork) {
          const {
            data:
              existingPresence,
          } = await supabase
            .from(
              'listening_presence'
            )
            .select(
              'apple_music_id'
            )
            .eq(
              'user_id',
              user.id
            )
            .maybeSingle();

          const isDifferentSong =
            existingPresence
              ?.apple_music_id !==
            (song.id || null);

          if (isDifferentSong) {
            livePresence.artwork_url =
              null;
          }
        }

        const {
          error:
            presenceError,
        } = await supabase
          .from(
            'listening_presence'
          )
          .upsert(
            livePresence,
            {
              onConflict:
                'user_id',
            }
          );

        if (
          presenceError
        ) {
          console.log(
            'Live presence update error:',
            presenceError.message
          );

          return;
        }

        console.log(
          '🟢 LISTENING NOW:',
          `${song.title} — ${song.artistName}`
        );

        return;
      }

      /*
       * NOW is open, but Apple Music has
       * been successfully verified as not
       * currently playing.
       *
       * Preserve the previous song so the
       * live-room card still has musical
       * context.
       */
      const {
        error: activityError,
      } = await supabase
        .from(
          'listening_presence'
        )
        .update({
          is_playing:
            false,

          last_active_at:
            now,

          updated_at:
            now,
        })
        .eq(
          'user_id',
          user.id
        );

      if (
        activityError
      ) {
        console.log(
          'Presence playback update error:',
          activityError.message
        );

        return;
      }

      console.log(
        '🟡 ON NOW, MUSIC PAUSED:',
        playback.playbackStatus ||
          'unknown'
      );
    } catch (error) {
      console.log(
        'Presence refresh error:',
        error
      );
    }
  };

const runHeartbeat =
  async () => {
    /*
     * First establish that the user has
     * NOW open.
     */
    await refreshAppActivity();

    /*
     * Then independently determine what
     * Apple Music is doing.
     */
    await refreshPresence();
  };

const startHeartbeat =
  () => {
    if (heartbeat) {
      clearInterval(
        heartbeat
      );
    }

    /*
     * Do not wait 15 seconds when NOW
     * becomes active.
     */
    runHeartbeat();

    heartbeat =
      setInterval(
        () => {
          runHeartbeat();
        },
        HEARTBEAT_MS
      );
  };

const stopHeartbeat =
  () => {
    if (!heartbeat) {
      return;
    }

    clearInterval(
      heartbeat
    );

    heartbeat = null;
  };

export const startPresenceTracking =
  () => {
    if (started) {
      return () => {};
    }

    started = true;
    // App Remote research is preserved below but is not part of the
    // production presence experience. Keep foreground heartbeats for
    // all OVRLEE members regardless of streaming provider.
    // startSpotifyListeners();

    currentAppState =
      AppState.currentState;

    if (
      currentAppState ===
      'active'
    ) {
      startHeartbeat();
      // reconnectSpotifyIfPossible(); // Parked pending provider approval.
    }

    appStateSubscription =
      AppState.addEventListener(
        'change',
        (
          nextState:
            AppStateStatus
        ) => {
          const previousState =
            currentAppState;

          currentAppState =
            nextState;

          /*
           * User returned to NOW.
           *
           * Immediately refresh both their
           * app presence and playback.
           */
          if (
            nextState ===
            'active'
          ) {
            startHeartbeat();
            // reconnectSpotifyIfPossible(); // Parked pending provider approval.
            return;
          }

          /*
           * Stop heartbeats when NOW leaves
           * the foreground.
           *
           * We intentionally do NOT delete
           * the presence row or instantly
           * mark the user offline.
           *
           * HOME uses last_active_at plus a
           * short grace period. That avoids
           * flickering when somebody briefly
           * switches apps.
           */
          if (
            previousState ===
              'active' &&
            (nextState ===
              'background' ||
              nextState ===
                'inactive')
          ) {
            stopHeartbeat();
            spotifyWriteQueue = spotifyWriteQueue.then(markSpotifyNotPlaying);
          }
        }
      );

    return () => {
      stopHeartbeat();
      spotifySubscriptions.forEach((subscription) => subscription.remove());
      spotifySubscriptions = [];
    spotifyAuthorizedThisSession = false;

      if (
        appStateSubscription
      ) {
        appStateSubscription.remove();

        appStateSubscription =
          null;
      }

      started = false;
    };
  };