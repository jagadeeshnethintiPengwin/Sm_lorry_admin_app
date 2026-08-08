import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Reliable status-bar inset.
 *
 * `useSafeAreaInsets().top` can report 0 on Android when the activity theme is
 * not edge-to-edge, or on the very first frame before window insets have been
 * dispatched. Anything that paints top chrome would then sit *underneath* the
 * status bar and its controls become invisible/untappable.
 *
 * `StatusBar.currentHeight` is the real measured bar height on Android, so it
 * is used as a floor. iOS always reports a correct inset (and 0 legitimately
 * means no notch on older devices), so a small floor keeps the header from
 * hugging the very top edge there too.
 */
const MIN_TOP = Platform.OS === 'ios' ? 20 : 24;

export const useTopInset = (): number => {
  const insets = useSafeAreaInsets();
  const androidBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  return Math.max(insets.top, androidBar, MIN_TOP);
};
