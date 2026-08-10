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
import { vehicleService } from '@services/fleet.service';
import type { AdminVehicle } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

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

/**
 * A fleet row as the API sends it, turned into the row this screen draws.
 *
 * The screen used to hold sixty lines of literal lorries, so the panel showed
 * the same forty-two vehicles on every device and the header said "42 total"
 * while the dashboard beside it read the real ten. Everything below is derived
 * from the record rather than written down.
 */
const DOC_TONE: Record<string, DocChip['tone']> = {
  VALID: 'navy',
  EXPIRING: 'gold',
  EXPIRED: 'red',
};

/** `AP31XX1234` is stored unspaced; plates are read in groups. */
const spacePlate = (plate: string): string =>
  /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(plate)
    ? plate.replace(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/, '$1 $2 $3 $4').replace(/\s+/g, ' ').trim()
    : plate;

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

function toRow(vehicle: AdminVehicle): VehicleRow {
  const status = String(vehicle.status ?? '').toUpperCase();
  const inTrip = status === 'IN_TRIP';
  const maintenance = status === 'MAINTENANCE';

  const driverName =
    ((vehicle.driver as { user?: { name?: string } } | null)?.user?.name) ?? '';

  const documents = Array.isArray(vehicle.documents)
    ? (vehicle.documents as { kind?: string; health?: string }[])
    : [];

  return {
    id: String(vehicle.id),
    registration: spacePlate(String(vehicle.registration ?? '')),
    // "14 Ft Truck · Tata LPT 1109" — the line under the plate.
    model: [vehicle.type, [vehicle.make, vehicle.model].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(' · '),
    // Maintenance trucks sit under Available rather than vanishing: two tabs
    // cannot hide a third state without losing lorries off the screen.
    status: inTrip ? 'in_trip' : 'available',
    statusLabel: inTrip ? 'IN TRIP' : maintenance ? 'MAINTENANCE' : 'AVAILABLE',
    pill: inTrip ? 'navy' : 'gold',
    rail: inTrip ? 'gold' : 'navy',
    tileBg: inTrip ? palette.goldTint : palette.navyTint,
    tileColor: inTrip ? palette.gold : palette.navy,
    driver: driverName
      ? { initials: initialsOf(driverName), name: driverName }
      : undefined,
    note: driverName ? undefined : { text: 'No driver assigned', tone: 'red' },
    // A kind is what the chip says, so a record without one has nothing to
    // draw — an empty chip is a stray coloured box, not information.
    docs: documents
      .filter(doc => doc.kind)
      .map(doc => ({
        label: String(doc.kind),
        tone: DOC_TONE[String(doc.health ?? '').toUpperCase()] ?? 'navy',
      })),
  };
}

const CHIP_TONE = {
  navy: { bg: palette.navyTint, fg: palette.navy },
  gold: { bg: palette.goldTint, fg: palette.goldText },
  red: { bg: palette.redTint, fg: palette.redDark },
};

export const VehiclesScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const addVehicle = useCallback(
    () => navigation.navigate('AddVehicle'),
    [navigation],
  );

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'in_trip' | 'available'>('in_trip');

  /*
   * The whole fleet in one read, filtered here.
   *
   * The API can filter by status and search on its own, but doing it there
   * would refetch on every keystroke and still leave the tab badges needing a
   * second request for the counts. A fleet is tens of lorries, not thousands.
   */
  const { data, loading, error, refetch } = useApi(
    () => vehicleService.page({ limit: 100 }),
    [],
  );

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter(vehicle => {
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
  }, [query, rows, tab]);

  /*
   * Counts come from the API's own tally, which covers the whole fleet — not
   * from `rows.length`, which would only ever count the page just fetched.
   */
  const counts = data?.meta?.counts;
  const total = data?.meta?.total ?? rows.length;
  const inTripCount = counts?.inTrip ?? rows.filter(r => r.status === 'in_trip').length;
  const availableCount =
    (counts?.available ?? 0) + (counts?.maintenance ?? 0) ||
    rows.filter(r => r.status === 'available').length;

  const openVehicle = useCallback(
    (id: string) => navigation.navigate('VehicleDetails', { vehicleId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Vehicles"
        subtitle={`${total} total · ${inTripCount} in trip`}
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
            In Trip {inTripCount}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('available')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'available' }}
          style={[styles.tab, tab === 'available' && styles.tabOn]}
        >
          <Text style={tab === 'available' ? styles.tabTextOn : styles.tabText}>
            Available {availableCount}
          </Text>
        </Pressable>
      </View>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        <ListState
          loading={loading}
          error={error}
          empty={visible.length === 0}
          what="vehicles"
          emptyHint={
            query.trim()
              ? 'Nothing matches that search.'
              : 'Add a truck with the + button to get started.'
          }
          onRetry={refetch}
        />

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
                  <Text style={styles.reg} numberOfLines={1}>
                    {vehicle.registration}
                  </Text>
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

                <Text style={styles.model} numberOfLines={1}>
                  {vehicle.model}
                </Text>

                {vehicle.driver ? (
                  <View style={styles.driverRow}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverInitials}>
                        {vehicle.driver.initials}
                      </Text>
                    </View>
                    <Text style={styles.driverName} numberOfLines={1}>
                      {vehicle.driver.name}
                    </Text>
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

      {/*
        * Add Vehicle.
        *
        * `AddVehicleScreen` and its route both existed, but nothing on this
        * list reached them — the only way in was the dashboard's quick action,
        * so an owner already looking at their fleet had no way to add to it.
        *
        * Same gold FAB as the drivers list rather than a new control: the two
        * screens are the same kind of thing, and a second pattern for the same
        * job is a thing to learn twice.
        */}
      <Pressable
        onPress={addVehicle}
        accessibilityRole="button"
        accessibilityLabel="Add vehicle"
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
  /*
   * The plate yields, the pill does not.
   *
   * `space-between` with neither side given a rule means whichever renders
   * wider wins. The mock only ever said "IN TRIP" or "AVAILABLE"; real records
   * also say "MAINTENANCE", which is half as wide again — long enough to push
   * the status off the card, or squeeze it until its text wrapped inside the
   * pill and the row grew a second line.
   */
  reg: {
    ...font(12, '800', { color: palette.navy, letterSpacing: 0.5 }),
    flexShrink: 1,
    minWidth: 0,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    borderRadius: radius.sm,
    flexShrink: 0,
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
    flexShrink: 0,
  },
  driverInitials: font(8, '800', { color: palette.white }),
  // A real name is longer than "Ramesh K" and must not push the avatar around.
  driverName: {
    ...font(9, '700', { color: palette.navy }),
    flexShrink: 1,
    minWidth: 0,
  },
  noteRed: { ...font(9, '700', { color: palette.red }), marginTop: s(4) },
  noteNavy: { ...font(9, '700', { color: palette.navy }), marginTop: s(4) },

  /*
   * Wraps, because the number of chips is not fixed.
   *
   * Four papers (RC, INS, FIT, PUC) fit on one line, which is all the mock
   * ever had. A truck a driver registered also carries its onboarding photos,
   * so the row can reach seven chips — and without wrapping the extras ran off
   * the edge of the card.
   */
  docs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(3),
    marginTop: s(6),
  },
  docChip: {
    paddingVertical: s(1),
    paddingHorizontal: s(5),
    borderRadius: s(5),
  },
  docText: font(7, '800'),
});
