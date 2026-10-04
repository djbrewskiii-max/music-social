import { requireNativeModule } from 'expo-modules-core';
import {
  AppState,
  AppStateStatus,
} from 'react-native';

import Catalog from '@wwdrew/expo-apple-music/build/modules/catalog';

import { supabase } from './supabase';

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

    currentAppState =
      AppState.currentState;

    if (
      currentAppState ===
      'active'
    ) {
      startHeartbeat();
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
          }
        }
      );

    return () => {
      stopHeartbeat();

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