import React, { memo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { RadialGlow, RadialGlowProps } from './RadialGlow';
import { gradients, palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * The navy gradient hero card that opens most trip screens:
 *
 *   background:linear-gradient(135deg,#0d2647,#1a3a63); color:#fff;
 *   border-radius:14px; padding:14px; margin-bottom:12px;
 *   position:relative; overflow:hidden;
 *   > glow: position:absolute; right:-25px; top:-25px; width:120px; height:120px;
 *           border-radius:50%;
 *           background:radial-gradient(circle,#f5a623 0%,transparent 65%);
 *           opacity:0.3;
 */
export type HeroCardProps = {
  children: React.ReactNode;
  colors?: readonly string[];
  /** Gradient direction — 135deg is the default in the mock. */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  borderRadius?: number;
  marginBottom?: number;
  /** Ambient orbs layered behind the content. */
  glows?: RadialGlowProps[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** The `right:-25px; top:-25px; width:120px` orb used by trip heroes. */
export const DEFAULT_HERO_GLOW: RadialGlowProps = {
  size: 120,
  color: palette.gold,
  opacity: 0.3,
  top: -25,
  right: -25,
};

const HeroCardComponent: React.FC<HeroCardProps> = ({
  children,
  colors = gradients.navyHero,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  padding = 14,
  paddingHorizontal,
  paddingVertical,
  borderRadius = 14,
  marginBottom = 12,
  glows = [DEFAULT_HERO_GLOW],
  style,
  contentStyle,
}) => (
  <LinearGradient
    colors={colors as string[]}
    start={start}
    end={end}
    style={[
      styles.card,
      {
        borderRadius: s(borderRadius),
        marginBottom: s(marginBottom),
        paddingVertical: s(paddingVertical ?? padding),
        paddingHorizontal: s(paddingHorizontal ?? padding),
      },
      style,
    ]}
  >
    {glows.map((glow, i) => (
      <RadialGlow key={`glow-${i}`} {...glow} />
    ))}
    <View style={[styles.content, contentStyle]}>{children}</View>
  </LinearGradient>
);

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.xl,
  },
  content: { position: 'relative' },
});

export const HeroCard = memo(HeroCardComponent);
HeroCard.displayName = 'HeroCard';
