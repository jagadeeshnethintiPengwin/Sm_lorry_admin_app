import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  BlinkDot,
  Content,
  Icon,
  RouteView,
  Screen,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 16 — Bookings List.
 *
 *   Pending / Approved / Rejected tabs, each with a count bubble ·
 *   pending cards on a `linear-gradient(180deg,#fffdf7,#fff 60%)` wash with a
 *   gold border, PENDING pill, customer row, route rail, dashed meta strip,
 *   and — on the first card — Reject / Review & Assign actions
 */
type Tab = 'pending' | 'approved' | 'rejected';

type BookingRow = {
  id: string;
  reference: string;
  customer: string;
  initials: string;
  tileBg: string;
  tileColor: string;
  pickup: string;
  drop: string;
  meta: string;
  age: string;
  status: Tab;
  /** Only the newest pending booking carries the inline actions. */
  actions?: boolean;
};

const BOOKINGS: BookingRow[] = [
  {
    id: 'b1',
    reference: '#ST-2026-8842',
    customer: 'Sri Sai Traders · Rajesh K',
    initials: 'SS',
    tileBg: palette.navyTint,
    tileColor: palette.navy,
    pickup: 'Kompally, Hyderabad',
    drop: 'Vijayawada',
    meta: '14 Ft · 278 km · Today 4 PM',
    age: '2 min ago',
    status: 'pending',
    actions: true,
  },
  {
    id: 'b2',
    reference: '#ST-2026-8841',
    customer: 'Krishna Industries · Suresh M',
    initials: 'KI',
    tileBg: palette.goldTint,
    tileColor: palette.gold,
    pickup: 'Vizag Port',
    drop: 'Uppal Depot',
    meta: '17 Ft · 620 km · Tomorrow 6 AM',
    age: '18 min ago',
    status: 'pending',
  },
  {
    id: 'b3',
    reference: '#ST-2026-8840',
    customer: 'Anand Logistics · Anand P',
    initials: 'AL',
    tileBg: palette.redTint,
    tileColor: palette.red,
    pickup: 'Guntur',
    drop: 'Chennai',
    meta: '22 Ft Trailer · Day after · 6 AM',
    age: '32 min ago',
    status: 'pending',
  },
];

const TABS: Array<[Tab, string, string]> = [
  ['pending', 'Pending', '7'],
  ['approved', 'Approved', '12'],
  ['rejected', 'Rejected', '3'],
];

export const BookingsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<Tab>('pending');

  const visible = useMemo(
    () => BOOKINGS.filter(booking => booking.status === tab),
    [tab],
  );

  const review = useCallback(
    (id: string) => navigation.navigate('BookingReview', { bookingId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Bookings"
        subtitle="7 pending · 142 total"
        showBack
        onBackPress={navigation.goBack}
      />

      {/* Status tabs */}
      <View style={styles.tabs}>
        {TABS.map(([key, label, count]) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label}, ${count}`}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={on ? styles.tabTextOn : styles.tabText}>{label}</Text>
              <View style={on ? styles.countOn : styles.count}>
                <Text style={on ? styles.countTextOn : styles.countText}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        {visible.map(booking => (
          <Pressable
            key={booking.id}
            onPress={() => review(booking.id)}
            accessibilityRole="button"
            accessibilityLabel={`${booking.reference}, ${booking.customer}`}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <LinearGradient
              colors={['#fffdf7', palette.white]}
              locations={[0, 0.6]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.card}
            >
              <View style={styles.head}>
                <Text style={styles.reference}>{booking.reference}</Text>
                <View style={styles.pill}>
                  <BlinkDot color={palette.gold} size={4} />
                  <Text style={styles.pillText}>PENDING</Text>
                </View>
              </View>

              <View style={styles.customerRow}>
                <View style={[styles.tile, { backgroundColor: booking.tileBg }]}>
                  <Text style={[styles.tileText, { color: booking.tileColor }]}>
                    {booking.initials}
                  </Text>
                </View>
                <Text style={styles.customer}>{booking.customer}</Text>
              </View>

              <RouteView
                pickup={booking.pickup}
                drop={booking.drop}
                pickupLabel="Pickup"
                dropLabel="Drop"
                style={styles.route}
              />

              <View style={styles.metaStrip}>
                <Text style={styles.meta}>{booking.meta}</Text>
                <Text style={styles.meta}>{booking.age}</Text>
              </View>

              {booking.actions ? (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reject ${booking.reference}`}
                    style={({ pressed }) => [
                      styles.reject,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name="x" size={12} color={palette.red} />
                    <Text style={styles.rejectText}>Reject</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => review(booking.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Review and assign ${booking.reference}`}
                    style={({ pressed }) => [
                      styles.reviewWrap,
                      pressed && styles.pressed,
                    ]}
                  >
                    <LinearGradient
                      colors={[palette.gold, palette.goldDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.review}
                    >
                      <Icon name="check" size={12} color={palette.navy} />
                      <Text style={styles.reviewText}>Review &amp; Assign</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : null}
            </LinearGradient>
          </Pressable>
        ))}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
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
    paddingHorizontal: s(2),
    borderRadius: radius.md,
    alignItems: 'center',
    gap: s(2),
  },
  tabOn: { backgroundColor: palette.navy },
  tabText: font(9, '700', { color: palette.slate500 }),
  tabTextOn: font(9, '800', { color: palette.white }),
  count: {
    paddingHorizontal: s(5),
    minWidth: s(14),
    borderRadius: radius.sm,
    backgroundColor: 'rgba(13,38,71,0.08)',
    alignItems: 'center',
  },
  countOn: {
    paddingHorizontal: s(5),
    minWidth: s(14),
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
  },
  countText: font(8, '700', { color: palette.slate500 }),
  countTextOn: font(8, '800', { color: palette.white }),

  contentTop: { paddingTop: s(10) },

  card: {
    borderRadius: radius.card,
    padding: s(12),
    marginBottom: s(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.goldSoft,
    ...shadows.card,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(6),
  },
  reference: font(10, '800', { color: palette.red }),
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldSoft,
    borderRadius: radius.sm,
  },
  pillText: font(8, '800', { color: palette.goldText }),

  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginBottom: s(6),
  },
  tile: {
    width: s(26),
    height: s(26),
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: font(9, '800'),
  customer: { ...font(11, '800', { color: palette.navy }), flex: 1 },

  route: { marginBottom: s(6) },

  metaStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: s(6),
    borderTopWidth: s(1),
    borderTopColor: palette.goldSoft,
    borderStyle: 'dashed',
  },
  meta: font(9, '700', { color: palette.goldText }),

  actions: { flexDirection: 'row', gap: s(6), marginTop: s(8) },
  reject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
    padding: s(8),
    backgroundColor: palette.white,
    borderWidth: s(1.5),
    borderColor: palette.redSoft,
    borderRadius: radius.md,
  },
  rejectText: font(10, '800', { color: palette.red }),
  reviewWrap: { flex: 1.4 },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
    padding: s(8),
    borderRadius: radius.md,
    ...shadows.goldSmall,
  },
  reviewText: font(10, '800', { color: palette.navy }),

  pressed: { opacity: 0.85 },
});
