import { requireNativeModule } from 'expo-modules-core';
type Match = { title: string; artist: string; appleMusicId?: string; isrc?: string };
type ShazamNative = {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(event: 'onMatch', callback: (match: Match) => void): { remove(): void };
  addListener(event: 'onError', callback: (event: { message: string }) => void): { remove(): void };
};
export const NowShazam = requireNativeModule<ShazamNative>('NowShazam');
