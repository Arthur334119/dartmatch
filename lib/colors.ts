import type { ViewStyle, TextStyle } from 'react-native';

export const colors = {
  primary: '#E8852B',
  primaryDeep: '#B45F0F',
  primarySoft: '#FFE7CC',
  secondary: '#1F6F8B',
  secondarySoft: '#D5ECF2',
  accent: '#F7B538',

  background: '#FBF7F2',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  surfaceMuted: '#F2EDE5',

  backgroundDark: '#15110D',
  surfaceDark: '#1F1A14',
  cardDark: '#28221A',
  surfaceMutedDark: '#2E2820',

  text: '#1A1410',
  textOnDark: '#F7F1E8',
  textMuted: '#857B70',
  textMutedDark: '#A89E91',

  success: '#3FA558',
  error: '#D6432B',
  warning: '#F0A91B',

  divider: '#ECE4D7',
  dividerDark: '#3A3328',

  scrim: 'rgba(20, 14, 8, 0.55)',
  overlay: 'rgba(0, 0, 0, 0.45)',
} as const;

export type ColorScheme = 'light' | 'dark';

export type Palette = {
  scheme: ColorScheme;
  bg: string;
  surface: string;
  surfaceMuted: string;
  card: string;
  text: string;
  textMuted: string;
  divider: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  secondary: string;
  secondarySoft: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  scrim: string;
  overlay: string;
};

export function palette(scheme: ColorScheme): Palette {
  const dark = scheme === 'dark';
  return {
    scheme,
    bg: dark ? colors.backgroundDark : colors.background,
    surface: dark ? colors.surfaceDark : colors.surface,
    surfaceMuted: dark ? colors.surfaceMutedDark : colors.surfaceMuted,
    card: dark ? colors.cardDark : colors.card,
    text: dark ? colors.textOnDark : colors.text,
    textMuted: dark ? colors.textMutedDark : colors.textMuted,
    divider: dark ? colors.dividerDark : colors.divider,
    primary: colors.primary,
    primaryDeep: colors.primaryDeep,
    primarySoft: dark ? '#3A2613' : colors.primarySoft,
    secondary: colors.secondary,
    secondarySoft: dark ? '#13313A' : colors.secondarySoft,
    accent: colors.accent,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    scrim: colors.scrim,
    overlay: colors.overlay,
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '900', letterSpacing: -0.6 } satisfies TextStyle,
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 } satisfies TextStyle,
  h2: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2 } satisfies TextStyle,
  h3: { fontSize: 17, fontWeight: '700' } satisfies TextStyle,
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 } satisfies TextStyle,
  bodyStrong: { fontSize: 15, fontWeight: '600' } satisfies TextStyle,
  small: { fontSize: 13, fontWeight: '500' } satisfies TextStyle,
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' } satisfies TextStyle,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } satisfies ViewStyle,
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } satisfies ViewStyle,
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } satisfies ViewStyle,
  brand: {
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  } satisfies ViewStyle,
} as const;

export function alpha(hex: string, a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  const value = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return hex + value;
}
