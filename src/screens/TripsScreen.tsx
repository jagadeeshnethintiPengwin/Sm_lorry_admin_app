import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  BlinkDot,
  Card,
  Content,
  DateFilter,
  ALL_TIME,
  dateRangeParams,
  type DateRange,
  Icon,
  ListState,
  RouteView,
  Screen,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { tripService } from '@services/fleet.service';
import type { AdminTrip } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Screen 18 — Trips List.
 *
 *   search · Transit / Scheduled / Delivered / Cancelled tabs · trip cards
 *   with a gold (in transit) or red (at pickup) left rail, route rail, and
 *   either a driver + progress bar or a dashed red loading note
 */
type Tab = 'transit' | 'scheduled' | 'delivered' | 'cancelled';

/**
 * How each status paints its pill and left rail.
 *
 * The card used to know two states — in transit, or "AT PICKUP" for everything
 * else — so a delivered or a cancelled trip wore a red "AT PICKUP" pill it had
 * long since left behind. The status is the one thing the card must not get
 * wrong, so all four are spelled out: a running trip pulls the eye in gold, a
 * delivered one reads green and finished, a cancelled one greys out, and only a
 * genuinely scheduled trip says it is waiting at the pickup.
 */
type PillKind = Tab | 'awaiting';

type TripRow = {
  id: string;
  reference: string;
  pickup: string;
  drop: string;
  rail: string;
  statusLabel: string;
  pillKind: PillKind;
  driverLine?: string;
  distance?: string;
  progress?: number;
  loadingNote?: string;
  /** The customer has confirmed the delivery (in their app, or via the office). */
  customerConfirmed: boolean;
  tab: Tab;
};

const STATUS_META: Record<
  string,
  { label: string; kind: PillKind; rail: string; tab: Tab }
> = {
  IN_TRANSIT: { label: 'IN TRANSIT', kind: 'transit', rail: palette.gold, tab: 'transit' },
  SCHEDULED: { label: 'AT PICKUP', kind: 'scheduled', rail: palette.navy, tab: 'scheduled' },
  DELIVERED: { label: 'DELIVERED', kind: 'delivered', rail: palette.green, tab: 'delivered' },
  CANCELLED: { label: 'CANCELLED', kind: 'cancelled', rail: palette.slate400, tab: 'cancelled' },
};

/*
 * Handed over, not yet closed. The trip stays IN_TRANSIT — and in the Transit
 * tab, whose count the API keeps by status — until the customer confirms and
 * the office approves, but it should not wear a pulsing "IN TRANSIT" for a
 * load that is already off the lorry.
 */
const AWAITING_META = {
  label: 'DELIVERED · AWAITING COMPLETION',
  kind: 'awaiting' as const,
  rail: palette.green,
  tab: 'transit' as const,
};

/**
 * A trip as the API sends it, turned into the row this screen draws.
 *
 * Replaces a literal list under a header claiming "18 in transit · 1,302
 * total" against a book of seventeen trips.
 */
function toRow(trip: AdminTrip): TripRow {
  const status = String(trip.status ?? '').toUpperCase();
  const booking = (trip.booking ?? {}) as {
    pickupPlace?: string;
    dropPlace?: string;
    material?: string;
  };

  const driver = trip.driver as { user?: { name?: string } } | null;
  const vehicle = trip.vehicle as { registration?: string } | null;

  const distanceKm = Number(trip.distanceKm ?? 0);
  const coveredKm = Number(trip.coveredKm ?? 0);
  const meta =
    status === 'IN_TRANSIT' && trip.deliveredAt
      ? AWAITING_META
      : (STATUS_META[status] ?? STATUS_META.SCHEDULED);

  return {
    id: String(trip.id),
    reference: `#${trip.reference ?? ''}`,
    pickup: String(booking.pickupPlace ?? '—'),
    drop: String(booking.dropPlace ?? '—'),
    rail: meta.rail,
    statusLabel: meta.label,
    pillKind: meta.kind,
    driverLine: [driver?.user?.name, vehicle?.registration]
      .filter(Boolean)
      .join(' · ') || undefined,
    distance: distanceKm
      ? `${coveredKm} / ${distanceKm} KM`
      : undefined,
    // Guarded: a trip whose distance was never recorded would divide by zero
    // and hand the bar a NaN, which renders as a full bar rather than none.
    progress: distanceKm > 0
      ? Math.min(100, Math.round((coveredKm / distanceKm) * 100))
      : undefined,
    loadingNote: booking.material ? String(booking.material) : undefined,
    customerConfirmed: Boolean(trip.customerConfirmedAt),
    tab: meta.tab,
  };
}

