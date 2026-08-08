import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { palette } from '@theme/colors';
import { typography } from '@theme/fonts';
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
export type RouteViewProps = {
  pickup: string;
  drop: string;
  pickupLabel?: string;
  dropLabel?: string;
  /** `margin-bottom` on the pickup address — 8px default, 6px on some cards. */
  pickupGap?: number;
  style?: StyleProp<ViewStyle>;
};

const RouteViewComponent: React.FC<RouteViewProps> = ({
  pickup,
  drop,
  pickupLabel = 'Pickup',
  dropLabel = 'Drop',
  pickupGap = 8,
  style,
}) => (
  <View style={[styles.route, style]}>
    <View style={styles.dots}>
      <View style={styles.dot} />
      <View style={styles.line} />
      <View style={[styles.dot, styles.dotDrop]} />
    </View>
    <View style={styles.addrs}>
      <Text style={styles.lbl}>{pickupLabel}</Text>
      <Text style={[styles.addr, { marginBottom: s(pickupGap) }]}>
        {pickup}
      </Text>
      <Text style={styles.lbl}>{dropLabel}</Text>
      <Text style={styles.addr}>{drop}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  route: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(10),
  },
  dots: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: s(4),
  },
  dot: {
    width: s(8),
    height: s(8),
    borderRadius: radius.full,
    backgroundColor: palette.navy,
  },
  dotDrop: { backgroundColor: palette.red },
  line: {
    width: s(2),
    height: s(22),
    backgroundColor: palette.gray200,
    marginVertical: s(2),
  },
  addrs: { flex: 1 },
  lbl: {
    ...typography.routeLabel,
    color: palette.slate500,
    textTransform: 'uppercase',
  },
  addr: {
    ...typography.address,
    color: palette.slate900,
  },
});

export const RouteView = memo(RouteViewComponent);
RouteView.displayName = 'RouteView';
