import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
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
  Icon,
  IconWell,
  ListState,
  RadialGlow,
  Screen,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';
import { tripService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Screen 19 — Trip Details.
 *
 *   navy hero (#TR-2026-8836, IN TRANSIT chip, route, 21% rail + ETA) ·
 *   DRIVER & VEHICLE card with a dashed divider and GPS freshness ·
 *   CUSTOMER card · DOCUMENTS · 5 as a 2-up grid ·
 *   Timeline / Track Live footer
 */
type DocTile = {
  id: string;
  name: string;
  size: string;
  icon: IconName;
  bg: string;
  color: string;
};

const DOCS: DocTile[] = [
  {
    id: 'eway',
    name: 'E-way Bill',
    size: '234 KB',
    icon: 'scroll-text',
    bg: palette.navyTint,
    color: palette.navy,
  },
  {
    id: 'invoice',
    name: 'Invoice',
    size: '1.1 MB',
    icon: 'receipt',
    bg: palette.goldTint,
    color: palette.gold,
  },
  {
    id: 'waybill',
    name: 'Waybill',
    size: '342 KB',
    icon: 'file-text',
    bg: palette.navyTint,
    color: palette.navy,
  },
  {
    id: 'lr',
    name: 'LR',
    size: '456 KB',
    icon: 'file-check',
    bg: palette.goldTint,
    color: palette.gold,
  },
  {
    // The mock labels this section "DOCUMENTS · 5" but draws four tiles. POD
    // is the missing fifth, and it doubles as the only route into the POD
    // Viewer screen (23), which nothing else reached.
    id: 'pod',
    name: 'Proof of Delivery',
    size: '892 KB',
    icon: 'package-check',
    bg: palette.redTint,
    color: palette.red,
  },
];

export const TripDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetails'>>();
  const { tripId } = route.params;

  /*
   * The trip this screen was opened for.
   *
   * It loaded nothing at all. Every value below — the reference, the status,
   * both cities, the progress rail, the driver, the lorry and the customer —
   * was written into the markup, so opening any trip in the fleet showed
   * `#TR-2026-8836 · Ramesh Kumar · AP 31 XX 1234 · Sri Sai Traders`. An
   * operator checking on a consignment was reading somebody else's, every
   * time, and the screen gave no sign of it.
   *
   * One request carries all of it: the trip, its booking, the vehicle, the
   * driver and the customer.
   */
  const { data, loading, error, refetch } = useApi(
    () => tripService.get(tripId),
    [tripId],
  );

  const trip = (data ?? null) as Record<string, any> | null;
  const booking = trip?.booking;
  const driverName: string = trip?.driver?.user?.name ?? '—';
  const driverMobile: string = trip?.driver?.user?.mobile ?? '';
  const registration: string = trip?.vehicle?.registration ?? '—';
  const vehicleType: string = trip?.vehicle?.type ?? '';
  const customer = booking?.customer;
  const customerName: string =
    customer?.company || customer?.user?.name || 'Customer';
  const customerContact: string = customer?.user?.name ?? '';
  const customerMobile: string = customer?.user?.mobile ?? '';

  /* What the booking and the trip actually carry between them. */
  const docCount =
    ((booking?.documents as unknown[] | undefined)?.length ?? 0) +
    ((trip?.documents as unknown[] | undefined)?.length ?? 0);

  const distanceKm = Number(trip?.distanceKm ?? 0);
  const coveredKm = Number(trip?.coveredKm ?? 0);
  const progress =
    distanceKm > 0 ? Math.min(100, Math.round((coveredKm / distanceKm) * 100)) : 0;

  /** `RK` from `Ramesh Kumar`, for the avatar. */
  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0] ?? '')
      .join('')
      .toUpperCase();

  /**
   * Rings the driver on this trip.
   *
   * It dialled a fixed seed number, so "Call driver" reached one person
   * regardless of who was actually carrying the load — on a screen whose whole
   * purpose is to check on a consignment in progress.
   */
  const callDriver = useCallback(() => {
    if (!driverMobile) {
      return;
    }
    Linking.openURL(`tel:${driverMobile}`).catch(() => undefined);
  }, [driverMobile]);

  /** Rings the shipper on this trip. */
  const callCustomer = useCallback(() => {
    if (!customerMobile) {
      return;
    }
    Linking.openURL(`tel:${customerMobile}`).catch(() => undefined);
  }, [customerMobile]);

  const openTimeline = useCallback(
    () => navigation.navigate('TripTimeline', { tripId }),
    [navigation, tripId],
  );

  const trackLive = useCallback(
    () => navigation.navigate('LiveTripTrack', { tripId }),
    [navigation, tripId],
  );

  const openPod = useCallback(
    () => navigation.navigate('PodViewer', { tripId }),
    [navigation, tripId],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title={trip?.reference ? `Trip ${trip.reference}` : 'Trip'}
        subtitle={
          trip?.status
            ? trip.status.replace('_', ' ').toLowerCase()
            : loading
              ? 'Loading…'
              : ''
        }
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
        {/*
          A screen that fetches has to say when it cannot.
          
          Loading, failure and not-found were all impossible states before,
          because nothing was ever requested — the invented trip rendered
          instantly and always.
        */}
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && !trip}
          what="trip"
          emptyIcon="truck"
          emptyHint="This trip could not be found."
          onRetry={refetch}
        />

        {trip ? (
        <>
        {/* Hero */}
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={120}
            color={palette.gold}
            opacity={0.3}
            top={-25}
            right={-25}
          />

          <View style={styles.heroBody}>
            <View style={styles.heroHead}>
              <Text style={styles.heroRef}>#{trip?.reference ?? '—'}</Text>
              <View style={styles.heroChip}>
                <BlinkDot color={palette.gold} size={5} />
                <Text style={styles.heroChipText}>
                  {(trip?.status ?? '').replace('_', ' ') || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.heroRoute}>
              <Text style={styles.heroCity} numberOfLines={1}>
                {booking?.pickupPlace ?? '—'}
              </Text>
              <Icon name="arrow-right" size={14} color={palette.gold} />
              <Text style={styles.heroCity} numberOfLines={1}>
                {booking?.dropPlace ?? '—'}
              </Text>
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressHead}>
                <Text style={styles.progressText}>
                  {Math.round(coveredKm)} / {Math.round(distanceKm)} KM
                </Text>
                {/*
                  No ETA. It read `21% · ETA 2:45 PM` on every trip, and there
                  is nothing behind it — the API reports distance covered, not
                  a predicted arrival, so an invented time is the one number an
                  operator would relay to a waiting customer.
                */}
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
              <View style={styles.track}>
                <LinearGradient
                  colors={[palette.gold, palette.red]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  /* The rail was a fixed width, so every trip looked 21% run. */
                  style={[styles.fill, { width: `${progress}%` }]}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Driver + vehicle */}
        <Text style={styles.section}>DRIVER &amp; VEHICLE</Text>
        <Card padding={11}>
          <View style={styles.driverRow}>
            <View>
              <LinearGradient
                colors={gradients.navyHero as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.driverAvatar}
              >
                <Text style={styles.driverInitials}>
                  {initialsOf(driverName)}
                </Text>
              </LinearGradient>
              <View style={styles.presence} />
            </View>

            <View style={styles.driverBody}>
              <Text style={styles.driverName} numberOfLines={1}>
                {driverName}
              </Text>
              <Text style={styles.driverPhone}>
                {driverMobile || 'No number on file'}
              </Text>
            </View>

            <Pressable
              onPress={callDriver}
              accessibilityRole="button"
              accessibilityLabel={
                driverMobile ? `Call ${driverName}` : 'No number on file'
              }
              style={({ pressed }) => [styles.callGold, pressed && styles.pressed]}
            >
              <Icon name="phone" size={14} color={palette.navy} />
            </Pressable>
          </View>

          <View style={styles.vehicleRow}>
            <IconWell
              icon="truck"
              size={38}
              iconSize={20}
              backgroundColor={palette.goldTint}
              color={palette.gold}
              borderRadius={radius.lg}
            />
            <View style={styles.driverBody}>
              <Text style={styles.driverName} numberOfLines={1}>
                {registration}
              </Text>
              {/*
                No speed. `62 km/h` was fixed text on a screen that fetches
                nothing, and a speed is exactly the sort of figure an operator
                repeats to a customer asking where their load is.
              */}
              <Text style={styles.driverPhone}>{vehicleType || '—'}</Text>
            </View>
            {/*
              Removed. `GPS · 12s ago` was fixed text, so a lorry that had not
              reported for an hour still claimed a fix from twelve seconds ago
              — which is the one thing on this card an operator would use to
              decide whether to worry.
            */}
          </View>
        </Card>

        {/* Customer */}
        <Text style={[styles.section, styles.sectionGap]}>CUSTOMER</Text>
        <Card padding={11} style={styles.customerRow}>
          <View style={styles.customerTile}>
            <Text style={styles.customerInitials}>
              {initialsOf(customerName)}
            </Text>
          </View>
          <View style={styles.driverBody}>
            <Text style={styles.driverName} numberOfLines={1}>
              {customerName}
            </Text>
            <Text style={styles.driverPhone} numberOfLines={1}>
              {[customerContact, customerMobile].filter(Boolean).join(' · ') ||
                'No contact on file'}
            </Text>
          </View>
          {/*
            Rings the customer, not the driver.
            
            This button called `callDriver` — the same handler as the card
            above it — so the office rang the driver while believing they were
            ringing the shipper.
          */}
          <Pressable
            onPress={callCustomer}
            disabled={!customerMobile}
            accessibilityRole="button"
            accessibilityState={{ disabled: !customerMobile }}
            accessibilityLabel={
              customerMobile ? `Call ${customerName}` : 'No number on file'
            }
            style={({ pressed }) => [
              styles.callNavy,
              !customerMobile && styles.callOff,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="phone" size={14} color={palette.white} />
          </Pressable>
        </Card>

        {/* Documents */}
        {/*
          Counted, not claimed. The heading said `DOCUMENTS · 5` while the
          grid below drew four tiles, on every trip.
        */}
        <Text style={[styles.section, styles.sectionGap]}>
          DOCUMENTS · {docCount}
        </Text>
        <View style={styles.docGrid}>
          {DOCS.map(doc => (
            <Pressable
              key={doc.id}
              onPress={doc.id === 'pod' ? openPod : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${doc.name}, ${doc.size}`}
              style={({ pressed }) => [styles.docCard, pressed && styles.pressed]}
            >
              <IconWell
                icon={doc.icon}
                size={26}
                iconSize={14}
                backgroundColor={doc.bg}
                color={doc.color}
                borderRadius={radius.md}
              />
              <View style={styles.docBody}>
                <Text style={styles.docName}>{doc.name}</Text>
                <Text style={styles.docSize}>{doc.size}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        </>
        ) : null}
      </Content>

      <Footer row>
        <Button
          label="Timeline"
          variant="outline"
          icon="clipboard-list"
          iconSize={14}
          flex={1}
          padding={10}
          fontSize={11}
          gap={5}
          borderColor={palette.border}
          onPress={openTimeline}
        />
        <Button
          label="Track Live"
          variant="gold"
          icon="map-pin"
          iconSize={14}
          flex={1.5}
          padding={10}
          fontSize={11}
          gap={5}
          onPress={trackLive}
        />
      </Footer>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: s(14),
    marginBottom: s(12),
    overflow: 'hidden',
  },
  heroBody: { position: 'relative' },
  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  heroRef: font(14, '800', { color: palette.white }),
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: s(20),
  },
  heroChipText: font(8, '800', { color: palette.gold, letterSpacing: 1 }),
  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  heroCity: font(13, '800', { color: palette.white }),
  progressBlock: { marginTop: s(10) },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(4),
  },
  progressText: { ...font(9, '800', { color: palette.white }), opacity: 0.85 },
  track: {
    height: s(5),
    backgroundColor: alpha.white15,
    borderRadius: s(3),
    overflow: 'hidden',
  },
  fill: { height: '100%', width: '21%', borderRadius: s(3) },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginBottom: s(8),
  },
  driverAvatar: {
    width: s(36),
    height: s(36),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: font(11, '800', { color: palette.white }),
  presence: {
    position: 'absolute',
    bottom: s(-1),
    right: s(-1),
    width: s(11),
    height: s(11),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    borderWidth: s(2),
    borderColor: palette.white,
  },
  driverBody: { flex: 1 },
  driverName: font(11, '800', { color: palette.navy }),
  driverPhone: font(9, '400', { color: palette.slate500 }),
  callGold: {
    width: s(30),
    height: s(30),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callOff: { opacity: 0.45 },
  callNavy: {
    width: s(30),
    height: s(30),
    borderRadius: radius.full,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingTop: s(8),
    borderTopWidth: s(1),
    borderTopColor: palette.gray200,
    borderStyle: 'dashed',
  },
  gps: font(9, '800', { color: palette.gold }),

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  customerTile: {
    width: s(38),
    height: s(38),
    backgroundColor: palette.navyTint,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: font(11, '800', { color: palette.navy }),

  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
    marginBottom: s(12),
  },
  docCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: s(9),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  docBody: { flex: 1, minWidth: 0 },
  docName: font(9, '800', { color: palette.navy }),
  docSize: font(8, '400', { color: palette.slate500 }),

  pressed: { opacity: 0.8 },
});
