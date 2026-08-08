import { Platform, ViewStyle } from 'react-native';
import { s } from './metrics';

/**
 * Converts a CSS `box-shadow` into its RN equivalent.
 *
 * iOS gets the real offset/blur/opacity; Android only exposes `elevation`, so
 * each entry carries a hand-picked elevation matching the visual weight of the
 * CSS shadow it replaces.
 */
const shadow = (
  color: string,
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
  offsetX = 0,
): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: color,
      shadowOffset: { width: s(offsetX), height: s(offsetY) },
      // CSS blur radius ~= 2x the iOS shadowRadius
      shadowRadius: s(blur / 2),
      shadowOpacity: opacity,
    },
    android: { elevation, shadowColor: color },
    default: {},
  }) as ViewStyle;

export const shadows = {
  none: {} as ViewStyle,

  /** `.card { box-shadow:0 1px 3px rgba(15,23,42,0.05) }` */
  card: shadow('#0f172a', 1, 3, 0.05, 1),

  /** `box-shadow:0 1px 3px rgba(15,23,42,0.06)` — vehicle list cards */
  cardSoft: shadow('#0f172a', 1, 3, 0.06, 1),

  /** `box-shadow:0 1px 3px rgba(15,23,42,0.04)` — request-vehicle CTA */
  cardFaint: shadow('#0f172a', 1, 3, 0.04, 1),

  /** `box-shadow:0 8px 24px rgba(13,38,71,0.12)` — dashboard overlap card */
  elevatedCard: shadow('#0d2647', 8, 24, 0.12, 8),

  /** `box-shadow:0 10px 30px rgba(13,38,71,0.15)` — auth floating pane */
  authPane: shadow('#0d2647', 10, 30, 0.15, 10),

  /** `box-shadow:0 10px 28px rgba(13,38,71,0.25)` — login trust card */
  trustCard: shadow('#0d2647', 10, 28, 0.25, 10),

  /** `box-shadow:0 8px 24px rgba(13,38,71,0.2)` — OTP security note */
  securityNote: shadow('#0d2647', 8, 24, 0.2, 8),

  /** `box-shadow:0 6px 20px rgba(245,166,35,0.2)` — selected vehicle card */
  vehicleSelected: shadow('#f5a623', 6, 20, 0.2, 6),

  /** `box-shadow:0 3px 10px rgba(245,166,35,0.5)` — selected check disc */
  goldCheck: shadow('#f5a623', 3, 10, 0.5, 4),

  /** `box-shadow:0 2px 6px rgba(245,166,35,0.24)` — selected radio chip */
  goldChip: shadow('#f5a623', 2, 6, 0.24, 2),

  /** Small gold lift for action-sheet tiles. */
  goldSmall: shadow('#f5a623', 3, 8, 0.28, 3),

  /** `box-shadow:0 12px 30px rgba(0,0,0,0.35)` — splash logo card */
  splashLogo: shadow('#000000', 12, 30, 0.35, 14),

  /** `box-shadow:0 8px 22px rgba(0,0,0,0.28)` — login logo card */
  loginLogo: shadow('#000000', 8, 22, 0.28, 10),

  /** `box-shadow:0 8px 22px rgba(0,0,0,0.25)` — OTP verify badge */
  otpBadge: shadow('#000000', 8, 22, 0.25, 10),

  /** `box-shadow:0 4px 12px rgba(0,0,0,0.25)` — dashboard avatar */
  avatar: shadow('#000000', 4, 12, 0.25, 5),

  /** `box-shadow:0 4px 12px rgba(220,38,38,0.25)` — active OTP box */
  otpActive: shadow('#dc2626', 4, 12, 0.25, 4),

  /** `box-shadow:0 -8px 30px rgba(0,0,0,0.2)` — bottom sheet */
  bottomSheet: shadow('#000000', -8, 30, 0.2, 20),

  /** `box-shadow:0 2px 6px rgba(0,0,0,0.08)` — white circle in upload wells */
  subtle: shadow('#000000', 2, 6, 0.08, 2),

  /** `box-shadow:0 2px 4px rgba(0,0,0,0.2)` — switch knob */
  switchKnob: shadow('#000000', 2, 4, 0.2, 2),

  /** `box-shadow:0 4px 10px rgba(0,0,0,0.2)` — map markers */
  mapMarker: shadow('#000000', 4, 10, 0.2, 4),

  /** `box-shadow:0 6px 14px rgba(0,0,0,0.25)` — the live truck puck */
  mapPuck: shadow('#000000', 6, 14, 0.25, 6),
} as const;

export type Shadows = typeof shadows;
