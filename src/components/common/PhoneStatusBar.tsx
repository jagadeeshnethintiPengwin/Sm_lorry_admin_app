import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { s, vs } from '@theme/metrics';

/**
 * `.status-bar` from the mock:
 *
 *   height:44px; padding:14px 24px 0;
 *   display:flex; justify-content:space-between; align-items:center;
 *   font-size:11px; font-weight:800;
 *
 * On a real device the OS draws the clock and radio icons, so this component
 * only reserves the safe-area inset. Set `showMockContent` to render the
 * mock's own "9:41 + signal/wifi/battery" row (used by design-review builds).
 */
export type PhoneStatusBarProps = {
  /** `color:#fff` on dark screens, default slate on light ones. */
  tint?: string;
  showMockContent?: boolean;
};

const PhoneStatusBarComponent: React.FC<PhoneStatusBarProps> = ({
  tint = palette.slate900,
  showMockContent = false,
}) => {
  const insets = useSafeAreaInsets();
  const height = Math.max(insets.top, vs(20));

  if (!showMockContent) {
    return <View style={{ height }} />;
  }

  return (
    <View style={[styles.bar, { height: height + vs(24), paddingTop: height }]}>
      <Text style={[styles.time, { color: tint }]}>9:41</Text>
      <View style={styles.icons}>
        <Icon name="signal" size={12} color={tint} />
        <Icon name="wifi" size={12} color={tint} />
        <Icon name="battery-full" size={16} color={tint} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexShrink: 0,
    paddingHorizontal: s(24),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  time: font(11, '800'),
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
});

export const PhoneStatusBar = memo(PhoneStatusBarComponent);
PhoneStatusBar.displayName = 'PhoneStatusBar';
