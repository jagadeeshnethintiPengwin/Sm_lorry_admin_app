import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  BlinkDot,
  Card,
  Content,
  FleetMap,
  IconWell,
  Screen,
} from '@components/index';
import type { FleetVehicle } from '@components/common/FleetMap';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 22 — Live Fleet Map.
 *
 *   TRACKING strip with a blinking LIVE chip · real Google map with a
 *   truck pucks (navy = moving, red = stopped), a Moving / Stopped legend and
 *   zoom · VEHICLES LIVE cards
 */


type FleetRow = {
  id: string;
  plate: string;
  speed: string;
  speedTone: 'gold' | 'red' | 'muted';
  driver: string;
  route: string;
  distance: string;
  distanceTone: 'gold' | 'red' | 'plain';
  rail?: string;
  tileBg: string;
  tileColor: string;
};

const FLEET: FleetRow[] = [
  {
    id: 'f1',
    plate: 'AP 31 XX 1234',
    speed: '62 km/h',
    speedTone: 'gold',
    driver: 'Ramesh K · #TR-2026-8836',
    route: 'Vizag → Hyd',
    distance: '128/620 km',
    distanceTone: 'gold',
    rail: palette.gold,
    tileBg: palette.goldTint,
    tileColor: palette.gold,
  },
  {
    id: 'f2',
    plate: 'AP 05 CH 9912',
    speed: '48 km/h',
    speedTone: 'muted',
    driver: 'Prakash R · #TR-2026-8829',
    route: 'Kompally → Kadapa',
    distance: '42/305 km',
    distanceTone: 'plain',
    tileBg: palette.navyTint,
    tileColor: palette.navy,
  },
  {
    id: 'f3',
    plate: 'AP 39 TR 4522',
    speed: 'STOPPED',
    speedTone: 'red',
    driver: 'Manoj K · #TR-2026-8842',
    route: 'At Kompally',
    distance: 'Loading · 12 min',
    distanceTone: 'red',
    rail: palette.red,
    tileBg: palette.redTint,
    tileColor: palette.red,
  },
];

/**
 * Where each truck actually is, matching the FLEET rows below:
 *   AP 31 XX 1234  Vizag -> Hyd, 128/620 km  (21% along)
 *   AP 05 CH 9912  Kompally -> Kadapa, 42/305 km (14% along)
 *   AP 39 TR 4522  loading at Kompally, so parked on the pickup point
 * The mock pins six pucks at fixed CSS offsets; on a real map they sit on
 * their true coordinates instead.
 */
const FLEET_POSITIONS: FleetVehicle[] = [
  {
    id: 'f1',
    registration: 'AP 31 XX 1234',
    position: { latitude: 17.6234, longitude: 82.2251 },
    moving: true,
  },
  {
    id: 'f2',
    registration: 'AP 05 CH 9912',
    position: { latitude: 17.1112, longitude: 78.5278 },
    moving: true,
  },
  {
    id: 'f3',
    registration: 'AP 39 TR 4522',
    position: { latitude: 17.5416, longitude: 78.4795 },
    moving: false,
  },
];

