import { Platform, TextStyle } from 'react-native';
import { fs } from './metrics';

/**
 * `customer-app.html` loads Plus Jakarta Sans at weights 400/500/600/700/800:
 *   font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
 *
 * Android cannot synthesise weights, so each maps to its own PostScript family.
 * TTFs live in `src/assets/fonts` and link via `react-native.config.js`.
 */
export const fontFamily = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semiBold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extraBold: 'PlusJakartaSans-ExtraBold',
} as const;

/** CSS `font-weight` -> bundled family. */
export const weight = {
  '400': fontFamily.regular,
  '500': fontFamily.medium,
  '600': fontFamily.semiBold,
  '700': fontFamily.bold,
  '800': fontFamily.extraBold,
} as const;

export type FontWeightKey = keyof typeof weight;

/**
 * Builds a text style from raw CSS values in the mock.
 *
 * @param size   CSS `font-size` in design px
 * @param w      CSS `font-weight`
 * @param extras `letter-spacing`, `line-height` (unitless multiplier), `color`
 */
export const font = (
  size: number,
  w: FontWeightKey = '400',
  extras?: { letterSpacing?: number; lineHeight?: number; color?: string },
): TextStyle => {
  // Built in one expression rather than assigned into: React Native 0.87 types
  // `TextStyle` as `Readonly`, so filling the object in afterwards no longer
  // compiles. Spreading `null` contributes nothing, which keeps each entry
  // absent — not present-and-undefined — exactly as the assignments did.
  return {
    fontFamily: weight[w],
    fontSize: fs(size),
    // Android adds extra leading; removing it makes the text box match the CSS box.
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    ...(extras?.letterSpacing !== undefined
      ? { letterSpacing: fs(extras.letterSpacing) }
      : null),
    ...(extras?.lineHeight !== undefined
      ? { lineHeight: fs(size * extras.lineHeight) }
      : null),
    ...(extras?.color ? { color: extras.color } : null),
  };
};

/**
 * Named type ramp — each entry is a rule that recurs in `customer-app.html`.
 */
export const typography = {
  /** OTP headline — 20px/800 */
  h1: font(20, '800', { letterSpacing: -0.4, lineHeight: 1.15 }),
  /** Login headline — 18px/800 */
  h2: font(18, '800', { letterSpacing: -0.4, lineHeight: 1.15 }),
  /** Home greeting name — 15px/800 */
  h3: font(15, '800', { lineHeight: 1.1 }),
  /** Vehicle name / empty-state title — 14px/800 */
  h4: font(14, '800'),

  /** `.app-hdr .title` — 13px/700 */
  headerTitle: font(13, '700'),
  /** `.app-hdr .sub` — 9px, opacity .85 */
  headerSub: font(9, '400'),
  /** `.btn-primary` / `.btn-red` / `.btn-outline` — 13px/700 */
  buttonLabel: font(13, '700'),
  /** `.btn-gold` — 13px/800 */
  buttonLabelBold: font(13, '800'),

  /** Hero card titles — 13px/800 */
  heroTitle: font(13, '800'),
  /** Card titles — 12px/800 */
  cardTitle: font(12, '800'),
  /** `.field` text — 12px/400 */
  fieldText: font(12, '400'),
  /** Row titles — 11px/800 */
  rowTitle: font(11, '800'),
  /** `.route .addr` — 11px/600 */
  address: font(11, '600', { lineHeight: 1.3 }),
  /** `.f7b-input` — 11px/600 */
  input: font(11, '600'),
  /** Section heading (`Services`) — 11px/800 */
  sectionTitle: font(11, '800'),

  /** Body / secondary — 10px/400 */
  body: font(10, '400', { lineHeight: 1.4 }),
  /** `.field-lbl` — 10px/700 */
  fieldLabel: font(10, '700'),
  /** `.tab span` — 10px/600 */
  tabLabel: font(10, '600'),
  /** `.tab.on span` — 10px/800 */
  tabLabelActive: font(10, '800'),

  /** Uppercase field labels — 9px/800 */
  inputLabel: font(9, '800'),
  /** Red section eyebrows — 9px/800 + 1px tracking */
  sectionLabel: font(9, '800', { letterSpacing: 1 }),
  /** Caption / helper — 9px/600 */
  caption: font(9, '600'),
  /** Meta — 9px/700 */
  meta: font(9, '700'),
  /** `.pill` — 9px/700 uppercase + 0.03em tracking */
  pill: font(9, '700', { letterSpacing: 0.27 }),

  /** Micro labels (`ACTIVE`, `DELIVERED`) — 8px/800 + 0.5px tracking */
  microLabel: font(8, '800', { letterSpacing: 0.5 }),
  /** Hero eyebrows — 8px/800 + 1.5px tracking */
  heroEyebrow: font(8, '800', { letterSpacing: 1.5 }),
  /** `.route .lbl` — 8px/700 uppercase */
  routeLabel: font(8, '700', { letterSpacing: 0.24 }),

  /** Smallest captions — 7px/700 + 1px tracking */
  nano: font(7, '700', { letterSpacing: 1 }),
} as const;

export type Typography = typeof typography;
