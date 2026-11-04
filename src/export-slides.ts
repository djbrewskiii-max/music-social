import * as Sharing from 'expo-sharing';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/*
  Turns rendered slides into 1080×1920 images (the TikTok / Instagram
  Stories size) and saves them.

  With the Photos module (next app build): all slides save to Photos in one
  tap, ready to post as a carousel. Without it (current build): each slide
  opens in the share sheet, where "Save Image" or Instagram works.
*/

export type ExportResult = { mode: 'photos' | 'share'; count: number };

export async function captureSlides(views: (View | null)[]): Promise<string[]> {
  const uris: string[] = [];
  for (const view of views) {
    if (!view) continue;
    uris.push(await captureRef(view, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' }));
  }
  return uris;
}

export async function saveSlides(uris: string[]): Promise<ExportResult> {
  // Preferred: straight into Photos (needs the Photos module, included in the
  // next app build). Looked up at runtime so older builds simply skip it.
  try {
    const MediaLibrary = requireOptionalNativeModule<any>('ExpoMediaLibrary');
    if (MediaLibrary?.saveToLibraryAsync && MediaLibrary?.requestPermissionsAsync) {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (permission?.granted) {
        for (const uri of uris) await MediaLibrary.saveToLibraryAsync(uri);
        return { mode: 'photos', count: uris.length };
      }
    }
  } catch (error) {
    console.log('Photos save unavailable, using share sheet:', error);
  }

  // Fallback: the share sheet, one slide at a time.
  for (const uri of uris) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Save or share this slide' });
  }
  return { mode: 'share', count: uris.length };
}