/** Labels are built from the API's own tally — see `tabsWithCounts`. */
const TAB_TITLES: Array<[Tab, string]> = [
  ['transit', 'Transit'],
  ['scheduled', 'Scheduled'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];

export const TripsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('transit');
  const [range, setRange] = useState<DateRange>(ALL_TIME);

  const { data, loading, error, refetch } = useApi(
    () => tripService.page({ limit: 100, ...dateRangeParams(range) }),
    [range.from, range.to],
  );

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter(trip => {
      const inTab = trip.tab === tab;
      if (!term) {
        return inTab;
      }
      return (
        inTab &&
        (trip.reference.toLowerCase().includes(term) ||
          (trip.driverLine ?? '').toLowerCase().includes(term) ||
          (trip.loadingNote ?? '').toLowerCase().includes(term))
      );
    });
  }, [query, rows, tab]);

  const counts = data?.meta?.counts;
  const total = data?.meta?.total ?? rows.length;
  const inTransit = counts?.inTransit ?? rows.filter(r => r.tab === 'transit').length;

  /*
   * Tab labels carry the API's counts, falling back to counting the rows in
   * hand. A count of zero still shows: "Cancelled 0" is information, whereas a
   * bare "Cancelled" leaves the operator wondering whether it failed to load.
   */
  const tabsWithCounts = useMemo(() => {
    const byTab: Record<Tab, number> = {
      transit: counts?.inTransit ?? rows.filter(r => r.tab === 'transit').length,
      scheduled:
        counts?.scheduled ?? rows.filter(r => r.tab === 'scheduled').length,
      delivered:
        counts?.delivered ?? rows.filter(r => r.tab === 'delivered').length,
      cancelled:
        counts?.cancelled ?? rows.filter(r => r.tab === 'cancelled').length,
    };
    return TAB_TITLES.map(
      ([key, title]) => [key, `${title} ${byTab[key]}`] as [Tab, string],
    );
  }, [counts, rows]);

  const openTrip = useCallback(
    (id: string) => navigation.navigate('TripDetails', { tripId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Trips"
        subtitle={`${inTransit} in transit · ${total} total`}
        showBack
        onBackPress={navigation.goBack}
        rightIcon="plus"
        onRightPress={() => navigation.navigate('NewTrip')}
        rightAccessibilityLabel="New trip"
      />

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="search" size={16} color={palette.slate400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Trip ID, driver, vehicle..."
            placeholderTextColor={palette.slate400}
            style={styles.searchInput}
            accessibilityLabel="Search trips"
          />
        </View>
      </View>

      <View style={styles.tabs}>
        {tabsWithCounts.map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && styles.tabOn]}
          >
            <Text style={tab === key ? styles.tabTextOn : styles.tabText}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <DateFilter range={range} onChange={setRange} label="Trip date" />

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        <ListState
          loading={loading}
          error={error}
          empty={visible.length === 0}
          what="trips"
          emptyIcon="package-search"
          emptyHint={query.trim() ? 'Nothing matches that search.' : undefined}
          onRetry={refetch}
        />

        {visible.map(trip => (
          <Card
            key={trip.id}
            padding={11}
            onPress={() => openTrip(trip.id)}
            accessibilityLabel={`${trip.reference}, ${trip.statusLabel}${
              trip.customerConfirmed ? ', confirmed by customer' : ''
            }`}
            accentColor={trip.rail}
            accentWidth={3}
          >
            <View style={styles.head}>
              <View style={styles.headLeft}>
                <Text style={styles.reference}>{trip.reference}</Text>
                {/* The customer's half is in — on an open trip, it is only
                    waiting on the office now. */}
                {trip.customerConfirmed ? (
                  <Text style={styles.custMark}>✓ CUSTOMER</Text>
                ) : null}
              </View>
              <View style={[styles.pill, PILL_STYLE[trip.pillKind]]}>
                {trip.pillKind === 'transit' ? (
                  <BlinkDot color={palette.gold} size={4} />
                ) : null}
                <Text style={[styles.pillText, PILL_TEXT_STYLE[trip.pillKind]]}>
                  {trip.statusLabel}
                </Text>
              </View>
            </View>

            <RouteView
              pickup={trip.pickup}
              drop={trip.drop}
              pickupLabel="Pickup"
              dropLabel="Drop"
              style={styles.route}
            />

            {trip.progress !== undefined ? (
              <View>
                <View style={styles.progressHead}>
                  <Text style={styles.driverLine}>{trip.driverLine}</Text>
                  <Text style={styles.distance}>{trip.distance}</Text>
                </View>
                <View style={styles.track}>
                  <LinearGradient
                    colors={[palette.gold, palette.red]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.fill, { width: `${trip.progress}%` }]}
                  />
                </View>
              </View>
            ) : (
              <Text style={styles.loadingNote}>{trip.loadingNote}</Text>
            )}
          </Card>
        ))}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  searchWrap: {
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    backgroundColor: palette.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: s(9),
    paddingHorizontal: s(11),
    backgroundColor: palette.screenBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.lg,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    ...font(11, '600', { color: palette.navy }),
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: palette.navyTint,
    marginTop: s(12),
    marginHorizontal: s(12),
    borderRadius: radius.lg,
    padding: s(3),
    gap: s(2),
  },
  tab: {
    flex: 1,
    paddingVertical: s(6),
    paddingHorizontal: s(4),
    borderRadius: radius.md,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: palette.navy },
  tabText: font(8.5, '700', { color: palette.slate500 }),
  tabTextOn: font(8.5, '800', { color: palette.white }),

  contentTop: { paddingTop: s(10) },

  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(6),
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  reference: font(10, '800', { color: palette.red }),
  custMark: {
    ...font(8, '800', { color: palette.green, letterSpacing: 0.4 }),
    marginLeft: s(6),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    borderRadius: radius.sm,
  },
  pillTransit: { backgroundColor: palette.navyTint },
  pillScheduled: { backgroundColor: palette.redSoft },
  pillDelivered: { backgroundColor: 'rgba(22,163,74,0.14)' },
  pillAwaiting: { backgroundColor: palette.goldTint },
  pillCancelled: { backgroundColor: palette.gray200 },
  pillText: font(8, '800', {}),
  pillTextTransit: { color: palette.navy },
  pillTextScheduled: { color: palette.redDark },
  pillTextDelivered: { color: palette.green },
  pillTextAwaiting: { color: palette.goldText },
  pillTextCancelled: { color: palette.slate700 },

  route: { marginBottom: s(6) },

  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(3),
  },
  driverLine: font(8, '700', { color: palette.slate500 }),
  distance: font(8, '700', { color: palette.gold }),
  track: {
    height: s(4),
    backgroundColor: palette.border,
    borderRadius: radius.xxs,
    overflow: 'hidden',
    marginBottom: s(5),
  },
  fill: { height: '100%', borderRadius: radius.xxs },

  loadingNote: {
    ...font(9, '800', { color: palette.red }),
    paddingTop: s(6),
    borderTopWidth: s(1),
    borderTopColor: palette.redSoft,
    borderStyle: 'dashed',
  },
});

/** Pill background per status — see `STATUS_META`. */
const PILL_STYLE: Record<PillKind, object> = {
  transit: styles.pillTransit,
  scheduled: styles.pillScheduled,
  delivered: styles.pillDelivered,
  awaiting: styles.pillAwaiting,
  cancelled: styles.pillCancelled,
};

/** Pill text colour per status. */
const PILL_TEXT_STYLE: Record<PillKind, object> = {
  transit: styles.pillTextTransit,
  scheduled: styles.pillTextScheduled,
  delivered: styles.pillTextDelivered,
  awaiting: styles.pillTextAwaiting,
  cancelled: styles.pillTextCancelled,
};
