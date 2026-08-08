/**
 * Colour tokens lifted verbatim from `customer-app.html`.
 *
 * The brand ramp below is the literal `tailwind.config` block from the file;
 * everything else appears in an inline style somewhere in the document.
 */
export const palette = {
  // Brand — navy
  navy: '#0d2647',
  navyMid: '#1a3a63',
  navyDark: '#081a33',
  navyTint: '#e6ecf3',

  // Brand — red
  red: '#dc2626',
  redSoft: '#fecaca',
  redTint: '#fff1f2',
  redDark: '#991b1b',

  // Brand — gold
  gold: '#f5a623',
  goldSoft: '#ffe0a3',
  goldTint: '#fff7e0',
  goldDark: '#c47f00',
  goldText: '#8a5a00',

  cream: '#f7f5f0',

  // Neutrals
  white: '#ffffff',
  black: '#000000',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  gray200: '#e5e7eb',

  // Surfaces / borders
  screenBg: '#f5f7fa',
  surfaceAlt: '#f7f9fc',
  border: '#eef2f7',
  divider: '#f0f2f5',

  // Splash scene
  skylineFar: '#081a33',
  skylineNear: '#0a1e3a',
  roadTop: '#050d1c',
  roadBottom: '#02060f',
  tyre: '#1a1a1a',
  tyreDark: '#0a0a0a',

  // Status / misc
  green: '#16a34a',
  sky: '#87ceeb',
  mapBg: '#f2f7ff',
  mapGrid: '#e8eef7',

  transparent: 'transparent',
} as const;

/** rgba() values used inline in the mock. */
export const alpha = {
  white08: 'rgba(255,255,255,0.08)',
  white10: 'rgba(255,255,255,0.1)',
  white12: 'rgba(255,255,255,0.12)',
  white14: 'rgba(255,255,255,0.14)',
  white15: 'rgba(255,255,255,0.15)',
  white20: 'rgba(255,255,255,0.2)',
  white25: 'rgba(255,255,255,0.25)',
  white30: 'rgba(255,255,255,0.3)',
  white55: 'rgba(255,255,255,0.55)',
  white60: 'rgba(255,255,255,0.6)',
  white70: 'rgba(255,255,255,0.7)',
  white75: 'rgba(255,255,255,0.75)',

  gold15: 'rgba(245,166,35,0.15)',
  gold18: 'rgba(245,166,35,0.18)',
  gold20: 'rgba(245,166,35,0.2)',
  gold25: 'rgba(245,166,35,0.25)',
  gold35: 'rgba(245,166,35,0.35)',
  gold40: 'rgba(245,166,35,0.4)',

  red15: 'rgba(220,38,38,0.15)',
  red20: 'rgba(220,38,38,0.2)',
  red25: 'rgba(220,38,38,0.25)',
  red40: 'rgba(220,38,38,0.4)',
  red45: 'rgba(220,38,38,0.45)',
  red90: 'rgba(220,38,38,0.9)',

  navy06: 'rgba(13,38,71,0.06)',
  navy08: 'rgba(13,38,71,0.08)',
  navy12: 'rgba(13,38,71,0.12)',
  navy15: 'rgba(13,38,71,0.15)',
  navy20: 'rgba(13,38,71,0.2)',
  navy25: 'rgba(13,38,71,0.25)',

  scrim: 'rgba(0,0,0,0.55)',
} as const;

export type ColorScheme = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceNavy: string;
  surfaceGold: string;
  surfaceRed: string;
  border: string;
  borderStrong: string;
  divider: string;
  text: string;
  textMuted: string;
  textFaint: string;
  textOnBrand: string;
  textGold: string;
  primary: string;
  primaryMid: string;
  primaryDark: string;
  accent: string;
  accentDark: string;
  danger: string;
  success: string;
  headerBg: string;
  tabBarBg: string;
  tabInactive: string;
  tabActive: string;
};

