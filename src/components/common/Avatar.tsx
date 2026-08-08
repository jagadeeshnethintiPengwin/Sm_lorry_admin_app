import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * The initials avatar. The mock uses several treatments:
 *
 *  - Dashboard  — 44px circle, white bg, navy text, wrapped in a gold ring
 *  - Profile    — 60px circle, white bg, navy text, gold ring
 *  - Signup     — 60px 14px-radius tile, gold gradient, navy text
 *  - List rows  — 34/36px circle, navy bg, white text
 */
export type AvatarShape = 'circle' | 'rounded';

export type AvatarProps = {
  initials: string;
  /** Box size in design px. */
  size: number;
  shape?: AvatarShape;
  /** Corner radius for `shape="rounded"`. */
  cornerRadius?: number;
  backgroundColor?: string;
  /** Gradient fill — takes precedence over `backgroundColor`. */
  gradient?: readonly string[];
  color?: string;
  fontSize?: number;
  /** Draws the gradient ring behind the avatar (`inset:-2px` / `-3px`). */
  ring?: boolean;
  ringInset?: number;
  ringGradient?: readonly string[];
  style?: StyleProp<ViewStyle>;
};

const AvatarComponent: React.FC<AvatarProps> = ({
  initials,
  size,
  shape = 'circle',
  cornerRadius = 14,
  backgroundColor = palette.navy,
  gradient,
  color = palette.white,
  fontSize,
  ring = false,
  ringInset = 2,
  ringGradient = gradients.gold,
  style,
}) => {
  const box = s(size);
  const br = shape === 'circle' ? radius.full : s(cornerRadius);
  const textStyle = font(fontSize ?? Math.round(size / 3), '800', { color });

  const inner = gradient ? (
    <LinearGradient
      colors={gradient as string[]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.center, { width: box, height: box, borderRadius: br }]}
    >
      <Text style={textStyle}>{initials}</Text>
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.center,
        { width: box, height: box, borderRadius: br, backgroundColor },
      ]}
    >
      <Text style={textStyle}>{initials}</Text>
    </View>
  );

  if (!ring) {
    return <View style={style}>{inner}</View>;
  }

  return (
    <View style={[styles.ringWrap, style]}>
      <LinearGradient
        colors={ringGradient as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          {
            top: -s(ringInset),
            left: -s(ringInset),
            right: -s(ringInset),
            bottom: -s(ringInset),
            borderRadius: shape === 'circle' ? radius.full : br + s(ringInset),
          },
        ]}
      />
      {inner}
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ringWrap: { position: 'relative', flexShrink: 0 },
});

export const Avatar = memo(AvatarComponent);
Avatar.displayName = 'Avatar';
