import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  BlinkDot,
  Card,
  Content,
  Icon,
  PulseGlow,
  RadialGlow,
  Screen,
  TwinkleDot,
} from '@components/index';
import { useTopInset } from '@hooks/useTopInset';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 4 — Dashboard.
 *
 *   premium navy header (avatar ring, Namaste, bell + 12 badge) ·
 *   FLEET STATUS · LIVE tri-stat card · gold "7 bookings awaiting approval" ·
 *   4-cell stat grid · ACTIVE TRIPS navy card with progress rail ·
 *   QUICK ACTIONS 4-up · THIS WEEK bar chart
 *
 * The header uses `padding:52px 14px 32px` and the content `margin-top:-24px`,
 * so the first card overlaps the header — applied to the first child rather
 * than the ScrollView, which would corrupt content-height measurement.
 */
type Stat = {
  label: string;
  value: string;
  note: string;
  icon: IconName;
  bg: string;
  color: string;
};

const STATS: Stat[] = [
  {
    label: 'FLEET',
    value: '42',
    note: '+3 this month',
    icon: 'truck',
    bg: palette.navyTint,
    color: palette.navy,
  },
  {
    label: 'DRIVERS',
    value: '38',
    note: '32 online now',
    icon: 'user-cog',
    bg: palette.goldTint,
    color: palette.gold,
  },
  {
    label: 'CUSTOMERS',
    value: '124',
    note: '+8 this mo',
    icon: 'users',
    bg: palette.redTint,
    color: palette.red,
  },
  {
    label: 'DELIVERED',
    value: '1,284',
    note: '98% on-time',
    icon: 'check-circle-2',
    bg: palette.navyTint,
    color: palette.navy,
  },
];

type QuickAction = {
  lines: [string, string];
  icon: IconName;
  bg: string;
  color: string;
  route: keyof RootStackParamList;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    lines: ['Add', 'Booking'],
    icon: 'plus-circle',
    bg: palette.navyTint,
    color: palette.navy,
    route: 'BookingReview',
  },
  {
    lines: ['Add', 'Vehicle'],
    icon: 'truck',
    bg: palette.goldTint,
    color: palette.gold,
    route: 'AddVehicle',
  },
  {
    lines: ['Add', 'Driver'],
    icon: 'user-plus',
    bg: palette.redTint,
    color: palette.red,
    route: 'AddDriver',
  },
  {
    lines: ['Live', 'Fleet'],
    icon: 'map-pin',
    bg: palette.navyTint,
    color: palette.navy,
    route: 'LiveFleetMap',
  },
];

/** `height:%` on each bar; the last one is navy (today). */
const WEEK = [
  { day: 'M', height: 55, today: false },
  { day: 'T', height: 70, today: false },
  { day: 'W', height: 50, today: false },
  { day: 'T', height: 85, today: false },
  { day: 'F', height: 65, today: false },
  { day: 'S', height: 100, today: false },
  { day: 'S', height: 75, today: true },
];

