import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { s } from '@theme/metrics';

/**
 * Bottom spacing that clears the home indicator / gesture bar.
 *
 * The HTML mock has no system chrome, so its bottom-anchored blocks sit flush
 * against the frame (`bottom:22px`, `margin-bottom:16px`, …). On a real device
 * those values fall underneath the indicator. This returns the design offset
 * plus the live inset, so the element keeps its intended visual gap on every
 * device and stays reachable.
 *
 * @param designOffset the offset in design px taken from the mock
 */
export const useSafeBottom = (designOffset = 0): number => {
  const insets = useSafeAreaInsets();
  return s(designOffset) + insets.bottom;
};

/**
 * Same idea for the top edge — status bar / notch.
 */
export const useSafeTop = (designOffset = 0): number => {
  const insets = useSafeAreaInsets();
  return s(designOffset) + insets.top;
};

/**
 * How a bottom sheet reaches the bottom of the screen, and clears the bar there.
 *
 * A modal opened with `statusBarTranslucent` + `navigationBarTranslucent` gets a
 * native window covering the whole display, but React still lays its contents
 * out inside the window's *content* area — the part left over once the status
 * and navigation bars are taken off. So a sheet anchored with
 * `justifyContent: 'flex-end'` stops short of the bottom by exactly the height
 * of both bars, and the scrim shows through underneath it.
 *
 * On a 1080x2408 handset that gap measured 204px: the sheet's own box ended at
 * 2204 with the display 2408 tall. It reads as the sheet floating above a dead
 * band, which is not what a drawer is meant to do.
 *
 * `height` therefore sizes the scrim to the real display rather than to the
 * content area, so `flex-end` puts the sheet on the actual bottom edge. Once it
 * is down there it covers the navigation bar, so `paddingBottom` lifts the
 * content back clear of it.
 *
 * `insets.bottom` is not usable for either number — inside this modal it
 * reports 0 on the device above, which is what made the sheet's own padding
 * look correct while the sheet sat in the wrong place.
 */
export const useSheetBottom = (
  designOffset = 0,
): { height: number; paddingBottom: number } => {
  const screen = Dimensions.get('screen');
  const window = Dimensions.get('window');

  // Everything the window does not occupy is system bars: the status bar at the
  // top and the navigation bar at the bottom. Only the latter sits under the
  // sheet, and a status bar is never the taller of the two, so half is a floor
  // rather than a guess — clamped so an odd reading cannot swallow the sheet.
  const systemBars = Math.max(0, screen.height - window.height);
  const navigationBar = Math.min(systemBars, TALLEST_NAVIGATION_BAR);

  return {
    height: screen.height,
    paddingBottom: s(designOffset) + navigationBar,
  };
};

/**
 * The tallest a navigation bar gets: Android's three-button bar, in dp.
 *
 * A gesture pill is around 24dp and a button bar 48dp. Nothing legitimately
 * needs more than this to be cleared, so a larger reading is capped rather
 * than trusted.
 */
const TALLEST_NAVIGATION_BAR = 48;
