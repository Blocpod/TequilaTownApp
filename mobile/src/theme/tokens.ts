/**
 * Tequila Town design tokens.
 * Visual language: vintage letterpress + Mexican folk collage. Cream paper, ink linework,
 * hard offset "print" shadows, terracotta & blush from the logo, agave greens, festival sky.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  ink: '#2B1A10',
  inkSoft: '#5A4334',
  inkMuted: '#8A7262',
  inkFaint: 'rgba(43,26,16,0.12)',

  paper: '#F3E9D2',
  paperDeep: '#E8DABB',
  card: '#FBF6EA',
  cardWarm: '#F7EAD3',

  terracotta: '#AD3A00',
  terracottaBright: '#D2541A',
  blush: '#FCC8BA',
  blushDeep: '#F4A792',
  sun: '#F2A541',
  marigold: '#E8921C',
  agave: '#4F7A5E',
  agaveDeep: '#2F4F3A',
  agaveMist: '#B9CDBE',
  sky: '#4AA7C5',
  skyDeep: '#2C7A96',
  cristal: '#BFE0EA',
  gold: '#C9A227',

  night: '#120E0C',
  nightCard: '#1F1814',
  nightLine: 'rgba(252,200,186,0.16)',
  moon: '#F3E9D2',

  danger: '#B3261E',
  white: '#FFFFFF',
  black: '#000000',
  scrim: 'rgba(18,14,12,0.55)',
} as const;

export const fonts = {
  display: 'TequilaTown',
  serif: 'Fraunces_600SemiBold',
  serifRegular: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifBoldItalic: 'Fraunces_600SemiBold_Italic',
  serifBlack: 'Fraunces_800ExtraBold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radii = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

/** Page gutter used everywhere so edges line up across screens. */
export const gutter = 20;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 52, lineHeight: 52, letterSpacing: 1, color: colors.ink },
  display: { fontFamily: fonts.display, fontSize: 38, lineHeight: 40, letterSpacing: 0.8, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, letterSpacing: 0.6, color: colors.ink },
  heading: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 28, color: colors.ink },
  subheading: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 24, color: colors.ink },
  lede: { fontFamily: fonts.serifItalic, fontSize: 17, lineHeight: 25, color: colors.inkSoft },
  body: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 23, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.sansSemiBold, fontSize: 15.5, lineHeight: 23, color: colors.ink },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  label: { fontFamily: fonts.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.inkMuted },
  stencilLabel: { fontFamily: fonts.display, fontSize: 15, lineHeight: 17, letterSpacing: 1.2, color: colors.ink },
  number: { fontFamily: fonts.serifBlack, fontSize: 30, lineHeight: 34, color: colors.ink },
} satisfies Record<string, TextStyle>;

/** Hard, offset "letterpress" shadow — the signature card treatment. */
export function printShadow(offset = 4, color: string = colors.ink): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `${offset}px ${offset}px 0 ${color}` } as ViewStyle,
    default: {
      shadowColor: color,
      shadowOffset: { width: offset, height: offset },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    },
  })!;
}

/** Soft ambient shadow for floating elements (tab bar, sheets). */
export function softShadow(radius = 18, opacity = 0.18): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 8px ${radius * 1.4}px rgba(43,26,16,${opacity})` } as ViewStyle,
    default: {
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation: 8,
    },
  })!;
}

export const border = { width: 1.5, color: colors.ink } as const;

export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 140, mass: 1 },
  springBouncy: { damping: 11, stiffness: 180, mass: 0.8 },
  stagger: 55,
} as const;
