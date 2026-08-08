import React, { memo } from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * `.card` from the mock:
 *
 *   background:#fff; border-radius:12px; padding:12px;
 *   margin-bottom:10px; box-shadow:0 1px 3px rgba(15,23,42,0.05);
 */
export type CardProps = {
  children: React.ReactNode;
  /** Overrides the default `padding:12px`. Pass 0 for `padding:0` cards. */
  padding?: number;
  /** Overrides the default `margin-bottom:10px`. */
  marginBottom?: number;
  /** `border-left:3px solid <color>` accent used by trip cards. */
  accentColor?: string;
  accentWidth?: number;
  /** `overflow:hidden` on cards that clip their rows. */
  clip?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const CardComponent: React.FC<CardProps> = ({
  children,
  padding = 12,
  marginBottom = 10,
  accentColor,
  accentWidth = 3,
  clip = false,
  onPress,
  accessibilityLabel,
  style,
}) => {
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      padding: s(padding),
      marginBottom: s(marginBottom),
    },
    accentColor
      ? { borderLeftWidth: s(accentWidth), borderLeftColor: accentColor }
      : null,
    clip ? styles.clip : null,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.card,
    ...shadows.card,
  },
  clip: { overflow: 'hidden' },
});

export const Card = memo(CardComponent);
Card.displayName = 'Card';
