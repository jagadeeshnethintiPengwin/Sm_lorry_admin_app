import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppHeader, Content, Icon, ListState, Screen } from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import { notificationService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';
import { notificationTarget } from '@utils/notificationTarget';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 5 — Notifications.
 *
 * TODAY / YESTERDAY groups. Each row is one of four tones from the mock:
 *   gold  — new booking (gold tint, gold left rail, Reject / Review & Assign)
 *   navy  — trip assigned (navy tint, navy left rail)
 *   plain — informational (white, hairline border)
 *   red   — driver offline (red tint, red left rail, Call Driver)
 */
type Tone = 'gold' | 'navy' | 'plain' | 'red';

type Item = {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: IconName;
  tone: Tone;
  unread?: boolean;
  /**
   * Where this notification leads, as the server wrote it — `/bookings/SMB186`.
   *
   * Two booleans used to sit here instead, `bookingActions` and `callAction`,
   * which drew a Reject / Review & Assign pair and a red Call Driver button.
   * Neither was ever set on any row, so the buttons never rendered — and the
   * call one dialled a fixed seed number rather than any driver. The rows had
   * no press handler of their own either, so the whole screen was inert: an
   * owner tapping "Booking Received" got nothing.
   */
  link?: string;
};

/**
 * A notification as the API sends it, turned into the row this screen draws.
 *
 * Replaces two literal lists — TODAY and YESTERDAY — under a header that
 * always claimed twelve unread, whatever had actually been read.
 */
const ICON_FOR: Record<string, IconName> = {
  BOOKINGS: 'package-plus',
  TRIPS: 'truck',
  DRIVERS: 'user-check',
  DELIVERY: 'package-check',
  GPS: 'wifi-off',
  WALLET: 'credit-card',
  SYSTEM: 'bell-ring',
};

/** How long ago, in the shorthand the rows already used. */
function agoFrom(iso: string): string {
  const when = new Date(iso).getTime();
  if (Number.isNaN(when)) {
    return '';
  }
  const minutes = Math.max(0, Math.round((Date.now() - when) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

type Bucket = 'today' | 'yesterday' | 'earlier';

/** Which day-group a row belongs to, compared at local midnight. */
function bucketOf(iso: string): Bucket {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    return 'earlier';
  }
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  if (when >= midnight) {
    return 'today';
  }
  const yesterday = new Date(midnight);
  yesterday.setDate(yesterday.getDate() - 1);
  return when >= yesterday ? 'yesterday' : 'earlier';
}

function toItem(row: Record<string, unknown>): Item & { bucket: Bucket } {
  const category = String(row.category ?? 'SYSTEM').toUpperCase();
  const unread = !row.readAt;
  const createdAt = String(row.createdAt ?? '');

  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    body: String(row.detail ?? ''),
    time: agoFrom(createdAt),
    icon: ICON_FOR[category] ?? 'bell-ring',
    // Unread earns colour; anything already read settles back to plain, so the
    // list reads as a queue rather than a wall of highlights.
    tone: unread ? (category === 'BOOKINGS' ? 'gold' : 'navy') : 'plain',
    unread,
    link: typeof row.link === 'string' ? row.link : undefined,
    bucket: bucketOf(createdAt),
  };
}

const TONE = {
  gold: {
    wrap: { backgroundColor: palette.goldTint, borderLeftColor: palette.gold },
    tileBg: palette.white,
    tileColor: palette.gold,
    body: palette.goldText,
    time: palette.goldText,
    timeWeight: '800' as const,
  },
  navy: {
    wrap: { backgroundColor: palette.navyTint, borderLeftColor: palette.navy },
    tileBg: palette.white,
    tileColor: palette.navy,
    body: palette.slate500,
    time: palette.navy,
    timeWeight: '800' as const,
  },
  plain: {
    wrap: { backgroundColor: palette.white },
    tileBg: palette.navyTint,
    tileColor: palette.navy,
    body: palette.slate500,
    time: palette.slate500,
    timeWeight: '700' as const,
  },
  red: {
    wrap: { backgroundColor: palette.redTint, borderLeftColor: palette.red },
    tileBg: palette.white,
    tileColor: palette.red,
    body: palette.redDark,
    time: palette.red,
    timeWeight: '800' as const,
  },
};

const Row: React.FC<{ item: Item; onOpen: (item: Item) => void }> = ({
  item,
  onOpen,
}) => {
  const tone = TONE[item.tone];
  const railed = item.tone !== 'plain';

  /*
   * Only rows that lead somewhere are pressable.
   *
   * A notification whose link this app has no screen for — one addressed to a
   * driver or a customer — stays as text rather than becoming a button that
   * does nothing when tapped.
   */
  const target = notificationTarget(item.link);

  const Wrapper = target ? Pressable : View;

  return (
    <Wrapper
      {...(target
        ? {
            onPress: () => onOpen(item),
            accessibilityRole: 'button' as const,
            accessibilityLabel: `${item.title}. ${item.body}`,
          }
        : {})}
      style={[
        styles.row,
        tone.wrap,
        railed ? styles.rowRailed : styles.rowPlain,
      ]}
    >
      <View style={[styles.tile, { backgroundColor: tone.tileBg }]}>
        <Icon name={item.icon} size={16} color={tone.tileColor} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.title}</Text>
          {item.unread ? <View style={styles.dot} /> : null}
        </View>

        <Text style={[styles.text, { color: tone.body }]}>{item.body}</Text>



        <Text
          style={[
            tone.timeWeight === '800' ? styles.timeBold : styles.timeMedium,
            { color: tone.time },
          ]}
        >
          {item.time}
        </Text>
      </View>
    </Wrapper>
  );
};

export const NotificationsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { data, loading, error, refetch } = useApi(
    () => notificationService.list(),
    [],
  );

  const items = useMemo(
    () => (data ?? []).map(row => toItem(row as Record<string, unknown>)),
    [data],
  );

  const unread = items.filter(item => item.unread).length;

  /*
   * Marked locally the moment it is pressed, then confirmed.
   *
   * The request is a round trip, and a header that keeps saying "12 unread"
   * while it completes reads as a button that did nothing — so the operator
   * presses it again. Clearing on press and re-reading afterwards means the
   * screen answers immediately and still ends up agreeing with the server.
   */
  /**
   * Opens what the notification is about.
   *
   * The link is a web path, because the same row is read in the browser panel;
   * `notificationTarget` turns it into a screen and its parameters. A row whose
   * link this app has no screen for never becomes pressable in the first place,
   * so the null branch here is belt and braces rather than a live case.
   */
  const open = useCallback(
    (item: Item) => {
      const target = notificationTarget(item.link);
      if (!target) {
        return;
      }
      switch (target.screen) {
        case 'TripDetails':
          navigation.navigate('TripDetails', target.params);
          break;
        case 'BookingReview':
          navigation.navigate('BookingReview', target.params);
          break;
        case 'VehicleDetails':
          navigation.navigate('VehicleDetails', target.params);
          break;
        case 'PodViewer':
          navigation.navigate('PodViewer', target.params);
          break;
      }
    },
    [navigation],
  );

  const [clearing, setClearing] = useState(false);
  const [clearedAll, setClearedAll] = useState(false);

  const markAllRead = useCallback(async () => {
    if (clearing || unread === 0) {
      return;
    }
    setClearing(true);
    setClearedAll(true);
    try {
      await notificationService.markAllRead();
    } catch {
      /*
       * Put it back. A failed call that left the screen looking cleared would
       * hide notifications the office has not actually seen — and the badge on
       * the dashboard, which re-reads from the server, would disagree with it
       * on the next visit.
       */
      setClearedAll(false);
    } finally {
      setClearing(false);
      /* Re-read, so `readAt` comes from the server rather than this screen. */
      refetch();
    }
  }, [clearing, refetch, unread]);

  /* What the header reports, allowing for a clear that is still in flight. */
  const shownUnread = clearedAll ? 0 : unread;

  /*
   * The rows, agreeing with the header.
   *
   * Without this the subtitle says "All caught up" while every row still
   * carries its unread dot and gold tone — the screen contradicting itself for
   * as long as the request takes. Once the refetch lands this is a no-op,
   * because the server's `readAt` says the same thing.
   */
  const shown = useMemo(
    () =>
      clearedAll
        ? items.map(item => ({ ...item, unread: false, tone: 'plain' as const }))
        : items,
    [clearedAll, items],
  );

  // Only groups with something in them get a heading — an empty "YESTERDAY"
  // above nothing reads as a list that failed to load.
  const groups = useMemo(
    () =>
      (
        [
          ['TODAY', 'today'],
          ['YESTERDAY', 'yesterday'],
          ['EARLIER', 'earlier'],
        ] as Array<[string, Bucket]>
      )
        .map(([heading, bucket]) => ({
          heading,
          rows: shown.filter(item => item.bucket === bucket),
        }))
        .filter(group => group.rows.length > 0),
    [shown],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Notifications"
        subtitle={
          shownUnread > 0 ? `${shownUnread} unread` : 'All caught up'
        }
        showBack
        onBackPress={navigation.goBack}
        /*
         * Only offered when there is something to clear.
         *
         * A tick that is always there gives no signal, and pressing it on an
         * already-clear feed is a request that changes nothing. It appears
         * with the first unread notification and goes when the last is read.
         */
        rightIcon={shownUnread > 0 ? 'check' : undefined}
        onRightPress={markAllRead}
        rightAccessibilityLabel={`Mark all ${shownUnread} notifications as read`}
      />

      <Content padding={12} safeBottom>
        <ListState
          loading={loading}
          error={error}
          empty={shown.length === 0}
          what="notifications"
          emptyIcon="bell-ring"
          emptyHint="You will see bookings, trips and alerts here."
          onRetry={refetch}
        />

        {groups.map((group, index) => (
          <React.Fragment key={group.heading}>
            <Text style={[styles.group, index > 0 && styles.groupGap]}>
              {group.heading}
            </Text>
            {group.rows.map(item => (
              <Row key={item.id} item={item} onOpen={open} />
            ))}
          </React.Fragment>
        ))}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  group: {
    ...font(9, '800', { color: palette.slate500, letterSpacing: 1 }),
    marginBottom: s(6),
  },
  groupGap: { marginTop: s(12) },

  row: {
    flexDirection: 'row',
    gap: s(10),
    padding: s(11),
    borderRadius: radius.card,
    marginBottom: s(6),
  },
  rowRailed: { borderLeftWidth: s(3) },
  rowPlain: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  tile: {
    width: s(34),
    height: s(34),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: s(6) },
  title: font(11, '800', { color: palette.navy }),
  dot: {
    width: s(7),
    height: s(7),
    borderRadius: radius.full,
    backgroundColor: palette.red,
    marginTop: s(4),
  },
  text: { ...font(10, '400'), marginTop: s(1) },



  timeBold: { ...font(9, '800'), marginTop: s(5) },
  timeMedium: { ...font(9, '700'), marginTop: s(5) },

  pressed: { opacity: 0.75 },
});
