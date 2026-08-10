import React, { memo } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { useSheetBottom } from '@hooks/useSafeBottom';
import { palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * The logout confirmation sheet (screen 18):
 *
 *   scrim : background:rgba(0,0,0,0.55)
 *   sheet : position:absolute; left:0; right:0; bottom:0; background:#fff;
 *           border-radius:24px 24px 0 0; padding:18px 16px 16px;
 *           box-shadow:0 -8px 30px rgba(0,0,0,0.2)
 *   grip  : width:36px; height:4px; background:#e5e7eb; border-radius:2px;
 *           margin:0 auto 14px
 */
export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Detaches the sheet from the bottom edge — inset on all sides with every
   * corner rounded, so it reads as a floating card rather than a drawer welded
   * to the screen. Used by the action sheets.
   */
  floating?: boolean;
  /** Renders the drag grip. */
  showHandle?: boolean;
  /** Tapping the scrim dismisses the sheet. */
  dismissOnBackdropPress?: boolean;
  paddingHorizontal?: number;
  paddingTop?: number;
  paddingBottom?: number;
  style?: StyleProp<ViewStyle>;
};

const BottomSheetComponent: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  floating = false,
  showHandle = true,
  dismissOnBackdropPress = true,
  paddingHorizontal = 16,
  paddingTop = 18,
  paddingBottom = 16,
  style,
}) => {
  // Capped rather than raw: this modal covers the system bars, and the inset
  // reported for such a window overstates the navigation bar on some handsets,
  // which shows up as a dead band beneath the sheet's last row.
  const sheet = useSheetBottom();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
        // Without this the Modal window stops above the Android navigation
        // bar, leaving a strip of the screen behind showing under the sheet.
        // Requires statusBarTranslucent; RN warns if it is missing.
        navigationBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(160)}
        style={[styles.scrim, { height: sheet.height }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdropPress ? onClose : undefined}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <Animated.View
          entering={SlideInDown.duration(300).dampingRatio(0.85)}
          exiting={SlideOutDown.duration(220)}
          style={[
            styles.sheet,
            floating ? styles.sheetFloating : null,
            {
              paddingHorizontal: s(paddingHorizontal),
              paddingTop: s(paddingTop),
              paddingBottom: floating
                ? s(paddingBottom)
                : s(paddingBottom) + sheet.paddingBottom,
            },
            floating
              ? { marginBottom: sheet.paddingBottom + s(12) }
              : null,
            style,
          ]}
        >
          {showHandle ? <View style={styles.handle} /> : null}
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    ...shadows.bottomSheet,
  },
  // Floating variant — inset from every edge, fully rounded.
  sheetFloating: {
    marginHorizontal: s(12),
    borderRadius: radius.sheet,
  },
  handle: {
    width: s(36),
    height: s(4),
    backgroundColor: palette.gray200,
    borderRadius: s(2),
    alignSelf: 'center',
    marginBottom: s(14),
  },
});

export const BottomSheet = memo(BottomSheetComponent);
BottomSheet.displayName = 'BottomSheet';
