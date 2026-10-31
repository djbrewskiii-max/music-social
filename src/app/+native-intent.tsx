import { getShareExtensionKey } from 'expo-share-intent';

/*
  The share extension opens OVRLEE with a special link. Send it to the home
  route; ShareIntentHandler (in the root layout) takes it from there.
*/
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/';
    return path;
  } catch {
    return '/';
  }
}
