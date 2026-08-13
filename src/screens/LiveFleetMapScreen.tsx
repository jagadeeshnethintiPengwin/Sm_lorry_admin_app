import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  BlinkDot,
  Card,
  Content,
  FleetMap,
  Icon,
  IconWell,
  Screen,
} from '@components/index';
import type { FleetVehicle } from '@components/common/FleetMap';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import { tripService, type LiveTrip } from '@services/fleet.service';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 22 — Live Fleet Map.
 *
 *   TRACKING strip with a blinking LIVE chip · real Google map with a
 *   truck pucks (navy = moving, red = stopped), a Moving / Stopped legend and
 *   zoom · VEHICLES LIVE cards
 */


/**
 * A live trip, in the shape this screen draws.
 *
 * The tones are worked out from the data rather than written down beside each
 * row as they were: a lorry that has reported recently is gold, one that has
 * gone quiet is red, and one not yet under way is muted. That is a fact about
 * the vehicle, and it changes while the screen is open.
 */
function toRow(trip: LiveTrip) {
  const minutesSincePing = trip.lastPingAt
    ? Math.round((Date.now() - new Date(trip.lastPingAt).getTime()) / 60000)
    : null;

  // Ten minutes of silence from a lorry that is supposed to be moving is the
  // threshold the office already uses on the GPS alert.
  const stale = minutesSincePing === null || minutesSincePing > 10;
  const moving = trip.status === 'IN_TRANSIT';

  const tone: 'gold' | 'red' | 'muted' = !moving
    ? 'muted'
    : stale
      ? 'red'
      : 'gold';

  return {
    /*
     * Two ids, and they are not interchangeable.
     *
     * `id` keys the row and the marker — it must be unique per row, and a
     * vehicle can appear on two trips, so the trip id is the right key. But
     * Vehicle Details is a *vehicle* screen: handing it the trip id asks the
     * API for `/vehicles/<a trip id>` and gets a 404, which is a details
     * screen that never loads.
     */
    id: trip.tripId,
    vehicleId: trip.vehicleId ?? null,
    plate: trip.registration ?? '—',
    driver: [trip.driver, trip.reference && `#${trip.reference}`]
      .filter(Boolean)
      .join(' · '),
    route: trip.route ?? '—',
    distance: trip.distanceKm
      ? `${Math.round(trip.coveredKm ?? 0)}/${Math.round(trip.distanceKm)} km`
      : '—',
    /*
     * The last fix, not a speed.
     *
     * The mock showed `62 km/h` and the row carried it as a literal. Nothing
     * reports speed — the ping records a position — so this says the one thing
     * that is true and useful: how long ago the lorry was last heard from.
     */
    heard:
      minutesSincePing === null
        ? 'No signal'
        : minutesSincePing < 1
          ? 'Just now'
          : `${minutesSincePing} min ago`,
    tone,
    position: trip.location
      ? { latitude: trip.location.lat, longitude: trip.location.lng }
      : null,
    moving,
  };
}

