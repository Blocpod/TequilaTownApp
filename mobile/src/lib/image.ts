import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';

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

/** Save a remote image (e.g. a Memoria Viva portrait) to the photo library. */
export async function saveImageToLibrary(url: string, name = `tequila-town-${Date.now()}.jpg`): Promise<'saved' | 'denied'> {
  const perm = await requestPermissionsAsync(true, ['photo']);
  if (!perm.granted) return 'denied';
  const file = await download(url, name);
  await Asset.create(file.uri);
  return 'saved';
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
