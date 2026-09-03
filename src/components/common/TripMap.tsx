import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import MapView, {
  type MapType,
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
import { font } from '@theme/fonts';

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
  /**
   * The driver behind the wheel — drawn as their own avatar beside the lorry's
   * live puck (they share the fix, so it is nudged clear rather than stacked),
   * so a live-track map shows both the vehicle and the driver location.
   */
  driver?: { name: string; onTrip?: boolean } | null;
  /** Full-screen: adds a satellite/road toggle and a recentre button on top of
   *  the always-on gestures. */
  interactive?: boolean;
  /** Chrome drawn over the map — plate tag, zoom, recentre, coords. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('') || '—'
  );
}

const TripMapComponent: React.FC<TripMapProps> = ({
  pickup,
  drop,
  current,
  routeCoordinates,
  height,
  driver,
  interactive = false,
  children,
  style,
}) => {
  const mapRef = useRef<MapView | null>(null);
  const [mapType, setMapType] = useState<MapType>('standard');
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

  // Recentre (the full-screen button): re-frame the journey — both ends and the
  // lorry — after the operator has panned away.
  const recenter = useCallback(() => {
    const pts = [pickup, drop, current].filter(
      (p): p is LatLng => Boolean(p),
    );
    if (pts.length === 0) {
      return;
    }
    mapRef.current?.fitToCoordinates(pts, {
      edgePadding: { top: s(80), right: s(60), bottom: s(80), left: s(60) },
      animated: true,
    });
  }, [pickup, drop, current]);

  return (
    <View style={[styles.wrap, { height }, style]}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        mapType={mapType}
        showsTraffic={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor={palette.screenBg}
        loadingIndicatorColor={palette.gold}
        showsCompass={interactive}
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

        {/* Driver — the person at the wheel, beside the lorry. They share the
            live fix, so the avatar is translated a fixed distance clear of the
            puck (zoom-independent) rather than stacked on top of it. */}
        {current && driver ? (
          <Marker coordinate={current} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverShift}>
              <View
                style={[
                  styles.avatar,
                  { borderColor: driver.onTrip ? palette.navy : palette.gold },
                ]}
              >
                <Text style={styles.avatarText}>{initialsOf(driver.name)}</Text>
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      {/* Full-screen controls: satellite/road toggle and recentre. */}
      {interactive ? (
        <View style={styles.controls}>
          <Pressable
            onPress={() =>
              setMapType(t => (t === 'standard' ? 'hybrid' : 'standard'))
            }
            accessibilityRole="button"
            accessibilityLabel={
              mapType === 'standard'
                ? 'Switch to satellite view'
                : 'Switch to map view'
            }
            style={({ pressed }) => [
              styles.ctrlBtn,
              mapType !== 'standard' && styles.ctrlBtnOn,
              pressed && styles.ctrlPressed,
            ]}
          >
            <Icon
              name="layers"
              size={18}
              color={mapType === 'standard' ? palette.navy : palette.gold}
            />
          </Pressable>
          <Pressable
            onPress={recenter}
            accessibilityRole="button"
            accessibilityLabel="Recentre the map"
            style={({ pressed }) => [
              styles.ctrlBtn,
              pressed && styles.ctrlPressed,
            ]}
          >
            <Icon name="locate-fixed" size={18} color={palette.navy} />
          </Pressable>
        </View>
      ) : null}

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

  // Shifts the driver avatar clear of the lorry puck — a fixed pixel offset, so
  // they stay side by side at any zoom.
  driverShift: { transform: [{ translateX: s(34) }] },
  avatar: {
    width: s(34),
    height: s(34),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(2.5),
    backgroundColor: palette.navy,
    ...shadows.mapMarker,
  },
  avatarText: font(11, '800', { color: palette.white }),

  controls: {
    position: 'absolute',
    top: s(12),
    right: s(12),
    gap: s(8),
  },
  ctrlBtn: {
    width: s(38),
    height: s(38),
    borderRadius: radius.md,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapMarker,
  },
  ctrlBtnOn: { backgroundColor: palette.navy },
  ctrlPressed: { opacity: 0.7 },
});

export const TripMap = memo(TripMapComponent);
TripMap.displayName = 'TripMap';
