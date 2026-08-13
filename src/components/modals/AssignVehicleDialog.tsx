import React, { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { CenterModal } from './CenterModal';
import { Icon } from '@components/common/Icon';
import { Loader } from '@components/common/Loader';
import { RadialGlow } from '@components/common/RadialGlow';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { hp, s } from '@theme/metrics';
import { vehicleService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

/**
 * Gives a driver a lorry.
 *
 * The roster's Assign button had no `onPress` at all — it rendered, it
 * pressed, and nothing happened. This is what it needed to open.
 *
 * Only lorries with nobody on them are offered. `Vehicle_driverId_key` is a
 * unique index, so a vehicle that already has a driver cannot take another;
 * listing one would be offering a choice the API is bound to refuse.
 */
export type AssignVehicleDialogProps = {
  visible: boolean;
  /** Named in the heading so it is obvious who is being given a lorry. */
  driverName: string;
  busy?: boolean;
  /** The failure from the last attempt, if it failed. */
  error?: string | null;
  onAssign: (vehicleId: string) => void;
  onClose: () => void;
};

const AssignVehicleDialogComponent: React.FC<AssignVehicleDialogProps> = ({
  visible,
  driverName,
  busy = false,
  error = null,
  onAssign,
  onClose,
}) => {
  const [chosen, setChosen] = useState<string | null>(null);

  /*
   * Read when the dialog opens rather than once on mount.
   *
   * Which lorries are spare changes while the roster is on screen — another
   * operator assigning one, a trip ending. Reading at open means the list is
   * what is true now, not what was true when the screen loaded.
   */
  const { data, loading } = useApi(
    () => (visible ? vehicleService.page({ limit: 100 }) : Promise.resolve(null)),
    [visible],
  );

  const free = useMemo(
    () => (data?.items ?? []).filter(vehicle => !vehicle.driverId),
    [data],
  );

  return (
    <CenterModal
      visible={visible}
      onClose={onClose}
      dismissOnBackdropPress={!busy}
      padding={0}
    >
      <LinearGradient
        colors={gradients.navyHero as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <RadialGlow
          size={110}
          color={palette.gold}
          opacity={0.28}
          top={-34}
          right={-24}
        />
        <View style={styles.well}>
          <Icon name="truck" size={20} color={palette.gold} />
        </View>
        <Text style={styles.title}>Assign a vehicle</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {driverName}
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.state}>
            <Loader size={26} label="Loading vehicles…" />
          </View>
        ) : free.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>No spare vehicle</Text>
            <Text style={styles.stateBody}>
              Every lorry already has a driver. Free one up first, then assign.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {free.map(vehicle => {
              const id = String(vehicle.id);
              const isChosen = id === chosen;
              return (
                <Pressable
                  key={id}
                  onPress={() => setChosen(id)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isChosen }}
                  accessibilityLabel={String(vehicle.registration ?? 'Vehicle')}
                  style={({ pressed }) => [
                    styles.option,
                    isChosen && styles.optionOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.tile, isChosen && styles.tileOn]}>
                    <Icon
                      name={isChosen ? 'check' : 'truck'}
                      size={14}
                      color={isChosen ? palette.white : palette.slate400}
                      strokeWidth={isChosen ? 3 : 2}
                    />
                  </View>
                  <View style={styles.optionBody}>
                    <Text style={styles.reg} numberOfLines={1}>
                      {String(vehicle.registration ?? '—')}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[vehicle.type, vehicle.capacity]
                        .filter(Boolean)
                        .join(' · ') || 'No details'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>

          <Pressable
            onPress={() => chosen && onAssign(chosen)}
            // Nothing to assign until one is picked, and the API needs a real
            // id — an enabled button with nothing chosen is a guaranteed 400.
            disabled={busy || !chosen}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.confirm,
              (busy || !chosen) && styles.confirmOff,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.confirmText}>
              {busy ? 'ASSIGNING…' : 'ASSIGN'}
            </Text>
          </Pressable>
        </View>
      </View>
    </CenterModal>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: s(20),
    paddingBottom: s(16),
    paddingHorizontal: s(18),
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  well: {
    width: s(42),
    height: s(42),
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,166,35,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,166,35,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(10),
  },
  title: font(13, '800', { color: palette.white, letterSpacing: -0.2 }),
  subtitle: {
    ...font(9, '600', { color: palette.white, letterSpacing: 0.2 }),
    opacity: 0.75,
    marginTop: s(3),
  },

  body: { padding: s(14), gap: s(10), flexShrink: 1, minHeight: 0 },
  list: { maxHeight: hp(38), flexShrink: 1, minHeight: 0 },
  listContent: { gap: s(8), paddingVertical: s(3), paddingHorizontal: s(2) },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    padding: s(11),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.xl,
    backgroundColor: palette.white,
  },
  optionOn: { backgroundColor: palette.goldTint, borderColor: palette.gold },
  tile: {
    width: s(32),
    height: s(32),
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
    flexShrink: 0,
  },
  tileOn: { backgroundColor: palette.gold },
  optionBody: { flex: 1, minWidth: 0 },
  reg: font(11, '800', { color: palette.navy }),
  meta: { ...font(9, '600', { color: palette.slate500 }), marginTop: s(1) },

  state: { alignItems: 'center', paddingVertical: s(22), gap: s(4) },
  stateTitle: font(12, '800', { color: palette.navy }),
  stateBody: {
    ...font(9, '600', { color: palette.slate500 }),
    textAlign: 'center',
    lineHeight: s(14),
  },

  error: {
    ...font(9, '700', { color: palette.red }),
    textAlign: 'center',
  },

  actions: {
    flexDirection: 'row',
    gap: s(8),
    paddingTop: s(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.divider,
  },
  cancel: {
    flex: 1,
    paddingVertical: s(11),
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceAlt,
  },
  cancelText: font(10, '800', { color: palette.slate500, letterSpacing: 1.2 }),
  confirm: {
    flex: 1.4,
    paddingVertical: s(11),
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: palette.gold,
  },
  confirmOff: { opacity: 0.45 },
  confirmText: font(10, '800', { color: palette.navy, letterSpacing: 1.2 }),
  pressed: { opacity: 0.75 },
});

export const AssignVehicleDialog = memo(AssignVehicleDialogComponent);
AssignVehicleDialog.displayName = 'AssignVehicleDialog';
