import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { CenterModal } from './CenterModal';
import { Button } from '@components/buttons/Button';
import { Icon } from '@components/common/Icon';
import { RadialGlow } from '@components/common/RadialGlow';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';

/**
 * The app's own confirm / result dialog, in place of `Alert.alert`.
 *
 * The system alert is the one surface in the product nobody designed: it
 * arrives in the platform's typeface and chrome, ignores the navy-and-gold
 * ramp everything else obeys, and looks different on every handset. Using it
 * for the moment an operator dispatches a lorry — the most consequential tap
 * on the screen — undoes the care taken everywhere around it.
 *
 * This wears the same navy cap, tinted icon well and footer rule as the picker
 * and the upload dialog, so a decision looks like part of the app that asked
 * for it.
 */
export type ConfirmTone = 'gold' | 'danger' | 'success';

export type ConfirmDialogProps = {
  visible: boolean;
  /** Colours the icon well and the confirming action. */
  tone?: ConfirmTone;
  icon?: IconName;
  title: string;
  message?: string;
  confirmLabel?: string;
  /**
   * Omit for a dialog that only reports — a result or a failure has nothing to
   * decline, so offering "Cancel" beside "OK" invents a choice.
   */
  cancelLabel?: string;
  /** Disables both actions and spins the confirming one. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const TONE: Record<
  ConfirmTone,
  { well: string; border: string; glyph: string; button: 'gold' | 'danger' }
> = {
  gold: {
    well: 'rgba(245,166,35,0.18)',
    border: 'rgba(245,166,35,0.4)',
    glyph: palette.gold,
    button: 'gold',
  },
  danger: {
    well: 'rgba(220,38,38,0.16)',
    border: 'rgba(220,38,38,0.38)',
    glyph: palette.red,
    button: 'danger',
  },
  success: {
    well: 'rgba(22,163,74,0.16)',
    border: 'rgba(22,163,74,0.38)',
    glyph: palette.green,
    button: 'gold',
  },
};

const ConfirmDialogComponent: React.FC<ConfirmDialogProps> = ({
  visible,
  tone = 'gold',
  icon,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const skin = TONE[tone];
  const glyph: IconName =
    icon ??
    (tone === 'danger'
      ? 'alert-triangle'
      : tone === 'success'
        ? 'check-circle-2'
        : 'shield-check');

  return (
    <CenterModal
      visible={visible}
      // A decision is not dismissed by tapping past it; the operator chooses.
      dismissOnBackdropPress={false}
      onClose={onCancel}
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
          color={skin.glyph}
          opacity={0.26}
          top={-34}
          right={-24}
        />
        <View
          style={[
            styles.well,
            { backgroundColor: skin.well, borderColor: skin.border },
          ]}
        >
          <Icon name={glyph} size={20} color={skin.glyph} />
        </View>
        <Text style={styles.title}>{title}</Text>
      </LinearGradient>

      <View style={styles.body}>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.actions}>
          {cancelLabel ? (
            <Button
              label={cancelLabel}
              variant="outline"
              flex={1}
              padding={10}
              fontSize={11}
              disabled={busy}
              onPress={onCancel}
            />
          ) : null}
          <Button
            label={confirmLabel}
            variant={skin.button === 'danger' ? 'outline' : 'gold'}
            // A destructive confirm keeps the outline shape but carries the
            // red, so it reads as serious rather than merely inviting.
            color={skin.button === 'danger' ? palette.red : undefined}
            borderColor={skin.button === 'danger' ? palette.redSoft : undefined}
            flex={cancelLabel ? 1.3 : 1}
            padding={10}
            fontSize={11}
            loading={busy}
            disabled={busy}
            onPress={onConfirm}
          />
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
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(10),
  },
  title: {
    ...font(13, '800', { color: palette.white, letterSpacing: -0.2 }),
    textAlign: 'center',
  },

  body: { padding: s(14), gap: s(12) },
  message: {
    ...font(10, '600', { color: palette.slate500 }),
    textAlign: 'center',
    lineHeight: s(15),
  },
  // Separated from the message the same way the picker's footer is, so the
  // actions read as the decision rather than as more copy.
  actions: {
    flexDirection: 'row',
    gap: s(8),
    paddingTop: s(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.divider,
  },
});

export const ConfirmDialog = memo(ConfirmDialogComponent);
ConfirmDialog.displayName = 'ConfirmDialog';
