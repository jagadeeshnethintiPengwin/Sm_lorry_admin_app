import React, { memo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { Icon } from './Icon';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { s } from '@theme/metrics';

/**
 * The generic settings / document / contact row:
 *
 *   display:flex; align-items:center; gap:11px; padding:11px 12px;
 *   border-bottom:1px solid #f0f2f5;
 *   title    : font-size:11px; font-weight:800; color:#0d2647
 *   subtitle : font-size:9px;  color:#64748b; margin-top:1px
 */
export type ListRowProps = {
  title: string;
  subtitle?: React.ReactNode;
  subtitleColor?: string;
  subtitleWeight?: '400' | '600' | '700' | '800';
  /** Leading node — usually an `IconWell` or `Avatar`. */
  leading?: React.ReactNode;
  /** Trailing node — chevron, pill, switch, call button… */
  trailing?: React.ReactNode;
  /** Renders the default `chevron-right` when no `trailing` is supplied. */
  showChevron?: boolean;
  onPress?: () => void;
  /** `border-bottom:1px solid #f0f2f5` — omit on the last row. */
  divider?: boolean;
  paddingVertical?: number;
  paddingHorizontal?: number;
  gap?: number;
  /** `border-left:3px solid <color>` accent. */
  accentColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

const ListRowComponent: React.FC<ListRowProps> = ({
  title,
  subtitle,
  subtitleColor = palette.slate500,
  subtitleWeight = '400',
  leading,
  trailing,
  showChevron = false,
  onPress,
  divider = false,
  paddingVertical = 11,
  paddingHorizontal = 12,
  gap = 11,
  accentColor,
  backgroundColor,
  style,
}) => {
  const content = (
    <>
      {leading}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          typeof subtitle === 'string' ? (
            <Text
              style={[
                font(9, subtitleWeight, { color: subtitleColor }),
                styles.subtitle,
              ]}
            >
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {trailing}
      {!trailing && showChevron ? (
        <Icon name="chevron-right" size={14} color={palette.slate400} />
      ) : null}
    </>
  );

  const rowStyle: StyleProp<ViewStyle> = [
    styles.row,
    {
      paddingVertical: s(paddingVertical),
      paddingHorizontal: s(paddingHorizontal),
      gap: s(gap),
    },
    divider ? styles.divider : null,
    accentColor
      ? { borderLeftWidth: s(3), borderLeftColor: accentColor }
      : null,
    backgroundColor ? { backgroundColor } : null,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => [rowStyle, pressed ? { opacity: 0.7 } : null]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  body: { flex: 1, minWidth: 0 },
  title: font(11, '800', { color: palette.navy }),
  subtitle: { marginTop: s(1) },
});

export const ListRow = memo(ListRowComponent);
ListRow.displayName = 'ListRow';
