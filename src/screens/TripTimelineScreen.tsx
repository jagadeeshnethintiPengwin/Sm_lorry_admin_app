import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  AppHeader,
  Card,
  Content,
  Screen,
  StatusTimeline,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { TimelineStep } from '@components/common/StatusTimeline';

/**
 * Screen 20 — Trip Timeline.
 *
 *   flat navy summary strip · timeline card: four gold ✓ steps,
 *   the navy pulsing In Transit step with a LIVE chip, then two grey
 *   pending steps
 */
const STEPS: TimelineStep[] = [
  {
    title: 'Booking Approved',
    detail: '17 May · 4:32 PM · By Admin',
    state: 'done',
  },
  {
    title: 'Driver & Vehicle Assigned',
    detail: '17 May · 5:12 PM\nRamesh K · AP 31 XX 1234',
    state: 'done',
  },
  {
    title: 'Trip Started',
    detail: '17 May · 6:00 PM · Left depot',
    state: 'done',
  },
  {
    title: 'Pickup Completed',
    detail: '18 May · 9:15 AM · Loaded 12.5 T',
    state: 'done',
  },
  {
    title: 'In Transit',
    detail: '128 KM covered · Last ping 12s ago',
    state: 'current',
    icon: 'truck',
    badge: 'LIVE',
    tone: 'navy',
  },
  {
    title: 'Reached Drop',
    detail: 'Awaiting arrival',
    state: 'pending',
    icon: 'map-pin',
  },
  {
    title: 'Delivered',
    detail: 'POD upload & end trip',
    state: 'pending',
    icon: 'package-check',
  },
];

export const TripTimelineScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Trip Timeline"
        subtitle="#TR-2026-8836"
        showBack
        onBackPress={navigation.goBack}
      />

      <Content safeBottom>
        <View style={styles.summary}>
          <Text style={styles.summaryKicker}>TRIP #TR-2026-8836</Text>
          <Text style={styles.summaryRoute}>Visakhapatnam → Hyderabad</Text>
          <Text style={styles.summaryMeta}>
            128 / 620 KM covered · ETA 2:45 PM
          </Text>
        </View>

        <Card padding={14} marginBottom={0} style={styles.timelineCard}>
          <StatusTimeline steps={STEPS} />
        </Card>
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  summary: {
    backgroundColor: palette.navy,
    paddingVertical: s(12),
    paddingHorizontal: s(14),
    borderRadius: radius.card,
    marginBottom: s(12),
  },
  summaryKicker: font(8, '800', { color: palette.gold, letterSpacing: 1.5 }),
  summaryRoute: {
    ...font(13, '800', { color: palette.white }),
    marginTop: s(2),
  },
  summaryMeta: {
    ...font(9, '400', { color: palette.white }),
    opacity: 0.85,
    marginTop: s(2),
  },
  timelineCard: { paddingVertical: s(16) },
});
