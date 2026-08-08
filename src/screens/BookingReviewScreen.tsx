import React, { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import {
  AppHeader,
  BlinkDot,
  Button,
  Card,
  Content,
  Footer,
  Icon,
  IconWell,
  RadialGlow,
  Screen,
  Select,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * Screen 17 — Review Booking.
 *
 *   navy hero (#ST-2026-8842, blinking PENDING chip, route, meta strip) ·
 *   CUSTOMER card with call · LOCATIONS (loading / unloading) · PACKAGE 2×2 ·
 *   attached documents pair · ASSIGN VEHICLE and ASSIGN DRIVER selects, each
 *   with the confirmed best-match card · Reject / Approve & Dispatch footer
 */
const VEHICLES = [
  {
    label: 'AP 39 TR 4522 (17 Ft) — Best match, Available',
    value: 'AP39TR4522',
  },
  { label: 'AP 31 XX 1234 (14 Ft) — In Trip', value: 'AP31XX1234' },
  { label: 'AP 05 CH 9912 (Mini Truck)', value: 'AP05CH9912' },
];

const DRIVERS = [
  { label: 'Manoj K — Available, near pickup (Best)', value: 'manoj' },
  { label: 'Prakash R', value: 'prakash' },
  { label: 'Ramesh K (In Trip)', value: 'ramesh' },
];

const PACKAGE = [
  { label: 'MATERIAL', value: 'Steel Pipes' },
  { label: 'WEIGHT', value: '12.5 Ton' },
  { label: 'UNITS', value: '25 Bundles' },
  { label: 'PACKAGE', value: 'Bundles' },
];

export const BookingReviewScreen: React.FC = () => {
  const navigation = useNavigation();

  const [vehicle, setVehicle] = useState('AP39TR4522');
  const [driver, setDriver] = useState('manoj');

  const call = useCallback(() => {
    Linking.openURL('tel:+919876543210').catch(() => undefined);
  }, []);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Review Booking"
        subtitle="#ST-2026-8842"
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
        {/* Hero */}
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={120}
            color={palette.gold}
            opacity={0.3}
            top={-25}
            right={-25}
          />

          <View style={styles.heroBody}>
            <View style={styles.heroHead}>
              <Text style={styles.heroRef}>#ST-2026-8842</Text>
              <View style={styles.heroChip}>
                <BlinkDot color={palette.gold} size={5} />
                <Text style={styles.heroChipText}>PENDING</Text>
              </View>
            </View>

            <View style={styles.heroRoute}>
              <Text style={styles.heroCity}>Kompally</Text>
              <Icon name="arrow-right" size={14} color={palette.gold} />
              <Text style={styles.heroCity}>Vijayawada</Text>
            </View>

            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaText}>278 km</Text>
              <Text style={styles.heroMetaDivider}>|</Text>
              <Text style={styles.heroMetaText}>14 Ft Truck</Text>
              <Text style={styles.heroMetaDivider}>|</Text>
              <Text style={styles.heroMetaText}>Today 4 PM</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Customer */}
        <Text style={styles.section}>CUSTOMER</Text>
        <Card padding={11} style={styles.customerCard}>
          <View style={styles.customerTile}>
            <Text style={styles.customerInitials}>SS</Text>
          </View>
          <View style={styles.customerBody}>
            <Text style={styles.customerName}>Sri Sai Traders</Text>
            <Text style={styles.customerMeta}>
              Rajesh Kumar · 28 trips · 98% on-time
            </Text>
          </View>
          <Pressable
            onPress={call}
            accessibilityRole="button"
            accessibilityLabel="Call Sri Sai Traders"
            style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
          >
            <Icon name="phone" size={14} color={palette.navy} />
          </Pressable>
        </Card>

        {/* Locations */}
        <Text style={[styles.section, styles.sectionGap]}>LOCATIONS</Text>
        <Card padding={11}>
          <View style={styles.locRow}>
            <IconWell
              icon="warehouse"
              size={26}
              iconSize={14}
              backgroundColor={palette.navyTint}
              color={palette.navy}
              borderRadius={radius.md}
            />
            <View style={styles.locBody}>
              <Text style={styles.locLabel}>LOADING AREA</Text>
              <Text style={styles.locName}>Kompally Industrial Estate</Text>
              <Text style={styles.locAddress}>Plot 42, Hyderabad - 500014</Text>
            </View>
          </View>

          <View style={[styles.locRow, styles.locRowGap]}>
            <IconWell
              icon="flag"
              size={26}
              iconSize={14}
              backgroundColor={palette.redTint}
              color={palette.red}
              borderRadius={radius.md}
            />
            <View style={styles.locBody}>
              <Text style={styles.locLabel}>UNLOADING AREA</Text>
              <Text style={styles.locName}>Sri Krishna Warehouse</Text>
              <Text style={styles.locAddress}>MG Road, Vijayawada - 520001</Text>
            </View>
          </View>
        </Card>

        {/* Package */}
        <Text style={[styles.section, styles.sectionGap]}>PACKAGE</Text>
        <Card padding={12}>
          <View style={styles.pkgGrid}>
            {PACKAGE.map(item => (
              <View key={item.label} style={styles.pkgCell}>
                <Text style={styles.pkgLabel}>{item.label}</Text>
                <Text style={styles.pkgValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Documents */}
        <View style={styles.docGrid}>
          <View style={styles.docCard}>
            <IconWell
              icon="scroll-text"
              size={26}
              iconSize={14}
              backgroundColor={palette.navyTint}
              color={palette.navy}
              borderRadius={radius.md}
            />
            <View style={styles.docBody}>
              <Text style={styles.docName}>E-way Bill</Text>
              <Text style={styles.docSize}>234 KB</Text>
            </View>
            <Icon name="eye" size={14} color={palette.slate500} />
          </View>

          <View style={styles.docCard}>
            <IconWell
              icon="receipt"
              size={26}
              iconSize={14}
              backgroundColor={palette.goldTint}
              color={palette.gold}
              borderRadius={radius.md}
            />
            <View style={styles.docBody}>
              <Text style={styles.docName}>Invoice</Text>
              <Text style={styles.docSize}>1.1 MB</Text>
            </View>
            <Icon name="eye" size={14} color={palette.slate500} />
          </View>
        </View>

        {/* Assign vehicle */}
        <Text style={styles.section}>ASSIGN VEHICLE</Text>
        <Card padding={11}>
          <Select
            options={VEHICLES}
            value={vehicle}
            onChange={setVehicle}
            marginBottom={10}
          />

          <View style={styles.matchGold}>
            <IconWell
              icon="truck"
              size={38}
              iconSize={20}
              backgroundColor={palette.white}
              color={palette.gold}
              borderRadius={radius.lg}
            />
            <View style={styles.matchBody}>
              <Text style={styles.matchTitle}>AP 39 TR 4522</Text>
              <Text style={styles.matchMetaGold}>
                17 Ft · 9 Ton · Available now
              </Text>
            </View>
            <Icon name="check" size={16} color={palette.gold} />
          </View>
        </Card>

        {/* Assign driver */}
        <Text style={[styles.section, styles.sectionGap]}>ASSIGN DRIVER</Text>
        <Card padding={11} marginBottom={0}>
          <Select
            options={DRIVERS}
            value={driver}
            onChange={setDriver}
            marginBottom={10}
          />

          <View style={styles.matchNavy}>
            <View>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverInitials}>MK</Text>
              </View>
              <View style={styles.presence} />
            </View>

            <View style={styles.matchBody}>
              <Text style={styles.matchTitle}>Manoj K</Text>
              <View style={styles.driverMetaRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.matchMeta}>
                  Online · 42 trips · AP 05 CH 9912
                </Text>
              </View>
            </View>

            <Icon name="check" size={16} color={palette.gold} />
          </View>
        </Card>
      </Content>

      <Footer row>
        <Button
          label="Reject"
          variant="outline"
          icon="x"
          iconSize={12}
          flex={1}
          padding={10}
          fontSize={11}
          gap={4}
          color={palette.red}
          borderColor={palette.redSoft}
          onPress={navigation.goBack}
        />
        <Button
          label="Approve & Dispatch"
          variant="gold"
          icon="check-circle-2"
          flex={1.8}
          padding={10}
          fontSize={10.5}
          gap={4}
          onPress={navigation.goBack}
        />
      </Footer>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: s(14),
    marginBottom: s(12),
    overflow: 'hidden',
  },
  heroBody: { position: 'relative' },
  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  heroRef: font(14, '800', { color: palette.white }),
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: s(20),
  },
  heroChipText: font(8, '800', { color: palette.gold, letterSpacing: 1 }),
  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  heroCity: font(13, '800', { color: palette.white }),
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginTop: s(4),
  },
  heroMetaText: { ...font(10, '700', { color: palette.white }), opacity: 0.85 },
  heroMetaDivider: {
    ...font(10, '700', { color: palette.white }),
    opacity: 0.4,
  },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  customerCard: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  customerTile: {
    width: s(36),
    height: s(36),
    backgroundColor: palette.navyTint,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: font(12, '800', { color: palette.navy }),
  customerBody: { flex: 1 },
  customerName: font(11, '800', { color: palette.navy }),
  customerMeta: font(9, '400', { color: palette.slate500 }),
  callBtn: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(9) },
  locRowGap: { marginTop: s(10) },
  locBody: { flex: 1 },
  locLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
  locName: {
    ...font(11, '800', { color: palette.navy }),
    marginTop: s(1),
  },
  locAddress: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },

  pkgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(10) },
  pkgCell: { width: '46%' },
  pkgLabel: font(8, '800', { color: palette.slate500 }),
  pkgValue: {
    ...font(11, '800', { color: palette.navy }),
    marginTop: s(2),
  },

  docGrid: { flexDirection: 'row', gap: s(8), marginTop: s(12), marginBottom: s(12) },
  docCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: s(9),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  docBody: { flex: 1, minWidth: 0 },
  docName: font(9, '800', { color: palette.navy }),
  docSize: font(8, '400', { color: palette.slate500 }),

  matchGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    backgroundColor: palette.goldTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.goldSoft,
    borderRadius: radius.lg,
    padding: s(10),
  },
  matchNavy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    backgroundColor: palette.navyTint,
    borderRadius: radius.lg,
    padding: s(10),
  },
  matchBody: { flex: 1 },
  matchTitle: font(11, '800', { color: palette.navy }),
  matchMeta: font(9, '400', { color: palette.slate500 }),
  matchMetaGold: font(9, '700', { color: palette.goldText }),

  driverAvatar: {
    width: s(36),
    height: s(36),
    borderRadius: radius.full,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: font(12, '800', { color: palette.white }),
  presence: {
    position: 'absolute',
    bottom: s(-1),
    right: s(-1),
    width: s(11),
    height: s(11),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    borderWidth: s(2),
    borderColor: palette.white,
  },
  driverMetaRow: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  onlineDot: {
    width: s(5),
    height: s(5),
    borderRadius: radius.full,
    backgroundColor: palette.green,
  },

  pressed: { opacity: 0.8 },
});
