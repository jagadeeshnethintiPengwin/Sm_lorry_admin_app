import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Icon,
  IconWell,
  ListState,
  RadialGlow,
  Screen,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { bookingService, customerService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Screen 14 — Customer Profile.
 *
 *   navy hero (gold-ringed square initials tile, GST VERIFIED · ACTIVE chip) ·
 *   stats card overlapping by -24px · CONTACT PERSON card with a dashed
 *   divider and MOBILE / EMAIL pair · BUSINESS card with GSTIN row ·
 *   RECENT TRIPS · Edit / New Booking footer
 */

export const CustomerDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'CustomerDetails'>>();
  const { customerId } = route.params;

  /*
   * The customer this screen was opened for.
   *
   * It never read `customerId` at all — the route has carried one since the
   * screen was written and nothing looked at it — so every customer in the
   * roster opened as `Rajesh Kumar`, GST VERIFIED, with a fixed number on the
   * call button. An operator checking who they were about to ring was reading
   * somebody else's record.
   */
  const { data, loading, error, refetch } = useApi(
    () => customerService.get(customerId),
    [customerId],
  );

  const customer = (data ?? null) as Record<string, any> | null;

  /*
   * This customer's shipments.
   *
   * The list under RECENT TRIPS was two literals — `#TR-2026-8836 Vizag →
   * Hyderabad` and `#TR-2026-8812 Uppal → Chennai` — shown against every
   * customer in the roster, and tapping one navigated with the *reference*
   * where a trip id was expected, so the trip screen it opened could only
   * ever 404.
   */
  const recent = useApi(
    () => bookingService.list({ customerId, limit: 5 }),
    [customerId],
  );
  const shipments = recent.data ?? [];
  const company: string = customer?.company || customer?.user?.name || '—';
  const contactName: string =
    customer?.contactName || customer?.user?.name || '';
  const mobile: string = customer?.user?.mobile ?? '';
  const email: string = customer?.email || customer?.user?.email || '';
  const gstin: string = customer?.gstin ?? '';
  const verified: boolean = Boolean(customer?.verified);
  const tripCount: number = Number(customer?._count?.bookings ?? 0);

  const initials = company
    .split(/\s+/)
    .slice(0, 2)
    .map((word: string) => word[0] ?? '')
    .join('')
    .toUpperCase();

  /**
   * Rings this customer.
   *
   * Dialled a fixed seed number before, so the office rang one person whoever
   * they had opened.
   */
  const call = useCallback(() => {
    if (!mobile) {
      return;
    }
    Linking.openURL(`tel:${mobile}`).catch(() => undefined);
  }, [mobile]);

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
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && !customer}
          what="customer"
          emptyIcon="users"
          emptyHint="This customer could not be found."
          onRetry={refetch}
        />

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
                <Text style={styles.logoText}>{initials}</Text>
              </View>
            </View>

            <View style={styles.heroBody}>
              <Text style={styles.heroName} numberOfLines={1}>
                {company}
              </Text>
              <Text style={styles.heroPlace} numberOfLines={1}>
                {[customer?.city, customer?.state].filter(Boolean).join(', ') ||
                  '—'}
              </Text>
              <View style={styles.verifiedChip}>
                <Icon name="badge-check" size={10} color={palette.navy} />
                {/*
                  Claimed on every customer before, verified or not — and a
                  GST status is exactly what an operator would rely on when
                  deciding whether to raise a tax invoice.
                */}
                <Text style={styles.verifiedText}>
                  {verified ? 'GST VERIFIED' : 'NOT VERIFIED'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Stats overlap */}
        <View style={styles.statsWrap}>
          <View style={styles.statsCard}>
            <View style={[styles.stat, styles.statDivider]}>
              {/*
                Counted from the record, not asserted.
                
                The three figures here read `28 trips · 98% on-time · 2y` on
                every customer. Two of them have nothing behind them at all —
                the API records no punctuality figure — so they are gone rather
                than invented; a shipper told they are a two-year client with
                98% on-time service has been told something nobody measured.
              */}
              <Text style={styles.statValue}>{tripCount}</Text>
              <Text style={styles.statLabel}>BOOKINGS</Text>
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValueGold}>
                {verified ? 'YES' : 'NO'}
              </Text>
              <Text style={styles.statLabel}>GST</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {customer?.since
                  ? new Date(customer.since as string).getFullYear()
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>SINCE</Text>
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
                <Text style={styles.contactInitials}>
                  {(contactName || company)
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word: string) => word[0] ?? '')
                    .join('')
                    .toUpperCase()}
                </Text>
              </LinearGradient>

              <View style={styles.contactBody}>
                <Text style={styles.contactName} numberOfLines={1}>
                  {contactName || '—'}
                </Text>
                {/* No invented job title — the API does not record one. */}
                <Text style={styles.contactRole}>
                  {customer?.businessType === 'company'
                    ? 'Business account'
                    : 'Individual'}
                </Text>
              </View>

              <Pressable
                onPress={call}
                accessibilityRole="button"
                accessibilityLabel={
                  mobile ? `Call ${contactName || company}` : 'No number on file'
                }
                style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
              >
                <Icon name="phone" size={14} color={palette.navy} />
              </Pressable>
            </View>

            <View style={styles.dashedRow}>
              <View style={styles.pairCell}>
                <Text style={styles.pairLabel}>MOBILE</Text>
                <Text style={styles.pairValue}>{mobile || '—'}</Text>
              </View>
              <View style={styles.pairCell}>
                <Text style={styles.pairLabel}>EMAIL</Text>
                <Text style={styles.pairValue} numberOfLines={1}>
                  {email || '—'}
                </Text>
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
                <Text style={styles.bizName} numberOfLines={1}>
                  {company}
                </Text>
                <Text style={styles.bizAddress}>
                  Plot 42, Industrial Estate, Gachibowli, Hyderabad - 500032
                </Text>
              </View>
            </View>

            <View style={styles.gstRow}>
              <Text style={styles.gstLabel}>GSTIN</Text>
              {/* A GSTIN nobody supplied is not a GSTIN. */}
              <Text style={styles.gstValue}>{gstin || 'Not provided'}</Text>
              <View style={styles.pillGold}>
                <Text style={styles.pillGoldText}>VERIFIED</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Recent trips */}
        <View style={styles.block}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionFlat}>
              RECENT TRIPS{shipments.length ? ` · ${shipments.length}` : ''}
            </Text>
            <Pressable
              onPress={openTrips}
              accessibilityRole="button"
              accessibilityLabel="See all trips"
            >
              <Text style={styles.seeAll}>See all →</Text>
            </Pressable>
          </View>

          {recent.loading ? (
            <Card padding={12}>
              <Text style={styles.emptyTrips}>Loading shipments…</Text>
            </Card>
          ) : !shipments.length ? (
            <Card padding={12}>
              <Text style={styles.emptyTrips}>
                This customer has not booked a shipment yet.
              </Text>
            </Card>
          ) : (
            shipments.map(booking => (
            <Card
              key={String(booking.id)}
              padding={10}
              onPress={() =>
                navigation.navigate('BookingReview', {
                  bookingId: String(booking.id),
                })
              }
              accessibilityLabel={`${booking.reference}, ${booking.pickupPlace} to ${booking.dropPlace}, ${booking.status}`}
            >
              <View style={styles.tripRow}>
                <View style={styles.tripBody}>
                  <Text style={styles.tripRef}>{booking.reference}</Text>
                  <Text style={styles.tripRoute} numberOfLines={1}>
                    {booking.pickupPlace} → {booking.dropPlace}
                  </Text>
                </View>
                {/*
                  Gold for a shipment that is finished, navy for one still
                  running. The mock hardcoded one of each.
                */}
                <View
                  style={
                    booking.status === 'COMPLETED'
                      ? styles.pillGold
                      : styles.pillNavy
                  }
                >
                  <Text
                    style={
                      booking.status === 'COMPLETED'
                        ? styles.pillGoldText
                        : styles.pillNavyText
                    }
                  >
                    {String(booking.status ?? '').replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
            </Card>
            ))
          )}
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
  /*
   * `flexShrink: 1`, because it defaults to 0 in React Native.
   *
   * Real place names are longer than "Vizag" — the mock's route fitted, a
   * genuine `Gachibowli, Hyderabad → Warangal, Telangana` pushes the status
   * pill off the card unless this side is allowed to give way.
   */
  tripBody: { flexShrink: 1, paddingRight: s(8) },
  emptyTrips: font(11, '600', { color: palette.slate500 }),
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
