import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
  RouteView,
  Screen,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 7 — Vehicle Details.
 *
 *   navy hero (52px truck tile, REG NUMBER, IN TRIP / INSURED / FIT OK chips) ·
 *   ASSIGNED DRIVER card with gold presence dot and call button ·
 *   CURRENT TRIP card (route rail + 21% progress) · SPECIFICATIONS 2×3 grid ·
 *   DOCUMENTS list with VALID / RENEW pills · gold Edit Details footer
 */
const SPECS: Array<{ label: string; value: string }> = [
  { label: 'TYPE', value: '14 Ft Truck' },
  { label: 'CAPACITY', value: '7 Ton' },
  { label: 'MAKE', value: 'Tata Motors' },
  { label: 'MODEL', value: 'LPT 1109' },
  { label: 'YEAR', value: '2022' },
  { label: 'FUEL', value: 'Diesel' },
];

type DocRow = {
  id: string;
  name: string;
  meta: string;
  metaTone: 'muted' | 'danger';
  icon: IconName;
  bg: string;
  color: string;
  pill: 'gold' | 'red';
  pillLabel: string;
};

const DOCS: DocRow[] = [
  {
    id: 'rc',
    name: 'RC Book',
    meta: 'Valid till Mar 2030',
    metaTone: 'muted',
    icon: 'file-text',
    bg: palette.navyTint,
    color: palette.navy,
    pill: 'gold',
    pillLabel: 'VALID',
  },
  {
    id: 'insurance',
    name: 'Insurance',
    meta: 'Valid till 20 Jun 2026',
    metaTone: 'muted',
    icon: 'shield-check',
    bg: palette.goldTint,
    color: palette.gold,
    pill: 'gold',
    pillLabel: 'VALID',
  },
  {
    id: 'fitness',
    name: 'Fitness Certificate',
    meta: 'Valid till 15 Dec 2026',
    metaTone: 'muted',
    icon: 'badge-check',
    bg: palette.redTint,
    color: palette.red,
    pill: 'gold',
    pillLabel: 'VALID',
  },
  {
    id: 'puc',
    name: 'Pollution (PUC)',
    meta: 'Expires in 12 days!',
    metaTone: 'danger',
    icon: 'leaf',
    bg: palette.navyTint,
    color: palette.navy,
    pill: 'red',
    pillLabel: 'RENEW',
  },
];

