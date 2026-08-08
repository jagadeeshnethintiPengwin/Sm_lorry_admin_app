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
