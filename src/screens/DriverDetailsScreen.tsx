import React, { useCallback, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { driverService, tripService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Icon,
  IconWell,
  RadialGlow,
  Screen,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 11 — Driver Profile.
 *
 *   navy hero (gold-ringed 60px avatar, VERIFIED · ONLINE chip, call button) ·
 *   stats card overlapping by -24px (TRIPS / EXPERIENCE / ON TIME) ·
 *   CURRENT TRIP navy card · ASSIGNED VEHICLE row · PERSONAL DETAILS
 *   (DL / Aadhar / PAN, each VERIFIED) · outline Edit Driver Profile
 */
type KycRow = {
  id: string;
  title: string;
  meta: string;
  icon: IconName;
  bg: string;
  color: string;
};

const KYC: KycRow[] = [
  {
    id: 'dl',
    title: 'Driving License',
    meta: 'DLAP 04...123456 · Till 2029',
    icon: 'id-card',
    bg: palette.goldTint,
    color: palette.gold,
  },
  {
    id: 'aadhar',
    title: 'Aadhar',
    meta: 'XXXX XXXX 4521',
    icon: 'fingerprint',
    bg: palette.navyTint,
    color: palette.navy,
  },
  {
    id: 'pan',
    title: 'PAN Card',
    meta: 'ABCDE1234F',
    icon: 'credit-card',
    bg: palette.redTint,
    color: palette.red,
  },
];

export const DriverDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DriverDetails'>>();
  const { driverId } = route.params;

  /*
   * The screen never read its own route parameter.
   *
   * Everything below was a literal — a fixed phone number, `vehicleId: 'v1'`,
   * `tripId: 'TR-2026-8836'` — so whichever driver you opened, the call button
   * rang one number and the vehicle card opened an id that does not exist,
   * which is a Vehicle Details screen that 404s and never loads.
   */
  const { data } = useApi(() => driverService.get(driverId), [driverId]);

  const vehicle = (data?.vehicle ?? null) as {
    id?: string;
    registration?: string;
  } | null;
  const mobile = (data?.user as { mobile?: string } | undefined)?.mobile;

  /* The trip this driver is on, if any — matched on the live board. */
  const live = useApi(() => tripService.live(), []);
  const trip = useMemo(
    () => (live.data ?? []).find(t => t.registration === vehicle?.registration) ?? null,
    [live.data, vehicle?.registration],
  );

  const call = useCallback(() => {
    if (mobile) {
      Linking.openURL(`tel:${mobile}`).catch(() => undefined);
    }
  }, [mobile]);

  const openTrip = useCallback(() => {
    if (trip) {
      navigation.navigate('TripDetails', { tripId: trip.tripId });
    }
  }, [navigation, trip]);

  const openVehicle = useCallback(() => {
    /* No truck assigned means nothing to open — better inert than a 404. */
    if (vehicle?.id) {
      navigation.navigate('VehicleDetails', { vehicleId: vehicle.id });
    }
  }, [navigation, vehicle]);

  /** Editing reuses the Add Driver form — same fields, prefilled upstream. */
  const editDriver = useCallback(
    () => navigation.navigate('AddDriver'),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader title="Driver Profile" showBack onBackPress={navigation.goBack} />

      <Content padding={0}>
        {/* Driver hero */}
        <LinearGradient
          colors={[palette.navy, palette.navyMid, palette.navyDark]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={140}
            color={palette.gold}
            opacity={0.28}
            top={-40}
            right={-40}
          />

          <View style={styles.heroRow}>
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={gradients.gold as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>RK</Text>
              </View>
              <View style={styles.presence} />
            </View>

            <View style={styles.heroBody}>
              <Text style={styles.heroName}>Ramesh Kumar</Text>
              <Text style={styles.heroPhone}>+91 98765 43210</Text>
              <View style={styles.verifiedChip}>
                <Icon name="badge-check" size={10} color={palette.navy} />
                <Text style={styles.verifiedText}>VERIFIED · ONLINE</Text>
              </View>
            </View>

            <Pressable
              onPress={call}
              accessibilityRole="button"
              accessibilityLabel="Call Ramesh Kumar"
              style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
            >
              <Icon name="phone" size={16} color={palette.navy} />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Stats card overlap */}
        <View style={styles.statsWrap}>
          <View style={styles.statsCard}>
            <View style={[styles.stat, styles.statDivider]}>
              <View style={styles.statValueRow}>
                <Icon name="truck" size={12} color={palette.gold} />
                <Text style={styles.statValue}>240</Text>
              </View>
              <Text style={styles.statLabel}>TRIPS</Text>
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <View style={styles.statValueRow}>
                <Icon name="calendar-days" size={12} color={palette.gold} />
                <Text style={styles.statValue}>4y</Text>
              </View>
              <Text style={styles.statLabel}>EXPERIENCE</Text>
            </View>
            <View style={styles.stat}>
              <View style={styles.statValueRow}>
                <Icon name="check-circle-2" size={12} color={palette.gold} />
                <Text style={styles.statValue}>98%</Text>
              </View>
              <Text style={styles.statLabel}>ON TIME</Text>
            </View>
          </View>
        </View>

        {/* Current trip */}
        <View style={styles.block}>
          <Text style={styles.section}>CURRENT TRIP</Text>
          <Pressable
            onPress={openTrip}
            accessibilityRole="button"
            accessibilityLabel="Open current trip TR-2026-8836"
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <LinearGradient
              colors={gradients.navyHero as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tripCard}
            >
              <View style={styles.tripHead}>
                <Text style={styles.tripRef}>#TR-2026-8836</Text>
                <Text style={styles.tripKm}>128/620 KM</Text>
              </View>
              <View style={styles.tripRoute}>
                <Text style={styles.tripCity}>Vizag</Text>
                <Icon name="arrow-right" size={14} color={palette.gold} />
                <Text style={styles.tripCity}>Hyderabad</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Assigned vehicle */}
        <View style={styles.block}>
          <Text style={styles.section}>ASSIGNED VEHICLE</Text>
          <Card
            padding={11}
            marginBottom={0}
            onPress={openVehicle}
            accessibilityLabel="Open vehicle AP 31 XX 1234"
            style={styles.vehicleRow}
          >
            <IconWell
              icon="truck"
              size={38}
              iconSize={20}
              backgroundColor={palette.goldTint}
              color={palette.gold}
              borderRadius={radius.lg}
            />
            <View style={styles.vehicleBody}>
              <Text style={styles.vehicleReg}>AP 31 XX 1234</Text>
              <Text style={styles.vehicleModel}>14 Ft Truck · Tata LPT 1109</Text>
            </View>
            <Icon name="chevron-right" size={16} color={palette.slate400} />
          </Card>
        </View>

        {/* Personal details */}
        <View style={styles.block}>
          <Text style={styles.section}>PERSONAL DETAILS</Text>
          <View style={styles.kycCard}>
            {KYC.map((row, index) => (
              <View
                key={row.id}
                style={[styles.kycRow, index < KYC.length - 1 && styles.kycDivider]}
              >
                <IconWell
                  icon={row.icon}
                  size={26}
                  iconSize={14}
                  backgroundColor={row.bg}
                  color={row.color}
                  borderRadius={radius.md}
                />
                <View style={styles.kycBody}>
                  <Text style={styles.kycTitle}>{row.title}</Text>
                  <Text style={styles.kycMeta}>{row.meta}</Text>
                </View>
                <View style={styles.pillGold}>
                  <Text style={styles.pillGoldText}>VERIFIED</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footerBlock}>
          <Button
            label="Edit Driver Profile"
            variant="outline"
            icon="edit-3"
            onPress={editDriver}
          />
        </View>
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingTop: s(18),
    paddingHorizontal: s(14),
    paddingBottom: s(40),
    overflow: 'hidden',
  },
  heroRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
  },
  avatarWrap: { width: s(66), height: s(66), alignItems: 'center', justifyContent: 'center' },
  avatarRing: { ...StyleSheet.absoluteFill, borderRadius: radius.full },
  avatar: {
    width: s(60),
    height: s(60),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: font(22, '800', { color: palette.navy }),
  presence: {
    position: 'absolute',
    bottom: s(-2),
    right: s(-2),
    width: s(14),
    height: s(14),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    borderWidth: s(2),
    borderColor: palette.navy,
  },
  heroBody: { flex: 1, minWidth: 0 },
  heroName: font(15, '800', { color: palette.white, lineHeight: 1.15 }),
  heroPhone: {
    ...font(10, '400', { color: palette.white }),
    opacity: 0.75,
    marginTop: s(1),
  },
  verifiedChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginTop: s(5),
    paddingVertical: s(2),
    paddingHorizontal: s(8),
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
  },
  verifiedText: font(8, '800', { color: palette.navy, letterSpacing: 0.5 }),
  callBtn: {
    width: s(36),
    height: s(36),
    backgroundColor: palette.gold,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsWrap: { paddingHorizontal: s(12), marginTop: s(-24) },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    paddingVertical: s(12),
    paddingHorizontal: s(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadows.elevatedCard,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.divider,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  statValue: font(16, '800', { color: palette.navy, lineHeight: 1 }),
  statLabel: {
    ...font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
    marginTop: s(5),
  },

  block: { paddingTop: s(14), paddingHorizontal: s(12) },
  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },

  tripCard: { borderRadius: radius.card, padding: s(11) },
  tripHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(6),
  },
  tripRef: font(9, '800', { color: palette.gold, letterSpacing: 0.5 }),
  tripKm: font(9, '800', { color: palette.gold }),
  tripRoute: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  tripCity: font(11, '800', { color: palette.white }),

  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  vehicleBody: { flex: 1 },
  vehicleReg: font(11, '800', { color: palette.navy, letterSpacing: 0.5 }),
  vehicleModel: font(9, '400', { color: palette.slate500 }),

  kycCard: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  kycRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(11),
    paddingVertical: s(11),
    paddingHorizontal: s(12),
  },
  kycDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  kycBody: { flex: 1 },
  kycTitle: font(11, '800', { color: palette.navy }),
  kycMeta: font(9, '400', { color: palette.slate500 }),
  pillGold: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldSoft,
    borderRadius: radius.sm,
  },
  pillGoldText: font(8, '800', { color: palette.goldText }),

  footerBlock: {
    paddingTop: s(14),
    paddingHorizontal: s(12),
    paddingBottom: s(20),
  },

  pressed: { opacity: 0.8 },
});
