import { requireOptionalNativeModule } from 'expo-modules-core';

export type SpotifyTrackEvent = {
  uri: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  isPaused: boolean;
  source: 'spotify';
};

export type SpotifyConnectionEvent = {
  connected: boolean;
};

export type SpotifyErrorEvent = {
  message: string;
};

type SpotifyNativeModule = {
  authorize: () => Promise<boolean>;
  authorizeForPlaylists?: () => Promise<boolean>;
  getPlaylistAccessToken?: () => string | null;
  clearPlaylistAccessToken?: () => void;
  handleRedirect: (url: string) => Promise<boolean>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  isConnected: () => boolean;
  getDiagnostics?: () => string;
  addListener: <T>(
    eventName: string,
    listener: (event: T) => void
  ) => { remove: () => void };
};

// Older development clients do not contain NowSpotify yet.
// Keep OVRLEE launchable until a new native build is installed.
const NativeSpotify = requireOptionalNativeModule<SpotifyNativeModule>('NowSpotify');
const noSubscription = () => ({ remove: () => {} });

export const SpotifyRemote = {
  authorize: () => NativeSpotify?.authorize() ?? Promise.resolve(false),
  authorizeForPlaylists: () => NativeSpotify?.authorizeForPlaylists?.() ?? Promise.resolve(false),
  getPlaylistAccessToken: () => NativeSpotify?.getPlaylistAccessToken?.() ?? null,
  clearPlaylistAccessToken: () => NativeSpotify?.clearPlaylistAccessToken?.(),
  handleRedirect: (url: string) => NativeSpotify?.handleRedirect(url) ?? Promise.resolve(false),
  connect: () => NativeSpotify?.connect() ?? Promise.resolve(false),
  disconnect: () => NativeSpotify?.disconnect() ?? Promise.resolve(false),
  isConnected: () => NativeSpotify?.isConnected() ?? false,
  getDiagnostics: () => NativeSpotify?.getDiagnostics?.() ?? "Spotify native diagnostics unavailable in this build.",

  onPlaylistAuthorized: (listener: (event: { authorized: boolean }) => void) =>
    NativeSpotify?.addListener<{ authorized: boolean }>('onPlaylistAuthorized', listener) ?? noSubscription(),

  onTrack: (listener: (event: SpotifyTrackEvent) => void) =>
    NativeSpotify?.addListener<SpotifyTrackEvent>('onTrack', listener) ?? noSubscription(),

  onConnection: (listener: (event: SpotifyConnectionEvent) => void) =>
    NativeSpotify?.addListener<SpotifyConnectionEvent>('onConnection', listener) ?? noSubscription(),

  onError: (listener: (event: SpotifyErrorEvent) => void) =>
    NativeSpotify?.addListener<SpotifyErrorEvent>('onError', listener) ?? noSubscription(),
};

export default SpotifyRemote;