export const DashboardScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const topInset = useTopInset();

  const openNotifications = useCallback(
    () => navigation.navigate('Notifications'),
    [navigation],
  );
  const openBookings = useCallback(
    () => navigation.navigate('Tabs', { screen: 'Bookings' }),
    [navigation],
  );
  const openTrips = useCallback(() => navigation.navigate('Trips'), [navigation]);
  const openTrip = useCallback(
    () => navigation.navigate('TripDetails', { tripId: 'TR-2026-8836' }),
    [navigation],
  );

  /** Each quick action has its own params, so route them explicitly. */
  const runQuickAction = useCallback(
    (action: QuickAction) => {
      switch (action.route) {
        case 'BookingReview':
          navigation.navigate('Tabs', { screen: 'Bookings' });
          break;
        case 'AddVehicle':
          navigation.navigate('AddVehicle');
          break;
        case 'AddDriver':
          navigation.navigate('AddDriver');
          break;
        default:
          navigation.navigate('LiveFleetMap');
      }
    },
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.screenBg}>
      {/* Premium header */}
      <LinearGradient
        colors={[palette.navy, palette.navyMid, palette.navyDark]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topInset + s(8) }]}
      >
        <RadialGlow
          size={180}
          color={palette.gold}
          opacity={0.22}
          top={-50}
          right={-50}
        />
        <TwinkleDot size={3} color={palette.gold} style={styles.headerTwinkle} />

        <View style={styles.headerRow}>
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={gradients.gold as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AD</Text>
            </View>
          </View>

          <View style={styles.greetBlock}>
            <Text style={styles.greetSmall}>Namaste,</Text>
            <Text style={styles.greetName}>Admin (Owner)</Text>
            <Text style={styles.greetOrg}>SMT Simhadri Transport</Text>
          </View>

          <Pressable
            onPress={openNotifications}
            accessibilityRole="button"
            accessibilityLabel="Notifications, 12 unread"
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <Icon name="bell" size={16} color={palette.white} />
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>12</Text>
            </View>
          </Pressable>
        </View>
      </LinearGradient>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        {/* Fleet status live card */}
        <View style={styles.fleetCard}>
          <View style={styles.fleetHead}>
            <Text style={styles.fleetLabel}>FLEET STATUS · LIVE</Text>
            <View style={styles.nowChip}>
              <BlinkDot color={palette.gold} size={6} />
              <Text style={styles.nowText}>NOW</Text>
            </View>
          </View>

          <View style={styles.fleetStats}>
            <View style={[styles.fleetStat, styles.fleetStatDivider]}>
              <View style={styles.fleetValueRow}>
                <Icon name="activity" size={12} color={palette.gold} />
                <Text style={styles.fleetValue}>18</Text>
              </View>
              <Text style={styles.fleetStatLabel}>ACTIVE</Text>
            </View>
            <View style={[styles.fleetStat, styles.fleetStatDivider]}>
              <View style={styles.fleetValueRow}>
                <Icon name="parking-circle" size={12} color={palette.navy} />
                <Text style={styles.fleetValue}>14</Text>
              </View>
              <Text style={styles.fleetStatLabel}>AVAILABLE</Text>
            </View>
            <View style={styles.fleetStat}>
              <View style={styles.fleetValueRow}>
                <Icon name="truck" size={12} color={palette.gold} />
                <Text style={styles.fleetValue}>32</Text>
              </View>
              <Text style={styles.fleetStatLabel}>TOTAL</Text>
            </View>
          </View>
        </View>

        {/* Pending bookings CTA */}
        <Pressable
          onPress={openBookings}
          accessibilityRole="button"
          accessibilityLabel="7 bookings awaiting approval"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <LinearGradient
            colors={gradients.gold as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <View style={styles.ctaBloom} />

            <View style={styles.ctaRow}>
              <View style={styles.ctaIconWrap}>
                <PulseGlow color={palette.navy} opacity={0.15} duration={1800} />
                <View style={styles.ctaIcon}>
                  <Icon name="clipboard-check" size={16} color={palette.gold} />
                </View>
              </View>

              <View style={styles.ctaBody}>
                <Text style={styles.ctaTitle}>7 bookings awaiting approval</Text>
                <Text style={styles.ctaMeta}>
                  Tap to review &amp; dispatch drivers
                </Text>
              </View>

              <Icon name="chevron-right" size={20} color={palette.navy} />
            </View>
          </LinearGradient>
        </Pressable>

        {/* 4-cell stats */}
        <View style={styles.grid}>
          {STATS.map(stat => (
            <Card key={stat.label} padding={11} marginBottom={0} style={styles.gridCell}>
              <View style={styles.statHead}>
                <View style={[styles.statTile, { backgroundColor: stat.bg }]}>
                  <Icon name={stat.icon} size={16} color={stat.color} />
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statNote}>{stat.note}</Text>
            </Card>
          ))}
        </View>

        {/* Active trip */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>ACTIVE TRIPS · 18</Text>
          <Pressable
            onPress={openTrips}
            accessibilityRole="button"
            accessibilityLabel="See all trips"
          >
            <Text style={styles.seeAll}>See all →</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={openTrip}
          accessibilityRole="button"
          accessibilityLabel="Trip TR-2026-8836, Vizag to Hyderabad, in transit"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <LinearGradient
            colors={gradients.navyHero as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tripCard}
          >
            <RadialGlow
              size={110}
              color={palette.gold}
              opacity={0.3}
              top={-25}
              right={-25}
            />

            <View style={styles.tripBody}>
              <View style={styles.tripHead}>
                <View style={styles.tripStatus}>
                  <BlinkDot color={palette.gold} size={6} />
                  <Text style={styles.tripStatusText}>IN TRANSIT</Text>
                </View>
                <Text style={styles.tripRef}>#TR-2026-8836</Text>
              </View>

              <View style={styles.tripRoute}>
                <Text style={styles.tripCity}>Vizag</Text>
                <Icon name="arrow-right" size={14} color={palette.gold} />
                <Text style={styles.tripCity}>Hyderabad</Text>
              </View>

              <View style={styles.tripMeta}>
                <Text style={styles.tripMetaText}>Ramesh K</Text>
                <Text style={styles.tripMetaDivider}>|</Text>
                <Text style={styles.tripMetaText}>AP 31 XX 1234</Text>
              </View>

              <View style={styles.tripProgressBlock}>
                <View style={styles.tripProgressHead}>
                  <Text style={styles.tripProgressText}>128 / 620 KM</Text>
                  <Text style={styles.tripProgressPct}>21%</Text>
                </View>
                <View style={styles.tripTrack}>
                  <LinearGradient
                    colors={[palette.gold, palette.red]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tripFill}
                  />
                </View>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Quick actions */}
        <Text style={[styles.sectionLabel, styles.sectionGap]}>
          QUICK ACTIONS
        </Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map(action => (
            <Pressable
              key={action.lines.join(' ')}
              onPress={() => runQuickAction(action)}
              accessibilityRole="button"
              accessibilityLabel={action.lines.join(' ')}
              style={({ pressed }) => [
                styles.quickCell,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.quickTile, { backgroundColor: action.bg }]}>
                <Icon name={action.icon} size={16} color={action.color} />
              </View>
              <Text style={styles.quickText}>
                {action.lines[0]}
                {'\n'}
                {action.lines[1]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Weekly trend */}
        <Card padding={12} marginBottom={0}>
          <View style={styles.trendHead}>
            <View>
              <Text style={styles.trendLabel}>THIS WEEK</Text>
              <Text style={styles.trendValue}>128 trips</Text>
            </View>
            <Text style={styles.trendDelta}>+12% vs last</Text>
          </View>

          <View style={styles.chart}>
            {WEEK.map((bar, index) => (
              <LinearGradient
                key={`${bar.day}-${index}`}
                colors={
                  bar.today
                    ? (gradients.navyHero as unknown as string[])
                    : (gradients.gold as unknown as string[])
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.bar, { height: `${bar.height}%` }]}
              />
            ))}
          </View>

          <View style={styles.chartAxis}>
            {WEEK.map((bar, index) => (
              <Text key={`${bar.day}-label-${index}`} style={styles.axisText}>
                {bar.day}
              </Text>
            ))}
          </View>
        </Card>
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: s(14),
    paddingBottom: s(32),
    overflow: 'hidden',
  },
  headerTwinkle: { position: 'absolute', top: s(56), right: s(120) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    width: '100%',
  },
  avatarWrap: { width: s(48), height: s(48), alignItems: 'center', justifyContent: 'center' },
  avatarRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.full,
  },
  avatar: {
    width: s(44),
    height: s(44),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: font(14, '800', { color: palette.navy }),
  greetBlock: { flex: 1, minWidth: 0 },
  greetSmall: { ...font(9, '700', { color: palette.white }), opacity: 0.7 },
  greetName: font(14, '800', { color: palette.white, lineHeight: 1.15 }),
  greetOrg: {
    ...font(9, '700', { color: palette.white }),
    opacity: 0.7,
    marginTop: s(1),
  },
  bell: {
    width: s(36),
    height: s(36),
    backgroundColor: alpha.white10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.white15,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: s(-3),
    right: s(-3),
    width: s(16),
    height: s(16),
    borderRadius: radius.full,
    backgroundColor: palette.red,
    borderWidth: s(2),
    borderColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: font(8, '800', { color: palette.white }),

  /** `.content { margin-top:-24px; padding-top:0 }`. */
  contentTop: { paddingTop: 0 },

  fleetCard: {
    marginTop: s(-24),
    backgroundColor: palette.white,
    borderRadius: radius.xxl,
    padding: s(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    marginBottom: s(12),
    ...shadows.elevatedCard,
  },
  fleetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(10),
  },
  fleetLabel: font(9, '800', { color: palette.red, letterSpacing: 1 }),
  nowChip: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  nowText: font(9, '800', { color: palette.gold }),
  fleetStats: { flexDirection: 'row' },
  fleetStat: { flex: 1, alignItems: 'center', paddingVertical: s(4) },
  fleetStatDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.divider,
  },
  fleetValueRow: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  fleetValue: font(16, '800', { color: palette.navy, lineHeight: 1 }),
  fleetStatLabel: {
    ...font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
    marginTop: s(4),
  },

  cta: {
    borderRadius: radius.xl,
    padding: s(12),
    marginBottom: s(12),
    overflow: 'hidden',
    ...shadows.vehicleSelected,
  },
  ctaBloom: {
    position: 'absolute',
    right: s(-15),
    top: s(-15),
    width: s(90),
    height: s(90),
    borderRadius: radius.full,
    backgroundColor: alpha.white15,
  },
  ctaRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  ctaIconWrap: { width: s(40), height: s(40) },
  ctaIcon: {
    position: 'absolute',
    top: s(5),
    left: s(5),
    right: s(5),
    bottom: s(5),
    backgroundColor: palette.navy,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBody: { flex: 1 },
  ctaTitle: font(12, '800', { color: palette.navy }),
  ctaMeta: {
    ...font(9, '700', { color: palette.navy }),
    opacity: 0.85,
    marginTop: s(1),
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
    marginBottom: s(12),
  },
  gridCell: { flexGrow: 1, flexBasis: 0, minWidth: '45%' },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(4),
  },
  statTile: {
    width: s(26),
    height: s(26),
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: font(9, '800', { color: palette.slate500, letterSpacing: 0.4 }),
  statValue: font(19, '800', { color: palette.navy, lineHeight: 1 }),
  statNote: {
    ...font(8, '800', { color: palette.gold }),
    marginTop: s(2),
  },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
    paddingHorizontal: s(2),
  },
  sectionLabel: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(4) },
  seeAll: font(9, '800', { color: palette.navy }),

  tripCard: {
    borderRadius: radius.xl,
    padding: s(12),
    marginBottom: s(8),
    overflow: 'hidden',
  },
  tripBody: { position: 'relative' },
  tripHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  tripStatus: { flexDirection: 'row', alignItems: 'center', gap: s(5) },
  tripStatusText: font(9, '800', { color: palette.gold, letterSpacing: 1 }),
  tripRef: font(10, '800', { color: palette.gold }),
  tripRoute: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  tripCity: font(12, '800', { color: palette.white }),
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginTop: s(3),
  },
  tripMetaText: { ...font(9, '700', { color: palette.white }), opacity: 0.85 },
  tripMetaDivider: { ...font(9, '700', { color: palette.white }), opacity: 0.4 },
  tripProgressBlock: { marginTop: s(8) },
  tripProgressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(3),
  },
  tripProgressText: {
    ...font(8, '800', { color: palette.white }),
    opacity: 0.85,
  },
  tripProgressPct: font(8, '800', { color: palette.gold }),
  tripTrack: {
    height: s(4),
    backgroundColor: alpha.white15,
    borderRadius: radius.xxs,
    overflow: 'hidden',
  },
  tripFill: { height: '100%', width: '21%', borderRadius: radius.xxs },

  quickGrid: { flexDirection: 'row', gap: s(6), marginBottom: s(12) },
  quickCell: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: radius.card,
    paddingVertical: s(9),
    paddingHorizontal: s(5),
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  quickTile: {
    width: s(34),
    height: s(34),
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(4),
  },
  quickText: {
    ...font(8, '800', { color: palette.navy, lineHeight: 1.2 }),
    textAlign: 'center',
  },

  trendHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(10),
  },
  trendLabel: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(2),
  },
  trendValue: font(14, '800', { color: palette.navy }),
  trendDelta: font(9, '800', { color: palette.gold }),
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: s(5),
    height: s(60),
  },
  bar: { flex: 1, borderTopLeftRadius: s(3), borderTopRightRadius: s(3) },
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: s(6),
  },
  axisText: font(8, '700', { color: palette.slate500 }),

  pressed: { opacity: 0.8 },
});