export const LiveFleetMapScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const openVehicle = useCallback(
    (id: string) => navigation.navigate('VehicleDetails', { vehicleId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Live Fleet"
        subtitle="18 vehicles tracking"
        showBack
        onBackPress={navigation.goBack}
      />

      {/* Tracking strip */}
      <View style={styles.trackingStrip}>
        <View>
          <Text style={styles.trackingLabel}>TRACKING</Text>
          <Text style={styles.trackingValue}>18 vehicles live · 11 idle</Text>
        </View>
        <View style={styles.liveChip}>
          <BlinkDot color={palette.navy} size={6} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        {/* Map */}
        <FleetMap vehicles={FLEET_POSITIONS} height={230}>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendGold]} />
              <Text style={styles.legendText}>Moving</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendRed]} />
              <Text style={styles.legendText}>Stopped</Text>
            </View>
          </View>

          {/* Zoom */}
          <View style={styles.zoom}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              style={styles.zoomBtn}
            >
              <Text style={styles.zoomText}>+</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              style={styles.zoomBtn}
            >
              <Text style={styles.zoomText}>-</Text>
            </Pressable>
          </View>
        </FleetMap>

        <Text style={styles.section}>VEHICLES LIVE</Text>

        {FLEET.map(vehicle => (
          <Card
            key={vehicle.id}
            padding={10}
            onPress={() => openVehicle(vehicle.id)}
            accessibilityLabel={`${vehicle.plate}, ${vehicle.speed}`}
            accentColor={vehicle.rail}
            accentWidth={3}
          >
            <View style={styles.fleetRow}>
              <IconWell
                icon="truck"
                size={26}
                iconSize={14}
                backgroundColor={vehicle.tileBg}
                color={vehicle.tileColor}
                borderRadius={radius.md}
              />

              <View style={styles.fleetBody}>
                <View style={styles.fleetHead}>
                  <Text style={styles.fleetPlate}>{vehicle.plate}</Text>
                  <Text
                    style={
                      vehicle.speedTone === 'gold'
                        ? styles.fleetSpeedGold
                        : vehicle.speedTone === 'red'
                        ? styles.fleetSpeedRed
                        : styles.fleetSpeedMuted
                    }
                  >
                    {vehicle.speed}
                  </Text>
                </View>

                <Text style={styles.fleetDriver}>{vehicle.driver}</Text>

                <View style={styles.fleetFoot}>
                  <Text style={styles.fleetRoute}>{vehicle.route}</Text>
                  <Text
                    style={
                      vehicle.distanceTone === 'gold'
                        ? styles.fleetDistanceGold
                        : vehicle.distanceTone === 'red'
                        ? styles.fleetDistanceRed
                        : styles.fleetDistancePlain
                    }
                  >
                    {vehicle.distance}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        ))}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  trackingStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    backgroundColor: palette.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  trackingLabel: font(8, '800', { color: palette.slate500, letterSpacing: 1 }),
  trackingValue: font(12, '800', { color: palette.navy }),
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    backgroundColor: palette.navyTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.navy,
    borderRadius: s(20),
  },
  liveText: font(9, '800', { color: palette.navy }),

  contentTop: { paddingTop: s(10) },
  map: { borderRadius: radius.card, marginBottom: s(12) },


  legend: {
    position: 'absolute',
    bottom: s(8),
    left: s(8),
    flexDirection: 'row',
    gap: s(8),
    backgroundColor: palette.white,
    paddingVertical: s(5),
    paddingHorizontal: s(8),
    borderRadius: radius.md,
    ...shadows.subtle,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  legendDot: { width: s(6), height: s(6), borderRadius: radius.full },
  legendGold: { backgroundColor: palette.gold },
  legendRed: { backgroundColor: palette.red },
  legendText: font(8, '800', { color: palette.navy }),

  zoom: {
    position: 'absolute',
    top: s(8),
    right: s(8),
    backgroundColor: palette.white,
    borderRadius: radius.sm,
    padding: s(3),
    gap: s(2),
    ...shadows.subtle,
  },
  zoomBtn: {
    width: s(22),
    height: s(22),
    backgroundColor: palette.screenBg,
    borderRadius: s(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: font(13, '800', { color: palette.navy }),

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },

  fleetRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  fleetBody: { flex: 1, minWidth: 0 },
  fleetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fleetPlate: font(10, '800', { color: palette.navy, letterSpacing: 0.5 }),
  fleetSpeedGold: font(8, '800', { color: palette.goldText }),
  fleetSpeedRed: font(8, '800', { color: palette.red }),
  fleetSpeedMuted: font(8, '800', { color: palette.slate500 }),
  fleetDriver: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },
  fleetFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: s(3),
  },
  fleetRoute: font(9, '800', { color: palette.navy }),
  fleetDistanceGold: font(9, '800', { color: palette.gold }),
  fleetDistanceRed: font(9, '800', { color: palette.red }),
  // The mock leaves this one uncoloured, so it inherits the body ink.
  fleetDistancePlain: font(9, '800', { color: palette.slate900 }),
});
