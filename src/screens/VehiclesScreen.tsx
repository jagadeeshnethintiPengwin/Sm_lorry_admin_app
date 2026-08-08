import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 6 — Vehicles List.
 *
 *   search bar (magnifier + QR) · In Trip / Available segmented control ·
 *   vehicle cards: gold or navy left rail, truck tile, registration +
 *   status pill, model line, driver chip or "No driver assigned", and the
 *   RC / INS / FIT / PUC document chips
 */
type DocChip = { label: string; tone: 'navy' | 'gold' | 'red' };

type VehicleRow = {
  id: string;
  registration: string;
  model: string;
  status: 'in_trip' | 'available';
  statusLabel: string;
  pill: 'navy' | 'gold';
  rail?: 'gold' | 'navy';
  tileBg: string;
  tileColor: string;
  driver?: { initials: string; name: string };
  note?: { text: string; tone: 'red' | 'navy' };
  docs?: DocChip[];
};

const VEHICLES: VehicleRow[] = [
  {
    id: 'v1',
    registration: 'AP 31 XX 1234',
    model: '14 Ft Truck · Tata LPT 1109',
    status: 'in_trip',
    statusLabel: 'IN TRIP',
    pill: 'navy',
    rail: 'gold',
    tileBg: palette.goldTint,
    tileColor: palette.gold,
    driver: { initials: 'RK', name: 'Ramesh K' },
    docs: [
      { label: 'RC', tone: 'navy' },
      { label: 'INS', tone: 'gold' },
      { label: 'FIT', tone: 'gold' },
      { label: 'PUC 12d', tone: 'red' },
    ],
  },
  {
    id: 'v2',
    registration: 'AP 39 TR 4522',
    model: '17 Ft Truck · Ashok Leyland Boss',
    status: 'available',
    statusLabel: 'AVAILABLE',
    pill: 'gold',
    tileBg: palette.navyTint,
    tileColor: palette.navy,
    note: { text: 'No driver assigned', tone: 'red' },
    docs: [
      { label: 'RC', tone: 'navy' },
      { label: 'INS', tone: 'gold' },
      { label: 'FIT', tone: 'gold' },
      { label: 'PUC', tone: 'gold' },
    ],
  },
  {
    id: 'v3',
    registration: 'TS 09 UB 8801',
    model: '22 Ft Trailer · Bharat Benz 2523R',
    status: 'available',
    statusLabel: 'AVAILABLE',
    pill: 'navy',
    rail: 'navy',
    tileBg: palette.navyTint,
    tileColor: palette.navy,
    note: { text: 'Parked at Vijayawada yard', tone: 'navy' },
  },
  {
    id: 'v4',
    registration: 'AP 05 CH 9912',
    model: '19 Ft Truck · Eicher Pro 3019',
    status: 'in_trip',
    statusLabel: 'IN TRIP',
    pill: 'navy',
    rail: 'gold',
    tileBg: palette.goldTint,
    tileColor: palette.gold,
    driver: { initials: 'MK', name: 'Manoj K' },
    docs: [
      { label: 'RC', tone: 'navy' },
      { label: 'INS', tone: 'gold' },
      { label: 'FIT', tone: 'gold' },
      { label: 'PUC', tone: 'gold' },
    ],
  },
];

const CHIP_TONE = {
  navy: { bg: palette.navyTint, fg: palette.navy },
  gold: { bg: palette.goldTint, fg: palette.goldText },
  red: { bg: palette.redTint, fg: palette.redDark },
};

