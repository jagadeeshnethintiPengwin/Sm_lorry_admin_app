import React, { useCallback } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
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
  TripMap,
  Icon,
  IconWell,
  Screen,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 21 — Live Trip Track.
 *
 *   navy MOVING strip (48 km/h · 42 km done · 263 km left) · grid map with
 *   radar rings round the truck puck, plate tag, zoom, recenter and coords ·
 *   CURRENT LOCATION · TRIP PROGRESS with the knob on the fill ·
 *   DRIVER & VEHICLE · Share / View Timeline footer
 */
/**
 * Kompally (Hyderabad) -> Kadapa, the trip the mock's strip describes
 * (48 km/h, 42 km done, 263 km left). `current` is interpolated to the 14%
 * mark so the truck puck sits where the progress rail says it is.
 */
const PICKUP = { latitude: 17.5416, longitude: 78.4795 };
const DROP = { latitude: 14.4673, longitude: 78.8242 };
const CURRENT = { latitude: 17.1112, longitude: 78.5278 };

export const LiveTripTrackScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LiveTripTrack'>>();

  const call = useCallback(() => {
    Linking.openURL('tel:+918886321044').catch(() => undefined);
  }, []);

  const share = useCallback(() => {
    Share.share({
      message:
        'Track SMT trip #TR-2026-8829 — AP 05 CH 9912, currently near Chevella toll.',
    }).catch(() => undefined);
  }, []);

  const openTimeline = useCallback(
    () => navigation.navigate('TripTimeline', { tripId: route.params.tripId }),
    [navigation, route.params.tripId],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Track Live"
        subtitle="#TR-2026-8829 · AP 05 CH 9912"
        showBack
        onBackPress={navigation.goBack}
      />

      <Content padding={12} contentStyle={styles.contentTop}>
        {/* Live status strip */}
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.strip}
        >
          <View style={styles.stripHead}>
            <View style={styles.movingChip}>
              <BlinkDot color={palette.gold} size={5} />
              <Text style={styles.movingText}>MOVING</Text>
            </View>
            <Text style={styles.updated}>UPDATED 12s AGO</Text>
          </View>

          <View style={styles.stripStats}>
            <View style={[styles.stripStat, styles.stripDivider]}>
              <Text style={styles.stripValue}>48</Text>
              <Text style={styles.stripLabel}>KM/H</Text>
            </View>
            <View style={[styles.stripStat, styles.stripDivider]}>
              <Text style={styles.stripValue}>42</Text>
              <Text style={styles.stripLabel}>KM DONE</Text>
            </View>
            <View style={styles.stripStat}>
              <Text style={styles.stripValue}>263</Text>
              <Text style={styles.stripLabel}>KM LEFT</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Map */}
        <TripMap
          pickup={PICKUP}
          drop={DROP}
          current={CURRENT}
          height={220}
          style={styles.map}
        >
          {/* Info tag above vehicle */}
          <View style={styles.plateTag}>
            <Text style={styles.plateText}>AP 05 CH 9912 · 48 km/h</Text>
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

          {/* Recenter */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recenter map"
            style={styles.recenter}
          >
            <Icon name="locate-fixed" size={14} color={palette.navy} />
          </Pressable>

          {/* Coord badge */}
          <View style={styles.coords}>
            <Icon name="map-pin" size={10} color={palette.navy} />
            <Text style={styles.coordsText}>17.4126° N, 78.7642° E</Text>
          </View>
        </TripMap>

        {/* Current location */}
        <Text style={styles.section}>CURRENT LOCATION</Text>
        <Card padding={11} marginBottom={10}>
          <View style={styles.locRow}>
            <IconWell
              icon="navigation"
              size={26}
              iconSize={14}
              backgroundColor={palette.goldTint}
              color={palette.gold}
              borderRadius={radius.md}
            />
            <View style={styles.locBody}>
              <Text style={styles.locName}>NH-65 near Chevella toll</Text>
              <Text style={styles.locMeta}>Ranga Reddy district, Telangana</Text>
              <View style={styles.locStats}>
                <Text style={styles.locSpeed}>48 km/h</Text>
                <Text style={styles.locDot}>·</Text>
                <Text style={styles.locHeading}>Heading south-west</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Trip progress */}
        <Text style={styles.section}>TRIP PROGRESS</Text>
        <Card padding={12} marginBottom={10}>
          <View style={styles.progHead}>
            <View>
              <Text style={styles.progLabel}>KOMPALLY</Text>
              <Text style={styles.progValue}>6:12 AM · Started</Text>
            </View>
            <View style={styles.progRight}>
              <Text style={styles.progLabel}>KADAPA</Text>
              <Text style={styles.progValue}>ETA 2:35 PM</Text>
            </View>
          </View>

          <View style={styles.track}>
            <LinearGradient
              colors={[palette.gold, palette.red]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fill}
            >
              <View style={styles.knob} />
            </LinearGradient>
          </View>

          <View style={styles.progFoot}>
            <Text style={styles.progCovered}>42 km covered</Text>
            <Text style={styles.progLeft}>263 km left · 14% done</Text>
          </View>
        </Card>

        {/* Driver & vehicle */}
        <Text style={styles.section}>DRIVER &amp; VEHICLE</Text>
        <Card padding={11} marginBottom={10}>
          <View style={styles.driverRow}>
            <LinearGradient
              colors={gradients.gold as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.driverAvatar}
            >
              <Text style={styles.driverInitials}>PK</Text>
            </LinearGradient>

            <View style={styles.driverBody}>
              <Text style={styles.driverName}>Prakash Reddy</Text>
              <Text style={styles.driverMeta}>+91 88863 21044 · 388 trips</Text>
            </View>

            <Pressable
              onPress={call}
              accessibilityRole="button"
              accessibilityLabel="Call Prakash Reddy"
              style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
            >
              <Icon name="phone" size={14} color={palette.navy} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.driverRow}>
            <IconWell
              icon="truck"
              size={26}
              iconSize={14}
              backgroundColor={palette.navyTint}
              color={palette.navy}
              borderRadius={radius.md}
            />
            <View style={styles.driverBody}>
              <Text style={styles.plate}>AP 05 CH 9912</Text>
              <Text style={styles.driverMeta}>
                22 Ft Trailer · Bharat Benz 2523R
              </Text>
            </View>
          </View>
        </Card>
      </Content>

      <Footer row>
        <Button
          label="Share"
          variant="outline"
          icon="share-2"
          iconSize={14}
          flex={1}
          padding={10}
          fontSize={11}
          gap={5}
          borderColor={palette.border}
          onPress={share}
        />
        <Button
          label="View Timeline"
          variant="gold"
          icon="clipboard-list"
          iconSize={14}
          flex={1.4}
          padding={10}
          fontSize={11}
          gap={5}
          onPress={openTimeline}
        />
      </Footer>
    </Screen>
  );
};

