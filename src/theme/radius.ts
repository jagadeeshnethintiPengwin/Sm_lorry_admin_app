import { s } from './metrics';

/** Border radii. Every value occurs literally in `customer-app.html`. */
export const radius = {
  none: 0,
  /** progress bars, road markings */
  xxs: s(2),
  /** flag swatch, small chips */
  xs: s(4),
  /** `.pill-*` small tags, thumbnails */
  sm: s(6),
  /** `.field`, `.f7b-input`, icon wells */
  md: s(8),
  /** `.btn-*`, service tiles, status chips */
  lg: s(10),
  /** `.card`, vehicle cards */
  card: s(12),
  /** `.pill` */
  pill: s(12),
  /** hero cards, service grid */
  xl: s(14),
  /** OTP shield tile, login stat card */
  xxl: s(16),
  /** OTP floating card */
  xxxl: s(18),
  /** splash logo card, login pane */
  x20: s(20),
  /** bottom sheet top corners */
  sheet: s(24),
  /** auth header bottom curve */
  authHeader: s(30),
  /** `.screen` */
  screen: s(41),
  full: 9999,
} as const;
