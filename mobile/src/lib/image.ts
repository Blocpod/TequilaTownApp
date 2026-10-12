import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';

import { isExpoGo } from './runtime';
import { shareText } from './share';

// Native implementation — image.web.ts covers the web dev preview.

/** Downscale + JPEG-encode a local photo for upload (keeps requests small on festival networks). */
export async function prepareJpeg(uri: string, maxSide = 1024, quality = 0.82): Promise<{ base64: string; uri: string }> {
  let ref = await ImageManipulator.manipulate(uri).renderAsync();
  // Only ever shrink, and by the longest side.
  if (Math.max(ref.width, ref.height) > maxSide) {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize(ref.width >= ref.height ? { width: maxSide } : { height: maxSide });
    ref = await ctx.renderAsync();
  }
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
  if (!out.base64) throw new Error('Could not encode image');
  return { base64: out.base64.replace(/^data:image\/\w+;base64,/, ''), uri: out.uri };
}

async function download(url: string, name: string): Promise<File> {
  const dir = new Directory(Paths.cache, 'tt-share');
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, name);
  if (target.exists) target.delete();
  return File.downloadFileAsync(url, target);
}

/**
 * Add a local file to the photo library. Store and development builds use the current class-based
 * API; Expo Go doesn't ship that native module, so it uses the legacy API (same result). Both
 * are imported lazily so merely loading this file can't crash inside Expo Go.
 */
async function addToPhotos(localUri: string): Promise<boolean> {
  if (isExpoGo) {
    const LegacyMediaLibrary = await import('expo-media-library/legacy');
    const perm = await LegacyMediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!perm.granted) return false;
    await LegacyMediaLibrary.saveToLibraryAsync(localUri);
    return true;
  }
  const MediaLibrary = await import('expo-media-library');
  const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!perm.granted) return false;
  await MediaLibrary.Asset.create(localUri);
  return true;
}

/** Save a remote image (e.g. a Memoria Viva portrait) to the photo library. */
export async function saveImageToLibrary(url: string, name = `tequila-town-${Date.now()}.jpg`): Promise<'saved' | 'denied'> {
  const file = await download(url, name);
  return (await addToPhotos(file.uri)) ? 'saved' : 'denied';
}

/** Share the image file itself (falls back to a link). */
export async function shareImage(url: string, message: string, link?: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    const file = await download(url, `tequila-town-${Date.now()}.jpg`);
    await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', dialogTitle: message, UTI: 'public.jpeg' });
    return;
  }
  await shareText(message, link ?? url);
}
