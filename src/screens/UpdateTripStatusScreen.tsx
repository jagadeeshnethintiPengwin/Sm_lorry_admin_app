import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Icon,
  Input,
  ListState,
  Screen,
} from '@components/index';
import { ConfirmDialog } from '@components/modals/ConfirmDialog';
import type { ConfirmTone } from '@components/modals/ConfirmDialog';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';
import { tripService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Update Trip Status — the office's manual control over a trip's lifecycle.
 *
 * The driver app drives a trip through its states from the road, but the office
 * needs the same power for the trips a driver cannot: a run started before the
 * driver marked it, a delivery confirmed over the radio, a trip that must be
 * called off. It offers only the moves the trip's current state allows — a
 * scheduled trip can start, an in-transit one can be delivered, either can be
 * cancelled — and a settled trip is left alone. Every action posts to the same
 * endpoints the driver app uses, so the vehicle and driver are freed and the
 * booking is closed the one, consistent way.
 */
type Nav = NativeStackNavigationProp<RootStackParamList, 'UpdateTripStatus'>;
type Rt = RouteProp<RootStackParamList, 'UpdateTripStatus'>;

type Dialog = {
  tone: ConfirmTone;
  icon?: IconName;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: palette.gold },
  IN_TRANSIT: { label: 'In Transit', color: palette.gold },
  DELIVERED: { label: 'Delivered', color: palette.navy },
  CANCELLED: { label: 'Cancelled', color: palette.red },
};

