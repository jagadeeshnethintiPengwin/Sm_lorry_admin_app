import { s, vs } from './metrics';

/**
 * Spacing scale. The mock uses a dense, hand-tuned rhythm rather than a strict
 * 4pt grid, so every value that actually occurs in `customer-app.html` is named
 * here instead of rounded to the nearest step.
 */
export const spacing = {
  none: 0,
  xxxs: s(1),
  xxs: s(2),
  xs: s(3),
  sm: s(4),
  smd: s(5),
  md: s(6),
  lg: s(8),
  xl: s(9),
  xxl: s(10),
  xxxl: s(12),
  x14: s(14),
  x16: s(16),
  x18: s(18),
  x20: s(20),
  x22: s(22),
  x24: s(24),
  x30: s(30),
  x40: s(40),
  x46: s(46),
  x52: s(52),
  x60: s(60),
} as const;

/** Vertical rhythm for values that should track viewport height. */
export const vSpacing = {
  xs: vs(4),
  sm: vs(8),
  md: vs(12),
  lg: vs(16),
  xl: vs(20),
  xxl: vs(24),
  xxxl: vs(40),
} as const;

/** Recurring layout constants pulled straight from the stylesheet. */
export const layout = {
  /** `.status-bar { height:44px }` */
  statusBarHeight: vs(44),
  /** `.app-hdr { padding:52px 14px 14px }` */
  headerPaddingTop: vs(52),
  headerPaddingH: s(14),
  headerPaddingBottom: s(14),
  /** `.tabs { height:62px }` */
  tabBarHeight: vs(62),
  /** `.content { padding:12px }` */
  contentPadding: s(12),
  /** Sticky footers: `padding:12px 14px 14px` */
  footerPaddingTop: s(12),
  footerPaddingH: s(14),
  footerPaddingBottom: s(14),
  /** `.app-hdr .back / .ico / .brand-mini { 28px }` */
  headerIconSize: s(28),
  /** `.map { height:200px }` */
  mapHeight: s(200),
} as const;
