import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * The mini tricolour used beside the `+91` prefix. Unlike the driver app's SVG
 * swatch, `customer-app.html` builds this from stacked divs:
 *
 *   <div style="width:16px; height:11px; border-radius:2px; overflow:hidden;
 *               display:flex; flex-direction:column;">
 *     <div style="flex:1; background:#f5a623;"></div>
 *     <div style="flex:1; background:#fff;  …optional chakra ring… "></div>
 *     <div style="flex:1; background:#16a34a;"></div>
 *   </div>
 *
 * The login screen includes the chakra ring; the OTP chip omits it.
 */
export type IndiaFlagMiniProps = {
  width?: number;
  height?: number;
  /** Renders the small navy ring in the white band (login screen only). */
  showChakra?: boolean;
};

const IndiaFlagMiniComponent: React.FC<IndiaFlagMiniProps> = ({
  width = 16,
  height = 11,
  showChakra = false,
}) => (
  <View style={[styles.flag, { width: s(width), height: s(height) }]}>
    <View style={styles.saffron} />
    <View style={styles.white}>
      {showChakra ? <View style={styles.chakra} /> : null}
    </View>
    <View style={styles.green} />
  </View>
);

const styles = StyleSheet.create({
  flag: {
    borderRadius: radius.xxs,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  saffron: { flex: 1, backgroundColor: palette.gold },
  white: {
    flex: 1,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  green: { flex: 1, backgroundColor: palette.green },
  chakra: {
    width: s(4),
    height: s(4),
    borderWidth: s(0.5),
    borderColor: palette.navy,
    borderRadius: radius.full,
  },
});

export const IndiaFlagMini = memo(IndiaFlagMiniComponent);
IndiaFlagMini.displayName = 'IndiaFlagMini';
