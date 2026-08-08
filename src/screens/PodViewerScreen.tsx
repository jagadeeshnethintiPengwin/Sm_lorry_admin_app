import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import {
  AppHeader,
  Card,
  Content,
  Icon,
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

/**
 * Screen 23 — Proof of Delivery.
 *
 *   navy "Delivered Successfully" hero with confetti twinkles and a pulsing
 *   gold check · DISTANCE / DURATION / STATUS mini stats · ROUTE ·
 *   DELIVERY PHOTOS · 3 tiles · RECEIVED BY with a gold check badge ·
 *   TRIP INFO 2×2
 */
const METRICS = [
  { value: '620 km', label: 'DISTANCE', gold: false },
  { value: '18h 42m', label: 'DURATION', gold: false },
  { value: 'On time', label: 'STATUS', gold: true },
];

const TRIP_INFO = [
  { label: 'CUSTOMER', value: 'Krishna Industries' },
  { label: 'DRIVER', value: 'Ramesh Kumar' },
  { label: 'VEHICLE', value: 'TS 09 UB 8801' },
  { label: 'MATERIAL', value: 'Steel · 12.5 T' },
];

export const PodViewerScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Proof of Delivery"
        subtitle="#TR-2026-8812"
        showBack
        onBackPress={navigation.goBack}
      />

      <Content safeBottom>
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

            <Text style={styles.heroKicker}>TRIP #TR-2026-8812</Text>
            <Text style={styles.heroTitle}>Delivered Successfully</Text>
            <Text style={styles.heroMeta}>12 May 2026 · 3:42 PM</Text>
          </View>
        </LinearGradient>

        {/* Metrics */}
        <View style={styles.metrics}>
          {METRICS.map(metric => (
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
            pickup="Visakhapatnam Port, Dockyard Rd"
            drop="Sanathnagar Industrial Area"
            pickupLabel="Pickup"
            dropLabel="Drop"
            pickupGap={6}
          />
        </Card>

        {/* Delivery photos */}
        <Text style={[styles.section, styles.sectionGap]}>
          DELIVERY PHOTOS · 3
        </Text>
        <View style={styles.photoGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Package photo"
            style={({ pressed }) => [styles.photoWrap, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={gradients.navyHero as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.photo}
            >
              <Icon name="package-check" size={24} color={palette.white} />
              <View style={styles.photoTagDark}>
                <Text style={styles.photoTagDarkText}>PACKAGE</Text>
              </View>
              <View style={styles.expand}>
                <Icon name="expand" size={11} color={palette.navy} />
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unloaded photo"
            style={({ pressed }) => [styles.photoWrap, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[palette.goldDark, palette.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.photo}
            >
              <Icon name="warehouse" size={24} color={palette.navy} />
              <View style={styles.photoTagLight}>
                <Text style={styles.photoTagLightText}>UNLOADED</Text>
              </View>
              <View style={styles.expand}>
                <Icon name="expand" size={11} color={palette.navy} />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

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
                <Text style={styles.receiverInitials}>AS</Text>
              </LinearGradient>
              <View style={styles.receiverBadge}>
                <Icon name="check" size={9} color={palette.navy} strokeWidth={3} />
              </View>
            </View>

            <View style={styles.receiverBody}>
              <Text style={styles.receiverName}>Anita Sharma</Text>
              <Text style={styles.receiverRole}>
                Store Manager · Sanathnagar
              </Text>
              <View style={styles.verifiedRow}>
                <Icon name="badge-check" size={11} color={palette.gold} />
                <Text style={styles.verifiedText}>Verified receiver</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Trip info */}
        <Text style={[styles.section, styles.sectionGap]}>TRIP INFO</Text>
        <Card padding={11} marginBottom={0}>
          <View style={styles.infoGrid}>
            {TRIP_INFO.map(item => (
              <View key={item.label} style={styles.infoCell}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </Card>
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

  photoGrid: { flexDirection: 'row', gap: s(8), marginBottom: s(10) },
  photoWrap: { flex: 1 },
  photo: {
    height: s(88),
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoTagDark: {
    position: 'absolute',
    bottom: s(5),
    left: s(5),
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: s(1),
    paddingHorizontal: s(5),
    borderRadius: s(4),
  },
  photoTagDarkText: font(7, '800', { color: palette.white }),
  photoTagLight: {
    position: 'absolute',
    bottom: s(5),
    left: s(5),
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: s(1),
    paddingHorizontal: s(5),
    borderRadius: s(4),
  },
  photoTagLightText: font(7, '800', { color: palette.navy }),
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
