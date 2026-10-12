export type DrinkCategory = 'blanco' | 'reposado' | 'anejo' | 'extra_anejo' | 'cristalino' | 'cocktail';

export const drinkCategories: { id: DrinkCategory; label: string; blurb: string; color: string }[] = [
  { id: 'blanco', label: 'Blanco', blurb: 'Unaged. Bright agave, citrus, pepper.', color: '#9DB8A0' },
  { id: 'reposado', label: 'Reposado', blurb: 'Rested 2 to 12 months in oak. Vanilla, caramel.', color: '#D9A441' },
  { id: 'anejo', label: 'Añejo', blurb: 'Aged 1 to 3 years. Honey, chocolate, dried fruit.', color: '#A8621E' },
  { id: 'extra_anejo', label: 'Extra Añejo', blurb: 'Aged 3+ years. Deep oak, tobacco, toffee.', color: '#6B3A1E' },
  { id: 'cristalino', label: 'Cristalino', blurb: 'Aged, then charcoal-filtered to clarity.', color: '#8FB7C6' },
  { id: 'cocktail', label: 'Cocktails', blurb: 'The house pours of Tequila Town.', color: '#E07A1F' },
];

export type Drink = {
  id: string;
  name: string;
  brand: string;
  category: DrinkCategory;
  description: string;
  tastingNotes: string[];
  abv: number;
  price: 1 | 2 | 3 | 4 | 5;
  image: string;
  whereToTry: string[];
  rating: number;
};

export const drinks: Drink[] = [
  {
    id: 'cuervo-blanco',
    name: 'Tradicional Blanco',
    brand: 'Jose Cuervo',
    category: 'blanco',
    description: 'The original silver tequila, pure and unaged with bright agave flavors.',
    tastingNotes: ['Citrus', 'Pepper', 'Fresh Agave', 'Mineral'],
    abv: 40,
    price: 2,
    image: 'drinkBlanco',
    whereToTry: ['la-rojena', 'cristalino-cantina'],
    rating: 4.2,
  },
  {
    id: 'casamigos-blanco',
    name: 'Casamigos Blanco',
    brand: 'Casamigos',
    category: 'blanco',
    description: 'Ultra-smooth blanco with sweet agave and hints of citrus and vanilla.',
    tastingNotes: ['Sweet Agave', 'Citrus', 'Vanilla', 'Mint'],
    abv: 40,
    price: 3,
    image: 'drinkBlanco',
    whereToTry: ['agave-after-dark', 'botanas'],
    rating: 4.4,
  },
  {
    id: 'herradura-reposado',
    name: 'Herradura Reposado',
    brand: 'Herradura',
    category: 'reposado',
    description: 'Rested 11 months in American white oak for a smooth, balanced character.',
    tastingNotes: ['Vanilla', 'Caramel', 'Cooked Agave', 'Oak'],
    abv: 40,
    price: 3,
    image: 'drinkReposado',
    whereToTry: ['barrel-gallery', 'la-cava'],
    rating: 4.5,
  },
  {
    id: '1800-reposado',
    name: '1800 Reposado',
    brand: '1800 Tequila',
    category: 'reposado',
    description: 'Double-distilled and aged six months for a smooth, versatile spirit.',
    tastingNotes: ['Buttery', 'Spice', 'Oak', 'Agave'],
    abv: 40,
    price: 2,
    image: 'drinkReposado',
    whereToTry: ['espiritu-express', 'mercado'],
    rating: 4.3,
  },
  {
    id: 'don-julio-anejo',
    name: 'Don Julio Añejo',
    brand: 'Don Julio',
    category: 'anejo',
    description: 'Aged 18 months for rich, complex flavors with hints of wild honey and vanilla.',
    tastingNotes: ['Honey', 'Butterscotch', 'Chocolate', 'Dried Fruit'],
    abv: 40,
    price: 4,
    image: 'drinkAnejo',
    whereToTry: ['palette-decoder', 'la-cava'],
    rating: 4.8,
  },
  {
    id: 'patron-extra-anejo',
    name: 'Patrón Extra Añejo',
    brand: 'Patrón',
    category: 'extra_anejo',
    description: 'Ultra-premium tequila aged over three years for exceptional depth and complexity.',
    tastingNotes: ['Oak', 'Dried Fruit', 'Tobacco', 'Caramel'],
    abv: 40,
    price: 5,
    image: 'drinkAnejo',
    whereToTry: ['calles-de-noche', 'la-cava'],
    rating: 4.9,
  },
  {
    id: 'dobel-diamante',
    name: 'Dobel Diamante',
    brand: 'Dobel',
    category: 'cristalino',
    description: 'Añejo filtered to crystal clarity while keeping its smooth aged character.',
    tastingNotes: ['Vanilla', 'Cooked Agave', 'Butter', 'White Pepper'],
    abv: 40,
    price: 4,
    image: 'drinkBlanco',
    whereToTry: ['cristalino-cantina'],
    rating: 4.6,
  },
  {
    id: 'classic-margarita',
    name: 'Classic Margarita',
    brand: 'Tequila Town House',
    category: 'cocktail',
    description: 'The icon: premium blanco, fresh lime and agave nectar, salted rim.',
    tastingNotes: ['Citrus', 'Salt', 'Sweet', 'Refreshing'],
    abv: 15,
    price: 2,
    image: 'drinkMargarita',
    whereToTry: ['mercado', 'agave-after-dark'],
    rating: 4.7,
  },
];

export const drinkById = (id: string) => drinks.find((d) => d.id === id);
