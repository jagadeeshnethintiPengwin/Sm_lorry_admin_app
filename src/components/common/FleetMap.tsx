import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Region,
} from 'react-native-maps';

import { Icon } from './Icon';
import { PulseGlow } from './Animations';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * Real Google map for Live Fleet Map (22).
 *
 * `admin-mobile-app.html` fakes the map with a CSS grid and six absolutely
 * positioned pucks. This renders the actual map underneath while keeping the
 * design's furniture — a white truck puck per vehicle, gold halo pulsing on
 * the ones that are moving, and the registration tag beneath it.
 *
 * Android uses PROVIDER_GOOGLE (key injected via AndroidManifest); iOS falls
 * back to the default provider so no extra SDK or pod is needed.
 */
import type { LatLng } from './TripMap';

export type FleetVehicle = {
  id: string;
  registration: string;
  position: LatLng;
  /** Moving vehicles get the pulsing gold halo; parked ones sit flat. */
  moving?: boolean;
};

export type FleetMapProps = {
  vehicles: FleetVehicle[];
  height: number;
  /** Overlaid chrome (LIVE chip, zoom buttons, legend). */
  children?: React.ReactNode;
};

/** Muted styling so the map sits behind the brand UI instead of fighting it. */
const MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#e8eef7' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f5f7fa' }],
  },
];

const FleetMapComponent: React.FC<FleetMapProps> = ({
  vehicles,
  height,
  children,
}) => {
  // Frame every vehicle with padding so none sits on the edge.
  const region = useMemo<Region>(() => {
    if (vehicles.length === 0) {
      return {
        latitude: 17.385,
        longitude: 78.4867,
        latitudeDelta: 3,
        longitudeDelta: 3,
      };
    }
    const lats = vehicles.map(v => v.position.latitude);
    const lngs = vehicles.map(v => v.position.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.4),
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.4),
    };
  }, [vehicles]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        customMapStyle={MAP_STYLE}
        showsTraffic={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor={palette.screenBg}
        loadingIndicatorColor={palette.gold}
      >
        {vehicles.map(vehicle => (
          <Marker
            key={vehicle.id}
            coordinate={vehicle.position}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            title={vehicle.registration}
          >
            <View style={styles.puckWrap}>
              {vehicle.moving ? (
                <PulseGlow color={palette.gold} opacity={0.35} duration={1600} />
              ) : null}
              <View style={styles.puck}>
                <Icon name="truck" size={12} color={palette.navy} />
              </View>
              <View style={styles.plate}>
                <Text style={styles.plateText} numberOfLines={1}>
                  {vehicle.registration}
                </Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },

  puckWrap: { alignItems: 'center', justifyContent: 'center' },
  puck: {
    width: s(26),
    height: s(26),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    borderWidth: s(2),
    borderColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapPuck,
  },
  plate: {
    marginTop: s(3),
    paddingVertical: s(1),
    paddingHorizontal: s(5),
    backgroundColor: palette.navy,
    borderRadius: radius.xs,
  },
  plateText: font(7, '800', { color: palette.white }),
});

export const FleetMap = memo(FleetMapComponent);
FleetMap.displayName = 'FleetMap';
