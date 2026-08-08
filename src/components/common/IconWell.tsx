import React, { memo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Icon, IconName } from './Icon';
import { palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * The rounded tinted square that precedes almost every list row / callout:
 *
 *   width:32px; height:32px; background:#e6ecf3; color:#0d2647;
 *   border-radius:8px; display:flex; align-items:center; justify-content:center;
 *
 * Sizes seen in the mock: 20, 22, 30, 32, 34, 36, 40, 44, 52, 56, 60, 64.
 */
export type IconWellProps = {
  icon: IconName;
  /** Box size in design px. */
  size?: number;
  /** Glyph size in design px. */
  iconSize?: number;
  backgroundColor?: string;
  color?: string;
  /** `border-radius`; omit for a circle via `round`. */
  borderRadius?: number;
  round?: boolean;
  borderColor?: string;
  borderWidth?: number;
  strokeWidth?: number;
  fill?: string;
  style?: StyleProp<ViewStyle>;
};

const IconWellComponent: React.FC<IconWellProps> = ({
  icon,
  size = 32,
  iconSize = 16,
  backgroundColor = palette.navyTint,
  color = palette.navy,
  borderRadius = 8,
  round = false,
  borderColor,
  borderWidth = 1,
  strokeWidth = 2,
  fill = 'none',
  style,
}) => (
  <View
    style={[
      styles.well,
      {
        width: s(size),
        height: s(size),
        borderRadius: round ? radius.full : s(borderRadius),
        backgroundColor,
      },
      borderColor ? { borderWidth: s(borderWidth), borderColor } : null,
      style,
    ]}
  >
    <Icon
      name={icon}
      size={iconSize}
      color={color}
      strokeWidth={strokeWidth}
      fill={fill}
    />
  </View>
);

const styles = StyleSheet.create({
  well: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

export const IconWell = memo(IconWellComponent);
IconWell.displayName = 'IconWell';
