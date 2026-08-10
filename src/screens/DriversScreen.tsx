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
  Screen,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { driverService } from '@services/fleet.service';
import type { AdminDriver } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Screen 10 — Drivers List.
 *
 *   search · Online / On Trip / Offline segmented control · driver cards with
 *   a gradient avatar, presence dot, on-time score, vehicle line and an
 *   ONLINE / OFFLINE pill (or an Assign button when no vehicle) · gold FAB
 */
type Tab = 'online' | 'on_trip' | 'offline';

type DriverRow = {
  id: string;
  name: string;
  initials: string;
  avatar: readonly string[];
  avatarTextColor: string;
  online: boolean;
  score: string;
  scoreColor: string;
  meta: string;
  vehicle?: string;
  onTrip: boolean;
  rail?: boolean;
  tabs: Tab[];
};

/**
 * A roster row as the API sends it, turned into the row this screen draws.
 *
 * Replaces sixty lines of literal drivers that made the panel show the same
 * five people on every device, under a header that claimed thirty-eight of
 * them while the dashboard beside it read the real twelve.
 */
const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

/** Presence decides the avatar, so the list reads at a glance. */
const AVATAR: Record<string, readonly string[]> = {
  ONLINE: gradients.navyHero,
  ON_TRIP: gradients.gold,
  OFFLINE: gradients.red,
};

function toRow(driver: AdminDriver): DriverRow {
  const status = String(driver.status ?? '').toUpperCase();
  const onTrip = status === 'ON_TRIP';
  const online = status === 'ONLINE' || onTrip;

  const user = (driver.user ?? {}) as { name?: string; mobile?: string };
  const name = user.name ?? 'Driver';

  const vehicle = driver.vehicle as { registration?: string } | null;
  const rating = Number(driver.rating ?? 0);
  const trips = Number(driver.totalTrips ?? 0);

  return {
    id: String(driver.id),
    name,
    initials: initialsOf(name),
    avatar: AVATAR[status] ?? gradients.navyHero,
    avatarTextColor: palette.white,
    online,
    // The roster carries a rating, not an on-time percentage — the latter is a
    // per-driver query and would be one request per row.
    score: `${rating.toFixed(1)} ★ RATING`,
    scoreColor:
      rating >= 4.5 ? palette.green : rating >= 4 ? palette.gold : palette.red,
    meta: [user.mobile, `${trips} trip${trips === 1 ? '' : 's'}`]
      .filter(Boolean)
      .join(' · '),
    vehicle: vehicle?.registration
      ? `${vehicle.registration}${onTrip ? ' · IN TRIP' : ''}`
      : undefined,
    onTrip,
    tabs: onTrip ? ['online', 'on_trip'] : online ? ['online'] : ['offline'],
  };
}

