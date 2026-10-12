/** Food, culture and music programming (from the MVP's festival pages). */
export type ProgramItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  experienceId: string;
  image: string;
  tag?: string;
  featured?: boolean;
};

export const food: ProgramItem[] = [
  { id: 'f1', title: 'Tacos al Pastor', description: 'Marinated pork with pineapple on hand-pressed corn tortillas.', time: 'All day', experienceId: 'botanas', image: 'expBotanas', tag: 'Street' },
  { id: 'f2', title: 'Guacamole Trio', description: 'Three styles of fresh guacamole with warm totopos.', time: 'All day', experienceId: 'mercado', image: 'expMercado', tag: 'Shareable' },
  { id: 'f3', title: 'Elote', description: 'Street corn with crema, cotija and tajín.', time: 'From 5 PM', experienceId: 'calles-de-noche', image: 'expCallesNoche', tag: 'Street' },
  { id: 'f4', title: 'Quesabirria', description: 'Birria-stuffed quesadillas with a cup of consommé.', time: 'All day', experienceId: 'lazaros-hacienda', image: 'expLazarosHacienda', tag: 'Signature' },
  { id: 'f5', title: 'Churros', description: 'Crisp churros with a dark chocolate dip.', time: 'All day', experienceId: 'mercado', image: 'expMercado', tag: 'Sweet' },
  { id: 'f6', title: 'Ceviche Tostada', description: 'Lime-cured fish on a crisp tostada.', time: 'All day', experienceId: 'botanas', image: 'expBotanas', tag: 'Fresh' },
];

export const culture: ProgramItem[] = [
  { id: 'c1', title: 'Tequila History', description: '250 years of heritage, told in the distillery.', time: '1:00 PM', experienceId: 'la-rojena', image: 'expLaRojena' },
  { id: 'c2', title: 'Jimador Demo', description: 'Watch master jimadors harvest agave with the coa.', time: '2:00 PM', experienceId: 'agave-reflection', image: 'expAgaveReflection', featured: true },
  { id: 'c3', title: 'Artisan Workshop', description: 'Paint your own ceramic caballito.', time: '3:30 PM', experienceId: 'mercado', image: 'expMercado' },
  { id: 'c4', title: 'Folklórico', description: 'Traditional Mexican dance under the papel picado.', time: '5:00 PM', experienceId: 'calles-de-noche', image: 'expCallesNoche', featured: true },
  { id: 'c5', title: 'Barrel Art Exhibition', description: 'Contemporary Mexican art on retired barrels.', time: 'All day', experienceId: 'barrel-gallery', image: 'expBarrelGallery' },
];

export const music: ProgramItem[] = [
  { id: 'm1', title: 'Mariachi Tradicional', description: 'Trumpets, violins and guitarrón to open the day.', time: '2:00 PM', experienceId: 'lazaros-hacienda', image: 'expLazarosHacienda', tag: 'Traditional', featured: true },
  { id: 'm2', title: 'Acoustic Sessions', description: 'Intimate sets in the candlelit vault.', time: '3:00 PM', experienceId: 'la-cava', image: 'expLaCava', tag: 'Acoustic' },
  { id: 'm3', title: 'Banda Sinaloense', description: 'Brass-heavy banda on the main stage.', time: '4:00 PM', experienceId: 'agave-after-dark', image: 'expCallesNoche', tag: 'Banda' },
  { id: 'm4', title: 'Cumbia Collective', description: 'Cumbia to keep the Mercado moving.', time: '6:00 PM', experienceId: 'mercado', image: 'expMercado', tag: 'Cumbia' },
  { id: 'm5', title: 'Sunset DJ Set', description: 'Golden-hour house in the cantina.', time: '7:00 PM', experienceId: 'cristalino-cantina', image: 'expCristalinoCantina', tag: 'House', featured: true },
  { id: 'm6', title: 'DJ Agave', description: 'Headline set. Drink to remember.', time: '8:00 PM', experienceId: 'agave-after-dark', image: 'expAgaveAfterDark', tag: 'Electronic', featured: true },
];
