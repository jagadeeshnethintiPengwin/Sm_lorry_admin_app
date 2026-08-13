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

type TripRow = {
  id: string;
  reference: string;
  pickup: string;
  drop: string;
  rail: string;
  status: 'IN TRANSIT' | 'AT PICKUP';
  pill: 'navy' | 'red';
  driverLine?: string;
  distance?: string;
  progress?: number;
  loadingNote?: string;
  tab: Tab;
};

/**
 * A trip as the API sends it, turned into the row this screen draws.
 *
 * Replaces a literal list under a header claiming "18 in transit · 1,302
 * total" against a book of seventeen trips.
 */
const TAB_FOR_STATUS: Record<string, Tab> = {
  IN_TRANSIT: 'transit',
  SCHEDULED: 'scheduled',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

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
  const inTransit = status === 'IN_TRANSIT';

  return {
    id: String(trip.id),
    reference: `#${trip.reference ?? ''}`,
    pickup: String(booking.pickupPlace ?? '—'),
    drop: String(booking.dropPlace ?? '—'),
    // A running trip is the one worth pulling the eye to.
    rail: inTransit ? palette.gold : palette.navy,
    status: inTransit ? 'IN TRANSIT' : 'AT PICKUP',
    pill: inTransit ? 'navy' : 'red',
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
    tab: TAB_FOR_STATUS[status] ?? 'scheduled',
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

  const { data, loading, error, refetch } = useApi(
    () => tripService.page({ limit: 100 }),
    [],
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
            accessibilityLabel={`${trip.reference}, ${trip.status}`}
            accentColor={trip.rail}
            accentWidth={3}
          >
            <View style={styles.head}>
              <Text style={styles.reference}>{trip.reference}</Text>
              <View style={trip.pill === 'navy' ? styles.pillNavy : styles.pillRed}>
                {trip.pill === 'navy' ? <BlinkDot color={palette.gold} size={4} /> : null}
                <Text
                  style={
                    trip.pill === 'navy' ? styles.pillNavyText : styles.pillRedText
                  }
                >
                  {trip.status}
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
  reference: font(10, '800', { color: palette.red }),
  pillNavy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.navyTint,
    borderRadius: radius.sm,
  },
  pillNavyText: font(8, '800', { color: palette.navy }),
  pillRed: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.redSoft,
    borderRadius: radius.sm,
  },
  pillRedText: font(8, '800', { color: palette.redDark }),

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