const styles = StyleSheet.create({
  contentTop: { paddingTop: s(10), paddingBottom: s(14) },

  strip: {
    borderRadius: radius.xl,
    padding: s(12),
    marginBottom: s(12),
    ...shadows.elevatedCard,
  },
  stripHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(10),
  },
  movingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(3),
    paddingHorizontal: s(9),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gold,
    borderRadius: s(20),
  },
  movingText: font(8, '800', { color: palette.gold }),
  updated: font(8, '800', { color: palette.slate400, letterSpacing: 0.5 }),
  stripStats: { flexDirection: 'row' },
  stripStat: { flex: 1, alignItems: 'center', paddingVertical: s(2) },
  stripDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: alpha.white12,
  },
  stripValue: font(15, '800', { color: palette.white, lineHeight: 1 }),
  stripLabel: {
    ...font(7.5, '800', { color: palette.slate400, letterSpacing: 0.5 }),
    marginTop: s(3),
  },

  map: { borderRadius: radius.card, marginBottom: s(12) },
  plateTag: {
    position: 'absolute',
    top: s(60),
    left: s(105),
    backgroundColor: palette.navy,
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    borderRadius: radius.sm,
    ...shadows.subtle,
  },
  plateText: font(8, '800', { color: palette.white }),
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
  recenter: {
    position: 'absolute',
    bottom: s(8),
    right: s(8),
    backgroundColor: palette.white,
    borderRadius: radius.sm,
    padding: s(6),
    ...shadows.subtle,
  },
  coords: {
    position: 'absolute',
    bottom: s(8),
    left: s(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: palette.white,
    paddingVertical: s(5),
    paddingHorizontal: s(8),
    borderRadius: radius.md,
    ...shadows.subtle,
  },
  coordsText: font(8, '800', { color: palette.navy }),

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },

  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(8) },
  locBody: { flex: 1, minWidth: 0 },
  locName: font(11, '800', { color: palette.navy }),
  locMeta: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(2),
  },
  locStats: {
    flexDirection: 'row',
    gap: s(8),
    marginTop: s(6),
  },
  locSpeed: font(9, '800', { color: palette.gold }),
  locDot: font(9, '800', { color: palette.slate500 }),
  locHeading: font(9, '800', { color: palette.navy }),

  progHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  progRight: { alignItems: 'flex-end' },
  progLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
  progValue: font(10, '800', { color: palette.navy }),
  track: {
    height: s(6),
    backgroundColor: palette.border,
    borderRadius: s(6),
  },
  fill: {
    width: '14%',
    height: '100%',
    borderRadius: s(6),
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    right: s(-6),
    width: s(12),
    height: s(12),
    backgroundColor: palette.white,
    borderWidth: s(2),
    borderColor: palette.red,
    borderRadius: radius.full,
    ...shadows.switchKnob,
  },
  progFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: s(8),
  },
  progCovered: font(9, '800', { color: palette.gold }),
  progLeft: font(9, '800', { color: palette.slate500 }),

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  driverAvatar: {
    width: s(38),
    height: s(38),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: font(13, '800', { color: palette.navy }),
  driverBody: { flex: 1 },
  driverName: font(11, '800', { color: palette.navy }),
  driverMeta: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(1),
  },
  plate: font(11, '800', { color: palette.navy, letterSpacing: 0.5 }),
  callBtn: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.goldSmall,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.divider,
    marginVertical: s(10),
  },

  pressed: { opacity: 0.8 },
});
