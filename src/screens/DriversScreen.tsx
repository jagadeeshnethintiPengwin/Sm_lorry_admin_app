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
  Screen,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

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

const DRIVERS: DriverRow[] = [
  {
    id: 'd1',
    name: 'Ramesh Kumar',
    initials: 'RK',
    avatar: gradients.navyHero,
    avatarTextColor: palette.white,
    online: true,
    score: '98% ON-TIME',
    scoreColor: palette.green,
    meta: '+91 98765 43210 · 240 trips · 4y',
    vehicle: 'AP 31 XX 1234 · IN TRIP',
    onTrip: true,
    tabs: ['online', 'on_trip'],
  },
  {
    id: 'd2',
    name: 'Suresh Menon',
    initials: 'SM',
    avatar: gradients.red,
    avatarTextColor: palette.white,
    online: false,
    score: '94% ON-TIME',
    scoreColor: palette.gold,
    meta: '+91 90140 22883 · 118 trips · 2y',
    vehicle: 'AP 39 TR 4522',
    onTrip: false,
    tabs: ['offline'],
  },
  {
    id: 'd3',
    name: 'Prakash Reddy',
    initials: 'PK',
    avatar: gradients.gold,
    avatarTextColor: palette.navy,
    online: true,
    score: '99% ON-TIME',
    scoreColor: palette.green,
    meta: '+91 88863 21044 · 388 trips · 6y',
    vehicle: 'AP 05 CH 9912 · IN TRIP',
    onTrip: true,
    tabs: ['online', 'on_trip'],
  },
  {
    id: 'd4',
    name: 'Manoj K',
    initials: 'MK',
    avatar: gradients.navyHero,
    avatarTextColor: palette.white,
    online: true,
    score: '89% ON-TIME',
    scoreColor: palette.red,
    meta: '+91 77998 15577 · 42 trips · 1y',
    onTrip: false,
    rail: true,
    tabs: ['online'],
  },
];

export const DriversScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('online');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return DRIVERS.filter(driver => {
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
  }, [query, tab]);

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
        subtitle="38 total · 32 online"
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
            ['online', 'Online 32'],
            ['on_trip', 'On Trip 18'],
            ['offline', 'Offline 6'],
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
                  <Text style={styles.name}>{driver.name}</Text>
                  <Text style={[styles.score, { color: driver.scoreColor }]}>
                    {driver.score}
                  </Text>
                </View>

                <Text style={styles.meta}>{driver.meta}</Text>

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
          <Icon name="plus" size={22} color={palette.navy} />
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
  name: font(12, '800', { color: palette.navy }),
  score: font(9, '800'),
  meta: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(2),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: s(6),
  },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
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
  fab: {
    width: s(54),
    height: s(54),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.vehicleSelected,
  },

  pressed: { opacity: 0.8 },
});
