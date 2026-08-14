import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  PulseGlow,
  BlinkDot,
  Card,
  Content,
  Icon,
  RadialGlow,
  Screen,
  TwinkleDot,
} from '@components/index';
import { useTopInset } from '@hooks/useTopInset';
import { onLiveNotification } from '@services/realtime';
import { reportService } from '@services/report.service';
import {
  notificationService,
  tripService,
  type LiveTrip,
} from '@services/fleet.service';
import type { DashboardSummary, TripsPerDay } from '@services/report.service';
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
 * The header uses `padding:52px 14px 32px`. The mock pulls the content up over
 * it with `margin-top:-24px` so the first card laps onto the navy; that is not
 * done here — the card is spaced below the header instead, which keeps the two
 * readable as separate surfaces. Any offset belongs on the first child rather
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

/**
 * The four stat cells, built from `GET /reports/dashboard`.
 *
 * These were literals — 42 vehicles, 38 drivers, 124 customers, 1,284
 * delivered, with notes like "+3 this month" and "98% on-time". They came from
 * the design mock, so every owner saw the same fleet whatever they actually
 * owned, and nothing ever moved. The notes that cannot be derived from the
 * summary are gone rather than invented: a made-up "98% on-time" under a real
 * delivered count is worse than no note at all.
 */
function statsOf(summary: DashboardSummary | null): Stat[] {
  const show = (n?: number) => (n === undefined ? '—' : n.toLocaleString('en-IN'));
  return [
    {
      label: 'FLEET',
      value: show(summary?.totalVehicles),
      note: summary ? `${summary.fleet.available} available now` : '',
      icon: 'truck',
      bg: palette.navyTint,
      color: palette.navy,
    },
    {
      label: 'DRIVERS',
      value: show(summary?.totalDrivers),
      note: summary ? `${summary.drivers.online} online now` : '',
      icon: 'user-cog',
      bg: palette.goldTint,
      color: palette.gold,
    },
    {
      label: 'CUSTOMERS',
      value: show(summary?.totalCustomers),
      note: '',
      icon: 'users',
      bg: palette.redTint,
      color: palette.red,
    },
    {
      label: 'DELIVERED',
      value: show(summary?.completedTrips),
      note: summary ? `${summary.activeTrips} running now` : '',
      icon: 'check-circle-2',
      bg: palette.navyTint,
      color: palette.navy,
    },
  ];
}

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

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The THIS WEEK bars, scaled from `GET /reports/trips-per-day`.
 *
 * The heights were seven fixed percentages, so the chart drew the same shape
 * for ever — a busy Saturday every week regardless of what was delivered.
 * Heights are now relative to the busiest day in the range, which is what makes
 * a bar chart readable; a week with no trips draws flat rather than pretending.
 */
function weekOf(series: TripsPerDay[]): Array<{
  day: string;
  height: number;
  today: boolean;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const peak = Math.max(1, ...series.map(d => d.completed + d.active));

  return series.map(day => {
    const total = day.completed + day.active;
    return {
      day: DAY_INITIALS[new Date(day.date).getDay()] ?? '',
      // A day with work always shows something; only a genuine zero is flat.
      height: total ? Math.max(8, Math.round((total / peak) * 100)) : 0,
      today: day.date === today,
    };
  });
}

