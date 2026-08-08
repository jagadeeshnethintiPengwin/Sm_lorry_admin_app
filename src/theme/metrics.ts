import { Dimensions, PixelRatio, StyleSheet } from 'react-native';
import {
  widthPercentageToDP,
  heightPercentageToDP,
} from 'react-native-responsive-screen';

/**
 * `customer-app.html` authors every screen inside a `.phone > .screen` box of
 * exactly 310 x 640 CSS pixels. Every dimension in this codebase is lifted
 * verbatim from that mock-up and converted through the helpers below, so the
 * rendered output keeps identical proportions on any device.
 *
 * The conversion is expressed through `react-native-responsive-screen`:
 * a value of `x` design-px is `x / 310` of the screen width, i.e.
 * `widthPercentageToDP((x / 310) * 100)`.
 */
export const DESIGN_WIDTH = 310;
export const DESIGN_HEIGHT = 640;

const { width, height } = Dimensions.get('window');

export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;

/** Horizontal scale — widths, padding, font sizes, radii. */
export const scale = (size: number): number =>
  widthPercentageToDP(`${(size / DESIGN_WIDTH) * 100}%`);

/** Vertical scale — heights that should track viewport height. */
export const verticalScale = (size: number): number =>
  heightPercentageToDP(`${(size / DESIGN_HEIGHT) * 100}%`);

/**
 * Moderate scale — softens the curve so text/controls do not become oversized
 * on tablets. `factor` 0 = no scaling, 1 = full scaling.
 */
export const moderateScale = (size: number, factor = 0.5): number =>
  size + (scale(size) - size) * factor;

/** Rounds to the nearest device pixel so hairlines stay crisp. */
const round = (value: number): number => PixelRatio.roundToNearestPixel(value);

// Short aliases used throughout the app.
export const s = (size: number) => round(scale(size));
export const vs = (size: number) => round(verticalScale(size));
export const ms = (size: number, factor = 0.5) =>
  round(moderateScale(size, factor));

/** Font scale — typography ranges from 7px to 20px in the mock. */
export const fs = (size: number) => round(scale(size));

/**
 * The mock uses `1px` borders. `hairlineWidth` is the thinnest line the device
 * can draw without anti-aliasing blur — the closest visual equivalent.
 */
export const hairline = StyleSheet.hairlineWidth;

export const isSmallDevice = width < 350;
export const isTablet = Math.min(width, height) >= 600;
export const isLandscape = width > height;
