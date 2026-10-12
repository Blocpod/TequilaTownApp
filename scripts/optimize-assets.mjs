#!/usr/bin/env node
/**
 * Optimizes the original Tequila Town artwork for the mobile app.
 *
 *   node scripts/optimize-assets.mjs <path-to-original-assets>
 *
 * - Resizes every piece of art to the largest size it is displayed at (@3x aware)
 * - Converts to WebP (animated GIFs become animated WebP)
 * - Computes a blurhash placeholder for every opaque image
 * - Generates app icon / adaptive icon / splash / favicon from the logo
 * - Writes mobile/src/theme/images.generated.ts — the typed image registry
 *
 * sharp is always fed Buffers (never paths) so it works on Windows paths longer
 * than MAX_PATH and inside virtualized app folders.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { encode } from 'blurhash';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] ?? path.join(root, '..', 'mvp', 'src', 'assets'));
const outDir = path.join(root, 'mobile', 'assets', 'images');
const appIconDir = path.join(root, 'mobile', 'assets', 'app');
const registryFile = path.join(root, 'mobile', 'src', 'theme', 'images.generated.ts');

if (!fs.existsSync(src)) {
  console.error(`Source folder not found: ${src}`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(appIconDir, { recursive: true });

/** key -> [source file, max width, quality, options] */
const PLAN = {
  // Zone / experience photography
  expAgaveReflection: ['exp-agave-reflection.jpg', 1080, 78],
  expEspirituTrain: ['exp-espiritu-train.jpg', 1080, 78],
  expLaRojena: ['exp-la-rojena.jpg', 1080, 78],
  expPaletteDecoder: ['exp-palette-decoder.jpg', 1080, 78],
  expBarrelGallery: ['exp-barrel-gallery.jpg', 1080, 78],
  expLaCava: ['exp-la-cava.jpg', 1080, 78],
  expCallesNoche: ['exp-calles-noche.jpg', 1080, 78],
  expBotanas: ['exp-botanas.jpg', 1080, 78],
  expLazarosHacienda: ['exp-lazaros-hacienda.jpg', 1080, 78],
  expCristalinoCantina: ['exp-cristalino-cantina.jpg', 1080, 78],
  expMercado: ['exp-mercado.jpg', 1080, 78],
  expAgaveAfterDark: ['exp-agave-after-dark.jpg', 1080, 78],
  // Animated collage walls (GIF -> animated WebP)
  motionAgaveReflection: ['exp-agave-reflection.gif', 720, 62, { animated: true }],
  motionCallesNoche: ['exp-calles-noche.gif', 720, 62, { animated: true }],
  motionCristalinoCantina: ['exp-cristalino-cantina.gif', 720, 62, { animated: true }],
  motionPaletteDecoder: ['exp-palette-decoder.gif', 720, 62, { animated: true }],
  // Category tiles (collage lettering)
  tileDrinks: ['category-drinks.png', 600, 82],
  tileFood: ['category-food.png', 600, 82],
  tileCulture: ['category-culture.png', 600, 82],
  tileMusic: ['category-music.png', 600, 82],
  tileTequila: ['category-tequila.png', 600, 82],
  tilePhotoPortal: ['category-photo-portal.png', 600, 82],
  tileShop: ['category-shop.png', 600, 82],
  tileEvents: ['category-events.png', 600, 82],
  // Illustrated section heroes
  heroDrinks: ['category-drinks.jpg', 1080, 78],
  heroFood: ['category-food.jpg', 1080, 78],
  heroCulture: ['category-culture.jpg', 1080, 78],
  heroMusic: ['category-music.jpg', 1080, 78],
  heroAgaveBloom: ['hero-banner.png', 1440, 76],
  posterFestival: ['hero-banner.jpg', 1080, 80],
  posterTown: ['festival-map.jpg', 1080, 80],
  experienceHero: ['experience-hero-bg.png', 1080, 76],
  passportCover: ['passport-hero.png', 1000, 80],
  passportWarehouse: ['passport-journey-bg.png', 1200, 74],
  passportStart: ['passport-start-journey-bg.jpg', 1200, 74],
  missionsHero: ['missions-bg.png', 1080, 78],
  missionComplete: ['mission-complete-scene.png', 1200, 76],
  missionFlower: ['mission-progress-flower.png', 600, 80],
  shopHero: ['shop-coming-soon-mobile-bg.png', 1080, 76],
  ticketSky: ['ticket-background.png', 1080, 76],
  ticketAgaveField: ['ticket-guest-info-bg.png', 800, 80],
  oracleMemoria: ['ai-portal-image-to-video-bg.jpg', 1200, 76],
  oracleCantinero: ['ai-portal-ai-bartender-bg.jpg', 1200, 76],
  oracleMesa: ['ai-portal-ai-chef-bg.jpg', 1200, 76],
  oracleOjo: ['agave-reference-2.jpg', 1200, 74],
  drinkBlanco: ['drink-blanco.jpg', 800, 80],
  drinkReposado: ['drink-reposado.jpg', 800, 80],
  drinkAnejo: ['drink-anejo.jpg', 800, 80],
  drinkMargarita: ['drink-margarita.jpg', 800, 80],
  // Textures, maps and illustrations (alpha preserved)
  paper: ['paper-texture.jpg', 1024, 70],
  parchment: ['experience-bg.png', 1200, 70],
  mapJourney: ['passport-journey-map.png', 1920, 86, { alpha: true }],
  mapVenue: ['festival-map.png', 1600, 86],
  iconAgave: ['icon-agave.png', 360, 86, { alpha: true }],
  iconAgaveFlower: ['icon-agave-flower.png', 360, 86, { alpha: true }],
  iconCactusFlower: ['icon-cactus-flower.png', 420, 86, { alpha: true }],
  stampFrame: ['passport-stamp.png', 600, 90, { alpha: true }],
  tvFrame: ['tv-frame.png', 1200, 86, { alpha: true }],
  woodFrame: ['wooden-frame.png', 900, 80],
  logo: ['tequila-town-logo.png', 600, 90, { alpha: true }],
};

