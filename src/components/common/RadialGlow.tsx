import React, { memo, useId } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { s } from '@theme/metrics';

/**
 * Port of the ambient glow orbs that appear on almost every hero card:
 *
 *   background: radial-gradient(circle, #f5a623 0%, transparent 65%);
 *   opacity: 0.3;
 *
 * `react-native-linear-gradient` only does linear ramps, so this uses an SVG
 * radial gradient to reproduce the falloff exactly (including the 65% stop).
 */
export type RadialGlowProps = {
  /** Box size in design px (the CSS width/height of the orb). */
  size: number;
  color: string;
  /** CSS `opacity` on the orb element. */
  opacity?: number;
  /** Where the transparent stop lands, as a CSS percentage. */
  falloff?: number;
  /** Absolute offsets in design px, matching the CSS `top/right/bottom/left`. */
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  style?: StyleProp<ViewStyle>;
};

const RadialGlowComponent: React.FC<RadialGlowProps> = ({
  size,
  color,
  opacity = 0.3,
  falloff = 65,
  top,
  right,
  bottom,
  left,
  style,
}) => {
  const gradientId = `glow-${useId()}`;
  const px = s(size);

  // One expression rather than four assignments: React Native 0.87 types
  // `ViewStyle` as `Readonly`. Spreading `null` leaves an offset absent, so an
  // edge that was not passed stays unset rather than becoming `undefined`.
  const position: ViewStyle = {
    position: 'absolute',
    ...(top !== undefined ? { top: s(top) } : null),
    ...(right !== undefined ? { right: s(right) } : null),
    ...(bottom !== undefined ? { bottom: s(bottom) } : null),
    ...(left !== undefined ? { left: s(left) } : null),
  };

  return (
    <View
      pointerEvents="none"
      style={[position, { width: px, height: px, opacity }, style]}
    >
      <Svg width={px} height={px}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={1} />
            <Stop
              offset={`${falloff}%`}
              stopColor={color}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>
        <Rect width={px} height={px} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
};

export const RadialGlow = memo(RadialGlowComponent);
RadialGlow.displayName = 'RadialGlow';
