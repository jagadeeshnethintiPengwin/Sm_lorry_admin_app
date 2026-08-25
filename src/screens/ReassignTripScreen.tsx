import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Footer,
  Icon,
  ListState,
  Screen,
} from '@components/index';
import { Select } from '@components/inputs/Select';
import { ConfirmDialog } from '@components/modals/ConfirmDialog';
import type { ConfirmTone } from '@components/modals/ConfirmDialog';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';
import { driverService, tripService, vehicleService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Reassign Trip — the office's escape hatch when a lorry breaks down, a driver
 * cannot continue, or the wrong one was sent.
 *
 * The web panel's reassign, brought to the admin app: swap the driver, the
 * vehicle, or both on one live trip. Each picker defaults to *keeping* what is
 * there, so changing one leaves the other alone. The pickers list only what is
 * actually free — `drivers/available` and `vehicles/available` both leave out
 * anything on another live trip (and vehicles in maintenance) — with the
 * current one offered separately as the "keep" default, since it never appears
 * in its own free list. The API makes the same refusals server-side, so nothing
 * shown here can double-book.
 */
type Nav = NativeStackNavigationProp<RootStackParamList, 'ReassignTrip'>;
type Rt = RouteProp<RootStackParamList, 'ReassignTrip'>;

type Dialog = {
  tone: ConfirmTone;
  icon?: IconName;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

const KEEP = '';

export const ReassignTripScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { tripId } = useRoute<Rt>().params;

  const trip = useApi(() => tripService.get(tripId), [tripId]);
  const roster = useApi(() => driverService.available(), []);
  const fleet = useApi(() => vehicleService.available(), []);

  const [newDriverId, setNewDriverId] = useState(KEEP);
  const [newVehicleId, setNewVehicleId] = useState(KEEP);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const data = (trip.data ?? null) as Record<string, any> | null;
  const reference: string = data?.reference ?? '';
  const status: string = data?.status ?? '';
  const currentDriverId: string = data?.driverId ?? '';
  const currentDriverName: string = data?.driver?.user?.name ?? 'current driver';
  const currentVehicleReg: string = data?.vehicle?.registration ?? 'current vehicle';

  // Only a trip still running can move. A delivered or cancelled one is settled,
  // and the API refuses it — so the screen says so rather than offering pickers
  // that lead to a rejection.
  const live = status === 'SCHEDULED' || status === 'IN_TRANSIT';

  const driverOptions = useMemo(
    () => [
      { value: KEEP, label: `Keep ${currentDriverName}` },
      ...(roster.data ?? []).map(row => {
        const user = (row.user ?? {}) as { name?: string };
        return { value: String(row.id), label: user.name ?? 'Driver' };
      }),
    ],
    [roster.data, currentDriverName],
  );

  const vehicleOptions = useMemo(
    () => [
      { value: KEEP, label: `Keep ${currentVehicleReg}` },
      ...(fleet.data ?? []).map(row => {
        const v = row as { registration?: string; type?: string };
        return {
          value: String(row.id),
          label: [v.registration ?? 'Vehicle', v.type && `(${v.type})`]
            .filter(Boolean)
            .join(' '),
        };
      }),
    ],
    [fleet.data, currentVehicleReg],
  );

  const chosenDriverName =
    driverOptions.find(o => o.value === newDriverId)?.label ?? '';
  const chosenVehicleName =
    vehicleOptions.find(o => o.value === newVehicleId)?.label ?? '';

  const commit = useCallback(async () => {
    setBusy(true);
    try {
      await tripService.reassign(tripId, {
        // The endpoint always needs a driver; send the current one unchanged
        // when only the vehicle is being swapped.
        driverId: newDriverId || currentDriverId,
        ...(newVehicleId ? { vehicleId: newVehicleId } : {}),
      });
      setDialog({
        tone: 'success',
        icon: 'check',
        title: 'Trip reassigned',
        message: `#${reference} has been updated and the driver notified.`,
        confirmLabel: 'Done',
        onConfirm: () => {
          setDialog(null);
          navigation.goBack();
        },
      });
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Could not reassign the trip';
      // The lists are a snapshot: another dispatcher can take the same driver or
      // lorry between this screen loading and Reassign being pressed. Re-read
      // both so the next choice is made from what is free now.
      if (/already on (another live )?trip|maintenance/i.test(detail)) {
        roster.refetch();
        fleet.refetch();
      }
      setDialog({
        tone: 'danger',
        icon: 'alert-circle',
        title: 'Could not reassign',
        message: detail,
        confirmLabel: 'Close',
        onConfirm: () => setDialog(null),
      });
    } finally {
      setBusy(false);
    }
  }, [
    tripId,
    newDriverId,
    newVehicleId,
    currentDriverId,
    reference,
    navigation,
    roster,
    fleet,
  ]);

  const askConfirm = useCallback(() => {
    if (!newDriverId && !newVehicleId) {
      setDialog({
        tone: 'gold',
        icon: 'user-cog',
        title: 'Nothing to change',
        message: 'Pick a new driver or a new vehicle to swap in.',
        confirmLabel: 'Got it',
        onConfirm: () => setDialog(null),
      });
      return;
    }
    const lines = [
      newDriverId ? `Driver → ${chosenDriverName}` : null,
      newVehicleId ? `Vehicle → ${chosenVehicleName}` : null,
    ].filter(Boolean);
    setDialog({
      tone: 'gold',
      icon: 'user-cog',
      title: `Reassign #${reference}?`,
      message: `${lines.join('\n')}\n\nWhatever is replaced is freed for the pool.`,
      confirmLabel: 'Reassign',
      cancelLabel: 'Cancel',
      onConfirm: commit,
    });
  }, [
    newDriverId,
    newVehicleId,
    chosenDriverName,
    chosenVehicleName,
    reference,
    commit,
  ]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Reassign Trip"
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
          !live ? (
            <Card padding={14} style={styles.settled}>
              <Icon name="alert-circle" size={18} color={palette.red} />
              <Text style={styles.settledText}>
                #{reference} is {status.replace('_', ' ').toLowerCase()} and can
                no longer be reassigned.
              </Text>
            </Card>
          ) : (
            <>
              <Text style={styles.hint}>
                Change the driver, the vehicle, or both. Change one and the other
                stays as it is.
              </Text>

              <Card padding={14} style={styles.card}>
                <Text style={styles.label}>
                  <Icon name="user-cog" size={12} color={palette.red} /> DRIVER
                </Text>
                <Select
                  label="Driver"
                  options={driverOptions}
                  value={newDriverId}
                  onChange={setNewDriverId}
                  marginBottom={12}
                />

                <Text style={styles.label}>
                  <Icon name="truck" size={12} color={palette.red} /> VEHICLE
                </Text>
                <Select
                  label="Vehicle"
                  options={vehicleOptions}
                  value={newVehicleId}
                  onChange={setNewVehicleId}
                />
              </Card>

              {roster.data?.length === 0 && fleet.data?.length === 0 ? (
                <Card padding={12} style={styles.warn}>
                  <Text style={styles.warnText}>
                    No other driver or vehicle is free right now. Free one from
                    another trip first.
                  </Text>
                </Card>
              ) : null}
            </>
          )
        ) : null}
      </Content>

      {data && live ? (
        <Footer>
          <Button
            label="Reassign"
            variant="primary"
            icon="user-cog"
            iconSize={15}
            padding={12}
            onPress={askConfirm}
            disabled={!newDriverId && !newVehicleId}
          />
        </Footer>
      ) : null}

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
  hint: {
    ...font(11, '500', { color: palette.slate500 }),
    marginBottom: s(12),
    lineHeight: s(16),
  },
  card: { marginBottom: s(10) },
  label: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(6),
  },
  settled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    backgroundColor: palette.redTint,
  },
  settledText: { ...font(11, '600', { color: palette.navy }), flex: 1 },
  warn: { backgroundColor: palette.goldTint, marginTop: s(2) },
  warnText: font(10, '700', { color: palette.goldText }),
});
