import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppHeader, Content, Icon, ListState, Screen } from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import { notificationService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

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
  /** Booking rows carry the Reject / Review pair. */
  bookingActions?: boolean;
  /** Offline rows carry the red Call Driver button. */
  callAction?: boolean;
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

const Row: React.FC<{ item: Item }> = ({ item }) => {
  const tone = TONE[item.tone];
  const railed = item.tone !== 'plain';

  return (
    <View
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

        {item.bookingActions ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reject booking"
              style={({ pressed }) => [styles.reject, pressed && styles.pressed]}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Review and assign booking"
              style={({ pressed }) => [styles.review, pressed && styles.pressed]}
            >
              <Text style={styles.reviewText}>Review &amp; Assign</Text>
            </Pressable>
          </View>
        ) : null}

        {item.callAction ? (
          <Pressable
            onPress={() => Linking.openURL('tel:+919876543210').catch(() => undefined)}
            accessibilityRole="button"
            accessibilityLabel="Call driver"
            style={({ pressed }) => [styles.call, pressed && styles.pressed]}
          >
            <Icon name="phone" size={10} color={palette.white} />
            <Text style={styles.callText}>Call Driver</Text>
          </Pressable>
        ) : null}

        <Text
          style={[
            tone.timeWeight === '800' ? styles.timeBold : styles.timeMedium,
            { color: tone.time },
          ]}
        >
          {item.time}
        </Text>
      </View>
    </View>
  );
};

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation();

  const { data, loading, error, refetch } = useApi(
    () => notificationService.list(),
    [],
  );

  const items = useMemo(
    () => (data ?? []).map(row => toItem(row as Record<string, unknown>)),
    [data],
  );

  const unread = items.filter(item => item.unread).length;

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
          rows: items.filter(item => item.bucket === bucket),
        }))
        .filter(group => group.rows.length > 0),
    [items],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content padding={12} safeBottom>
        <ListState
          loading={loading}
          error={error}
          empty={items.length === 0}
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
              <Row key={item.id} item={item} />
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

  actions: { flexDirection: 'row', gap: s(6), marginTop: s(8) },
  reject: {
    flex: 1,
    paddingVertical: s(5),
    paddingHorizontal: s(8),
    backgroundColor: palette.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.redSoft,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  rejectText: font(9, '800', { color: palette.red }),
  review: {
    flex: 1.4,
    paddingVertical: s(5),
    paddingHorizontal: s(8),
    backgroundColor: palette.navy,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  reviewText: font(9, '800', { color: palette.white }),

  call: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(4),
    paddingHorizontal: s(8),
    backgroundColor: palette.red,
    borderRadius: s(5),
    marginTop: s(6),
  },
  callText: font(9, '800', { color: palette.white }),

  timeBold: { ...font(9, '800'), marginTop: s(5) },
  timeMedium: { ...font(9, '700'), marginTop: s(5) },

  pressed: { opacity: 0.75 },
});
