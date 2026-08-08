import React, { memo } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import { palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * Centred dialog.
 *
 * Where `BottomSheet` is a drawer anchored to the bottom edge, this floats a
 * card in the middle of the screen. It springs in with a scale+fade rather
 * than sliding, which reads as more deliberate for a short, focused choice.
 */
export type CenterModalProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Tapping the scrim dismisses. */
  dismissOnBackdropPress?: boolean;
  /** Horizontal inset from the screen edges. */
  inset?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

const CenterModalComponent: React.FC<CenterModalProps> = ({
  visible,
  onClose,
  children,
  dismissOnBackdropPress = true,
  inset = 24,
  padding = 18,
  style,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="none"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      style={styles.scrim}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={dismissOnBackdropPress ? onClose : undefined}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />

      <Animated.View
        entering={ZoomIn.springify().damping(18).stiffness(220).mass(0.6)}
        exiting={ZoomOut.duration(160)}
        style={[
          styles.card,
          {
            marginHorizontal: s(inset),
            padding: s(padding),
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  </Modal>
);

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(8,26,51,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: palette.white,
    borderRadius: radius.sheet,
    // Lifted well off the scrim so the dialog reads as floating.
    shadowColor: palette.navyDark,
    shadowOffset: { width: 0, height: s(18) },
    shadowRadius: s(24),
    shadowOpacity: 0.35,
    elevation: 24,
  },
});

export const CenterModal = memo(CenterModalComponent);
CenterModal.displayName = 'CenterModal';
