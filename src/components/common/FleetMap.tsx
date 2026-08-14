import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Region,
} from 'react-native-maps';

import { Icon } from './Icon';
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
  /**
   * Degrees clockwise from north, when the vehicle's own tracker reports it.
   *
   * Drawn as a wedge on the rim of the puck. Absent for a position that came
   * from the driver's phone, which reports where a lorry is but not which way
   * it is facing — so the wedge simply is not drawn, rather than pointing
   * north and lying.
   */
  heading?: number | null;
  /**
   * True when nothing has been heard for long enough to distrust the position.
   *
   * Drawn hollow. A lorry that stopped reporting twenty minutes ago is not in
   * the same state as one parked with its engine off, and a map that draws
   * them identically is how an operator rings the wrong driver.
   */
  stale?: boolean;
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
/**
 * The box the puck sits inside, and the heading wedge rotates within.
 *
 * Larger than the puck on purpose: the wedge that shows which way the cab is
 * pointing sweeps a full circle, so it needs room on every side. Because the
 * bitmap is clipped to the view, that room has to be reserved here rather than
 * discovered at render time.
 */
const HALO = 38;
const PLATE_GAP = 3;
const PLATE_HEIGHT = 15;
/**
 * Wide enough for the longest plate in the fleet, with room to spare.
 *
 * The marker is rasterised to the size of its view, so this is a hard ceiling
 * on the registration rather than a suggestion: a plate that needs more is
 * ellipsised, and half a registration on a fleet map is worse than none —
 * `AP 31 XX 1234` and `AP 31 XX 7034` differ in one character near the end.
 * 118 fits every format the fleet holds at this weight, including the spaced
 * ones, on the narrowest device the app supports.
 */
const MARKER_WIDTH = 118;
const MARKER_HEIGHT = HALO + PLATE_GAP + PLATE_HEIGHT;
/**
 * Puck centre, as a fraction of the whole marker.
 *
 * Derived rather than typed: the truck lands on its coordinate only if this
 * tracks the geometry above, and a hand-tuned number silently drifts the
 * moment any of it changes.
 */
const PUCK_CENTRE_Y = HALO / 2 / MARKER_HEIGHT;

/** Muted styling so the map sits behind the brand UI instead of fighting it. */
/**
 * A quiet base map, so the lorries are the only thing on it that shouts.
 *
 * The default Google style is built for a person finding a restaurant: shops,
 * parks, bus routes and full-strength road colours, all competing with a
 * marker for the same attention. On a fleet board none of that is being looked
 * for — the question is only ever "where are my trucks, and which way are they
 * going".
 *
 * So the ground is desaturated to near-paper, the road network is kept but
 * pushed back to a hierarchy of greys with the arterials a shade darker, and
 * everything that is neither road, water nor place name is turned off. The
 * gold and red pucks then sit on a background that has nothing else in those
 * hues, which is what makes them legible at a glance rather than merely
 * present.
 */
