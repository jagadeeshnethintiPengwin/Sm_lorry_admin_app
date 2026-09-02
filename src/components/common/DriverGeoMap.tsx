import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import MapView, {
  type MapType,
  Marker,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Region,
} from 'react-native-maps';

import { Icon } from './Icon';
import { palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import { font } from '@theme/fonts';

/**
 * Driver-and-lorry map for the detail screens — the phone twin of the web
 * panel's driver/vehicle map.
 *
 * A driver is drawn as their own avatar (initials, ringed gold when online and
 * navy on a trip); the lorry is the white truck puck. When both report the very
 * same spot — which is the norm on a trip, since the driver's phone in the cab
 * is the lorry's only tracker — the two would stack, so the map nudges them a
 * touch apart to sit side by side, like two markers meeting at an intersection.
 * When neither reports, it shows an honest "not reported" panel rather than a
 * map centred on nowhere.
 *
 * Android uses PROVIDER_GOOGLE (key in the manifest); iOS falls back to the
 * default (Apple Maps) so no extra pod is needed — the same choice TripMap makes.
 */
export type GeoPoint = { latitude: number; longitude: number };

export type DriverGeoMapProps = {
  /** The driver's own live fix + who they are. */
  driver?: { position: GeoPoint; name: string; onTrip?: boolean } | null;
  /** The lorry's fix + its plate. */
  vehicle?: { position: GeoPoint; reg: string } | null;
  /** Fixed height for the card preview; omit to fill the parent (full screen). */
  height?: number;
  /**
   * The full-screen version: gestures on, plus a satellite toggle and a
   * recentre button — everything a Google map has. The card on a detail screen
   * stays a static preview (this off) so it does not fight the page's scroll.
   */
  interactive?: boolean;
  /** Tapping the (static) preview opens the full-screen map. Ignored when
   *  `interactive`, since there the gestures are the point. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Two fixes within ~11m read as the same place on a phone-sized map. */
function samePlace(a: GeoPoint, b: GeoPoint): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < 1e-4 &&
    Math.abs(a.longitude - b.longitude) < 1e-4
  );
}

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