export const VehiclesScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'in_trip' | 'available'>('in_trip');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return VEHICLES.filter(vehicle => {
      const matchesTab = vehicle.status === tab;
      if (!term) {
        return matchesTab;
      }
      return (
        matchesTab &&
        (vehicle.registration.toLowerCase().includes(term) ||
          vehicle.model.toLowerCase().includes(term))
      );
    });
  }, [query, tab]);

  const openVehicle = useCallback(
    (id: string) => navigation.navigate('VehicleDetails', { vehicleId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Vehicles"
        subtitle="42 total · 28 in trip"
        showBack
        onBackPress={navigation.goBack}
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="search" size={16} color={palette.slate400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search reg number, type..."
            placeholderTextColor={palette.slate400}
            style={styles.searchInput}
            accessibilityLabel="Search vehicles"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan QR code"
            hitSlop={s(6)}
          >
            <Icon name="qr-code" size={16} color={palette.navy} />
          </Pressable>
        </View>
      </View>

      {/* Status tabs */}
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('in_trip')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'in_trip' }}
          style={[styles.tab, tab === 'in_trip' && styles.tabOn]}
        >
          <Text style={tab === 'in_trip' ? styles.tabTextOn : styles.tabText}>
            In Trip 28
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('available')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'available' }}
          style={[styles.tab, tab === 'available' && styles.tabOn]}
        >
          <Text style={tab === 'available' ? styles.tabTextOn : styles.tabText}>
            Available 14
          </Text>
        </Pressable>
      </View>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        {visible.map(vehicle => (
          <Card
            key={vehicle.id}
            padding={11}
            onPress={() => openVehicle(vehicle.id)}
            accessibilityLabel={`${vehicle.registration}, ${vehicle.statusLabel}`}
            accentColor={
              vehicle.rail === 'gold'
                ? palette.gold
                : vehicle.rail === 'navy'
                ? palette.navy
                : undefined
            }
            accentWidth={3}
          >
            <View style={styles.row}>
              <View style={[styles.tile, { backgroundColor: vehicle.tileBg }]}>
                <Icon name="truck" size={20} color={vehicle.tileColor} />
              </View>

              <View style={styles.body}>
                <View style={styles.head}>
                  <Text style={styles.reg}>{vehicle.registration}</Text>
                  <View
                    style={[
                      styles.pill,
                      vehicle.pill === 'navy' ? styles.pillNavy : styles.pillGold,
                    ]}
                  >
                    {vehicle.status === 'in_trip' && vehicle.pill === 'navy' ? (
                      <BlinkDot color={palette.gold} size={4} />
                    ) : null}
                    <Text
                      style={
                        vehicle.pill === 'navy'
                          ? styles.pillTextNavy
                          : styles.pillTextGold
                      }
                    >
                      {vehicle.statusLabel}
                    </Text>
                  </View>
                </View>

                <Text style={styles.model}>{vehicle.model}</Text>

                {vehicle.driver ? (
                  <View style={styles.driverRow}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverInitials}>
                        {vehicle.driver.initials}
                      </Text>
                    </View>
                    <Text style={styles.driverName}>{vehicle.driver.name}</Text>
                  </View>
                ) : null}

                {vehicle.note ? (
                  <Text
                    style={
                      vehicle.note.tone === 'red'
                        ? styles.noteRed
                        : styles.noteNavy
                    }
                  >
                    {vehicle.note.text}
                  </Text>
                ) : null}

                {vehicle.docs ? (
                  <View style={styles.docs}>
                    {vehicle.docs.map(doc => (
                      <View
                        key={doc.label}
                        style={[
                          styles.docChip,
                          { backgroundColor: CHIP_TONE[doc.tone].bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.docText,
                            { color: CHIP_TONE[doc.tone].fg },
                          ]}
                        >
                          {doc.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
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
  tabText: font(9.5, '700', { color: palette.slate500 }),
  tabTextOn: font(9.5, '800', { color: palette.white }),

  contentTop: { paddingTop: s(10) },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: s(10) },
  tile: {
    width: s(38),
    height: s(38),
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: s(8),
  },
  reg: font(12, '800', { color: palette.navy, letterSpacing: 0.5 }),
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    borderRadius: radius.sm,
  },
  pillNavy: { backgroundColor: palette.navyTint },
  pillGold: { backgroundColor: palette.goldSoft },
  pillTextNavy: font(8, '800', { color: palette.navy }),
  pillTextGold: font(8, '800', { color: palette.goldText }),

  model: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(2),
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: s(4),
  },
  driverAvatar: {
    width: s(18),
    height: s(18),
    borderRadius: radius.full,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: font(8, '800', { color: palette.white }),
  driverName: font(9, '700', { color: palette.navy }),
  noteRed: { ...font(9, '700', { color: palette.red }), marginTop: s(4) },
  noteNavy: { ...font(9, '700', { color: palette.navy }), marginTop: s(4) },

  docs: { flexDirection: 'row', gap: s(3), marginTop: s(6) },
  docChip: {
    paddingVertical: s(1),
    paddingHorizontal: s(5),
    borderRadius: s(5),
  },
  docText: font(7, '800'),
});
