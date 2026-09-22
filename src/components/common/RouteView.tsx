import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { palette } from '@theme/colors';
import { font, typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * `.route` from the mock — the pickup/drop stack with its connector rail:
 *
 *   .route       { display:flex; align-items:flex-start; gap:10px }
 *   .route .dots { flex-direction:column; align-items:center; padding-top:4px }
 *   .route .d    { width:8px; height:8px; border-radius:50%; background:#0d2647 }
 *   .route .d.drop { background:#dc2626 }
 *   .route .line { width:2px; height:22px; background:#e5e7eb; margin:2px 0 }
 *   .route .lbl  { font-size:8px; color:#64748b; text-transform:uppercase;
 *                  font-weight:700; letter-spacing:0.03em }
 *   .route .addr { color:#0f172a; font-weight:600; margin-bottom:8px;
 *                  line-height:1.3; font-size:11px }
 */

/**
 * Where the stack is drawn: a white card, or the navy gradient of the live
 * banner. Two named schemes rather than five colour props, because those are
 * the only two surfaces this appears on and a half-set of overrides is how a
 * label ends up navy-on-navy.
 */
export type RouteTone = 'onLight' | 'onDark';

const TONES: Record<
  RouteTone,
  { pickupDot: string; dropDot: string; rail: string; label: string; addr: string }
> = {
  onLight: {
    pickupDot: palette.navy,
    dropDot: palette.red,
    rail: palette.gray200,
    label: palette.slate500,
    addr: palette.slate900,
  },
  onDark: {
    pickupDot: palette.gold,
    dropDot: palette.white,
    rail: 'rgba(255,255,255,0.35)',
    label: 'rgba(255,255,255,0.65)',
    addr: palette.white,
  },
};

export type RouteViewProps = {
  pickup: string;
  drop: string;
  pickupLabel?: string;
  dropLabel?: string;
  /** Vertical gap between the two legs. */
  pickupGap?: number;
  tone?: RouteTone;
  /**
   * Smaller address text, for a list where each card carries two full postal
   * addresses rather than a place name.
   */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * One leg of the route: its dot, the rail down to the next leg, and the
 * labelled address beside them.
 *
 * The rail is `flex:1` inside a column that stretches to the row's height,
 * which is what ties it to the text rather than to a guess. It used to be a
 * fixed 22px line in a dots column of its own, so a pickup that wrapped to
 * three lines left the drop dot stranded against the middle of the pickup
 * address with nothing at all beside the DROP label — visible on any trip
 * booked with a full postal address.
 */
const Leg: React.FC<{
  label: string;
  address: string;
  dotColor: string;
  colors: (typeof TONES)[RouteTone];
  compact: boolean;
  isLast?: boolean;
  gap?: number;
}> = ({ label, address, dotColor, colors, compact, isLast = false, gap = 8 }) => (
  <View style={[styles.leg, isLast ? null : { paddingBottom: s(gap) }]}>
    <View style={styles.rail}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      {isLast ? null : (
        <View style={[styles.connector, { backgroundColor: colors.rail }]} />
      )}
    </View>
    <View style={styles.body}>
      <Text style={[styles.lbl, { color: colors.label }]}>{label}</Text>
      {/*
        * No `numberOfLines`: the address is the whole point of the row, and
        * two places in the same city differ at the end of the string, which is
        * exactly what an ellipsis eats.
        */}
      <Text
        style={[compact ? styles.addrCompact : styles.addr, { color: colors.addr }]}
      >
        {address}
      </Text>
    </View>
  </View>
);

const RouteViewComponent: React.FC<RouteViewProps> = ({
  pickup,
  drop,
  pickupLabel = 'Pickup',
  dropLabel = 'Drop',
  pickupGap = 8,
  tone = 'onLight',
  compact = false,
  style,
}) => {
  const colors = TONES[tone];
  return (
    <View style={style}>
      <Leg
        label={pickupLabel}
        address={pickup}
        dotColor={colors.pickupDot}
        colors={colors}
        compact={compact}
        gap={pickupGap}
      />
      <Leg
        label={dropLabel}
        address={drop}
        dotColor={colors.dropDot}
        colors={colors}
        compact={compact}
        isLast
      />
    </View>
  );
};

const styles = StyleSheet.create({
  leg: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(10),
  },
  // `alignSelf: stretch` is what gives the rail the leg's full height, so the
  // connector below the dot can claim whatever the address does not.
  rail: { alignItems: 'center', alignSelf: 'stretch', paddingTop: s(4) },
  dot: {
    width: s(8),
    height: s(8),
    borderRadius: radius.full,
  },
  connector: {
    width: s(2),
    flex: 1,
    marginTop: s(2),
    minHeight: s(12),
  },
  body: { flex: 1, minWidth: 0 },
  lbl: {
    ...typography.routeLabel,
    textTransform: 'uppercase',
  },
  addr: typography.address,
  addrCompact: font(10, '600', { lineHeight: 1.35 }),
});

export const RouteView = memo(RouteViewComponent);
RouteView.displayName = 'RouteView';