const DriverGeoMapComponent: React.FC<DriverGeoMapProps> = ({
  driver,
  vehicle,
  height,
  interactive = false,
  onPress,
  style,
}) => {
  const driverPos = driver?.position ?? null;
  const vehiclePos = vehicle?.position ?? null;

  const mapRef = useRef<MapView | null>(null);
  const [mapType, setMapType] = useState<MapType>('standard');

  const region = useMemo<Region>(() => {
    const pts = [driverPos, vehiclePos].filter(Boolean) as GeoPoint[];
    if (pts.length === 0) {
      // Nothing to show — a neutral region behind the "not reported" panel.
      return {
        latitude: 17.385,
        longitude: 78.4867,
        latitudeDelta: 3,
        longitudeDelta: 3,
      };
    }
    const lats = pts.map(p => p.latitude);
    const lngs = pts.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.02),
      longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.02),
    };
  }, [driverPos, vehiclePos]);

  // When the driver and lorry share a point, nudge them a slice of the view
  // apart so neither hides the other. Purely to un-stack two markers that are
  // genuinely at the same place.
  const spread =
    driverPos && vehiclePos && samePlace(driverPos, vehiclePos)
      ? region.longitudeDelta * 0.07
      : 0;

  const driverCoord = driverPos
    ? { latitude: driverPos.latitude, longitude: driverPos.longitude + spread }
    : null;
  const vehicleCoord = vehiclePos
    ? { latitude: vehiclePos.latitude, longitude: vehiclePos.longitude - spread }
    : null;

  // Recentre (the full-screen map's button): frame both fixes again, or zoom to
  // the single one, after the operator has panned away.
  const recenter = useCallback(() => {
    const pts = [driverPos, vehiclePos].filter(Boolean) as GeoPoint[];
    if (pts.length === 0) {
      return;
    }
    if (pts.length === 1) {
      mapRef.current?.animateToRegion(
        {
          latitude: pts[0].latitude,
          longitude: pts[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        350,
      );
      return;
    }
    mapRef.current?.fitToCoordinates(pts, {
      edgePadding: { top: s(80), right: s(70), bottom: s(80), left: s(70) },
      animated: true,
    });
  }, [driverPos, vehiclePos]);

  const sizeStyle = height != null ? { height } : styles.fill;

  // Neither reporting — no map, just an honest panel.
  if (!driverPos && !vehiclePos) {
    return (
      <View style={[styles.wrap, styles.empty, sizeStyle, style]}>
        <Icon name="map-pin" size={20} color={palette.slate500} />
        <Text style={styles.emptyText}>Location not reported</Text>
        <Text style={styles.emptySub}>
          A lorry has no tracker of its own — the driver&apos;s phone reports its
          position while a trip is running.
        </Text>
      </View>
    );
  }

  const driverRing = driver?.onTrip ? palette.navy : palette.gold;

  return (
    <View style={[styles.wrap, sizeStyle, style]}>
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
        /* Full-screen: pinch, pan, rotate and tilt like any Google map. The
           card preview keeps them off so it never swallows the page's scroll on
           a detail screen that lives inside a ScrollView. */
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
      >
        {vehicleCoord && vehicle ? (
          <Marker coordinate={vehicleCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerCol}>
              <View style={styles.puck}>
                <Icon name="truck" size={18} color={palette.navy} />
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{vehicle.reg}</Text>
              </View>
            </View>
          </Marker>
        ) : null}

        {driverCoord && driver ? (
          <Marker coordinate={driverCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerCol}>
              <View style={[styles.avatar, { borderColor: driverRing }]}>
                <Text style={styles.avatarText}>{initialsOf(driver.name)}</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: driverRing }]}>
                <Text
                  style={[
                    styles.tagText,
                    { color: driver.onTrip ? palette.white : palette.navy },
                  ]}
                >
                  {driver.name}
                </Text>
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      {/* Which symbol is which — the driver is the ringed avatar, the lorry the
          truck puck, both on the one map. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { borderColor: driverRing }]} />
          <Text style={styles.legendText}>Driver</Text>
        </View>
        {vehicle ? (
          <View style={styles.legendItem}>
            <Icon name="truck" size={11} color={palette.navy} />
            <Text style={styles.legendText}>{vehicle.reg}</Text>
          </View>
        ) : null}
      </View>

      {/* Full-screen controls: satellite/road toggle and recentre, the map
          furniture the web panel carries. */}
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

      {/* Static preview: the whole card is a button that opens the full-screen
          map. The map's own gestures are off, so this overlay gets the tap. */}
      {onPress && !interactive ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Open full-screen map"
        >
          <View style={styles.expandHint}>
            <Icon name="maximize-2" size={14} color={palette.white} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden', borderRadius: radius.lg },
  fill: { flex: 1 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    paddingHorizontal: s(24),
    backgroundColor: palette.screenBg,
  },
  emptyText: font(12, '800', { color: palette.navy }),
  emptySub: {
    ...font(9, '400', { color: palette.slate500 }),
    textAlign: 'center' as const,
  },

  markerCol: { alignItems: 'center' },
  puck: {
    width: s(34),
    height: s(34),
    backgroundColor: palette.white,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(2),
    borderColor: palette.navy,
    ...shadows.mapPuck,
  },
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
  tag: {
    marginTop: s(3),
    maxWidth: s(120),
    backgroundColor: palette.navy,
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: radius.sm,
  },
  tagText: font(8, '800', { color: palette.white }),

  legend: {
    position: 'absolute',
    left: s(8),
    bottom: s(8),
    flexDirection: 'row',
    gap: s(10),
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: s(8),
    paddingVertical: s(4),
    borderRadius: radius.sm,
    ...shadows.mapMarker,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  legendDot: {
    width: s(10),
    height: s(10),
    borderRadius: radius.full,
    borderWidth: s(2),
    backgroundColor: palette.white,
  },
  legendText: font(8, '700', { color: palette.navy }),

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

  expandHint: {
    position: 'absolute',
    top: s(8),
    right: s(8),
    width: s(26),
    height: s(26),
    borderRadius: radius.sm,
    backgroundColor: 'rgba(13,38,71,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const DriverGeoMap = memo(DriverGeoMapComponent);
DriverGeoMap.displayName = 'DriverGeoMap';