const blurhashFor = async (buf) => {
  const { data, info } = await sharp(buf).raw().ensureAlpha().resize(32, 32, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
};

const registry = [];
let inBytes = 0;
let outBytes = 0;

for (const [key, [file, width, quality, opts = {}]] of Object.entries(PLAN)) {
  const input = fs.readFileSync(path.join(src, file));
  inBytes += input.length;
  const animated = !!opts.animated;
  let pipeline = sharp(input, { animated }).resize({ width, withoutEnlargement: true });
  pipeline = pipeline.webp({ quality, effort: 6, alphaQuality: 90, ...(animated ? { loop: 0 } : {}) });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const outName = `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}.webp`;
  fs.writeFileSync(path.join(outDir, outName), data);
  outBytes += data.length;
  const height = animated ? info.pageHeight ?? info.height : info.height;
  const hash = opts.alpha ? null : await blurhashFor(input);
  registry.push({ key, outName, width: info.width, height, blurhash: hash });
  console.log(`${key.padEnd(24)} ${String(Math.round(input.length / 1024)).padStart(6)}KB -> ${String(Math.round(data.length / 1024)).padStart(5)}KB  ${info.width}x${height}`);
}

// ---------------------------------------------------------------------------
// App icon, adaptive icon, splash, favicon — all derived from the circle logo.
// ---------------------------------------------------------------------------
const logo = fs.readFileSync(path.join(src, 'tequila-town-logo.png'));
const ORANGE = '#AD3A00';
const CREAM = '#F3E9D2';

// iOS / store icon: the logo circle is the same orange as the background, so the circle
// edge disappears and only the lettering reads — sized to ~70% width for the rounded mask.
const icon = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: ORANGE } })
  .composite([{ input: await sharp(logo).resize(1000, 1000).toBuffer(), left: 12, top: 12 }])
  .flatten({ background: ORANGE })
  .png()
  .toBuffer();
fs.writeFileSync(path.join(appIconDir, 'icon.png'), icon);

// Android adaptive foreground: lettering inside the 66% safe zone, transparent elsewhere.
const fgLogo = await sharp(logo).resize(820, 820).toBuffer();
const adaptiveFg = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fgLogo, left: 102, top: 102 }])
  .png()
  .toBuffer();
fs.writeFileSync(path.join(appIconDir, 'adaptive-foreground.png'), adaptiveFg);

// Monochrome (themed icons on Android 13+): white silhouette of the lettering.
const { data: rgba, info: rgbaInfo } = await sharp(adaptiveFg).raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < rgba.length; i += 4) {
  const [r, g, b, a] = [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
  const isLetter = a > 0 && r > 220 && g > 160 && b > 150; // blush pink letters
  rgba[i] = rgba[i + 1] = rgba[i + 2] = 255;
  rgba[i + 3] = isLetter ? 255 : 0;
}
fs.writeFileSync(
  path.join(appIconDir, 'adaptive-monochrome.png'),
  await sharp(rgba, { raw: { width: rgbaInfo.width, height: rgbaInfo.height, channels: 4 } }).png().toBuffer(),
);

fs.writeFileSync(path.join(appIconDir, 'splash-logo.png'), await sharp(logo).resize(600, 600).png().toBuffer());
fs.writeFileSync(path.join(appIconDir, 'favicon.png'), await sharp(logo).resize(96, 96).png().toBuffer());
console.log(`App icons written to ${path.relative(root, appIconDir)} (bg ${ORANGE}, splash bg ${CREAM})`);

// ---------------------------------------------------------------------------
// Typed registry
// ---------------------------------------------------------------------------
const lines = [
  '// AUTO-GENERATED by scripts/optimize-assets.mjs — do not edit by hand.',
  "import type { ImageSourcePropType } from 'react-native';",
  '',
  'export type ArtImage = { source: ImageSourcePropType; width: number; height: number; blurhash: string | null };',
  '',
  'export const art = {',
  ...registry.map(
    (r) =>
      `  ${r.key}: { source: require('../../assets/images/${r.outName}'), width: ${r.width}, height: ${r.height}, blurhash: ${r.blurhash ? JSON.stringify(r.blurhash) : 'null'} },`,
  ),
  '} satisfies Record<string, ArtImage>;',
  '',
  'export type ArtKey = keyof typeof art;',
  '',
];
fs.writeFileSync(registryFile, lines.join('\n'));
console.log(`\n${registry.length} images: ${(inBytes / 1048576).toFixed(1)}MB -> ${(outBytes / 1048576).toFixed(1)}MB`);
console.log(`Registry: ${path.relative(root, registryFile)}`);
