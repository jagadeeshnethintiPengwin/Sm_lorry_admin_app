import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
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
  Screen,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 19 — Trip Details.
 *
 *   navy hero (#TR-2026-8836, IN TRANSIT chip, route, 21% rail + ETA) ·
 *   DRIVER & VEHICLE card with a dashed divider and GPS freshness ·
 *   CUSTOMER card · DOCUMENTS · 5 as a 2-up grid ·
 *   Timeline / Track Live footer
 */
type DocTile = {
  id: string;
  name: string;
  size: string;
  icon: IconName;
  bg: string;
  color: string;
};

const DOCS: DocTile[] = [
  {
    id: 'eway',
    name: 'E-way Bill',
    size: '234 KB',
    icon: 'scroll-text',
    bg: palette.navyTint,
    color: palette.navy,
  },
  {
    id: 'invoice',
    name: 'Invoice',
    size: '1.1 MB',
    icon: 'receipt',
    bg: palette.goldTint,
    color: palette.gold,
  },
  {
    id: 'waybill',
    name: 'Waybill',
    size: '342 KB',
    icon: 'file-text',
    bg: palette.navyTint,
    color: palette.navy,
  },
  {
    id: 'lr',
    name: 'LR',
    size: '456 KB',
    icon: 'file-check',
    bg: palette.goldTint,
    color: palette.gold,
  },
  {
    // The mock labels this section "DOCUMENTS · 5" but draws four tiles. POD
    // is the missing fifth, and it doubles as the only route into the POD
    // Viewer screen (23), which nothing else reached.
    id: 'pod',
    name: 'Proof of Delivery',
    size: '892 KB',
    icon: 'package-check',
    bg: palette.redTint,
    color: palette.red,
  },
];

export const TripDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetails'>>();
  const { tripId } = route.params;

  const callDriver = useCallback(() => {
    Linking.openURL('tel:+919876543210').catch(() => undefined);
  }, []);

  const openTimeline = useCallback(
    () => navigation.navigate('TripTimeline', { tripId }),
    [navigation, tripId],
  );

  const trackLive = useCallback(
    () => navigation.navigate('LiveTripTrack', { tripId }),
    [navigation, tripId],
  );

  const openPod = useCallback(
    () => navigation.navigate('PodViewer', { tripId }),
    [navigation, tripId],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Trip #8836"
        subtitle="In transit"
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
              <Text style={styles.heroRef}>#TR-2026-8836</Text>
              <View style={styles.heroChip}>
                <BlinkDot color={palette.gold} size={5} />
                <Text style={styles.heroChipText}>IN TRANSIT</Text>
              </View>
            </View>

            <View style={styles.heroRoute}>
              <Text style={styles.heroCity}>Visakhapatnam</Text>
              <Icon name="arrow-right" size={14} color={palette.gold} />
              <Text style={styles.heroCity}>Hyderabad</Text>
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressHead}>
                <Text style={styles.progressText}>128 / 620 KM</Text>
                <Text style={styles.progressText}>21% · ETA 2:45 PM</Text>
              </View>
              <View style={styles.track}>
                <LinearGradient
                  colors={[palette.gold, palette.red]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.fill}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Driver + vehicle */}
        <Text style={styles.section}>DRIVER &amp; VEHICLE</Text>
        <Card padding={11}>
          <View style={styles.driverRow}>
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
              <Text style={styles.driverPhone}>+91 98765 43210</Text>
            </View>

            <Pressable
              onPress={callDriver}
              accessibilityRole="button"
              accessibilityLabel="Call Ramesh Kumar"
              style={({ pressed }) => [styles.callGold, pressed && styles.pressed]}
            >
              <Icon name="phone" size={14} color={palette.navy} />
            </Pressable>
          </View>

          <View style={styles.vehicleRow}>
            <IconWell
              icon="truck"
              size={38}
              iconSize={20}
              backgroundColor={palette.goldTint}
              color={palette.gold}
              borderRadius={radius.lg}
            />
            <View style={styles.driverBody}>
              <Text style={styles.driverName}>AP 31 XX 1234</Text>
              <Text style={styles.driverPhone}>14 Ft Truck · 62 km/h</Text>
            </View>
            <Text style={styles.gps}>GPS · 12s ago</Text>
          </View>
        </Card>

        {/* Customer */}
        <Text style={[styles.section, styles.sectionGap]}>CUSTOMER</Text>
        <Card padding={11} style={styles.customerRow}>
          <View style={styles.customerTile}>
            <Text style={styles.customerInitials}>SS</Text>
          </View>
          <View style={styles.driverBody}>
            <Text style={styles.driverName}>Sri Sai Traders</Text>
            <Text style={styles.driverPhone}>Rajesh K · +91 98765 43210</Text>
          </View>
          <Pressable
            onPress={callDriver}
            accessibilityRole="button"
            accessibilityLabel="Call Sri Sai Traders"
            style={({ pressed }) => [styles.callNavy, pressed && styles.pressed]}
          >
            <Icon name="phone" size={14} color={palette.white} />
          </Pressable>
        </Card>

        {/* Documents */}
        <Text style={[styles.section, styles.sectionGap]}>DOCUMENTS · 5</Text>
        <View style={styles.docGrid}>
          {DOCS.map(doc => (
            <Pressable
              key={doc.id}
              onPress={doc.id === 'pod' ? openPod : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${doc.name}, ${doc.size}`}
              style={({ pressed }) => [styles.docCard, pressed && styles.pressed]}
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
                <Text style={styles.docSize}>{doc.size}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Content>

      <Footer row>
        <Button
          label="Timeline"
          variant="outline"
          icon="clipboard-list"
          iconSize={14}
          flex={1}
          padding={10}
          fontSize={11}
          gap={5}
          borderColor={palette.border}
          onPress={openTimeline}
        />
        <Button
          label="Track Live"
          variant="gold"
          icon="map-pin"
          iconSize={14}
          flex={1.5}
          padding={10}
          fontSize={11}
          gap={5}
          onPress={trackLive}
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
  progressBlock: { marginTop: s(10) },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(4),
  },
  progressText: { ...font(9, '800', { color: palette.white }), opacity: 0.85 },
  track: {
    height: s(5),
    backgroundColor: alpha.white15,
    borderRadius: s(3),
    overflow: 'hidden',
  },
  fill: { height: '100%', width: '21%', borderRadius: s(3) },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginBottom: s(8),
  },
  driverAvatar: {
    width: s(36),
    height: s(36),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: font(11, '800', { color: palette.white }),
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
  driverPhone: font(9, '400', { color: palette.slate500 }),
  callGold: {
    width: s(30),
    height: s(30),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callNavy: {
    width: s(30),
    height: s(30),
    borderRadius: radius.full,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingTop: s(8),
    borderTopWidth: s(1),
    borderTopColor: palette.gray200,
    borderStyle: 'dashed',
  },
  gps: font(9, '800', { color: palette.gold }),

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  customerTile: {
    width: s(38),
    height: s(38),
    backgroundColor: palette.navyTint,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: font(11, '800', { color: palette.navy }),

  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
    marginBottom: s(12),
  },
  docCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '45%',
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

  pressed: { opacity: 0.8 },
});
