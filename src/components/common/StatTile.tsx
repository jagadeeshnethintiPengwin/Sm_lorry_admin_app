import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Icon, IconName } from './Icon';
import { palette } from '@theme/colors';
import { font, typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * The 3-up metric strip used on the dashboard, profile and trip cards:
 *
 *   cell : text-align:center; border-right:1px solid #f0f2f5; padding:4px 0
 *   value: font-size:15px; font-weight:800; color:#0d2647; line-height:1
 *   label: font-size:8px; font-weight:800; color:#64748b;
 *          margin-top:4px; letter-spacing:0.5px
 */
export type StatCellProps = {
  value: string;
  label: string;
  icon?: IconName;
  iconColor?: string;
  /** `fill:#f5a623` on the star glyph. */
  iconFill?: string;
  valueSize?: number;
  valueColor?: string;
  /** `border-right:1px solid #f0f2f5` — omit on the last cell. */
  divider?: boolean;
  paddingVertical?: number;
  style?: StyleProp<ViewStyle>;
};

const StatCellComponent: React.FC<StatCellProps> = ({
  value,
  label,
  icon,
  iconColor = palette.navy,
  iconFill = 'none',
  valueSize = 15,
  valueColor = palette.navy,
  divider = false,
  paddingVertical = 4,
  style,
}) => (
  <View
    style={[
      styles.cell,
      { paddingVertical: s(paddingVertical) },
      divider ? styles.cellDivider : null,
      style,
    ]}
  >
    <View style={styles.valueRow}>
      {icon ? (
        <Icon name={icon} size={12} color={iconColor} fill={iconFill} />
      ) : null}
      <Text
        style={font(valueSize, '800', { color: valueColor, lineHeight: 1 })}
      >
        {value}
      </Text>
    </View>
    <Text style={styles.label}>{label}</Text>
  </View>
);

export const StatCell = memo(StatCellComponent);
StatCell.displayName = 'StatCell';

/**
 * The standalone summary tile (`ASSIGNED` / `ACTIVE` / `DONE`):
 *
 *   background:#fff; border-radius:10px; padding:10px 6px; text-align:center;
 *   border:1px solid #eef2f7
 *   value: font-size:16px; font-weight:800; line-height:1
 *   label: font-size:8px; font-weight:800; color:#64748b; margin-top:3px
 */
export type SummaryTileProps = {
  value: string;
  label: string;
  valueColor?: string;
  /** Dimmed tiles on the offline dashboard use `opacity:0.55`. */
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SummaryTileComponent: React.FC<SummaryTileProps> = ({
  value,
  label,
  valueColor = palette.navy,
  dimmed = false,
  style,
}) => (
  <View style={[styles.tile, dimmed ? styles.dimmed : null, style]}>
    <Text style={font(16, '800', { color: valueColor, lineHeight: 1 })}>
      {value}
    </Text>
    <Text style={[styles.label, styles.tileLabel]}>{label}</Text>
  </View>
);

export const SummaryTile = memo(SummaryTileComponent);
SummaryTile.displayName = 'SummaryTile';

/**
 * The translucent metric chip inside navy hero cards (trip-completed screen):
 *
 *   background:rgba(255,255,255,0.08); border-radius:8px; padding:8px
 *   value: font-size:12px; font-weight:800; color:#f5a623
 *   label: font-size:7px; opacity:0.75; font-weight:800; letter-spacing:0.5px
 */
export const HeroStatTile = memo<{
  value: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}>(({ value, label, style }) => (
  <View style={[styles.heroTile, style]}>
    <Text style={font(12, '800', { color: palette.gold })}>{value}</Text>
    <Text style={styles.heroTileLabel}>{label}</Text>
  </View>
));
HeroStatTile.displayName = 'HeroStatTile';

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  cellDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.divider,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
  },
  label: {
    ...typography.microLabel,
    color: palette.slate500,
    marginTop: s(4),
  },
  tile: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    paddingVertical: s(10),
    paddingHorizontal: s(6),
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  tileLabel: { marginTop: s(3) },
  dimmed: { opacity: 0.55 },
  heroTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: s(8),
    alignItems: 'center',
  },
  heroTileLabel: {
    ...font(7, '800', { letterSpacing: 0.5, color: palette.white }),
    opacity: 0.75,
    marginTop: s(2),
  },
});
