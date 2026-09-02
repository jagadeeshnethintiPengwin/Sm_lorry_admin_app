import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { AppHeader, DriverGeoMap, Screen } from '@components/index';
import { palette } from '@theme/colors';
import type { RootStackParamList } from '@navigation/types';

/**
 * Full-screen driver-and-lorry map — the tap-through from the preview card on
 * the Vehicle and Driver detail screens.
 *
 * A real Google map with everything the platform gives: pinch-zoom, pan, a
 * rotate/tilt gesture, a satellite/road toggle and a recentre button — the same
 * two markers (the driver's ringed avatar, the lorry's truck puck) the web
 * panel shows, now big enough to actually read the streets under them.
 */
export const GeoMapScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'GeoMap'>>();
  const { title, driver, vehicle } = route.params;

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title={title ?? 'Location'}
        showBack
        onBackPress={navigation.goBack}
      />
      <View style={styles.body}>
        <DriverGeoMap
          interactive
          driver={driver ?? null}
          vehicle={vehicle ?? null}
          style={styles.map}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1 },
  // Square corners edge-to-edge; the preview's rounding is for the card only.
  map: { flex: 1, borderRadius: 0 },
});
