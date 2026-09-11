import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  BlinkDot,
  Button,
  Card,
  Content,
  Footer,
  HaltUpdates,
  TripMap,
  Icon,
  IconWell,
  ListState,
  Screen,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { tripService } from '@services/fleet.service';
import type { Halt } from '@services/fleet.service';
import { directionsService, type RoadRoute } from '@services/directions.service';
import { useApi } from '@hooks/useApi';

/**
 * Screen 21 — Live Trip Track.
 *
 *   navy MOVING strip (km done · km total · km left) · grid map with
 *   radar rings round the truck puck, plate tag, zoom, recenter and coords ·
 *   CURRENT LOCATION · TRIP PROGRESS with the knob on the fill ·
 *   DRIVER & VEHICLE · Share / View Timeline footer
 */

export const LiveTripTrackScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LiveTripTrack'>>();
  const { tripId } = route.params;

  /*
   * The trip, and where it currently is.
   *
   * Neither was fetched. The strip read `48 km/h · 42 km done · 263 km left`,
   * the header `#TR-2026-8829 · AP 05 CH 9912`, and the map drew a fixed
   * Hyderabad-to-Kadapa line with the lorry pinned 14% along it — on every
   * trip in the fleet. The office watched an animation, not a vehicle.
   *
   * Two calls: the trip for who and what, and `tracking` for the live
   * position, distance covered and the timeline.
   */
  const trip = useApi(() => tripService.get(tripId), [tripId]);
  const live = useApi(() => tripService.tracking(tripId), [tripId]);

  const record = (trip.data ?? null) as Record<string, any> | null;
  const tracking = (live.data ?? null) as Record<string, any> | null;

  const reference: string = record?.reference ?? tracking?.reference ?? '—';
  const registration: string = record?.vehicle?.registration ?? '—';
  const driverMobile: string = record?.driver?.user?.mobile ?? '';
  const booking = record?.booking;

  const distanceKm = Number(tracking?.distanceKm ?? record?.distanceKm ?? 0);
  const coveredKm = Number(tracking?.coveredKm ?? record?.coveredKm ?? 0);
  const remainingKm = Math.max(0, Math.round(distanceKm - coveredKm));

  /*
   * Where the lorry is, if it has reported.
   *
   * `null` until the driver starts and the first position arrives — the map
   * below falls back to the route's own end points rather than inventing a
   * coordinate, because a puck drawn on a guess is worse than no puck.
   */
  const current = tracking?.location
    ? {
        latitude: Number(tracking.location.lat),
        longitude: Number(tracking.location.lng),
      }
    : null;

  /*
   * The two ends of the leg, from the booking the customer placed.
   *
   * Nullable in the schema — a booking the office typed in over the phone has
   * no autocomplete behind it, so there is no coordinate to draw. When either
   * end is missing the map is hidden rather than drawn to (0, 0), which is in
   * the Atlantic and reads as a lorry that has fallen off the world.
   */
  const pickup =
    booking?.pickupLat != null && booking?.pickupLng != null
      ? { latitude: Number(booking.pickupLat), longitude: Number(booking.pickupLng) }
      : null;
  const drop =
    booking?.dropLat != null && booking?.dropLng != null
      ? { latitude: Number(booking.dropLat), longitude: Number(booking.dropLng) }
      : null;
  const mappable = pickup != null && drop != null;

  /*
   * The real road pickup→drop, so the line follows the carriageway like Google's
   * own directions rather than cutting straight across country. Fetched once per
   * leg — keyed on the two endpoints as strings, not the object identities that
   * change every render — and left null on failure, where the map falls back to
   * the straight line.
   */
  const [road, setRoad] = useState<RoadRoute | null>(null);
  const pickupKey = pickup ? `${pickup.latitude},${pickup.longitude}` : '';
  const dropKey = drop ? `${drop.latitude},${drop.longitude}` : '';
  useEffect(() => {
    if (!pickupKey || !dropKey) {
      setRoad(null);
      return;
    }
    let alive = true;
    const [plat, plng] = pickupKey.split(',').map(Number);
    const [dlat, dlng] = dropKey.split(',').map(Number);
    directionsService
      .road(
        { latitude: plat, longitude: plng },
        { latitude: dlat, longitude: dlng },
      )
      .then(found => {
        if (alive) {
          setRoad(found);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pickupKey, dropKey]);

  /*
   * Where the lorry stopped for too long along the way.
   *
   * The tracking endpoint rolls consecutive still fixes into halts; the map
   * drops a pin on each. Absent (an unstarted trip that has never reported) or
   * empty means no pins — the map draws exactly as before.
   */
  const halts: Halt[] = Array.isArray(tracking?.halts) ? tracking!.halts : [];

  const progress = Number(tracking?.progress ?? 0);
  const speedKmph =
    tracking?.location?.speedKph != null
      ? Math.round(Number(tracking.location.speedKph))
      : null;

  const driverName: string = record?.driver?.user?.name ?? '—';
  const driverInitials = driverName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('') || '—';

  const vehicleLine = [record?.vehicle?.type, record?.vehicle?.model]
    .filter(Boolean)
    .join(' · ');

  // The driver on the map beside the lorry — a live trip, so navy-ringed.
  const mapDriver =
    driverName && driverName !== '—' ? { name: driverName, onTrip: true } : null;

  // The full-screen map is a modal over this screen, reading the same live
  // props, so the lorry keeps moving on it without re-subscribing.
  const [fullScreen, setFullScreen] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /** The fix's age, which is the honest version of "48 km/h · moving". */
  const fixAge = (() => {
    const at = tracking?.location?.recordedAt;
    if (!at) {
      return null;
    }
    const secs = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000));
    if (secs < 60) {
      return `${secs}s ago`;
    }
    if (secs < 3600) {
      return `${Math.round(secs / 60)}m ago`;
    }
    return `${Math.round(secs / 3600)}h ago`;
  })();

  const clock = (value?: string | null) =>
    value
      ? new Date(value).toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '—';

  const call = useCallback(() => {
    if (!driverMobile) {
      return;
    }
    Linking.openURL(`tel:${driverMobile}`).catch(() => undefined);
  }, [driverMobile]);

  /**
   * Shares this trip, not a fixed sentence.
   *
   * It read "Track SMT trip #TR-2026-8829 — AP 05 CH 9912, currently near
   * Chevella toll" whatever was on screen, so an operator forwarding a status
   * to a customer sent them another consignment's reference and plate.
   */
  const share = useCallback(() => {
    const where = booking
      ? `${booking.pickupPlace} → ${booking.dropPlace}`
      : '';
    Share.share({
      message: [
        `SMT trip ${reference}`,
        registration !== '—' ? `— ${registration}` : '',
        where ? `· ${where}` : '',
        distanceKm > 0 ? `· ${Math.round(coveredKm)}/${Math.round(distanceKm)} km` : '',
      ]
        .filter(Boolean)
        .join(' '),
    }).catch(() => undefined);
  }, [booking, coveredKm, distanceKm, reference, registration]);

  const openTimeline = useCallback(
    () => navigation.navigate('TripTimeline', { tripId: route.params.tripId }),
    [navigation, route.params.tripId],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Track Live"
        subtitle={`${reference} · ${registration}`}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content padding={12} contentStyle={styles.contentTop}>
        {/*
          Loading, failure and not-found were all unreachable before, because
          nothing was ever requested — the invented lorry rendered instantly
          and always, on a route it had never driven.
        */}
        <ListState
          loading={trip.loading}
          error={trip.error}
          empty={!trip.loading && !trip.error && !record}
          what="trip"
          emptyIcon="truck"
          emptyHint="This trip could not be found."
          onRetry={() => {
            trip.refetch();
            live.refetch();
          }}
        />

        {record ? (
        <>
        {/* Live status strip */}
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.strip}
        >
          <View style={styles.stripHead}>
            {/*
              The trip's own state, and the age of the last fix.
              
              The chip blinked `MOVING` and the corner read `UPDATED 12s AGO`
              on a trip that had not started and had never reported — the two
              pieces of the screen that most look like proof of life were the
              two with nothing behind them. The dot only blinks when a fix has
              actually arrived recently.
            */}
            <View style={styles.movingChip}>
              {fixAge ? <BlinkDot color={palette.gold} size={5} /> : null}
              <Text style={styles.movingText}>
                {(record?.status ?? tracking?.status) || '—'}
              </Text>
            </View>
            <Text style={styles.updated}>
              {fixAge ? `UPDATED ${fixAge.toUpperCase()}` : 'NO POSITION YET'}
            </Text>
          </View>

          <View style={styles.stripStats}>
            <View style={[styles.stripStat, styles.stripDivider]}>
              {/*
                Distance run, not a speed.
                
                The strip led with `48 KM/H`, which the API does not report —
                and a speed is the figure an operator repeats to a customer
                asking how far off the lorry is. Covered kilometres is the
                thing that is actually known.
              */}
              <Text style={styles.stripValue}>{Math.round(coveredKm)}</Text>
              <Text style={styles.stripLabel}>KM DONE</Text>
            </View>
            <View style={[styles.stripStat, styles.stripDivider]}>
              <Text style={styles.stripValue}>{Math.round(distanceKm)}</Text>
              <Text style={styles.stripLabel}>KM TOTAL</Text>
            </View>
            <View style={styles.stripStat}>
              <Text style={styles.stripValue}>{remainingKm}</Text>
              <Text style={styles.stripLabel}>KM LEFT</Text>
            </View>
          </View>
        </LinearGradient>

        {/*
          The map, only when there is a route to draw.
          
          Pickup and drop are nullable — a booking taken over the phone has no
          coordinates behind its typed address. Rendering anyway would put both
          pins at (0, 0), so the screen says so instead.
        */}
        {!mappable ? (
          <View style={styles.noMap}>
            <Icon name="map-pin" size={18} color={palette.slate400} />
            <Text style={styles.noMapText}>
              This booking has no pickup or drop coordinates, so the route
              cannot be drawn.
            </Text>
          </View>
        ) : (
        <TripMap
          pickup={pickup!}
          drop={drop!}
          current={current ?? pickup!}
          routeCoordinates={road?.path}
          driver={mapDriver}
          halts={halts}
          height={220}
          style={styles.map}
        >
          {/* Info tag above vehicle */}
          <View style={styles.plateTag}>
            <Text style={styles.plateText}>
              {registration}
              {speedKmph != null ? ` · ${speedKmph} km/h` : ''}
            </Text>
          </View>

          {/* Open the map full-screen — a full Google map with both markers. */}
          <Pressable
            style={styles.expandBtn}
            onPress={() => setFullScreen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open full-screen map"
          >
            <Icon name="maximize-2" size={16} color={palette.navy} />
          </Pressable>

          {/* Zoom */}
          <View style={styles.zoom}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              style={styles.zoomBtn}
            >
              <Text style={styles.zoomText}>+</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              style={styles.zoomBtn}
            >
              <Text style={styles.zoomText}>-</Text>
            </Pressable>
          </View>

          {/* Recenter */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recenter map"
            style={styles.recenter}
          >
            <Icon name="locate-fixed" size={14} color={palette.navy} />
          </Pressable>

          {/* Coord badge */}
          <View style={styles.coords}>
            <Icon name="map-pin" size={10} color={palette.navy} />
            {/*
              The lorry's own coordinates, or the pickup's until it reports.
              
              This read `17.4126° N, 78.7642° E` on every trip — a fixed point
              south-east of Hyderabad that belonged to no consignment.
            */}
            <Text style={styles.coordsText}>
              {(current ?? pickup)
                ? `${(current ?? pickup)!.latitude.toFixed(4)}° N, ${(current ?? pickup)!.longitude.toFixed(4)}° E`
                : 'No position yet'}
            </Text>
          </View>
        </TripMap>
        )}

        {/* Current location */}
        <Text style={styles.section}>CURRENT LOCATION</Text>
        <Card padding={11} marginBottom={10}>
          <View style={styles.locRow}>
            <IconWell
              icon="navigation"
              size={26}
              iconSize={14}
              backgroundColor={palette.goldTint}
              color={palette.gold}
              borderRadius={radius.md}
            />
            <View style={styles.locBody}>
              {/*
                What is known, not a place name we cannot resolve.
                
                There is no reverse geocoder behind this screen, so the mock's
                `NH-65 near Chevella toll / Ranga Reddy district` was pure
                invention. The leg and the freshness of the fix are the two
                things the API actually reports, and both are what an operator
                on the phone to a customer needs.
              */}
              <Text style={styles.locName}>
                {booking ? `${booking.pickupPlace} → ${booking.dropPlace}` : '—'}
              </Text>
              <Text style={styles.locMeta}>
                {current
                  ? `${current.latitude.toFixed(4)}, ${current.longitude.toFixed(4)}`
                  : 'The lorry has not reported a position yet'}
              </Text>
              <View style={styles.locStats}>
                <Text style={styles.locSpeed}>
                  {speedKmph != null ? `${speedKmph} km/h` : `${progress}% done`}
                </Text>
                {fixAge ? (
                  <>
                    <Text style={styles.locDot}>·</Text>
                    <Text style={styles.locHeading}>Updated {fixAge}</Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </Card>

        {/* Trip progress */}
        <Text style={styles.section}>TRIP PROGRESS</Text>
        <Card padding={12} marginBottom={10}>
          <View style={styles.progHead}>
            <View style={styles.progCol}>
              <Text style={styles.progLabel} numberOfLines={1}>
                {(booking?.pickupPlace ?? '—').toUpperCase()}
              </Text>
              <Text style={styles.progValue} numberOfLines={1}>
                {record?.startedAt
                  ? `${clock(record.startedAt)} · Started`
                  : 'Not started'}
              </Text>
            </View>
            <View style={[styles.progCol, styles.progRight]}>
              <Text style={styles.progLabel} numberOfLines={1}>
                {(booking?.dropPlace ?? '—').toUpperCase()}
              </Text>
              <Text style={styles.progValue} numberOfLines={1}>
                {record?.deliveredAt
                  ? `${clock(record.deliveredAt)} · Delivered`
                  : `${remainingKm} km to go`}
              </Text>
            </View>
          </View>

          <View style={styles.track}>
            <LinearGradient
              colors={[palette.gold, palette.red]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${Math.min(100, Math.max(2, progress))}%` }]}
            >
              <View style={styles.knob} />
            </LinearGradient>
          </View>

          <View style={styles.progFoot}>
            <Text style={styles.progCovered}>{Math.round(coveredKm)} km covered</Text>
            <Text style={styles.progLeft}>
              {remainingKm} km left · {progress}% done
            </Text>
          </View>
        </Card>

        {/* Driver & vehicle */}
        <Text style={styles.section}>DRIVER &amp; VEHICLE</Text>
        <Card padding={11} marginBottom={10}>
          <View style={styles.driverRow}>
            <LinearGradient
              colors={gradients.gold as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.driverAvatar}
            >
              <Text style={styles.driverInitials}>{driverInitials}</Text>
            </LinearGradient>

            <View style={styles.driverBody}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.driverMeta}>{driverMobile || 'No number on file'}</Text>
            </View>

            <Pressable
              onPress={call}
              accessibilityRole="button"
              accessibilityLabel={`Call ${driverName}`}
              disabled={!driverMobile}
              style={({ pressed }) => [
                styles.callBtn,
                pressed && styles.pressed,
                !driverMobile && styles.callDisabled,
              ]}
            >
              <Icon name="phone" size={14} color={palette.navy} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.driverRow}>
            <IconWell
              icon="truck"
              size={26}
              iconSize={14}
              backgroundColor={palette.navyTint}
              color={palette.navy}
              borderRadius={radius.md}
            />
            <View style={styles.driverBody}>
              <Text style={styles.plate}>{registration}</Text>
              <Text style={styles.driverMeta}>{vehicleLine || '—'}</Text>
            </View>
          </View>
        </Card>

        {/* Halts — where the lorry has stopped, with the driver's reason, the
            place, the time and photos, and the total time stopped up top.
            Self-hides when there are none. */}
        <HaltUpdates halts={halts} />
        </>
        ) : null}
      </Content>

      <Footer row>
        <Button
          label="Share"
          variant="outline"
          icon="share-2"
          iconSize={14}
          flex={1}
          padding={10}
          fontSize={11}
          gap={5}
          borderColor={palette.border}
          onPress={share}
        />
        <Button
          label="View Timeline"
          variant="gold"
          icon="clipboard-list"
          iconSize={14}
          flex={1.4}
          padding={10}
          fontSize={11}
          gap={5}
          onPress={openTimeline}
        />
      </Footer>

      {/* Full-screen map — a real Google map (pinch-zoom, pan, satellite toggle,
          recentre) fed the same live props, so the lorry keeps moving and the
          driver rides beside it, on the route to the drop. */}
      {pickup && drop ? (
        <Modal
          visible={fullScreen}
          animationType="slide"
          onRequestClose={() => setFullScreen(false)}
          statusBarTranslucent
        >
          <View style={styles.fullWrap}>
            <TripMap
              interactive
              pickup={pickup}
              drop={drop}
              current={current ?? pickup}
              routeCoordinates={road?.path}
              driver={mapDriver}
              halts={halts}
              height={windowHeight}
              style={styles.fullMap}
            />
            <Pressable
              style={[styles.closeBtn, { top: insets.top + s(12) }]}
              onPress={() => setFullScreen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close full-screen map"
            >
              <Icon name="x" size={20} color={palette.navy} />
            </Pressable>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  contentTop: { paddingTop: s(10), paddingBottom: s(14) },

  strip: {
    borderRadius: radius.xl,
    padding: s(12),
    marginBottom: s(12),
    ...shadows.elevatedCard,
  },
  stripHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(10),
  },
  movingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(3),
    paddingHorizontal: s(9),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gold,
    borderRadius: s(20),
  },
  movingText: font(8, '800', { color: palette.gold }),
  updated: font(8, '800', { color: palette.slate400, letterSpacing: 0.5 }),
  stripStats: { flexDirection: 'row' },
  stripStat: { flex: 1, alignItems: 'center', paddingVertical: s(2) },
  stripDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: alpha.white12,
  },
  stripValue: font(15, '800', { color: palette.white, lineHeight: 1 }),
  stripLabel: {
    ...font(7.5, '800', { color: palette.slate400, letterSpacing: 0.5 }),
    marginTop: s(3),
  },

  map: { borderRadius: radius.card, marginBottom: s(12) },
  expandBtn: {
    position: 'absolute',
    top: s(12),
    right: s(12),
    width: s(34),
    height: s(34),
    borderRadius: radius.md,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapMarker,
  },
  fullWrap: { flex: 1, backgroundColor: palette.screenBg },
  fullMap: { borderRadius: 0 },
  closeBtn: {
    position: 'absolute',
    left: s(12),
    width: s(40),
    height: s(40),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapMarker,
  },
  plateTag: {
    position: 'absolute',
    top: s(60),
    left: s(105),
    backgroundColor: palette.navy,
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    borderRadius: radius.sm,
    ...shadows.subtle,
  },
  plateText: font(8, '800', { color: palette.white }),
  zoom: {
    position: 'absolute',
    top: s(8),
    right: s(8),
    backgroundColor: palette.white,
    borderRadius: radius.sm,
    padding: s(3),
    gap: s(2),
    ...shadows.subtle,
  },
  zoomBtn: {
    width: s(22),
    height: s(22),
    backgroundColor: palette.screenBg,
    borderRadius: s(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: font(13, '800', { color: palette.navy }),
  recenter: {
    position: 'absolute',
    bottom: s(8),
    right: s(8),
    backgroundColor: palette.white,
    borderRadius: radius.sm,
    padding: s(6),
    ...shadows.subtle,
  },
  coords: {
    position: 'absolute',
    bottom: s(8),
    left: s(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: palette.white,
    paddingVertical: s(5),
    paddingHorizontal: s(8),
    borderRadius: radius.md,
    ...shadows.subtle,
  },
  coordsText: font(8, '800', { color: palette.navy }),

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },

  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(8) },
  locBody: { flex: 1, minWidth: 0 },
  locName: font(11, '800', { color: palette.navy }),
  locMeta: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(2),
  },
  locStats: {
    flexDirection: 'row',
    gap: s(8),
    marginTop: s(6),
  },
  locSpeed: font(9, '800', { color: palette.gold }),
  locDot: font(9, '800', { color: palette.slate500 }),
  locHeading: font(9, '800', { color: palette.navy }),

  progHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: s(10),
    marginBottom: s(8),
  },
  // Each end gets an equal half and can shrink, so a long place name truncates
  // inside its own column instead of running across into the other one.
  progCol: { flex: 1, minWidth: 0 },
  progRight: { alignItems: 'flex-end' },
  progLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
  progValue: font(10, '800', { color: palette.navy }),
  track: {
    height: s(6),
    backgroundColor: palette.border,
    borderRadius: s(6),
  },
  fill: {
    height: '100%',
    borderRadius: s(6),
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    right: s(-6),
    width: s(12),
    height: s(12),
    backgroundColor: palette.white,
    borderWidth: s(2),
    borderColor: palette.red,
    borderRadius: radius.full,
    ...shadows.switchKnob,
  },
  progFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: s(8),
  },
  progCovered: font(9, '800', { color: palette.gold }),
  progLeft: font(9, '800', { color: palette.slate500 }),

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  driverAvatar: {
    width: s(38),
    height: s(38),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: font(13, '800', { color: palette.navy }),
  driverBody: { flex: 1 },
  driverName: font(11, '800', { color: palette.navy }),
  driverMeta: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(1),
  },
  plate: font(11, '800', { color: palette.navy, letterSpacing: 0.5 }),
  /** A driver with no number on file: the button stays, visibly inert. */
  callDisabled: { opacity: 0.4 },
  noMap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  noMapText: { ...font(11, '600', { color: palette.slate500 }), flex: 1 },
  callBtn: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.goldSmall,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.divider,
    marginVertical: s(10),
  },

  pressed: { opacity: 0.8 },
});
