import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Icon,
  IconWell,
  RadialGlow,
  Screen,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 14 — Customer Profile.
 *
 *   navy hero (gold-ringed square initials tile, GST VERIFIED · ACTIVE chip) ·
 *   stats card overlapping by -24px · CONTACT PERSON card with a dashed
 *   divider and MOBILE / EMAIL pair · BUSINESS card with GSTIN row ·
 *   RECENT TRIPS · Edit / New Booking footer
 */
type TripRow = {
  reference: string;
  route: string;
  status: string;
  pill: 'navy' | 'gold';
};

const RECENT: TripRow[] = [
  {
    reference: '#TR-2026-8836',
    route: 'Vizag → Hyderabad',
    status: 'IN TRANSIT',
    pill: 'navy',
  },
  {
    reference: '#TR-2026-8812',
    route: 'Uppal → Chennai',
    status: 'DELIVERED',
    pill: 'gold',
  },
];

export const CustomerDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const call = useCallback(() => {
    Linking.openURL('tel:+919876543210').catch(() => undefined);
  }, []);

  const openTrips = useCallback(() => navigation.navigate('Trips'), [navigation]);

  /** Editing reuses the Add Customer form — same fields, prefilled upstream. */
  const editCustomer = useCallback(
    () => navigation.navigate('AddCustomer'),
    [navigation],
  );

  /** Bookings are raised from the Bookings tab, same as the dashboard action. */
  const newBooking = useCallback(
    () => navigation.navigate('Tabs', { screen: 'Bookings' }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Customer Profile"
        showBack
        onBackPress={navigation.goBack}
      />

      <Content padding={0}>
        {/* Customer hero */}
        <LinearGradient
          colors={[palette.navy, palette.navyMid, palette.navyDark]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={140}
            color={palette.gold}
            opacity={0.28}
            top={-40}
            right={-40}
          />

          <View style={styles.heroRow}>
            <View style={styles.logoWrap}>
              <LinearGradient
                colors={gradients.gold as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoRing}
              />
              <View style={styles.logo}>
                <Text style={styles.logoText}>SS</Text>
              </View>
            </View>

            <View style={styles.heroBody}>
              <Text style={styles.heroName}>Sri Sai Traders</Text>
              <Text style={styles.heroPlace}>Hyderabad, Telangana</Text>
              <View style={styles.verifiedChip}>
                <Icon name="badge-check" size={10} color={palette.navy} />
                <Text style={styles.verifiedText}>GST VERIFIED · ACTIVE</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Stats overlap */}
        <View style={styles.statsWrap}>
          <View style={styles.statsCard}>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValue}>28</Text>
              <Text style={styles.statLabel}>TRIPS</Text>
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValueGold}>98%</Text>
              <Text style={styles.statLabel}>ON TIME</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>2y</Text>
              <Text style={styles.statLabel}>CLIENT</Text>
            </View>
          </View>
        </View>

        {/* Contact person */}
        <View style={styles.block}>
          <Text style={styles.section}>CONTACT PERSON</Text>
          <Card padding={11} marginBottom={0}>
            <View style={styles.contactRow}>
              <LinearGradient
                colors={gradients.navyHero as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.contactAvatar}
              >
                <Text style={styles.contactInitials}>RK</Text>
              </LinearGradient>

              <View style={styles.contactBody}>
                <Text style={styles.contactName}>Rajesh Kumar</Text>
                <Text style={styles.contactRole}>Director</Text>
              </View>

              <Pressable
                onPress={call}
                accessibilityRole="button"
                accessibilityLabel="Call Rajesh Kumar"
                style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
              >
                <Icon name="phone" size={14} color={palette.navy} />
              </Pressable>
            </View>

            <View style={styles.dashedRow}>
              <View style={styles.pairCell}>
                <Text style={styles.pairLabel}>MOBILE</Text>
                <Text style={styles.pairValue}>+91 98765 43210</Text>
              </View>
              <View style={styles.pairCell}>
                <Text style={styles.pairLabel}>EMAIL</Text>
                <Text style={styles.pairValue}>rajesh@sri.in</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Business */}
        <View style={styles.block}>
          <Text style={styles.section}>BUSINESS</Text>
          <Card padding={11} marginBottom={0}>
            <View style={styles.bizRow}>
              <IconWell
                icon="building-2"
                size={26}
                iconSize={14}
                backgroundColor={palette.goldTint}
                color={palette.gold}
                borderRadius={radius.md}
              />
              <View style={styles.bizBody}>
                <Text style={styles.bizName}>Sri Sai Traders Pvt Ltd</Text>
                <Text style={styles.bizAddress}>
                  Plot 42, Industrial Estate, Gachibowli, Hyderabad - 500032
                </Text>
              </View>
            </View>

            <View style={styles.gstRow}>
              <Text style={styles.gstLabel}>GSTIN</Text>
              <Text style={styles.gstValue}>36AABCS1234H1Z5</Text>
              <View style={styles.pillGold}>
                <Text style={styles.pillGoldText}>VERIFIED</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Recent trips */}
        <View style={styles.block}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionFlat}>RECENT TRIPS · 28</Text>
            <Pressable
              onPress={openTrips}
              accessibilityRole="button"
              accessibilityLabel="See all trips"
            >
              <Text style={styles.seeAll}>See all →</Text>
            </Pressable>
          </View>

          {RECENT.map(trip => (
            <Card
              key={trip.reference}
              padding={10}
              onPress={() =>
                navigation.navigate('TripDetails', {
                  tripId: trip.reference.replace('#', ''),
                })
              }
              accessibilityLabel={`${trip.reference}, ${trip.route}, ${trip.status}`}
            >
              <View style={styles.tripRow}>
                <View>
                  <Text style={styles.tripRef}>{trip.reference}</Text>
                  <Text style={styles.tripRoute}>{trip.route}</Text>
                </View>
                <View
                  style={trip.pill === 'navy' ? styles.pillNavy : styles.pillGold}
                >
                  <Text
                    style={
                      trip.pill === 'navy'
                        ? styles.pillNavyText
                        : styles.pillGoldText
                    }
                  >
                    {trip.status}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label="Edit"
            variant="outline"
            icon="edit-3"
            flex={1}
            onPress={editCustomer}
          />
          <Button
            label="New Booking"
            variant="gold"
            icon="plus-circle"
            flex={1.3}
            onPress={newBooking}
          />
        </View>
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingTop: s(18),
    paddingHorizontal: s(14),
    paddingBottom: s(40),
    overflow: 'hidden',
  },
  heroRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
  },
  logoWrap: {
    width: s(66),
    height: s(66),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRing: { ...StyleSheet.absoluteFill, borderRadius: radius.xl },
  logo: {
    width: s(60),
    height: s(60),
    borderRadius: radius.xl,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: font(20, '800', { color: palette.navy }),
  heroBody: { flex: 1, minWidth: 0 },
  heroName: font(14, '800', { color: palette.white, lineHeight: 1.15 }),
  heroPlace: {
    ...font(9, '400', { color: palette.white }),
    opacity: 0.75,
    marginTop: s(1),
  },
  verifiedChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginTop: s(5),
    paddingVertical: s(2),
    paddingHorizontal: s(8),
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
  },
  verifiedText: font(8, '800', { color: palette.navy, letterSpacing: 0.5 }),

  statsWrap: { paddingHorizontal: s(12), marginTop: s(-24) },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    paddingVertical: s(12),
    paddingHorizontal: s(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadows.elevatedCard,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.divider,
  },
  statValue: font(15, '800', { color: palette.navy }),
  statValueGold: font(15, '800', { color: palette.gold }),
  statLabel: {
    ...font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
    marginTop: s(3),
  },

  block: { paddingTop: s(14), paddingHorizontal: s(12) },
  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionFlat: font(9, '800', { color: palette.red, letterSpacing: 1 }),
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  seeAll: font(9, '800', { color: palette.navy }),

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  contactAvatar: {
    width: s(36),
    height: s(36),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitials: font(12, '800', { color: palette.white }),
  contactBody: { flex: 1 },
  contactName: font(11, '800', { color: palette.navy }),
  contactRole: font(9, '400', { color: palette.slate500 }),
  callBtn: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRow: {
    flexDirection: 'row',
    gap: s(8),
    marginTop: s(10),
    paddingTop: s(10),
    borderTopWidth: s(1),
    borderTopColor: palette.gray200,
    borderStyle: 'dashed',
  },
  pairCell: { flex: 1 },
  pairLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
  pairValue: {
    ...font(10, '800', { color: palette.navy }),
    marginTop: s(2),
  },

  bizRow: { flexDirection: 'row', gap: s(10) },
  bizBody: { flex: 1 },
  bizName: font(10, '800', { color: palette.navy }),
  bizAddress: {
    ...font(9, '400', { color: palette.slate500, lineHeight: 1.4 }),
    marginTop: s(1),
  },
  gstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginTop: s(8),
    paddingTop: s(8),
    borderTopWidth: s(1),
    borderTopColor: palette.gray200,
    borderStyle: 'dashed',
  },
  gstLabel: font(8, '800', { color: palette.slate500 }),
  gstValue: {
    ...font(10, '800', { color: palette.navy, letterSpacing: 0.5 }),
    flex: 1,
  },

  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripRef: font(10, '800', { color: palette.red }),
  tripRoute: {
    ...font(9, '700', { color: palette.navy }),
    marginTop: s(1),
  },
  pillNavy: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.navyTint,
    borderRadius: radius.sm,
  },
  pillNavyText: font(8, '800', { color: palette.navy }),
  pillGold: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldSoft,
    borderRadius: radius.sm,
  },
  pillGoldText: font(8, '800', { color: palette.goldText }),

  actions: {
    flexDirection: 'row',
    gap: s(8),
    paddingTop: s(14),
    paddingHorizontal: s(12),
    paddingBottom: s(20),
  },

  pressed: { opacity: 0.8 },
});