export const LiveFleetMapScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  /*
   * The fleet, from the fleet.
   *
   * `FLEET` and `FLEET_POSITIONS` were three invented lorries — plates,
   * drivers, speeds and fixed coordinates — shown identically to every office
   * that opened this screen, while `/trips/live` served the real ones the
   * whole time. The header said "18 vehicles tracking" beside three rows.
   */
  const load = useCallback(async () => {
    setFailure(null);
    try {
      setTrips(await tripService.live());
    } catch (error) {
      setFailure((error as Error).message || 'Could not load the fleet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      /*
       * Re-read while the screen is open. A live map that only loads once is a
       * screenshot; the office leaves this open on a desk.
       */
      const timer = setInterval(load, 20_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const rows = useMemo(() => trips.map(toRow), [trips]);
  const moving = useMemo(() => rows.filter(row => row.moving).length, [rows]);

  /* Only the lorries that have reported can be drawn. */
  const markers = useMemo<FleetVehicle[]>(
    () =>
      rows
        .filter(row => row.position)
        .map(row => ({
          id: row.id,
          registration: row.plate,
          position: row.position as FleetVehicle['position'],
          moving: row.moving,
        })),
    [rows],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => rows.find(row => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const openVehicle = useCallback(
    (vehicleId: string | null) => {
      /*
       * A row whose trip carries no vehicle id cannot open a vehicle. Rare —
       * the board joins the vehicle in — but a dead tap is worse than an
       * obviously inert row.
       */
      if (vehicleId) {
        navigation.navigate('VehicleDetails', { vehicleId });
      }
    },
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Live Fleet"
        subtitle={`${rows.length} ${rows.length === 1 ? "vehicle" : "vehicles"} tracking`}
        showBack
        onBackPress={navigation.goBack}
      />

      {/* Tracking strip */}
      <View style={styles.trackingStrip}>
        <View>
          <Text style={styles.trackingLabel}>TRACKING</Text>
          {/* Counted, not asserted. The strip claimed 18 live and 11 idle
              beside three hardcoded rows. */}
          <Text style={styles.trackingValue}>
            {`${moving} moving · ${rows.length - moving} idle`}
          </Text>
        </View>
        <View style={styles.liveChip}>
          <BlinkDot color={palette.navy} size={6} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        {/* Map */}
        <FleetMap
          vehicles={markers}
          height={230}
          selectedId={selectedId}
          onSelect={setSelectedId}
        >

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendGold]} />
              <Text style={styles.legendText}>Moving</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendRed]} />
              <Text style={styles.legendText}>Stopped</Text>
            </View>
          </View>

          {/*
            The tapped lorry, spelled out.

            A marker is rasterised to the size of its own view, so a plate long
            enough to overflow it is cut off with no way around it from inside
            the marker. This card is an ordinary view laid over the map: it has
            no such bound, so the registration is shown in full however long it
            is, with the detail that will not fit on a puck.
          */}
          {selected ? (
            <Pressable
              style={styles.selectedCard}
              onPress={() => openVehicle(selected.id)}
              accessibilityRole="button"
              accessibilityLabel={`${selected.plate}, ${selected.heard}. Open vehicle`}
            >
              <View style={styles.selectedHead}>
                <Text style={styles.selectedPlate}>{selected.plate}</Text>
                <Pressable
                  onPress={() => setSelectedId(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                >
                  <Icon name="x" size={14} color={palette.slate400} />
                </Pressable>
              </View>
              <Text style={styles.selectedDriver} numberOfLines={1}>
                {selected.driver}
              </Text>
              <View style={styles.selectedFoot}>
                <Text style={styles.selectedRoute} numberOfLines={1}>
                  {selected.route}
                </Text>
                <Text
                  style={
                    selected.tone === 'red'
                      ? styles.fleetSpeedRed
                      : selected.tone === 'gold'
                        ? styles.fleetSpeedGold
                        : styles.fleetSpeedMuted
                  }
                >
                  {selected.heard}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {/*
            The zoom +/- buttons are gone: neither had a handler — they
            rendered, they pressed, and nothing happened — and the map is
            already pinch-zoomable. The customer app's map lost the same pair
            for the same reason.
          */}
        </FleetMap>

        <Text style={styles.section}>VEHICLES LIVE</Text>

        {failure ? (
          <Card padding={14}>
            <Text style={styles.stateTitle}>Could not load the fleet</Text>
            <Text style={styles.stateBody}>{failure}</Text>
          </Card>
        ) : loading && !rows.length ? (
          <Card padding={14}>
            <Text style={styles.stateBody}>Finding vehicles on the road…</Text>
          </Card>
        ) : !rows.length ? (
          <Card padding={14}>
            <Text style={styles.stateTitle}>Nothing on the road</Text>
            <Text style={styles.stateBody}>
              Live vehicles appear here once a trip is under way.
            </Text>
          </Card>
        ) : (
          rows.map(vehicle => (
            <Card
              key={vehicle.id}
              padding={10}
              onPress={() => openVehicle(vehicle.vehicleId)}
              accessibilityLabel={`${vehicle.plate}, ${vehicle.heard}`}
              accentColor={
                vehicle.tone === 'gold'
                  ? palette.gold
                  : vehicle.tone === 'red'
                    ? palette.red
                    : undefined
              }
              accentWidth={3}
            >
              <View style={styles.fleetRow}>
                <IconWell
                  icon="truck"
                  size={26}
                  iconSize={14}
                  backgroundColor={
                    vehicle.tone === 'gold'
                      ? palette.goldTint
                      : vehicle.tone === 'red'
                        ? palette.redTint
                        : palette.navyTint
                  }
                  color={
                    vehicle.tone === 'gold'
                      ? palette.gold
                      : vehicle.tone === 'red'
                        ? palette.red
                        : palette.navy
                  }
                  borderRadius={radius.md}
                />

                <View style={styles.fleetBody}>
                  <View style={styles.fleetHead}>
                    <Text style={styles.fleetPlate} numberOfLines={1}>
                      {vehicle.plate}
                    </Text>
                    <Text
                      style={
                        vehicle.tone === 'gold'
                          ? styles.fleetSpeedGold
                          : vehicle.tone === 'red'
                            ? styles.fleetSpeedRed
                            : styles.fleetSpeedMuted
                      }
                      numberOfLines={1}
                    >
                      {vehicle.heard}
                    </Text>
                  </View>

                  <Text style={styles.fleetDriver} numberOfLines={1}>
                    {vehicle.driver}
                  </Text>

                  <View style={styles.fleetFoot}>
                    <Text style={styles.fleetRoute} numberOfLines={1}>
                      {vehicle.route}
                    </Text>
                    <Text style={styles.fleetDistancePlain} numberOfLines={1}>
                      {vehicle.distance}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  /*
   * Anchored to the bottom of the map, clear of the legend in the top-left.
   * A plain view, so nothing about it is subject to the marker bitmap that
   * clips a long registration on the puck itself.
   */
  selectedCard: {
    position: 'absolute',
    left: s(10),
    right: s(10),
    bottom: s(10),
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingVertical: s(9),
    paddingHorizontal: s(11),
    ...shadows.card,
  },
  selectedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(8),
  },
  /* No `numberOfLines`: showing this in full is the point of the card. */
  selectedPlate: {
    ...font(13, '800', { color: palette.navy, letterSpacing: 0.3 }),
    flexShrink: 1,
  },
  selectedDriver: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(2),
  },
  selectedFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(10),
    marginTop: s(5),
  },
  selectedRoute: {
    ...font(9, '700', { color: palette.navy }),
    flexShrink: 1,
  },
  stateTitle: font(12, '800', { color: palette.navy }),
  stateBody: {
    ...font(10, '500', { color: palette.slate500, lineHeight: 1.5 }),
    marginTop: s(3),
  },
  trackingStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    backgroundColor: palette.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  trackingLabel: font(8, '800', { color: palette.slate500, letterSpacing: 1 }),
  trackingValue: font(12, '800', { color: palette.navy }),
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    backgroundColor: palette.navyTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.navy,
    borderRadius: s(20),
  },
  liveText: font(9, '800', { color: palette.navy }),

  contentTop: { paddingTop: s(10) },


  legend: {
    position: 'absolute',
    bottom: s(8),
    left: s(8),
    flexDirection: 'row',
    gap: s(8),
    backgroundColor: palette.white,
    paddingVertical: s(5),
    paddingHorizontal: s(8),
    borderRadius: radius.md,
    ...shadows.subtle,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  legendDot: { width: s(6), height: s(6), borderRadius: radius.full },
  legendGold: { backgroundColor: palette.gold },
  legendRed: { backgroundColor: palette.red },
  legendText: font(8, '800', { color: palette.navy }),


  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },

  fleetRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  fleetBody: { flex: 1, minWidth: 0 },
  fleetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fleetPlate: font(10, '800', { color: palette.navy, letterSpacing: 0.5 }),
  fleetSpeedGold: font(8, '800', { color: palette.goldText }),
  fleetSpeedRed: font(8, '800', { color: palette.red }),
  fleetSpeedMuted: font(8, '800', { color: palette.slate500 }),
  fleetDriver: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },
  fleetFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: s(3),
  },
  fleetRoute: font(9, '800', { color: palette.navy }),
  // The mock leaves this one uncoloured, so it inherits the body ink.
  fleetDistancePlain: font(9, '800', { color: palette.slate900 }),
});
