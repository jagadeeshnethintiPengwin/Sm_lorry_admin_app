import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useSpin } from './Animations';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { s } from '@theme/metrics';

/**
 * Spinner built on the mock's `@keyframes spin` and brand ramp
 * (`#dc2626 -> #f5a623`).
 */
export type LoaderProps = {
  size?: number;
  strokeWidth?: number;
  /** Caption below the spinner. */
  label?: string;
  labelColor?: string;
  /** Fills its parent and centres itself. */
  fullscreen?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

const LoaderComponent: React.FC<LoaderProps> = ({
  size = 32,
  strokeWidth = 3,
  label,
  labelColor = palette.slate500,
  fullscreen = false,
  backgroundColor,
  style,
}) => {
  const spinStyle = useSpin(900);
  const box = s(size);
  const r = (box - s(strokeWidth)) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View
      style={[
        fullscreen ? styles.fullscreen : styles.inline,
        backgroundColor ? { backgroundColor } : null,
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <Animated.View style={spinStyle}>
        <Svg width={box} height={box}>
          <Defs>
            <LinearGradient id="loaderRamp" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={palette.red} />
              <Stop offset="100%" stopColor={palette.gold} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            stroke={palette.border}
            strokeWidth={s(strokeWidth)}
            fill="none"
          />
          <Circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            stroke="url(#loaderRamp)"
            strokeWidth={s(strokeWidth)}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.28} ${circumference}`}
          />
        </Svg>
      </Animated.View>
      {label ? (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  inline: { alignItems: 'center', justifyContent: 'center' },
  fullscreen: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...font(9, '700'),
    marginTop: s(8),
    textAlign: 'center',
  },
});

export const Loader = memo(LoaderComponent);
Loader.displayName = 'Loader';
