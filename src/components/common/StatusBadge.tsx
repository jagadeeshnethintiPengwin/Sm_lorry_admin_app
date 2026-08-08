import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { Icon, IconName } from './Icon';
import { BlinkDot } from './Animations';
import { alpha, palette } from '@theme/colors';
import { font, typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * `.pill` variants from the mock:
 *
 *   .pill       { padding:3px 8px; border-radius:12px; font-size:9px;
 *                 font-weight:700; text-transform:uppercase;
 *                 letter-spacing:0.03em }
 *   .pill-navy  { background:#e6ecf3; color:#0d2647 }
 *   .pill-red   { background:#fecaca; color:#991b1b }
 *   .pill-gold  { background:#ffe0a3; color:#8a5a00 }
 */
export type PillTone = 'navy' | 'red' | 'gold';

export type PillProps = {
  label: string;
  tone?: PillTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  navy: { bg: palette.navyTint, fg: palette.navy },
  red: { bg: palette.redSoft, fg: '#991b1b' },
  gold: { bg: palette.goldSoft, fg: palette.goldText },
};

const PillComponent: React.FC<PillProps> = ({
  label,
  tone = 'navy',
  style,
  textStyle,
}) => {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.pillText, { color: fg }, textStyle]}>{label}</Text>
    </View>
  );
};
export const Pill = memo(PillComponent);
Pill.displayName = 'Pill';

/**
 * The translucent status chip used on hero cards, e.g.
 *
 *   padding:4px 10px; background:rgba(245,166,35,0.2);
 *   border:1px solid rgba(245,166,35,0.4); border-radius:20px;
 *   font-size:8px; font-weight:800; color:#f5a623; letter-spacing:1px;
 *
 * Optionally prefixed by a blinking dot or a Lucide glyph.
 */
export type StatusChipProps = {
  label: string;
  /** Chip fill. */
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
  /** Renders the blinking `<span>` marker used by LIVE/IN TRANSIT chips. */
  dot?: boolean;
  dotColor?: string;
  dotSize?: number;
  /** Renders a Lucide glyph instead of the dot. */
  icon?: IconName;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const StatusChipComponent: React.FC<StatusChipProps> = ({
  label,
  backgroundColor = alpha.gold20,
  borderColor = alpha.gold40,
  color = palette.gold,
  dot = false,
  dotColor,
  dotSize = 5,
  icon,
  iconSize = 12,
  style,
  textStyle,
}) => (
  <View
    style={[
      styles.chip,
      { backgroundColor, borderColor },
      style,
    ]}
  >
    {dot ? <BlinkDot size={dotSize} color={dotColor ?? color} /> : null}
    {icon ? <Icon name={icon} size={iconSize} color={color} /> : null}
    <Text style={[styles.chipText, { color }, textStyle]}>{label}</Text>
  </View>
);
export const StatusChip = memo(StatusChipComponent);
StatusChip.displayName = 'StatusChip';

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    borderRadius: radius.pill,
  },
  pillText: {
    ...typography.pill,
    textTransform: 'uppercase',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    borderRadius: s(20),
    borderWidth: s(1),
  },
  // `font-size:8px; font-weight:800; letter-spacing:1px`
  chipText: font(8, '800', { letterSpacing: 1 }),
});
