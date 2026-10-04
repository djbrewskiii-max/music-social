import { requireNativeModule } from 'expo-modules-core';
import {
  AppState,
  AppStateStatus,
} from 'react-native';

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

const formatArtworkUrl = (
  url?: string,
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

export const refreshPresence =
  async () => {
    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      const playback =
        await getSystemPlayback();

      /*
       * A failed native read is NOT the
       * same thing as Apple Music being
       * paused.
       *
       * Leave the existing presence alone
       * rather than recording false data.
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
        playback.itemType === 'song' &&
        !!song?.title &&
        !!song?.artistName;

      if (isVerifiedPlaying && song) {
        /*
         * TRUE LIVE PLAYBACK.
         *
         * NOW has directly verified that
         * Apple Music is currently playing
         * this exact song.
         */
        const {
          error: presenceError,
        } = await supabase
          .from('listening_presence')
          .upsert(
            {
              user_id: user.id,

              song_title:
                song.title,

              artist_name:
                song.artistName,

              artwork_url:
                formatArtworkUrl(
                  song.artworkUrl
                ),

              apple_music_id:
                song.id || null,

              is_playing: true,

              last_active_at:
                now,

              last_verified_playing_at:
                now,

              updated_at:
                now,
            },
            {
              onConflict:
                'user_id',
            }
          );

        if (presenceError) {
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
       * NOW successfully checked Apple
       * Music, but Apple Music is NOT
       * currently playing a verified song.
       *
       * Keep the previous song information
       * because that becomes:
       *
       * 🟡 Recently Listened
       *
       * But explicitly mark it as no longer
       * live.
       */
      const {
        error: activityError,
      } = await supabase
        .from('listening_presence')
        .update({
          is_playing: false,
          last_active_at: now,
          updated_at: now,
        })
        .eq('user_id', user.id);

      if (activityError) {
        console.log(
          'Presence activity update error:',
          activityError.message
        );

        return;
      }

      console.log(
        '🟡 NOT CURRENTLY PLAYING:',
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

const startHeartbeat = () => {
  if (heartbeat) {
    clearInterval(heartbeat);
  }

  /*
   * Verify immediately when NOW becomes
   * active.
   */
  refreshPresence();

  /*
   * Then re-check Apple Music every
   * 15 seconds while NOW remains active.
   */
  heartbeat = setInterval(
    () => {
      refreshPresence();
    },
    HEARTBEAT_MS
  );
};

const stopHeartbeat = () => {
  if (!heartbeat) {
    return;
  }

  clearInterval(heartbeat);
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
      currentAppState === 'active'
    ) {
      startHeartbeat();
    }

    appStateSubscription =
      AppState.addEventListener(
        'change',
        (
          nextState: AppStateStatus
        ) => {
          const previousState =
            currentAppState;

          currentAppState =
            nextState;

          /*
           * User returned to NOW.
           *
           * Immediately verify Apple Music
           * again rather than waiting for
           * the next heartbeat.
           */
          if (
            nextState === 'active'
          ) {
            startHeartbeat();
            return;
          }

          /*
           * NOW is leaving the foreground.
           *
           * Stop the JS timer because iOS
           * may suspend the application.
           *
           * We do NOT immediately set
           * is_playing=false here. A brief
           * switch to another app should
           * not instantly turn someone's
           * Listening Now status yellow.
           *
           * The feed will use
           * last_verified_playing_at with
           * a freshness window so stale
           * green statuses expire safely.
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