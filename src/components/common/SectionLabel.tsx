import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { palette } from '@theme/colors';
import { typography } from '@theme/fonts';
import { s } from '@theme/metrics';

/**
 * The recurring red section eyebrow:
 *
 *   font-size:9px; font-weight:800; color:#dc2626;
 *   letter-spacing:1px; margin-bottom:8px;
 */
export type SectionLabelProps = {
  children: React.ReactNode;
  color?: string;
  marginBottom?: number;
  /** Trailing muted note, e.g. `(optional)` or `(scan / photo)`. */
  hint?: string;
  hintStyle?: StyleProp<TextStyle>;
  /** Right-aligned meta, e.g. `This week` / `Set by dispatcher`. */
  right?: React.ReactNode;
  paddingHorizontal?: number;
  style?: StyleProp<ViewStyle>;
};

const SectionLabelComponent: React.FC<SectionLabelProps> = ({
  children,
  color = palette.red,
  marginBottom = 8,
  hint,
  hintStyle,
  right,
  paddingHorizontal,
  style,
}) => {
  const label = (
    <Text style={[styles.label, { color }]}>
      {children}
      {hint ? <Text style={[styles.hint, hintStyle]}>{` ${hint}`}</Text> : null}
    </Text>
  );

  if (!right) {
    return (
      <View
        style={[
          {
            marginBottom: s(marginBottom),
            paddingHorizontal:
              paddingHorizontal !== undefined ? s(paddingHorizontal) : 0,
          },
          style,
        ]}
      >
        {label}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.row,
        {
          marginBottom: s(marginBottom),
          paddingHorizontal:
            paddingHorizontal !== undefined ? s(paddingHorizontal) : 0,
        },
        style,
      ]}
    >
      {label}
      {right}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.sectionLabel,
    textTransform: 'uppercase',
  },
  hint: {
    ...typography.caption,
    color: palette.slate500,
    letterSpacing: 0,
    textTransform: 'none',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export const SectionLabel = memo(SectionLabelComponent);
SectionLabel.displayName = 'SectionLabel';
