import React, { memo, useEffect, useMemo, useRef } from 'react';
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
  /** Overlaid chrome (LIVE chip, legend, the selected-vehicle card). */
  children?: React.ReactNode;
  /** The vehicle currently picked out, drawn larger and on top. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

/*
 * The marker's own measurements.
 *
 * Named because the anchor is derived from them. A marker view on Android is
 * rendered into a bitmap the size of the view, and anything drawn outside
 * those bounds is clipped — which is what cut the registration plates in half
 * when they were absolutely positioned below the puck. So the view contains
 * everything it draws, and the *anchor* is moved instead: the fraction down
 * the view where the puck's centre sits, so the truck still lands exactly on
 * the coordinate.
 */
const PUCK = 26;
const PLATE_GAP = 2;
const PLATE_HEIGHT = 15;
/** Wide enough for `AP 31 XX 1234` at 7px without the plate being trimmed. */
const MARKER_WIDTH = 92;
const MARKER_HEIGHT = PUCK + PLATE_GAP + PLATE_HEIGHT;
/** Puck centre, as a fraction of the whole marker. */
const PUCK_CENTRE_Y = PUCK / 2 / MARKER_HEIGHT;

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
  selectedId = null,
  onSelect,
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

  /*
   * `initialRegion` is applied once, at mount, and never again.
   *
   * The fleet used to be a constant, so it was present on the first render and
   * that was enough. It is fetched now, so the first render has no vehicles at
   * all — the map opened on the default view of Hyderabad and stayed there
   * while the real lorries loaded somewhere off screen.
   *
   * So the camera is moved when the set of vehicles materially changes. Keyed
   * on which vehicles are shown and roughly where, not on the exact
   * coordinates: re-fitting on every ping would yank the camera back each time
   * the office panned away to look at something.
   */
  const mapRef = useRef<MapView | null>(null);
  const framed = useRef('');

  useEffect(() => {
    if (!vehicles.length) {
      return;
    }
    const key = vehicles
      .map(v => `${v.id}:${v.position.latitude.toFixed(2)},${v.position.longitude.toFixed(2)}`)
      .sort()
      .join('|');
    if (key === framed.current) {
      return;
    }
    framed.current = key;

    // A beat after layout: fitting before the map has measured itself is a
    // no-op on Android.
    const timer = setTimeout(() => {
      if (vehicles.length === 1) {
        // One lorry has no extent to fit; `fitToCoordinates` would zoom to its
        // tightest level and show a rooftop.
        mapRef.current?.animateToRegion(
          { ...vehicles[0].position, latitudeDelta: 0.08, longitudeDelta: 0.08 },
          600,
        );
        return;
      }
      mapRef.current?.fitToCoordinates(
        vehicles.map(v => v.position),
        {
          edgePadding: { top: 70, right: 60, bottom: 70, left: 60 },
          animated: true,
        },
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [vehicles]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
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
            anchor={{ x: 0.5, y: PUCK_CENTRE_Y }}
            tracksViewChanges={false}
            title={vehicle.registration}
            /*
             * Moving lorries sit on top where markers overlap.
             *
             * Eleven vehicles on one screen put several within a few pixels of
             * each other — a depot yard stacks them exactly — and without an
             * order the platform picks one arbitrarily, so which truck is
             * legible changes on every re-render. A lorry on the road is the
             * one the office is watching, so it wins; the rest keep a stable
             * order behind it rather than shuffling.
             */
            /*
             * The selected lorry is always on top, then moving ones, then the
             * rest. Without an order the platform picks arbitrarily where
             * markers overlap, so the one the office just tapped could end up
             * drawn underneath its neighbours.
             */
            zIndex={
              vehicle.id === selectedId ? 3 : vehicle.moving ? 2 : 1
            }
            onPress={onSelect ? () => onSelect(vehicle.id) : undefined}
          >
            {/*
              Puck above, plate below, both inside the marker's own bounds —
              see the note on the constants above for why nothing may sit
              outside them, and why the anchor rather than the layout is what
              puts the truck on the coordinate.
            */}
            <View style={styles.puckWrap}>
              {vehicle.moving ? (
                <PulseGlow color={palette.gold} opacity={0.35} duration={1600} />
              ) : null}
              <View
                style={[
                  vehicle.moving ? styles.puck : styles.puckStopped,
                  vehicle.id === selectedId ? styles.puckSelected : null,
                ]}
              >
                <Icon
                  name="truck"
                  size={12}
                  color={vehicle.moving ? palette.navy : palette.red}
                />
              </View>
              <View style={styles.plate} pointerEvents="none">
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

  /*
   * The whole marker: puck, gap, plate. Sized explicitly so the anchor above
   * can be computed from it, and so nothing it draws falls outside the bounds
   * Android rasterises.
   */
  puckWrap: {
    width: s(MARKER_WIDTH),
    height: s(MARKER_HEIGHT),
    alignItems: 'center',
  },
  puck: {
    width: s(PUCK),
    height: s(PUCK),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    borderWidth: s(2),
    borderColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapPuck,
  },
  /* A stopped lorry reads red, matching the legend and the list beside it. */
  puckStopped: {
    width: s(PUCK),
    height: s(PUCK),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    borderWidth: s(2),
    borderColor: palette.red,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapPuck,
  },
  /*
   * In normal flow under the puck, not absolutely positioned.
   *
   * Hanging it outside the parent was what cut the registrations in half: the
   * marker bitmap is the size of the view, so the half of the plate that sat
   * beyond it was simply not drawn.
   */
  plate: {
    marginTop: s(PLATE_GAP),
    height: s(PLATE_HEIGHT),
    maxWidth: s(MARKER_WIDTH),
    justifyContent: 'center',
    paddingHorizontal: s(5),
    backgroundColor: palette.navy,
    borderRadius: radius.xs,
  },
  plateText: font(7, '800', { color: palette.white }),
  /*
   * The picked-out lorry, made obvious without resizing the marker — changing
   * its box would change the anchor fraction with it, and put the truck back
   * off its coordinate.
   */
  puckSelected: {
    borderColor: palette.navy,
    borderWidth: s(3),
    backgroundColor: palette.goldTint,
  },
});

export const FleetMap = memo(FleetMapComponent);
FleetMap.displayName = 'FleetMap';