export const VehicleDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const callDriver = useCallback(() => {
    Linking.openURL('tel:+919876543210').catch(() => undefined);
  }, []);

  const openTrip = useCallback(
    () => navigation.navigate('TripDetails', { tripId: 'TR-2026-8836' }),
    [navigation],
  );

  /** Editing reuses the Add Vehicle form — same fields, prefilled upstream. */
  const editVehicle = useCallback(
    () => navigation.navigate('AddVehicle'),
    [navigation],
  );

  /** The eye opens the document screen for this truck's paperwork. */
  const openDocument = useCallback(
    () => navigation.navigate('UploadDocument', { ownerLabel: 'AP 31 XX 1234' }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Vehicle Details"
        subtitle="AP 31 XX 1234"
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
            size={130}
            color={palette.gold}
            opacity={0.32}
            top={-30}
            right={-30}
          />

          <View style={styles.heroBody}>
            <View style={styles.heroRow}>
              <View style={styles.heroTile}>
                <Icon name="truck" size={22} color={palette.gold} />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroKicker}>REG NUMBER</Text>
                <Text style={styles.heroReg}>AP 31 XX 1234</Text>
                <Text style={styles.heroModel}>Tata LPT 1109 · 14 Ft Truck</Text>
              </View>
            </View>

            <View style={styles.heroChips}>
              <View style={styles.heroChipGold}>
                <BlinkDot color={palette.gold} size={5} />
                <Text style={styles.heroChipGoldText}>IN TRIP</Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>INSURED</Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>FIT OK</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Assigned driver */}
        <Text style={styles.section}>ASSIGNED DRIVER</Text>
        <Card padding={11} style={styles.driverCard}>
          <View>
            <LinearGradient
              colors={gradients.navyHero as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.driverAvatar}
            >
              <Text style={styles.driverInitials}>RK</Text>
            </LinearGradient>
            <View style={styles.presence} />
          </View>

          <View style={styles.driverBody}>
            <Text style={styles.driverName}>Ramesh Kumar</Text>
            <View style={styles.driverMeta}>
              <Icon name="check-circle-2" size={12} color={palette.gold} />
              <Text style={styles.driverTrips}>240 trips</Text>
              <Text style={styles.driverStats}>· 98% on-time · 4y</Text>
            </View>
          </View>

          <Pressable
            onPress={callDriver}
            accessibilityRole="button"
            accessibilityLabel="Call Ramesh Kumar"
            style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
          >
            <Icon name="phone" size={14} color={palette.navy} />
          </Pressable>
        </Card>

        {/* Current trip */}
        <Text style={[styles.section, styles.sectionGap]}>CURRENT TRIP</Text>
        <Card padding={11} onPress={openTrip} accessibilityLabel="Open current trip">
          <View style={styles.tripHead}>
            <Text style={styles.tripRef}>#TR-2026-8836</Text>
            <View style={styles.pillNavy}>
              <BlinkDot color={palette.gold} size={4} />
              <Text style={styles.pillNavyText}>IN TRANSIT</Text>
            </View>
          </View>

          <RouteView
            pickup="Visakhapatnam Port"
            drop="Sanathnagar, Hyderabad"
            pickupLabel="Pickup"
            dropLabel="Drop"
            style={styles.route}
          />

          <View style={styles.progressHead}>
            <Text style={styles.progressText}>128 / 620 KM</Text>
            <Text style={styles.progressPct}>21%</Text>
          </View>
          <View style={styles.track}>
            <LinearGradient
              colors={[palette.gold, palette.red]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fill}
            />
          </View>
        </Card>

        {/* Specs */}
        <Text style={[styles.section, styles.sectionGap]}>SPECIFICATIONS</Text>
        <Card padding={12}>
          <View style={styles.specGrid}>
            {SPECS.map(spec => (
              <View key={spec.label} style={styles.specCell}>
                <Text style={styles.specLabel}>{spec.label}</Text>
                <Text style={styles.specValue}>{spec.value}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Documents */}
        <Text style={[styles.section, styles.sectionGap]}>DOCUMENTS</Text>
        <Card padding={0} clip marginBottom={0}>
          {DOCS.map((doc, index) => (
            <View
              key={doc.id}
              style={[styles.docRow, index < DOCS.length - 1 && styles.docDivider]}
            >
              <IconWell
                icon={doc.icon}
                size={26}
                iconSize={14}
                backgroundColor={doc.bg}
                color={doc.color}
                borderRadius={radius.md}
              />
              <View style={styles.docBody}>
                <Text style={styles.docName}>{doc.name}</Text>
                <Text
                  style={
                    doc.metaTone === 'danger' ? styles.docMetaRed : styles.docMeta
                  }
                >
                  {doc.meta}
                </Text>
              </View>

              <View
                style={doc.pill === 'gold' ? styles.pillGold : styles.pillRed}
              >
                <Text
                  style={
                    doc.pill === 'gold'
                      ? styles.pillGoldText
                      : styles.pillRedText
                  }
                >
                  {doc.pillLabel}
                </Text>
              </View>

              <Pressable
                onPress={openDocument}
                accessibilityRole="button"
                accessibilityLabel={`View ${doc.name}`}
                style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
              >
                <Icon name="eye" size={14} color={palette.navy} />
              </Pressable>
            </View>
          ))}
        </Card>
      </Content>

      <Footer>
        <Button
          label="Edit Details"
          variant="gold"
          icon="edit-3"
          padding={12}
          fontSize={12}
          onPress={editVehicle}
        />
      </Footer>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xxl,
    padding: s(14),
    marginBottom: s(12),
    overflow: 'hidden',
  },
  heroBody: { position: 'relative' },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginBottom: s(12),
  },
  heroTile: {
    width: s(52),
    height: s(52),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroKicker: font(8, '800', { color: palette.gold, letterSpacing: 1.5 }),
  heroReg: font(17, '800', { color: palette.white, letterSpacing: 1 }),
  heroModel: {
    ...font(9, '700', { color: palette.white }),
    opacity: 0.85,
    marginTop: s(1),
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: s(5) },
  heroChipGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: radius.lg,
  },
  heroChipGoldText: font(8, '800', { color: palette.gold, letterSpacing: 0.5 }),
  heroChip: {
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    backgroundColor: alpha.white10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.white15,
    borderRadius: radius.lg,
  },
  heroChipText: font(8, '800', { color: palette.white }),

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  driverCard: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  driverAvatar: {
    width: s(38),
    height: s(38),
    borderRadius: radius.full,
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
  driverBody: { flex: 1 },
  driverName: font(11, '800', { color: palette.navy }),
  driverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: s(1),
  },
  driverTrips: font(9, '800', { color: palette.navy }),
  driverStats: font(9, '400', { color: palette.slate500 }),
  callBtn: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tripHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(6),
  },
  tripRef: font(10, '800', { color: palette.red }),
  pillNavy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.navyTint,
    borderRadius: radius.sm,
  },
  pillNavyText: font(8, '800', { color: palette.navy }),
  route: { marginBottom: s(6) },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(3),
  },
  progressText: font(8, '700', { color: palette.slate500 }),
  progressPct: font(8, '700', { color: palette.gold }),
  track: {
    height: s(4),
    backgroundColor: palette.border,
    borderRadius: radius.xxs,
    overflow: 'hidden',
  },
  fill: { height: '100%', width: '21%', borderRadius: radius.xxs },

  specGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: s(12), columnGap: s(10) },
  specCell: { width: '47%' },
  specLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
  specValue: {
    ...font(11, '800', { color: palette.navy }),
    marginTop: s(2),
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingVertical: s(11),
    paddingHorizontal: s(12),
  },
  docDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  docBody: { flex: 1 },
  docName: font(11, '800', { color: palette.navy }),
  docMeta: font(9, '400', { color: palette.slate500 }),
  docMetaRed: font(9, '800', { color: palette.red }),
  pillGold: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldSoft,
    borderRadius: radius.sm,
  },
  pillGoldText: font(8, '800', { color: palette.goldText }),
  pillRed: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.redSoft,
    borderRadius: radius.sm,
  },
  pillRedText: font(8, '800', { color: palette.redDark }),
  eye: {
    width: s(28),
    height: s(28),
    backgroundColor: palette.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: { opacity: 0.75 },
});