export const DriversScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('online');

  const { data, loading, error, refetch } = useApi(
    () => driverService.page({ limit: 100 }),
    [],
  );

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter(driver => {
      const inTab = driver.tabs.includes(tab);
      if (!term) {
        return inTab;
      }
      return (
        inTab &&
        (driver.name.toLowerCase().includes(term) ||
          driver.meta.toLowerCase().includes(term))
      );
    });
  }, [query, rows, tab]);

  // The API's own tally, which covers the whole roster rather than this page.
  const counts = data?.meta?.counts;
  const total = data?.meta?.total ?? rows.length;
  const onlineCount =
    counts !== undefined
      ? (counts.online ?? 0) + (counts.onTrip ?? 0)
      : rows.filter(r => r.online).length;

  const openDriver = useCallback(
    (id: string) => navigation.navigate('DriverDetails', { driverId: id }),
    [navigation],
  );

  const addDriver = useCallback(
    () => navigation.navigate('AddDriver'),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Drivers"
        subtitle={`${total} total · ${onlineCount} online`}
        showBack
        onBackPress={navigation.goBack}
      />

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="search" size={16} color={palette.slate400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, mobile, DL..."
            placeholderTextColor={palette.slate400}
            style={styles.searchInput}
            accessibilityLabel="Search drivers"
          />
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['online', `Online ${onlineCount}`],
            ['on_trip', `On Trip ${counts?.onTrip ?? rows.filter(r => r.onTrip).length}`],
            [
              'offline',
              `Offline ${counts?.offline ?? rows.filter(r => !r.online).length}`,
            ],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
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
          what="drivers"
          emptyIcon="user-plus"
          emptyHint={
            query.trim()
              ? 'Nothing matches that search.'
              : 'Add a driver with the + button to get started.'
          }
          onRetry={refetch}
        />

        {visible.map(driver => (
          <Card
            key={driver.id}
            padding={11}
            onPress={() => openDriver(driver.id)}
            accessibilityLabel={`${driver.name}, ${driver.score}`}
            accentColor={driver.rail ? palette.red : undefined}
            accentWidth={3}
          >
            <View style={styles.row}>
              <View>
                <LinearGradient
                  colors={driver.avatar as unknown as string[]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text
                    style={[
                      styles.initials,
                      { color: driver.avatarTextColor },
                    ]}
                  >
                    {driver.initials}
                  </Text>
                </LinearGradient>
                <View
                  style={[
                    styles.presence,
                    { backgroundColor: driver.online ? palette.gold : palette.slate400 },
                  ]}
                />
              </View>

              <View style={styles.body}>
                <View style={styles.head}>
                  <Text style={styles.name} numberOfLines={1}>
                    {driver.name}
                  </Text>
                  <Text
                    style={[styles.score, { color: driver.scoreColor }]}
                    numberOfLines={1}
                  >
                    {driver.score}
                  </Text>
                </View>

                <Text style={styles.meta} numberOfLines={1}>
                  {driver.meta}
                </Text>

                <View style={styles.footer}>
                  {driver.vehicle ? (
                    <View style={styles.vehicleRow}>
                      <Icon
                        name="truck"
                        size={12}
                        color={driver.onTrip ? palette.navy : palette.slate500}
                      />
                      <Text
                        style={
                          driver.onTrip ? styles.vehicleOn : styles.vehicleOff
                        }
                        numberOfLines={1}
                      >
                        {driver.vehicle}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noVehicle}>No vehicle assigned</Text>
                  )}

                  {driver.vehicle ? (
                    <View
                      style={driver.online ? styles.pillOnline : styles.pillOffline}
                    >
                      {driver.online ? (
                        <BlinkDot color={palette.gold} size={4} />
                      ) : (
                        <View style={styles.offlineDot} />
                      )}
                      <Text
                        style={
                          driver.online
                            ? styles.pillOnlineText
                            : styles.pillOfflineText
                        }
                      >
                        {driver.online ? 'ONLINE' : 'OFFLINE'}
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Assign vehicle to ${driver.name}`}
                      style={({ pressed }) => [
                        styles.assign,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.assignText}>Assign</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </Card>
        ))}
      </Content>

      {/* FAB */}
      <Pressable
        onPress={addDriver}
        accessibilityRole="button"
        accessibilityLabel="Add driver"
        style={({ pressed }) => [styles.fabWrap, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={gradients.gold as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Icon name="plus" size={18} color={palette.navy} />
        </LinearGradient>
      </Pressable>
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
  tabText: font(9, '700', { color: palette.slate500 }),
  tabTextOn: font(9, '800', { color: palette.white }),

  contentTop: { paddingTop: s(10) },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: s(10) },
  avatar: {
    width: s(40),
    height: s(40),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: font(13, '800'),
  presence: {
    position: 'absolute',
    bottom: s(-1),
    right: s(-1),
    width: s(12),
    height: s(12),
    borderRadius: radius.full,
    borderWidth: s(2),
    borderColor: palette.white,
  },
  body: { flex: 1, minWidth: 0 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: s(8),
  },
  /*
   * The name yields, the score does not.
   *
   * `space-between` with no rule on either side lets whichever is wider take
   * the room. The mock abbreviated its people — "Ramesh K" — while the roster
   * sends the name the account was registered with, so a longer one pushed the
   * score off the card.
   */
  name: {
    ...font(12, '800', { color: palette.navy }),
    flexShrink: 1,
    minWidth: 0,
  },
  score: { ...font(9, '800'), flexShrink: 0 },
  meta: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(2),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: s(8),
    marginTop: s(6),
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    flexShrink: 1,
    minWidth: 0,
  },
  vehicleOn: font(9, '800', { color: palette.navy }),
  vehicleOff: font(9, '800', { color: palette.slate500 }),
  noVehicle: font(9, '800', { color: palette.red }),

  pillOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldTint,
    borderRadius: radius.sm,
  },
  pillOnlineText: font(8, '800', { color: palette.goldText }),
  pillOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.sm,
  },
  pillOfflineText: font(8, '800', { color: palette.slate500 }),
  offlineDot: {
    width: s(4),
    height: s(4),
    borderRadius: radius.full,
    backgroundColor: palette.slate400,
  },

  assign: {
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    backgroundColor: palette.gold,
    borderRadius: radius.sm,
  },
  assignText: font(9, '800', { color: palette.navy }),

  fabWrap: { position: 'absolute', bottom: s(20), right: s(20) },
  // 44, down from 54. The glyph drops 22 -> 18 with it, so the plus keeps
  // its proportion inside the circle rather than just gaining padding.
  fab: {
    width: s(44),
    height: s(44),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.vehicleSelected,
  },

  pressed: { opacity: 0.8 },
});
