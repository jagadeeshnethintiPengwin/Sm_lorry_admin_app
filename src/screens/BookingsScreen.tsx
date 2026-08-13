import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  BlinkDot,
  Content,
  Icon,
  RouteView,
  Screen,
} from '@components/index';
import { bookingService } from '@services/fleet.service';
import type { AdminBooking } from '@services/fleet.service';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList, TabParamList } from '@navigation/types';

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

/** Counts come from the rows now, so a tab is just its key and label. */
const TABS: Array<[Tab, string]> = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];

/**
 * The tab a booking belongs to, from the status the API sends.
 *
 * All five `BookingStatus` values are here on purpose. A booking that reaches
 * `COMPLETED` was approved and then delivered, so it stays under Approved —
 * and `CANCELLED` sits with Rejected, both being ways a booking ends without a
 * trip running. Anything not listed is not guessed at: an unrecognised status
 * is dropped rather than falling into Pending, which would have put five
 * completed bookings in the owner's approval queue.
 */
const TAB_FOR: Record<string, Tab | undefined> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  COMPLETED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'rejected',
};

/** The tile accent cycles, so a list of rows is scannable. */
const TILE = [
  { tileBg: palette.navyTint, tileColor: palette.navy },
  { tileBg: palette.goldTint, tileColor: palette.gold },
  { tileBg: palette.redTint, tileColor: palette.red },
];

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** `2 min ago` / `18 min ago` / `3 days ago`. */
function ageOf(iso?: string): string {
  if (!iso) {
    return '';
  }
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function whenOf(iso?: string): string {
  if (!iso) {
    return '';
  }
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * One API booking, as this list draws it.
 *
 * The screen carried three literal rows — Sri Sai Traders, Krishna Industries,
 * Anand Logistics — and tab counts of 7/12/3. So the panel showed the same
 * three bookings to every owner, the counts never agreed with them, and the
 * approve and reject buttons acted on ids that did not exist.
 */
function toRow(
  booking: AdminBooking,
  index: number,
  newestPendingId: string | null,
  status: Tab,
): BookingRow {
  const company = String(booking.customer?.company ?? 'Customer');
  const contact = booking.customer?.contactName;

  return {
    id: booking.id,
    reference: `#${booking.reference ?? ''}`,
    customer: [company, contact].filter(Boolean).join(' · '),
    initials: initialsOf(company),
    ...TILE[index % TILE.length],
    pickup: String(booking.pickupPlace ?? '—'),
    drop: String(booking.dropPlace ?? '—'),
    meta: [
      booking.vehicleType,
      booking.distanceKm ? `${booking.distanceKm} km` : null,
      whenOf(booking.pickupAt as string | undefined),
    ]
      .filter(Boolean)
      .join(' · '),
    age: ageOf(booking.createdAt as string | undefined),
    status,
    // Inline approve/reject on the newest pending one, as the design has it.
    actions: booking.id === newestPendingId,
  };
}

export const BookingsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<TabParamList, 'Bookings'>>();

  const [tab, setTab] = useState<Tab>('pending');

  /*
   * Arriving with a bucket named shows that bucket.
   *
   * Approving moves a booking out of Pending, so returning to Pending showed
   * an operator the absence of what they had just done. The review screen now
   * says where the outcome landed and the list opens there.
   */
  const requestedTab = route.params?.tab;
  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab);
    }
  }, [requestedTab]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * Every booking, once, then split into tabs here.
   *
   * The API can filter by status, but the tab counts have to be right whichever
   * tab is showing — fetching per tab would leave the other two counts guessing,
   * which is how the hardcoded 7/12/3 came to disagree with the rows underneath
   * them.
   */
  const load = useCallback(async () => {
    setFailure(null);
    try {
      setBookings(await bookingService.list({ limit: 100 }));
    } catch (error) {
      setFailure((error as Error).message || 'Could not load bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rows = useMemo(() => {
    // Paired with its tab up front, so a status the app does not recognise is
    // left out rather than landed in whichever bucket happened to be default.
    const known = bookings
      .map(booking => ({ booking, tab: TAB_FOR[String(booking.status)] }))
      .filter((entry): entry is { booking: AdminBooking; tab: Tab } =>
        Boolean(entry.tab),
      );

    const newestPendingId =
      known.find(entry => entry.tab === 'pending')?.booking.id ?? null;

    return known.map((entry, index) =>
      toRow(entry.booking, index, newestPendingId, entry.tab),
    );
  }, [bookings]);

  const counts = useMemo(
    () => ({
      pending: rows.filter(r => r.status === 'pending').length,
      approved: rows.filter(r => r.status === 'approved').length,
      rejected: rows.filter(r => r.status === 'rejected').length,
    }),
    [rows],
  );

  const visible = useMemo(
    () => rows.filter(booking => booking.status === tab),
    [rows, tab],
  );

  /**
   * Rejects a booking, then re-reads so the tabs and counts follow.
   *
   * Reject only: approving takes a vehicle and a driver, which is a choice
   * this row cannot make. The branch that called `approve(id)` with no body
   * was unreachable — nothing wired a button to it — but it could only ever
   * have returned `400 vehicleId must be a string`, so it is gone rather than
   * left for the next person to connect. Approval goes through Review &
   * Assign, which is where the vehicle and driver are chosen.
   */
  const rejectBooking = useCallback(
    (id: string) => async () => {
      setBusyId(id);
      setFailure(null);
      try {
        await bookingService.reject(id, 'Rejected from the panel');
        await load();
        setTab('rejected');
      } catch (error) {
        setFailure(
          (error as Error).message || 'Could not reject the booking.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const review = useCallback(
    (id: string) => navigation.navigate('BookingReview', { bookingId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Bookings"
        subtitle={`${counts.pending} pending · ${rows.length} total`}
        showBack
        onBackPress={navigation.goBack}
      />

      {/* Status tabs */}
      <View style={styles.tabs}>
        {TABS.map(([key, label]) => {
          const count = counts[key];
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
        {/*
          * A failed fetch and an empty tab used to look identical, because both
          * were impossible — the list was a constant. Now that it is real, they
          * need telling apart.
          */}
        {failure ? (
          <Pressable onPress={load} accessibilityRole="button" style={styles.state}>
            <Icon name="alert-circle" size={16} color={palette.red} />
            <Text style={styles.stateTitle}>Could not load bookings</Text>
            <Text style={styles.stateBody}>{failure}</Text>
            <Text style={styles.stateAction}>Tap to try again</Text>
          </Pressable>
        ) : loading && !rows.length ? (
          <View style={styles.state}>
            <ActivityIndicator color={palette.navy} />
            <Text style={styles.stateBody}>Loading bookings…</Text>
          </View>
        ) : !visible.length ? (
          <View style={styles.state}>
            <Icon name="clipboard-list" size={18} color={palette.slate400} />
            <Text style={styles.stateTitle}>Nothing {tab}</Text>
            <Text style={styles.stateBody}>
              {tab === 'pending'
                ? 'New bookings from customers land here for approval.'
                : `Bookings you have ${tab} will be listed here.`}
            </Text>
          </View>
        ) : null}

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
                  <Text style={styles.pillText}>
                    {booking.status.toUpperCase()}
                  </Text>
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
                  {/* Reject had no `onPress` at all — it looked like a control
                      and did nothing. It now calls the API and re-reads, so
                      the row moves to the Rejected tab. */}
                  <Pressable
                    onPress={rejectBooking(booking.id)}
                    disabled={busyId === booking.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Reject ${booking.reference}`}
                    style={({ pressed }) => [
                      styles.reject,
                      (pressed || busyId === booking.id) && styles.pressed,
                    ]}
                  >
                    <Icon name="x" size={12} color={palette.red} />
                    <Text style={styles.rejectText}>
                      {busyId === booking.id ? 'Working…' : 'Reject'}
                    </Text>
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
  state: { alignItems: 'center', gap: s(6), paddingVertical: s(24) },
  stateTitle: font(11, '800', { color: palette.navy }),
  stateBody: {
    ...font(9, '600', { lineHeight: 1.35, color: palette.slate500 }),
    textAlign: 'center' },
  stateAction: font(9, '800', { color: palette.navy }),
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
