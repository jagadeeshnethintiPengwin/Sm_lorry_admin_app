import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Region,
} from 'react-native-maps';

import { Icon } from './Icon';
import { PulseGlow } from './Animations';
import { palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * Real Google map for the Route Overview screen.
 *
 * The mock draws a fake grid with an SVG bezier; this renders the actual route
 * while keeping the design's map furniture — the navy pickup pin, red drop
 * flag and the white truck puck with its pulsing halo — so the screen still
 * matches `driver-app.html` visually.
 *
 * Android uses PROVIDER_GOOGLE (key injected via AndroidManifest). iOS falls
 * back to the default provider (Apple Maps) so no extra SDK/pod is required.
 */
export type LatLng = { latitude: number; longitude: number };

export type TripMapProps = {
  pickup: LatLng;
  drop: LatLng;
  /** Vehicle's live position — draws the truck puck. */
  current?: LatLng;
  /** Travelled + remaining path. Falls back to a straight pickup→drop line. */
  routeCoordinates?: LatLng[];
  height: number;
  /** Chrome drawn over the map — plate tag, zoom, recentre, coords. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
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

const TripMapComponent: React.FC<TripMapProps> = ({
  pickup,
  drop,
  current,
  routeCoordinates,
  height,
  children,
  style,
}) => {
  // Frame both endpoints with padding so neither pin sits on the edge.
  const region = useMemo<Region>(() => {
    const midLat = (pickup.latitude + drop.latitude) / 2;
    const midLng = (pickup.longitude + drop.longitude) / 2;
    const latDelta = Math.abs(pickup.latitude - drop.latitude) * 1.6 || 0.5;
    const lngDelta = Math.abs(pickup.longitude - drop.longitude) * 1.6 || 0.5;
    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.max(latDelta, 0.2),
      longitudeDelta: Math.max(lngDelta, 0.2),
    };
  }, [pickup, drop]);

  const path = useMemo(
    () => routeCoordinates ?? [pickup, drop],
    [routeCoordinates, pickup, drop],
  );

  return (
    <View style={[styles.wrap, { height }, style]}>
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
        {/* Route — navy casing under a gold line, as in the mock's two paths */}
        <Polyline
          coordinates={path}
          strokeColor="rgba(13,38,71,0.35)"
          strokeWidth={s(6)}
          lineCap="round"
        />
        <Polyline
          coordinates={path}
          strokeColor={palette.gold}
          strokeWidth={s(3)}
          lineCap="round"
        />

        {/* Pickup */}
        <Marker coordinate={pickup} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={[styles.marker, styles.markerPickup]}>
            <Icon name="map-pin" size={16} color={palette.white} />
          </View>
        </Marker>

        {/* Drop */}
        <Marker coordinate={drop} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={[styles.marker, styles.markerDrop]}>
            <Icon name="flag" size={16} color={palette.white} />
          </View>
        </Marker>

        {/* Live vehicle */}
        {current ? (
          <Marker coordinate={current} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.puckWrap}>
              <View style={styles.puckHalo}>
                <PulseGlow color={palette.gold} opacity={0.28} duration={2000} />
              </View>
              <View style={styles.puck}>
                <Icon name="truck" size={24} color={palette.navy} />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },
  marker: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(2),
    borderColor: palette.white,
    ...shadows.mapMarker,
  },
  markerPickup: { backgroundColor: palette.navy },
  markerDrop: { backgroundColor: palette.red },

  puckWrap: {
    width: s(60),
    height: s(60),
    alignItems: 'center',
    justifyContent: 'center',
  },
  puckHalo: {
    position: 'absolute',
    top: s(8),
    left: s(8),
    right: s(8),
    bottom: s(8),
  },
  puck: {
    width: s(44),
    height: s(44),
    backgroundColor: palette.white,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(2),
    borderColor: palette.navy,
    ...shadows.mapPuck,
  },
});

export const TripMap = memo(TripMapComponent);
TripMap.displayName = 'TripMap';
