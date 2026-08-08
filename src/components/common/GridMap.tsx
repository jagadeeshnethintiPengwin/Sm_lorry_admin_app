import React, { memo, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { palette } from '@theme/colors';
import { s } from '@theme/metrics';

/**
 * The mock's `.map` surface — a schematic grid, not a real map:
 *
 *   background:
 *     linear-gradient(rgba(13,38,71,0.05), rgba(13,38,71,0.05)),
 *     repeating-linear-gradient(0deg,  #e8eef7 0 1px, transparent 1px 40px),
 *     repeating-linear-gradient(90deg, #e8eef7 0 1px, transparent 1px 40px),
 *     #f2f7ff
 *
 * The two repeating gradients are redrawn as hairlines every 40px.
 */
export type GridMapProps = {
  height: number;
  children?: React.ReactNode;
  /** CSS grid pitch. */
  step?: number;
  style?: StyleProp<ViewStyle>;
};

const GridMapComponent: React.FC<GridMapProps> = ({
  height,
  children,
  step = 40,
  style,
}) => {
  const rows = useMemo(
    () => Array.from({ length: Math.ceil(height / step) }, (_, i) => i * step),
    [height, step],
  );
  // The canvas is 310 CSS px wide; a few extra columns cover wider devices.
  const columns = useMemo(
    () => Array.from({ length: Math.ceil(360 / step) }, (_, i) => i * step),
    [step],
  );

  return (
    <View style={[styles.map, { height: s(height) }, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {rows.map(top => (
          <View key={`r${top}`} style={[styles.hLine, { top: s(top) }]} />
        ))}
        {columns.map(left => (
          <View key={`c${left}`} style={[styles.vLine, { left: s(left) }]} />
        ))}
      </View>

      {/* The 5%-navy wash that sits over the grid. */}
      <View style={styles.wash} pointerEvents="none" />

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    backgroundColor: palette.mapBg,
    position: 'relative',
    overflow: 'hidden',
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.mapGrid,
  },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: palette.mapGrid,
  },
  wash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(13,38,71,0.05)',
  },
});

export const GridMap = memo(GridMapComponent);
GridMap.displayName = 'GridMap';