/** Light palette — this IS the HTML, hex for hex. */
export const lightColors: ColorScheme = {
  background: palette.screenBg,
  surface: palette.white,
  surfaceAlt: palette.surfaceAlt,
  surfaceNavy: palette.navyTint,
  surfaceGold: palette.goldTint,
  surfaceRed: palette.redTint,
  border: palette.border,
  borderStrong: palette.gray200,
  divider: palette.divider,
  text: palette.navy,
  textMuted: palette.slate500,
  textFaint: palette.slate400,
  textOnBrand: palette.white,
  textGold: palette.goldText,
  primary: palette.navy,
  primaryMid: palette.navyMid,
  primaryDark: palette.navyDark,
  accent: palette.gold,
  accentDark: palette.goldDark,
  danger: palette.red,
  success: palette.green,
  headerBg: palette.navy,
  tabBarBg: palette.white,
  tabInactive: palette.slate400,
  tabActive: palette.navy,
};

/** Dark counterpart — brand hues preserved, only neutrals invert. */
export const darkColors: ColorScheme = {
  background: '#0b1523',
  surface: '#121f33',
  surfaceAlt: '#0f1b2d',
  surfaceNavy: '#16283f',
  surfaceGold: '#2a2113',
  surfaceRed: '#2a1517',
  border: '#1d2c42',
  borderStrong: '#26374f',
  divider: '#1a2839',
  text: '#e8eef7',
  textMuted: '#93a4bd',
  textFaint: '#6b7d97',
  textOnBrand: palette.white,
  textGold: palette.goldSoft,
  primary: palette.navy,
  primaryMid: palette.navyMid,
  primaryDark: palette.navyDark,
  accent: palette.gold,
  accentDark: palette.goldDark,
  danger: palette.red,
  success: palette.green,
  headerBg: palette.navy,
  tabBarBg: '#101c2e',
  tabInactive: '#6b7d97',
  tabActive: palette.gold,
};

/** Gradient stop pairs that recur in the mock. */
export const gradients = {
  /** `linear-gradient(135deg,#0d2647,#1a3a63)` — hero cards */
  navyHero: [palette.navy, palette.navyMid] as const,
  /** `linear-gradient(180deg,#0d2647 0%,#081a33 100%)` — splash */
  navySplash: [palette.navy, palette.navyDark] as const,
  /** `linear-gradient(150deg,#0d2647 0%,#1a3a63 55%,#0d2647 100%)` — auth hero */
  navyAuth: [palette.navy, palette.navyMid, palette.navy] as const,
  /** `linear-gradient(135deg,#f5a623,#c47f00)` — gold avatars/discs */
  gold: [palette.gold, palette.goldDark] as const,
  /** `linear-gradient(135deg,#dc2626,#991b1b)` — OTP shield tile */
  red: [palette.red, palette.redDark] as const,
  /** `linear-gradient(90deg,#dc2626,#f5a623)` — progress bars */
  progress: [palette.red, palette.gold] as const,
  /** `linear-gradient(135deg,#e6ecf3 0%,#f7f9fc 100%)` — empty-state tile */
  emptyTile: [palette.navyTint, palette.surfaceAlt] as const,
  /** `linear-gradient(135deg,#f7f9fc,#e6ecf3)` — vehicle thumbnail well */
  vehicleThumb: [palette.surfaceAlt, palette.navyTint] as const,
  /** `linear-gradient(135deg,#fff7e0,#fff)` — selected vehicle card */
  vehicleSelected: [palette.goldTint, palette.white] as const,
  /** `linear-gradient(135deg,#fff,#fff7e0)` — selected vehicle thumb well */
  vehicleSelectedThumb: [palette.white, palette.goldTint] as const,
  /** `linear-gradient(135deg,#fff7e0,#ffe0a3)` — request-vehicle CTA tile */
  goldSoftTile: [palette.goldTint, palette.goldSoft] as const,
  /** `linear-gradient(180deg,#050d1c 0%,#02060f 100%)` — splash road */
  road: [palette.roadTop, palette.roadBottom] as const,
} as const;
