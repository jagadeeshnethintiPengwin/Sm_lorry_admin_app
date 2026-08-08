import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppHeader, Content, Icon, Screen } from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';

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

const TODAY: Item[] = [
  {
    id: 'n1',
    title: 'New Booking Received',
    body: 'Sri Sai Traders · #ST-2026-8842 · Vizag → Hyd',
    time: '2 min ago',
    icon: 'package-plus',
    tone: 'gold',
    unread: true,
    bookingActions: true,
  },
  {
    id: 'n2',
    title: 'Trip Assigned',
    body: '#TR-2026-8842 → Manoj K (AP 39 TR 4522)',
    time: '12 min ago',
    icon: 'check-circle-2',
    tone: 'navy',
    unread: true,
  },
  {
    id: 'n3',
    title: 'Trip Started',
    body: 'Ramesh K started #TR-2026-8836',
    time: '18 min ago',
    icon: 'play',
    tone: 'plain',
  },
  {
    id: 'n4',
    title: 'Driver Went Offline',
    body: 'Suresh M · AP 39 TR 4522',
    time: '32 min ago',
    icon: 'wifi-off',
    tone: 'red',
    unread: true,
    callAction: true,
  },
  {
    id: 'n5',
    title: 'Vehicle Reached Pickup',
    body: 'AP 05 CH 9912 at Kompally',
    time: '45 min ago',
    icon: 'map-pin',
    tone: 'plain',
  },
];

const YESTERDAY: Item[] = [
  {
    id: 'n6',
    title: 'Delivery Completed',
    body: '#TR-2026-8812 · POD uploaded',
    time: 'Yesterday, 3:42 PM',
    icon: 'package-check',
    tone: 'plain',
  },
];

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

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Notifications"
        subtitle="12 unread"
        showBack
        onBackPress={navigation.goBack}
      />

      <Content padding={12} safeBottom>
        <Text style={styles.group}>TODAY</Text>
        {TODAY.map(item => (
          <Row key={item.id} item={item} />
        ))}

        <Text style={[styles.group, styles.groupGap]}>YESTERDAY</Text>
        {YESTERDAY.map(item => (
          <Row key={item.id} item={item} />
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
