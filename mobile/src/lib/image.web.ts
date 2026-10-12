import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { shareText } from './share';

/** Web build (dev preview): same contract as image.ts without native file / photo-library modules. */
export async function prepareJpeg(uri: string, maxSide = 1024, quality = 0.82): Promise<{ base64: string; uri: string }> {
  let ref = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(ref.width, ref.height) > maxSide) {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize(ref.width >= ref.height ? { width: maxSide } : { height: maxSide });
    ref = await ctx.renderAsync();
  }
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
  if (!out.base64) throw new Error('Could not encode image');
  return { base64: out.base64.replace(/^data:image\/\w+;base64,/, ''), uri: out.uri };
}

export async function saveImageToLibrary(url: string, _name?: string): Promise<'saved' | 'denied'> {
  globalThis.open?.(url, '_blank');
  return 'saved';
}

export async function shareImage(url: string, message: string, link?: string): Promise<void> {
  await shareText(message, link ?? url);
}
