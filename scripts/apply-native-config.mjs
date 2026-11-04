// Updates app.json in place for the next development build, keeping
// everything else in it (including your new icon setup) exactly as it is.
// Run from the project folder:  node scripts/apply-native-config.mjs
import fs from 'node:fs';

const path = new URL('../app.json', import.meta.url);
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
const expo = config.expo;
const changes = [];

// 1. Home-screen name
if (expo.name !== 'OVRLEE') {
  expo.name = 'OVRLEE';
  changes.push('App name → OVRLEE');
}

// 2. Keep playing listening parties in the background
expo.ios ??= {};
expo.ios.infoPlist ??= {};
const plist = expo.ios.infoPlist;
const modes = new Set(plist.UIBackgroundModes || []);
if (!modes.has('audio')) {
  modes.add('audio');
  plist.UIBackgroundModes = [...modes];
  changes.push('Background audio on');
}

// 3. Permission messages (Apple reviewers read these)
plist.NSAppleMusicUsageDescription =
  'OVRLEE uses your Apple Music library and listening to build your music identity, find people who listen like you, and play listening parties in sync.';
plist.NSMicrophoneUsageDescription =
  'OVRLEE uses the microphone only when you tap Recognize Music to identify a song playing near you.';


// 4. ovrlee:// links (existing schemes stay first so current links keep working)
const schemes = Array.isArray(expo.scheme) ? expo.scheme : expo.scheme ? [expo.scheme] : [];
if (!schemes.includes('ovrlee')) {
  expo.scheme = [...schemes, 'ovrlee'];
  changes.push('Added ovrlee:// scheme');
}

// 5. Splash: only replace Expo's default blue (leave a custom splash alone)
for (const plugin of expo.plugins || []) {
  if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen' && plugin[1]?.backgroundColor === '#208AEF') {
    plugin[1].backgroundColor = '#000000';
    changes.push('Splash background → black');
  }
}

// 6. Share extension: "OVRLEE" in the share sheet of Apple Music and Spotify
const hasShare = (expo.plugins || []).some((p) => p === 'expo-share-intent' || (Array.isArray(p) && p[0] === 'expo-share-intent'));
if (!hasShare) {
  expo.plugins.push([
    'expo-share-intent',
    {
      iosShareExtensionName: 'OVRLEE',
      iosActivationRules: {
        NSExtensionActivationSupportsWebURLWithMaxCount: 1,
        NSExtensionActivationSupportsText: true,
      },
      disableAndroid: true,
    },
  ]);
  changes.push('Share extension added');
}

// 7. Save collection slides straight to Photos
const hasMedia = (expo.plugins || []).some((p) => p === 'expo-media-library' || (Array.isArray(p) && p[0] === 'expo-media-library'));
if (!hasMedia) {
  expo.plugins.push([
    'expo-media-library',
    {
      savePhotosPermission: 'OVRLEE saves your collection slides to Photos so you can post them anywhere.',
      photosPermission: 'OVRLEE uses your photos for posts and collections.',
      isAccessMediaLocationEnabled: false,
    },
  ]);
  changes.push('Save-to-Photos added (takes effect in the next app build)');
}

// 8. Development builds reopen the last server instead of the launcher
const devClient = (expo.plugins || []).find((p) => p === 'expo-dev-client' || (Array.isArray(p) && p[0] === 'expo-dev-client'));
if (!devClient) {
  expo.plugins.push(['expo-dev-client', { launchMode: 'most-recent' }]);
  changes.push('Dev builds skip the server picker (next app build)');
} else if (Array.isArray(devClient) && devClient[1]?.launchMode !== 'most-recent') {
  devClient[1] = { ...(devClient[1] || {}), launchMode: 'most-recent' };
  changes.push('Dev builds skip the server picker (next app build)');
}

fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log(changes.length ? 'Updated app.json:\n- ' + changes.join('\n- ') : 'app.json already up to date.');