export const DashboardScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const topInset = useTopInset();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [series, setSeries] = useState<TripsPerDay[]>([]);
  const [live, setLive] = useState<LiveTrip[]>([]);
  const [unread, setUnread] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Re-read on every visit.
   *
   * A dashboard is the one screen where stale numbers are actively misleading —
   * an owner glances at it to decide something. `useFocusEffect` rather than a
   * mount-only effect, so coming back from approving a booking shows the new
   * pending count rather than the one from when the app started.
   */
  const load = useCallback(async () => {
    setFailure(null);
    try {
      const [counts, perDay, board, unreadNow] = await Promise.all([
        reportService.dashboard(),
        reportService.tripsPerDay(),
        /*
         * The trip the card actually shows.
         *
         * It used to be a literal — #TR-2026-8836, Vizag → Hyderabad, Ramesh K,
         * 128/620 KM — with the tap wired to that same reference, so every
         * office saw one invented lorry and opening it led to a trip that was
         * not the one running. `/trips/live` is the same board the fleet map
         * reads.
         */
        tripService.live(),
        /*
         * The bell's badge. It was the literal `12`, on every device and every
         * account, and it never moved — including for an office with nothing
         * unread, which is the one state the badge exists to distinguish.
         */
        notificationService.unreadCount(),
      ]);
      setSummary(counts);
      setSeries(perDay);
      setLive(board);
      setUnread(unreadNow);
    } catch (error) {
      setFailure(
        (error as Error).message ||
          'Could not reach the server. Pull down to try again.',
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /*
   * The badge moves the moment one arrives, not on the next visit.
   *
   * `load` re-reads the count on focus, which covers coming back to the
   * screen. It does nothing for the dashboard left open on a desk — the case
   * this badge is for. The socket already delivers the notification; counting
   * it here costs one request fewer than re-asking the server.
   */
  useEffect(
    () => onLiveNotification(() => setUnread(current => current + 1)),
    [],
  );

  const stats = useMemo(() => statsOf(summary), [summary]);
  const week = useMemo(() => weekOf(series), [series]);

  const openNotifications = useCallback(
    () => navigation.navigate('Notifications'),
    [navigation],
  );
  const openBookings = useCallback(
    () => navigation.navigate('Tabs', { screen: 'Bookings' }),
    [navigation],
  );
  const openTrips = useCallback(() => navigation.navigate('Trips'), [navigation]);
  /**
   * The lorry actually on the road, if there is one.
   *
   * `IN_TRANSIT` first, because that is what "active" means on this card; a
   * scheduled trip has not left. The newest fix wins when several are running,
   * so the card shows the one that most recently reported.
   */
  const activeTrip = useMemo(() => {
    const moving = live.filter(t => t.status === 'IN_TRANSIT');
    return (
      [...moving].sort(
        (a, b) =>
          new Date(b.lastPingAt ?? 0).getTime() -
          new Date(a.lastPingAt ?? 0).getTime(),
      )[0] ?? null
    );
  }, [live]);

  /** Clamped: a lorry that overshoots its routed distance is not 140% done. */
  const tripPct = useMemo(() => {
    const total = Number(activeTrip?.distanceKm ?? 0);
    const done = Number(activeTrip?.coveredKm ?? 0);
    return total ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;
  }, [activeTrip]);

  const openTrip = useCallback(() => {
    if (activeTrip) {
      navigation.navigate('TripDetails', { tripId: activeTrip.tripId });
    }
  }, [activeTrip, navigation]);

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
        style={[styles.header, { paddingTop: topInset + s(2) }]}
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
            accessibilityLabel={
              unread
                ? `Notifications, ${unread} unread`
                : 'Notifications, none unread'
            }
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <Icon name="bell" size={16} color={palette.white} />
            {/*
              Hidden at zero rather than showing a `0`.

              A badge is an exception marker: one that is always present stops
              being read at all, which is how a permanent `12` went unnoticed.
              Past 99 it caps — the exact number stops mattering long before
              then, and three digits break the circle.
            */}
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </LinearGradient>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        {/*
          * Say when the numbers could not be fetched.
          *
          * Every figure below falls back to an em dash, which on its own reads
          * as "nothing today" rather than "could not ask" — an owner would take
          * an idle fleet at face value.
          */}
        {failure ? (
          <Pressable
            onPress={load}
            accessibilityRole="button"
            accessibilityLabel="Retry loading the dashboard"
            style={styles.failure}
          >
            <Icon name="alert-circle" size={14} color={palette.red} />
            <Text style={styles.failureText}>{failure}</Text>
            <Text style={styles.failureRetry}>Retry</Text>
          </Pressable>
        ) : null}

        {/* Fleet status live card */}
        <View style={styles.fleetCard}>
          <View style={styles.fleetHead}>
            <Text style={styles.fleetLabel}>FLEET STATUS · LIVE</Text>
            <View style={styles.nowChip}>
              <BlinkDot color={palette.gold} size={6} />
              <Text style={styles.nowText}>NOW</Text>
            </View>
          </View>

          {/* Was 18 / 14 / 32, fixed. A card headed "LIVE" is the last place
              that should be showing constants. */}
          <View style={styles.fleetStats}>
            <View style={[styles.fleetStat, styles.fleetStatDivider]}>
              <View style={styles.fleetValueRow}>
                <Icon name="activity" size={12} color={palette.gold} />
                <Text style={styles.fleetValue}>
                  {summary?.fleet.inTrip ?? '—'}
                </Text>
              </View>
              <Text style={styles.fleetStatLabel}>ACTIVE</Text>
            </View>
            <View style={[styles.fleetStat, styles.fleetStatDivider]}>
              <View style={styles.fleetValueRow}>
                <Icon name="parking-circle" size={12} color={palette.navy} />
                <Text style={styles.fleetValue}>
                  {summary?.fleet.available ?? '—'}
                </Text>
              </View>
              <Text style={styles.fleetStatLabel}>AVAILABLE</Text>
            </View>
            <View style={styles.fleetStat}>
              <View style={styles.fleetValueRow}>
                <Icon name="truck" size={12} color={palette.gold} />
                <Text style={styles.fleetValue}>
                  {summary?.totalVehicles ?? '—'}
                </Text>
              </View>
              <Text style={styles.fleetStatLabel}>TOTAL</Text>
            </View>
          </View>
        </View>

        {/* Pending bookings CTA */}
        <Pressable
          onPress={openBookings}
          accessibilityRole="button"
          accessibilityLabel={`${summary?.pendingBookings ?? 0} bookings awaiting approval`}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <LinearGradient
            colors={gradients.gold as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            {/*
              The bloom is gone.

              It was a 90px translucent disc bleeding out of the top-right
              corner, which put a pale ring directly behind the chevron — the
              arrow looked like it had been given a circle nobody asked for.
              The card carries its depth from the gradient and the hairline
              below instead.
            */}
            <View style={styles.ctaRow}>
              <View style={styles.ctaIconWrap}>
                <PulseGlow color={palette.navy} opacity={0.15} duration={1800} />
                <View style={styles.ctaIcon}>
                  <Icon name="clipboard-check" size={16} color={palette.gold} />
                </View>
              </View>

              <View style={styles.ctaBody}>
                {/*
                  The count leads.

                  It was set in the same 12px weight as the words around it, so
                  the one number the operator is looking for had to be read out
                  of a sentence. Sized up and given the line to itself, the card
                  answers "how many" before it is read.
                */}
                <View style={styles.ctaHeadline}>
                  <Text style={styles.ctaCount}>
                    {summary?.pendingBookings ?? 0}
                  </Text>
                  <Text style={styles.ctaTitle}>bookings awaiting approval</Text>
                </View>
                <Text style={styles.ctaMeta}>
                  Tap to review &amp; dispatch drivers
                </Text>
              </View>

              {/* Wrapped: `Icon` takes no style prop of its own. */}
              <View style={styles.ctaChevron}>
                <Icon name="chevron-right" size={20} color={palette.navy} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {/* 4-cell stats */}
        <View style={styles.grid}>
          {stats.map(stat => (
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
          <Text style={styles.sectionLabel}>
            ACTIVE TRIPS · {summary?.activeTrips ?? 0}
          </Text>
          <Pressable
            onPress={openTrips}
            accessibilityRole="button"
            accessibilityLabel="See all trips"
          >
            <Text style={styles.seeAll}>See all →</Text>
          </Pressable>
        </View>

        {activeTrip ? (
          <Pressable
            onPress={openTrip}
            accessibilityRole="button"
            accessibilityLabel={`Trip ${activeTrip.reference}, ${activeTrip.route}, in transit`}
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
                  <Text style={styles.tripRef}>#{activeTrip.reference}</Text>
                </View>

                {/* The route arrives joined; split back into the two ends. */}
                <View style={styles.tripRoute}>
                  <Text style={styles.tripCity} numberOfLines={1}>
                    {(activeTrip.route ?? '').split('→')[0]?.trim() || '—'}
                  </Text>
                  <Icon name="arrow-right" size={14} color={palette.gold} />
                  <Text style={styles.tripCity} numberOfLines={1}>
                    {(activeTrip.route ?? '').split('→')[1]?.trim() || '—'}
                  </Text>
                </View>

                <View style={styles.tripMeta}>
                  <Text style={styles.tripMetaText} numberOfLines={1}>
                    {activeTrip.driver ?? '—'}
                  </Text>
                  <Text style={styles.tripMetaDivider}>|</Text>
                  <Text style={styles.tripMetaText} numberOfLines={1}>
                    {activeTrip.registration ?? '—'}
                  </Text>
                </View>

                <View style={styles.tripProgressBlock}>
                  <View style={styles.tripProgressHead}>
                    <Text style={styles.tripProgressText}>
                      {activeTrip.distanceKm
                        ? `${Math.round(activeTrip.coveredKm ?? 0)} / ${Math.round(activeTrip.distanceKm)} KM`
                        : 'Distance not recorded'}
                    </Text>
                    <Text style={styles.tripProgressPct}>{tripPct}%</Text>
                  </View>
                  <View style={styles.tripTrack}>
                    <LinearGradient
                      colors={[palette.gold, palette.red]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.tripFill, { width: `${tripPct}%` }]}
                    />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        ) : (
          /*
           * Nothing on the road is an ordinary state for a fleet — an empty
           * yard at 6am is not an error. Said plainly rather than drawn as an
           * invented lorry that cannot be opened.
           */
          <View style={styles.tripEmpty}>
            <Icon name="truck" size={16} color={palette.slate400} />
            <Text style={styles.tripEmptyText}>
              No trip is on the road right now.
            </Text>
          </View>
        )}

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
            {week.map((bar, index) => (
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
            {week.map((bar, index) => (
              <Text
                key={`${bar.day}-label-${index}`}
                style={bar.today ? styles.axisTextToday : styles.axisText}
              >
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
  /*
   * Was `paddingBottom: 32` under a `paddingTop` of `topInset + 8`.
   *
   * The header holds one row — avatar, greeting, bell — and the fleet card is
   * pulled up into it, so most of that 32 was navy nobody saw: it sat behind
   * the card. Trimming it to 20 takes real height off the top of the screen
   * without touching the overlap, which is the part the design is actually
   * doing. `paddingTop` comes down with it, inline, so the row is not left
   * hanging low in a shorter band.
   */
  header: {
    paddingHorizontal: s(14),
    paddingBottom: s(12),
    overflow: 'hidden',
  },
  headerTwinkle: { position: 'absolute', top: s(56), right: s(120) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    width: '100%',
  },
  // 40/36, down from 48/44: the avatar is the tallest thing in the header row,
  // so the band cannot get shorter than it however the padding is trimmed.
  avatarWrap: { width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' },
  avatarRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.full,
  },
  avatar: {
    width: s(36),
    height: s(36),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: font(12, '800', { color: palette.navy }),
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
  /*
   * A pill that grows, not a fixed circle.
   *
   * It was a hard 16×16 — enough for the single hardcoded `12`, and not enough
   * for `99+`, which the 2px border trims to about 12px of usable width. A
   * `minWidth` keeps a single digit perfectly round and lets two or three
   * characters widen it instead of clipping.
   */
  bellBadge: {
    position: 'absolute',
    top: s(-3),
    right: s(-3),
    minWidth: s(16),
    paddingHorizontal: s(3),
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
  failure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    padding: s(10),
    marginBottom: s(10),
    borderRadius: radius.md,
    backgroundColor: palette.redTint },
  failureText: {
    ...font(9, '700', { lineHeight: 1.3, color: palette.red }),
    flex: 1 },
  failureRetry: font(9, '800', { color: palette.navy }),
  /*
   * The gap under the header.
   *
   * The fleet card used to carry this itself as `marginTop: -10`, lapping onto
   * the navy exactly as the mock does. Two problems with putting it on the
   * card: the overlap left no breathing room under the header, and the card is
   * not reliably the first thing here — the failure banner takes its place
   * when the dashboard cannot load, and that rendered flush against the
   * header. Spacing the content region covers whichever child comes first.
   */
  contentTop: { paddingTop: s(12) },

  fleetCard: {
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
    padding: s(13),
    marginBottom: s(12),
    overflow: 'hidden',
    /*
     * A lit top edge.
     *
     * With the bloom removed the gradient had nothing to catch, and a flat
     * gold rectangle reads as cheap. A hairline of white along the border
     * behaves like light landing on the top of the card — the same trick the
     * vehicle cards use — and costs one line rather than another absolutely
     * positioned shape.
     */
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.white30,
    ...shadows.vehicleSelected,
  },
  ctaRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(11),
  },
  ctaIconWrap: {
    width: s(40),
    height: s(40),
    // Defaults to 0 in React Native, so a long headline would squash the disc
    // into an oval rather than wrapping.
    flexShrink: 0,
  },
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
  ctaBody: { flex: 1, minWidth: 0 },
  /* The count and its label share a baseline rather than stacking. */
  ctaHeadline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: s(5),
  },
  ctaCount: font(19, '800', { color: palette.navy, letterSpacing: -0.3 }),
  ctaTitle: {
    ...font(11, '800', { color: palette.navy }),
    flexShrink: 1,
  },
  ctaMeta: {
    ...font(9, '700', { color: palette.navy }),
    opacity: 0.75,
    marginTop: s(2),
  },
  /* Present, not shouting — the whole card is the target. */
  ctaChevron: { opacity: 0.55, flexShrink: 0 },

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
  /*
   * Allowed to shrink, which `numberOfLines` alone does not arrange.
   *
   * `flexShrink` defaults to 0 in React Native, so a Text in a row keeps its
   * full intrinsic width and simply overflows the parent — `numberOfLines`
   * caps the number of lines, not the width. The card used to hold "Vizag →
   * Hyderabad" and fitted by luck; real bookings carry addresses like
   * "Gachibowli 3rd Floor, Shresta Marvel, … Telangana 500032, India", which
   * ran straight out of the card.
   *
   * `minWidth: 0` because a flex child's automatic minimum size is its content
   * — without it the shrink is permitted and then refused.
   */
  tripCity: {
    ...font(12, '800', { color: palette.white }),
    flexShrink: 1,
    minWidth: 0,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginTop: s(3),
  },
  /* Driver names and registrations run long too — same rule. */
  tripMetaText: {
    ...font(9, '700', { color: palette.white }),
    opacity: 0.85,
    flexShrink: 1,
    minWidth: 0,
  },
  /* The divider is punctuation: it must never be the thing that shrinks. */
  tripMetaDivider: {
    ...font(9, '700', { color: palette.white }),
    opacity: 0.4,
    flexShrink: 0,
  },
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
  tripEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(9),
    padding: s(14),
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  tripEmptyText: font(10, '600', { color: palette.slate500 }),
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
  /*
   * The axis must share the bars' column rules, not its own.
   *
   * The bars are `flex: 1` with `gap: 5`, so each occupies an equal share of
   * the row. The labels used `justifyContent: 'space-between'` with no flex
   * and no gap, which lays out seven glyph-width labels edge to edge instead —
   * the first pinned left, the last pinned right, the rest spread evenly. That
   * spacing does not match equal columns, so every label between the ends sat
   * off its bar, drifting further towards the middle.
   *
   * Same `gap`, and each label `flex: 1` and centred: one label per column,
   * centred on the bar above it.
   */
  chartAxis: {
    flexDirection: 'row',
    gap: s(5),
    marginTop: s(6),
  },
  axisText: {
    ...font(8, '700', { color: palette.slate500 }),
    flex: 1,
    textAlign: 'center',
  },
  /* Today's label picked out, matching the navy bar above it. */
  axisTextToday: {
    ...font(8, '800', { color: palette.navy }),
    flex: 1,
    textAlign: 'center',
  },

  pressed: { opacity: 0.8 },
});
