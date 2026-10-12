/**
 * The Mercado shop. Purchases are reserve-and-pay-at-pickup (no in-app payment):
 *  - `reserve`  → added to the bag, reserved for pickup at the Mercado with a pickup code
 *  - `request`  → one-of-one pieces: a consultation request the artisans follow up on
 *  - `waitlist` → bottles not yet released: notify-me list
 */
export type ShopSection = 'merch' | 'goods' | 'bespoke' | 'bottles';
export type ShopAction = 'reserve' | 'request' | 'waitlist';

export const shopSections: { id: ShopSection; name: string; description: string }[] = [
  { id: 'merch', name: 'Merch', description: 'Branded apparel & identity' },
  { id: 'goods', name: 'Goods', description: 'Lifestyle & barware' },
  { id: 'bespoke', name: 'Bespoke', description: 'One-of-one & limited editions' },
  { id: 'bottles', name: 'Bottles', description: 'The festival collection' },
];

export type ShopProduct = {
  id: string;
  name: string;
  price: number;
  section: ShopSection;
  action: ShopAction;
  image: string;
  description: string;
  story?: string;
  limit: number;
  sizes?: string[];
  badge?: 'Limited' | 'One of one' | 'Coming soon';
};

export const shopProducts: ShopProduct[] = [
  { id: 'merch-tee', name: 'Tequila Town Tee', price: 35, section: 'merch', action: 'reserve', image: 'expAgaveReflection', description: 'Heavyweight festival tee with the stencil wordmark.', limit: 4, sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'merch-hoodie', name: 'Festival Hoodie', price: 65, section: 'merch', action: 'reserve', image: 'expLaCava', description: 'Brushed-fleece hoodie with an embroidered logo.', limit: 2, sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'merch-cap', name: 'Agave Cap', price: 30, section: 'merch', action: 'reserve', image: 'expEspirituTrain', description: 'Adjustable snapback with a woven patch.', limit: 3 },
  { id: 'merch-tank', name: 'Festival Tank', price: 28, section: 'merch', action: 'reserve', image: 'expLaRojena', description: 'Lightweight tank for long days in the sun.', limit: 3, sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'goods-caballitos', name: 'Caballito Set', price: 45, section: 'goods', action: 'reserve', image: 'expCristalinoCantina', description: 'Four traditional caballito glasses.', limit: 2 },
  { id: 'goods-tote', name: 'Agave Tote', price: 25, section: 'goods', action: 'reserve', image: 'expMercado', description: 'Heavy canvas tote with an agave print.', limit: 3 },
  { id: 'goods-poster', name: 'Festival Poster', price: 20, section: 'goods', action: 'reserve', image: 'posterFestival', description: 'Limited-edition 18 by 24 inch art print.', limit: 2, badge: 'Limited' },
  { id: 'goods-jigger', name: 'Copper Jigger', price: 38, section: 'goods', action: 'reserve', image: 'expBotanas', description: 'Dual-sided jigger in a copper finish.', limit: 2 },
  { id: 'goods-salt', name: 'Salt Shot Glasses', price: 32, section: 'goods', action: 'reserve', image: 'expPaletteDecoder', description: 'Set of four pink Himalayan salt shooters.', limit: 2 },
  {
    id: 'bespoke-jacket',
    name: 'Hand-Painted Agave Jacket',
    price: 450,
    section: 'bespoke',
    action: 'request',
    image: 'expBarrelGallery',
    description: 'One-of-a-kind denim jacket with hand-painted agave art.',
    story: 'Each jacket is painted by Jalisco artists over 40+ hours. No two pieces are alike. Wearable art celebrating the heritage of tequila making.',
    limit: 1,
    badge: 'One of one',
  },
  {
    id: 'bespoke-folio',
    name: 'Artisan Leather Folio',
    price: 320,
    section: 'bespoke',
    action: 'request',
    image: 'expLazarosHacienda',
    description: 'Hand-tooled leather folio with agave embossing.',
    story: 'Crafted by master leatherworkers using techniques passed down through generations, with aged brass hardware. Limited to 25 pieces.',
    limit: 1,
    badge: 'Limited',
  },
  {
    id: 'bespoke-still',
    name: "Collector's Copper Still",
    price: 1200,
    section: 'bespoke',
    action: 'request',
    image: 'expLaCava',
    description: 'Museum-quality 1:8 copper alembic still.',
    story: 'Handmade by third-generation coppersmiths from Tequila, Jalisco. A conversation piece and a testament to the craft.',
    limit: 1,
    badge: 'Limited',
  },
  {
    id: 'bottle-blanco',
    name: 'Reserve Blanco',
    price: 85,
    section: 'bottles',
    action: 'waitlist',
    image: 'drinkBlanco',
    description: 'Festival-edition unaged tequila.',
    story: 'Crystal clear with bright agave notes, made exclusively for Tequila Town from 100% blue Weber agave harvested at peak maturity.',
    limit: 1,
    badge: 'Coming soon',
  },
  {
    id: 'bottle-reposado',
    name: 'Festival Reposado',
    price: 120,
    section: 'bottles',
    action: 'waitlist',
    image: 'drinkReposado',
    description: 'Limited release, eight months in oak.',
    story: 'Rested in American white oak for eight months, with notes of vanilla, caramel and soft oak. Only 500 bottles produced.',
    limit: 1,
    badge: 'Coming soon',
  },
  {
    id: 'bottle-anejo',
    name: 'Añejo Especial',
    price: 180,
    section: 'bottles',
    action: 'waitlist',
    image: 'drinkAnejo',
    description: 'Eighteen months in charred oak.',
    story: 'Dark chocolate, dried fruit and toasted agave. A sipping añejo for the collection.',
    limit: 1,
    badge: 'Coming soon',
  },
];

export const productById = (id: string) => shopProducts.find((p) => p.id === id);