export const UpdateTripStatusScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { tripId } = useRoute<Rt>().params;

  const trip = useApi(() => tripService.get(tripId), [tripId]);

  const [mode, setMode] = useState<'complete' | 'cancel' | null>(null);
  const [receiverName, setReceiverName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const data = (trip.data ?? null) as Record<string, any> | null;
  const reference: string = data?.reference ?? '';
  const status: string = data?.status ?? '';
  const meta = STATUS_META[status] ?? { label: status, color: palette.slate500 };
  const live = status === 'SCHEDULED' || status === 'IN_TRANSIT';

  const succeed = useCallback(
    (title: string, message: string) =>
      setDialog({
        tone: 'success',
        icon: 'check-circle-2',
        title,
        message,
        confirmLabel: 'Done',
        onConfirm: () => {
          setDialog(null);
          navigation.goBack();
        },
      }),
    [navigation],
  );

  const failWith = useCallback(
    (message: string) =>
      setDialog({
        tone: 'danger',
        icon: 'alert-circle',
        title: 'Could not update the trip',
        message,
        confirmLabel: 'Close',
        onConfirm: () => setDialog(null),
      }),
    [],
  );

  const run = useCallback(
    async (action: () => Promise<unknown>, title: string, message: string) => {
      setBusy(true);
      try {
        await action();
        succeed(title, message);
      } catch (error) {
        failWith(
          error instanceof Error ? error.message : 'That action failed',
        );
      } finally {
        setBusy(false);
      }
    },
    [succeed, failWith],
  );

  const askStart = useCallback(() => {
    setDialog({
      tone: 'gold',
      icon: 'arrow-right',
      title: `Start #${reference}?`,
      message:
        'The trip moves to In Transit and the lorry is marked on the road.',
      confirmLabel: 'Start trip',
      cancelLabel: 'Cancel',
      onConfirm: () =>
        run(
          () => tripService.start(tripId),
          'Trip started',
          `#${reference} is now in transit.`,
        ),
    });
  }, [reference, run, tripId]);

  const confirmComplete = useCallback(() => {
    if (receiverName.trim().length < 2) {
      failWith('Enter the name of who received the load.');
      return;
    }
    run(
      () =>
        tripService.complete(tripId, {
          receiverName: receiverName.trim(),
          remarks: remarks.trim() || undefined,
        }),
      'Marked delivered',
      `#${reference} is delivered — the lorry and driver are free.`,
    );
  }, [receiverName, remarks, run, tripId, reference, failWith]);

  const confirmCancel = useCallback(() => {
    run(
      () => tripService.cancel(tripId, reason.trim() || 'Cancelled by the office'),
      'Trip cancelled',
      `#${reference} has been cancelled and the lorry freed.`,
    );
  }, [reason, run, tripId, reference]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Trip Status"
        subtitle={reference ? `#${reference}` : 'Loading…'}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
        <ListState
          loading={trip.loading}
          error={trip.error}
          empty={!trip.loading && !trip.error && !data}
          what="trip"
          emptyIcon="truck"
          emptyHint="This trip could not be found."
          onRetry={trip.refetch}
        />

        {data ? (
          <>
            <Card padding={14} style={styles.card}>
              <Text style={styles.kicker}>CURRENT STATUS</Text>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: meta.color }]} />
                <Text style={styles.statusText}>{meta.label}</Text>
              </View>
            </Card>

            {!live ? (
              <Card padding={14} style={styles.settled}>
                <Icon name="check-circle-2" size={18} color={palette.navy} />
                <Text style={styles.settledText}>
                  This trip is {meta.label.toLowerCase()} — its status is settled
                  and cannot be changed.
                </Text>
              </Card>
            ) : mode === 'complete' ? (
              <Card padding={14} style={styles.card}>
                <Text style={styles.kicker}>MARK AS DELIVERED</Text>
                <Input
                  label="Received by"
                  placeholder="Name of who took the load"
                  value={receiverName}
                  onChangeText={setReceiverName}
                  autoCapitalize="words"
                />
                <Input
                  label="Remarks (optional)"
                  placeholder="Any note on the delivery"
                  value={remarks}
                  onChangeText={setRemarks}
                  multiline
                />
                <Button
                  label={busy ? 'Saving…' : 'Confirm Delivery'}
                  variant="gold"
                  icon="package-check"
                  loading={busy}
                  disabled={busy}
                  onPress={confirmComplete}
                  style={styles.action}
                />
                <Button
                  label="Back"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setMode(null)}
                />
              </Card>
            ) : mode === 'cancel' ? (
              <Card padding={14} style={styles.card}>
                <Text style={styles.kicker}>CANCEL TRIP</Text>
                <Input
                  label="Reason"
                  placeholder="Why is this trip being cancelled?"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <Button
                  label={busy ? 'Cancelling…' : 'Confirm Cancellation'}
                  variant="red"
                  icon="alert-triangle"
                  loading={busy}
                  disabled={busy}
                  onPress={confirmCancel}
                  style={styles.action}
                />
                <Button
                  label="Back"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setMode(null)}
                />
              </Card>
            ) : (
              <Card padding={14} style={styles.card}>
                <Text style={styles.kicker}>CHANGE STATUS</Text>
                {status === 'SCHEDULED' ? (
                  <Button
                    label="Start Trip · Ongoing"
                    variant="gold"
                    icon="arrow-right"
                    onPress={askStart}
                    style={styles.action}
                  />
                ) : null}
                {status === 'IN_TRANSIT' ? (
                  <Button
                    label="Mark as Delivered"
                    variant="gold"
                    icon="package-check"
                    onPress={() => setMode('complete')}
                    style={styles.action}
                  />
                ) : null}
                <Button
                  label="Cancel Trip"
                  variant="outline"
                  icon="alert-triangle"
                  color={palette.red}
                  borderColor={palette.redSoft}
                  onPress={() => setMode('cancel')}
                  style={styles.action}
                />
              </Card>
            )}
          </>
        ) : null}
      </Content>

      <ConfirmDialog
        visible={dialog !== null}
        tone={dialog?.tone}
        icon={dialog?.icon}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        busy={busy}
        onConfirm={() => dialog?.onConfirm()}
        onCancel={() => (busy ? undefined : setDialog(null))}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: s(10) },
  kicker: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  dot: { width: s(9), height: s(9), borderRadius: s(5) },
  statusText: font(14, '800', { color: palette.navy }),
  action: { marginTop: s(10) },
  settled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    backgroundColor: palette.navyTint,
  },
  settledText: { ...font(11, '600', { color: palette.navy }), flex: 1 },
});
