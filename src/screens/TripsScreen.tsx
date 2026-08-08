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
  RouteView,
  Screen,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

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

const TRIPS: TripRow[] = [
  {
    id: 'TR-2026-8836',
    reference: '#TR-2026-8836',
    pickup: 'Visakhapatnam Port',
    drop: 'Sanathnagar, Hyderabad',
    rail: palette.gold,
    status: 'IN TRANSIT',
    pill: 'navy',
    driverLine: 'Ramesh K · AP 31 XX 1234',
    distance: '128/620 KM · 21%',
    progress: 21,
    tab: 'transit',
  },
  {
    id: 'TR-2026-8829',
    reference: '#TR-2026-8829',
    pickup: 'Kompally',
    drop: 'Kadapa',
    rail: palette.gold,
    status: 'IN TRANSIT',
    pill: 'navy',
    driverLine: 'Prakash R · AP 05 CH 9912',
    distance: '42/305 KM · 14%',
    progress: 14,
    tab: 'transit',
  },
  {
    id: 'TR-2026-8842',
    reference: '#TR-2026-8842',
    pickup: 'Kompally, Hyderabad',
    drop: 'Vijayawada',
    rail: palette.red,
    status: 'AT PICKUP',
    pill: 'red',
    loadingNote: 'Manoj K · Loading in progress',
    tab: 'transit',
  },
];

const TABS: Array<[Tab, string]> = [
  ['transit', 'Transit 18'],
  ['scheduled', 'Scheduled 12'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];

export const TripsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('transit');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return TRIPS.filter(trip => {
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
  }, [query, tab]);

  const openTrip = useCallback(
    (id: string) => navigation.navigate('TripDetails', { tripId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Trips"
        subtitle="18 in transit · 1,302 total"
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
        {TABS.map(([key, label]) => (
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
