import { art, type ArtImage, type ArtKey } from './images.generated';

export { art };
export type { ArtImage, ArtKey };

/** Resolve an art key coming from shared content (typed as string) to an image. */
export function artFor(key: string | undefined | null): ArtImage {
  if (key && key in art) return art[key as ArtKey];
  return art.parchment;
}

/** Props for expo-image: source + blurhash placeholder + crossfade. */
export function imageProps(key: string | undefined | null, transition = 280) {
  const a = artFor(key);
  return {
    source: a.source,
    placeholder: a.blurhash ? { blurhash: a.blurhash } : undefined,
    transition,
  } as const;
}
