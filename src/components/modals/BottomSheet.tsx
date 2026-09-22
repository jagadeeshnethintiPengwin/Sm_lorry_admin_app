import React, { memo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
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
  /**
   * Scrolls the sheet's body and keeps it clear of the keyboard.
   *
   * Opt-in, because most sheets here are a title and two buttons and a
   * ScrollView around those would add a scroll container that never scrolls.
   * A sheet carrying a form needs it: without it a six-field form runs off the
   * top of the screen with no way to reach the rest, and the keyboard covers
   * whichever field is being typed into.
   */
  scrollable?: boolean;
  /**
   * How much of the screen a scrollable sheet may take before it scrolls.
   *
   * Not the whole height: the scrim above has to stay visible, or the sheet
   * reads as a page that arrived from nowhere rather than something laid over
   * the list — and there is nothing left to tap to dismiss it.
   */
  maxHeightRatio?: number;
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
  scrollable = false,
  maxHeightRatio = 0.88,
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
          {scrollable ? (
            /*
             * `padding` on both platforms rather than `height` on Android.
             *
             * The app is `adjustResize`, which normally lifts content by
             * itself — but this sheet lives in a modal window that spans the
             * system bars, and such a window is not resized when the keyboard
             * opens. Left to the default the keyboard simply covers the field
             * being typed into.
             */
            <KeyboardAvoidingView
              behavior="padding"
              style={{ maxHeight: sheet.height * maxHeightRatio }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.scrollContent}
              >
                {children}
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            children
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  /* A little room under the last control so it is not flush with the edge of
     the sheet when the content is long enough to scroll. */
  scrollContent: { paddingBottom: s(4) },
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
