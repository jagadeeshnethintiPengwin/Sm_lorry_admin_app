import React, { useCallback } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import {
  AppHeader,
  Card,
  Content,
  Icon,
  ListState,
  PulseGlow,
  RadialGlow,
  RouteView,
  Screen,
  TwinkleDot,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { documentService, tripService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Screen 23 — Proof of Delivery.
 *
 *   navy "Delivered Successfully" hero with confetti twinkles and a pulsing
 *   gold check · DISTANCE / DURATION / STATUS mini stats · ROUTE ·
 *   DELIVERY PHOTOS · 3 tiles · RECEIVED BY with a gold check badge ·
 *   TRIP INFO 2×2
 */
/** "18h 42m", from two timestamps — or nothing, if the trip never started. */
const spanOf = (from?: string | null, to?: string | null): string => {
  if (!from || !to) {
    return '—';
  }
  const mins = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
};

export const PodViewerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'PodViewer'>>();
  const { tripId } = route.params;

  /*
   * The delivery, and the photographs taken at it.
   *
   * The whole screen was a set of literals: trip #TR-2026-8812, 620 km in
   * 18h 42m, Krishna Industries, received by Anita Sharma, and two tiles
   * that were gradients with an icon on them rather than photographs. The
   * driver app has been uploading real POD photos as trip documents for a
   * while — nothing had ever asked for them.
   *
   * This is the record a payment dispute is settled on, so every figure on it
   * now comes from the trip it belongs to.
   */
  const trip = useApi(() => tripService.get(tripId), [tripId]);
  const photos = useApi(() => documentService.podPhotos(tripId), [tripId]);

  const record = (trip.data ?? null) as Record<string, any> | null;
  const booking = record?.booking;
  const shots = photos.data ?? [];

  const reference: string = record?.reference ?? '—';
  const deliveredAt: string | null = record?.deliveredAt ?? null;
  const delivered = record?.status === 'DELIVERED';

  /*
   * On time against the date the customer was promised.
   *
   * `expectedAt` is nullable — an office booking taken by phone often has no
   * promised slot — and calling a delivery "On time" with nothing to compare
   * it against is the kind of claim that gets quoted back in a dispute.
   */
  const onTime =
    booking?.expectedAt && deliveredAt
      ? new Date(deliveredAt).getTime() <= new Date(booking.expectedAt).getTime()
      : null;

  const metrics = [
    {
      label: 'DISTANCE',
      value: record?.distanceKm ? `${Math.round(Number(record.distanceKm))} km` : '—',
      gold: false,
    },
    {
      label: 'DURATION',
      value: spanOf(record?.startedAt, deliveredAt),
      gold: false,
    },
    {
      label: 'STATUS',
      value: onTime === null ? (delivered ? 'Delivered' : '—') : onTime ? 'On time' : 'Late',
      gold: onTime !== false,
    },
  ];

  const tripInfo = [
    { label: 'CUSTOMER', value: booking?.customer?.company ?? booking?.customer?.contactName ?? '—' },
    { label: 'DRIVER', value: record?.driver?.user?.name ?? '—' },
    { label: 'VEHICLE', value: record?.vehicle?.registration ?? '—' },
    {
      label: 'MATERIAL',
      value: booking
        ? [booking.material, booking.weightTons ? `${booking.weightTons} T` : null]
            .filter(Boolean)
            .join(' · ')
        : '—',
    },
  ];

  const receiverName: string = record?.receiverName ?? '';
  const receiverPhone: string = record?.receiverPhone ?? '';
  const receiverInitials =
    receiverName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? '')
      .join('') || '—';

  const openPhoto = useCallback(
    (url: string) => () => {
      Linking.openURL(url).catch(() => undefined);
    },
    [],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Proof of Delivery"
        subtitle={reference}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content safeBottom>
        <ListState
          loading={trip.loading}
          error={trip.error}
          empty={!trip.loading && !trip.error && !record}
          what="proof of delivery"
          emptyIcon="check"
          emptyHint="This trip could not be found."
          onRetry={() => {
            trip.refetch();
            photos.refetch();
          }}
        />

        {record ? (
        <>
        {/* Delivered hero */}
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={130}
            color={palette.gold}
            opacity={0.32}
            top={-30}
            right={-30}
          />

          {/* Confetti */}
          <TwinkleDot size={4} color={palette.gold} style={styles.confetti1} />
          <TwinkleDot
            size={3}
            color={palette.red}
            delay={0.6}
            style={styles.confetti2}
          />
          <TwinkleDot
            size={3}
            color={palette.white}
            delay={1.2}
            style={styles.confetti3}
          />

          <View style={styles.heroBody}>
            <View style={styles.checkWrap}>
              <PulseGlow color={palette.gold} opacity={0.25} duration={2000} />
              <LinearGradient
                colors={gradients.gold as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.checkDisc}
              >
                <Icon name="check" size={24} color={palette.white} strokeWidth={3} />
              </LinearGradient>
            </View>

            {/*
              The trip's own state.
              
              This declared "Delivered Successfully" on 12 May 2026 at 3:42 PM
              regardless — including for a trip still on the road, which is a
              screen that certifies a delivery that has not happened.
            */}
            <Text style={styles.heroKicker}>TRIP {reference}</Text>
            <Text style={styles.heroTitle}>
              {delivered ? 'Delivered Successfully' : 'Not delivered yet'}
            </Text>
            <Text style={styles.heroMeta}>
              {deliveredAt
                ? new Date(deliveredAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : (record?.status ?? '—')}
            </Text>
          </View>
        </LinearGradient>

        {/* Metrics */}
        <View style={styles.metrics}>
          {metrics.map(metric => (
            <View key={metric.label} style={styles.metric}>
              <Text style={metric.gold ? styles.metricValueGold : styles.metricValue}>
                {metric.value}
              </Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>

        {/* Route */}
        <Text style={styles.section}>ROUTE</Text>
        <Card padding={11}>
          <RouteView
            pickup={booking?.pickupAddress ?? booking?.pickupPlace ?? '—'}
            drop={booking?.dropAddress ?? booking?.dropPlace ?? '—'}
            pickupLabel="Pickup"
            dropLabel="Drop"
            pickupGap={6}
          />
        </Card>

        {/*
          The photographs the driver took, not two coloured tiles.
          
          This section said "DELIVERY PHOTOS · 3" above two gradient rectangles
          with a package icon and a warehouse icon drawn on them — captioned
          PACKAGE and UNLOADED, as though the load had been photographed. The
          driver app uploads the real ones against the trip; they are fetched
          and shown, and the count is however many there are.
        */}
        <Text style={[styles.section, styles.sectionGap]}>
          DELIVERY PHOTOS{shots.length ? ` · ${shots.length}` : ''}
        </Text>

        {photos.loading ? (
          <Card padding={14}>
            <Text style={styles.noPhotos}>Loading photos…</Text>
          </Card>
        ) : !shots.length ? (
          <Card padding={14}>
            <Text style={styles.noPhotos}>
              No delivery photos were uploaded for this trip.
            </Text>
          </Card>
        ) : (
          <View style={styles.photoGrid}>
            {shots.map(shot => (
              <Pressable
                key={shot.id}
                onPress={openPhoto(shot.url)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${shot.name}`}
                style={({ pressed }) => [
                  styles.photoWrap,
                  pressed && styles.pressed,
                ]}
              >
                {/*
                  A signed link, which is what makes this render at all.
                  
                  `<Image>` sends no Authorization header, and `/uploads/:name`
                  is guarded — the stored `fileUrl` would come back 401 and
                  draw a grey box. `podPhotos` exchanges each one for a link
                  that authorises that single file.
                */}
                <Image
                  source={{ uri: shot.url }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                <View style={styles.expand}>
                  <Icon name="expand" size={11} color={palette.navy} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Received by */}
        <Text style={styles.section}>RECEIVED BY</Text>
        <Card padding={11}>
          <View style={styles.receiverRow}>
            <View>
              <LinearGradient
                colors={gradients.navyHero as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.receiverAvatar}
              >
                <Text style={styles.receiverInitials}>{receiverInitials}</Text>
              </LinearGradient>
              <View style={styles.receiverBadge}>
                <Icon name="check" size={9} color={palette.navy} strokeWidth={3} />
              </View>
            </View>

            <View style={styles.receiverBody}>
              <Text style={styles.receiverName}>
                {receiverName || 'Not recorded'}
              </Text>
              <Text style={styles.receiverRole}>
                {receiverPhone || (record?.remarks ?? 'No number taken')}
              </Text>
              {/*
                "Verified receiver" was a badge nothing verified. What the
                driver actually did is take a name at the door, so that is what
                it says now — and only when a name was in fact taken.
              */}
              {receiverName ? (
                <View style={styles.verifiedRow}>
                  <Icon name="badge-check" size={11} color={palette.gold} />
                  <Text style={styles.verifiedText}>
                    Signed for at delivery
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Trip info */}
        <Text style={[styles.section, styles.sectionGap]}>TRIP INFO</Text>
        <Card padding={11} marginBottom={0}>
          <View style={styles.infoGrid}>
            {tripInfo.map(item => (
              <View key={item.label} style={styles.infoCell}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </Card>
        </>
        ) : null}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    paddingVertical: s(16),
    paddingHorizontal: s(14),
    marginBottom: s(12),
    overflow: 'hidden',
  },
  confetti1: { position: 'absolute', top: s(14), left: s(30) },
  confetti2: { position: 'absolute', top: s(38), right: s(36) },
  confetti3: { position: 'absolute', bottom: s(16), left: s(46) },
  heroBody: { position: 'relative', alignItems: 'center' },
  checkWrap: {
    width: s(60),
    height: s(60),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(10),
  },
  checkDisc: {
    position: 'absolute',
    top: s(6),
    left: s(6),
    right: s(6),
    bottom: s(6),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.goldCheck,
  },
  heroKicker: font(8, '800', { color: palette.gold, letterSpacing: 1.5 }),
  heroTitle: {
    ...font(16, '800', { color: palette.white }),
    marginTop: s(2),
  },
  heroMeta: {
    ...font(9, '400', { color: palette.white }),
    opacity: 0.85,
    marginTop: s(2),
  },

  metrics: { flexDirection: 'row', gap: s(6), marginBottom: s(12) },
  metric: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    paddingVertical: s(10),
    paddingHorizontal: s(6),
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  metricValue: font(14, '800', { color: palette.navy }),
  metricValueGold: font(12, '800', { color: palette.gold }),
  metricLabel: {
    ...font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
    marginTop: s(3),
  },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
    marginBottom: s(10),
  },
  noPhotos: font(11, '600', { color: palette.slate500 }),
  photoWrap: { flex: 1 },
  photo: {
    height: s(88),
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  expand: {
    position: 'absolute',
    top: s(5),
    right: s(5),
    width: s(20),
    height: s(20),
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  receiverRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  receiverAvatar: {
    width: s(38),
    height: s(38),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiverInitials: font(12, '800', { color: palette.white }),
  receiverBadge: {
    position: 'absolute',
    bottom: s(-2),
    right: s(-2),
    width: s(16),
    height: s(16),
    backgroundColor: palette.gold,
    borderWidth: s(2),
    borderColor: palette.white,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiverBody: { flex: 1 },
  receiverName: font(11, '800', { color: palette.navy }),
  receiverRole: font(9, '400', { color: palette.slate500 }),
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginTop: s(2),
  },
  verifiedText: font(9, '800', { color: palette.gold }),

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(10) },
  infoCell: { width: '46%' },
  infoLabel: font(8, '800', { color: palette.slate500 }),
  infoValue: {
    ...font(10, '800', { color: palette.navy }),
    marginTop: s(2),
  },

  pressed: { opacity: 0.85 },
});
