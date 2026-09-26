import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import {
  AppHeader,
  Card,
  Content,
  ListState,
  Screen,
  StatusTimeline,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { TimelineStep } from '@components/common/StatusTimeline';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';
import { tripService } from '@services/fleet.service';
import type { AdminTrip } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Screen 20 — Trip Timeline.
 *
 *   flat navy summary strip · timeline card: four gold ✓ steps,
 *   the navy pulsing In Transit step with a LIVE chip, then two grey
 *   pending steps
 */
/**
 * The icon a stage carries, by the name the API records it under.
 *
 * `addEvent` uppercases whatever stage it is handed, so an unrecognised one is
 * expected rather than exceptional — it falls back to a plain tick instead of
 * rendering nothing.
 */
const ICON_FOR_STAGE: Record<string, IconName> = {
  ASSIGNED: 'user-check',
  PICKUP_COMPLETED: 'package-check',
  STARTED: 'truck',
  // The three sign-offs that close a trip: the driver's hand-over, the
  // customer's confirmation (their own, or recorded by the office), and the
  // office's approval.
  DELIVERED: 'package-check',
  CUSTOMER_CONFIRMED: 'badge-check',
  COMPLETION_APPROVED: 'check-circle-2',
  CANCELLED: 'alert-circle',
};

/** `10 Aug · 4:52 PM`, the shorthand the timeline already spoke. */
function stampOf(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    return '';
  }
  const date = when.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
  const time = when.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date} · ${time}`;
}

/**
 * The timeline for a trip: what has happened, what is happening, what is left.
 *
 * Ordered by `occurredAt` rather than by a fixed lifecycle, because the two
 * disagree — a real trip records PICKUP_COMPLETED *before* STARTED, since the
 * lorry is loaded and then departs. Imposing the order the mock happened to
 * list would have redrawn every trip's history to match a guess.
 *
 * Only the trailing steps are invented: a running trip gets a live step
 * carrying its real distance, and a trip that has not yet been delivered shows
 * that as pending. A delivered one that is not yet closed shows what it is
 * still waiting on — the customer's confirmation, then the office's approval —
 * since it stays IN_TRANSIT until both are in. A cancelled trip ends where it
 * stopped — offering "Delivered · awaiting" under a cancellation would be
 * nonsense.
 */
function buildSteps(trip: AdminTrip | null): TimelineStep[] {
  if (!trip) {
    return [];
  }

  const status = String(trip.status ?? '').toUpperCase();
  const events = Array.isArray(trip.events)
    ? ([...trip.events] as Array<{
        stage?: string;
        label?: string;
        note?: string;
        occurredAt?: string;
      }>)
    : [];

  events.sort(
    (a, b) =>
      new Date(a.occurredAt ?? 0).getTime() -
      new Date(b.occurredAt ?? 0).getTime(),
  );

  const steps: TimelineStep[] = events.map(event => {
    const stage = String(event.stage ?? '').toUpperCase();
    return {
      title: String(event.label ?? stage),
      detail: [stampOf(String(event.occurredAt ?? '')), event.note]
        .filter(Boolean)
        .join(' · '),
      state: 'done',
      icon: ICON_FOR_STAGE[stage] ?? 'check',
    };
  });

  if (status === 'CANCELLED') {
    return steps;
  }

  const covered = Number(trip.coveredKm ?? 0);
  const distance = Number(trip.distanceKm ?? 0);
  const delivered = Boolean(trip.deliveredAt) || status === 'DELIVERED';

  if (delivered) {
    if (trip.completionApprovedAt) {
      return steps;
    }
    // A trip delivered before confirmations existed only needs the office.
    if (!trip.customerConfirmedAt && status !== 'DELIVERED') {
      steps.push({
        title: 'Customer confirmation',
        detail: 'Waiting for the customer to confirm',
        state: 'pending',
        icon: 'badge-check',
      });
    }
    steps.push({
      title: 'Trip completion',
      detail: 'Office approval — frees the lorry and driver',
      state: 'pending',
      icon: 'check-circle-2',
    });
    return steps;
  }

  if (status === 'IN_TRANSIT') {
    steps.push({
      title: 'In Transit',
      detail: distance
        ? `${covered} / ${distance} KM covered`
        : 'On the road',
      state: 'current',
      icon: 'truck',
      badge: 'LIVE',
      tone: 'navy',
    });
  }

  steps.push({
    title: 'Delivered',
    detail: 'POD upload & end trip',
    state: 'pending',
    icon: 'package-check',
  });

  return steps;
}

export const TripTimelineScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'TripTimeline'>>();
  const { tripId } = route.params;

  const { data, loading, error, refetch } = useApi(
    () => tripService.get(tripId),
    [tripId],
  );

  const steps = useMemo(() => buildSteps(data), [data]);

  const booking = (data?.booking ?? {}) as {
    pickupPlace?: string;
    dropPlace?: string;
  };
  const reference = data?.reference ? `#${data.reference}` : '';
  const covered = Number(data?.coveredKm ?? 0);
  const distance = Number(data?.distanceKm ?? 0);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Trip Timeline"
        subtitle={reference}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content safeBottom>
        <ListState
          loading={loading}
          error={error}
          empty={!data}
          what="this trip"
          onRetry={refetch}
        />

        {data ? (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryKicker}>TRIP {reference}</Text>
              <Text style={styles.summaryRoute} numberOfLines={1}>
                {booking.pickupPlace ?? '—'} → {booking.dropPlace ?? '—'}
              </Text>
              <Text style={styles.summaryMeta}>
                {distance
                  ? `${covered} / ${distance} KM covered`
                  : 'Distance not recorded'}
              </Text>
            </View>

            <Card padding={14} marginBottom={0} style={styles.timelineCard}>
              <StatusTimeline steps={steps} />
            </Card>
          </>
        ) : null}
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