const MAP_STYLE = [
  /* Clutter: shops, parks, bus stops, business labels. */
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },

  /* Ground and water: two flat, cool neutrals. */
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f4f6fa' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#dde7f2' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#93a7bd' }],
  },

  /*
   * Roads, kept but recessive.
   *
   * Removing them entirely reads as prettier and is worse: without a road
   * network an operator cannot tell whether a stopped lorry is on a highway
   * or in a yard. They are drawn in greys instead, with the arterials and
   * highways progressively darker so the shape of the route survives.
   */
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9aa8b8' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#f0f3f7' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#e4e9f0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d5dde7' }],
  },

  /* Place names stay — a position means little without a town beside it. */
  {
    featureType: 'administrative',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7d8da0' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#dfe6ee' }],
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
              {/*
                The halo holds everything that is round: the pulse, the
                direction wedge and the disc, stacked concentrically so the
                truck's centre stays exactly on the coordinate whichever of
                them are drawn.
              */}
              <View style={styles.halo}>
                {/*
                  No halo behind the puck.
                  
                  A pulsing gold disc sat under every moving lorry, which on a
                  pale map read as a yellow smear rather than as emphasis —
                  and with several trucks in a yard the smears merged into one
                  patch. The gold *ring* already says the lorry is moving, and
                  says it more precisely.
                */}
                {/*
                  Which way the cab is pointing.
                  
                  Only drawn when the vehicle's own tracker reported a heading
                  — a position relayed from the driver's phone knows where the
                  lorry is but not its bearing, and a wedge defaulting to north
                  would be a confident lie. Rotating the whole box keeps the
                  wedge on the rim at any angle.
                */}
                {typeof vehicle.heading === 'number' && vehicle.moving ? (
                  <View
                    style={[
                      styles.headingRing,
                      { transform: [{ rotate: `${vehicle.heading}deg` }] },
                    ]}
                    pointerEvents="none"
                  >
                    <View
                      style={[
                        styles.headingWedge,
                        vehicle.stale ? styles.headingWedgeStale : null,
                      ]}
                    />
                  </View>
                ) : null}

                <View
                  style={[
                    styles.puckBase,
                    vehicle.moving ? styles.puckMoving : styles.puckStopped,
                    vehicle.stale ? styles.puckStale : null,
                    vehicle.id === selectedId ? styles.puckSelected : null,
                  ]}
                >
                  <Icon
                    name="truck"
                    size={12}
                    color={
                      vehicle.stale
                        ? palette.slate400
                        : vehicle.moving
                          ? palette.navy
                          : palette.red
                    }
                  />
                </View>
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
  /* Everything round, concentric, centred on the coordinate. */
  halo: {
    width: s(HALO),
    height: s(HALO),
    alignItems: 'center',
    justifyContent: 'center',
  },

  /*
   * The rotating frame the direction wedge lives on.
   *
   * Rotating this rather than the wedge keeps the wedge's own geometry
   * upright and its position on the rim exact at any bearing — rotating a
   * child about an offset origin is where this kind of indicator usually
   * drifts a few degrees.
   */
  headingRing: {
    position: 'absolute',
    width: s(HALO),
    height: s(HALO),
    alignItems: 'center',
  },
  /*
   * A triangle, made from borders.
   *
   * React Native has no polygon; a zero-width box with two transparent side
   * borders and one coloured bottom border is the standard way to get one,
   * and it costs no image and no SVG dependency.
   */
  headingWedge: {
    width: 0,
    height: 0,
    borderLeftWidth: s(4),
    borderRightWidth: s(4),
    borderBottomWidth: s(6),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: palette.navy,
  },
  headingWedgeStale: { borderBottomColor: palette.slate400 },

  puckBase: {
    width: s(PUCK),
    height: s(PUCK),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    borderWidth: s(2),
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapPuck,
  },
  puckMoving: { borderColor: palette.gold },
  /* A stopped lorry reads red, matching the legend and the list beside it. */
  puckStopped: { borderColor: palette.red },
  /*
   * Nothing heard for a while: drawn hollow and grey.
   *
   * Distinct from "parked", which is a lorry we are hearing from and which is
   * not moving. Collapsing the two is how an operator ends up ringing a driver
   * who is fine, and not ringing the one whose tracker has died.
   */
  puckStale: {
    borderColor: palette.slate400,
    backgroundColor: palette.navyTint,
  },
  /*
   * In normal flow under the puck, not absolutely positioned.
   *
   * Hanging it outside the parent was what cut the registrations in half: the
   * marker bitmap is the size of the view, so the half of the plate that sat
   * beyond it was simply not drawn.
   */
  /*
   * The registration, on a plate rather than bare text.
   *
   * A hairline of gold and a slightly deeper navy than the UI behind it: on a
   * near-white map, unbordered dark text at 7px reads as a smudge at a glance,
   * and the border is what gives it an edge to resolve against.
   */
  plate: {
    marginTop: s(PLATE_GAP),
    height: s(PLATE_HEIGHT),
    maxWidth: s(MARKER_WIDTH),
    justifyContent: 'center',
    paddingHorizontal: s(6),
    backgroundColor: palette.navy,
    borderRadius: radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,166,35,0.55)',
    ...shadows.mapPuck,
  },
  plateText: font(7, '800', { color: palette.white, letterSpacing: 0.3 }),
  /*
   * The picked-out lorry, made obvious without resizing the marker — changing
   * its box would change the anchor fraction with it, and put the truck back
   * off its coordinate.
   */
  /*
   * The picked-out lorry: a heavier navy ring, and nothing else.
   *
   * It used to be filled `goldTint`, which changed the disc from white to
   * yellow and made the truck inside it hard to read — the fill competed with
   * the icon it was meant to draw attention to. Thickening the ring picks the
   * lorry out without touching what is inside it, and keeps the marker the
   * same size, which matters because its box determines the anchor.
   */
  puckSelected: {
    borderColor: palette.navy,
    borderWidth: s(3),
  },
});

export const FleetMap = memo(FleetMapComponent);
FleetMap.displayName = 'FleetMap';
