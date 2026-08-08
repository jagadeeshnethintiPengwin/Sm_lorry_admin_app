import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Icon, IconName } from './Icon';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * The tinted info strip that recurs throughout the mock:
 *
 *   background:#fff7e0; border:1px solid #ffe0a3; border-radius:10px;
 *   padding:9px 11px; display:flex; align-items:center; gap:8px;
 *   text: font-size:9px; color:#8a5a00; font-weight:700; line-height:1.4
 */
export type CalloutProps = {
  icon?: IconName;
  iconSize?: number;
  iconColor?: string;
  /** Single-line body. Use `children` for rich content. */
  text?: React.ReactNode;
  /** Bold title rendered above `text`. */
  title?: string;
  children?: React.ReactNode;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  paddingVertical?: number;
  paddingHorizontal?: number;
  borderRadius?: number;
  marginBottom?: number;
  gap?: number;
  /** Custom leading node (e.g. an `IconWell`). */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const CalloutComponent: React.FC<CalloutProps> = ({
  icon,
  iconSize = 16,
  iconColor = palette.gold,
  text,
  title,
  children,
  backgroundColor = palette.goldTint,
  borderColor = palette.goldSoft,
  textColor = palette.goldText,
  paddingVertical = 9,
  paddingHorizontal = 11,
  borderRadius = 10,
  marginBottom = 0,
  gap = 8,
  leading,
  style,
}) => (
  <View
    style={[
      styles.wrap,
      {
        backgroundColor,
        borderColor,
        borderRadius: s(borderRadius),
        paddingVertical: s(paddingVertical),
        paddingHorizontal: s(paddingHorizontal),
        marginBottom: s(marginBottom),
        gap: s(gap),
      },
      style,
    ]}
  >
    {leading}
    {!leading && icon ? (
      <Icon name={icon} size={iconSize} color={iconColor} />
    ) : null}

    {children ?? (
      <View style={styles.body}>
        {title ? (
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        ) : null}
        {typeof text === 'string' ? (
          <Text style={[styles.text, { color: textColor }]}>{text}</Text>
        ) : (
          text
        )}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  body: { flex: 1 },
  title: font(10, '800'),
  text: font(9, '700', { lineHeight: 1.4 }),
});

export const Callout = memo(CalloutComponent);
Callout.displayName = 'Callout';
