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
import { hp, s, wp } from '@theme/metrics';

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
  /**
   * Horizontal inset from the screen edges, in design px.
   *
   * Omit it. The default below is a share of the display, which is what a
   * dialog margin should be, and every dialog looking the same is the point of
   * having one component. Pass a number only when a particular dialog genuinely
   * needs a different width.
   */
  inset?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The side margin every centred dialog gets.
 *
 * Proportional rather than scaled from the mock, so a narrow handset and a
 * large one show the same *visual* margin instead of the same pixel count. On a
 * 1080px display this is 86px a side.
 *
 * It lives here rather than in each dialog's stylesheet because it had been
 * written out twice already and the two copies had drifted — the upload dialog
 * at 86px, the picker beside it at 54px.
 */
const SIDE_MARGIN = wp(8);

/**
 * Past this a dialog stops reading as a dialog and becomes a page, so the
 * proportional margin gives way to a fixed ceiling.
 *
 * Inert on a phone: the cap works out wider than the screen, so the margin
 * above is what decides the width. It only engages on a tablet — where, being
 * a stretched item that has hit a maximum, the card sits against the leading
 * edge rather than centred. Worth knowing before this ships to one; on the
 * handsets this app targets it never applies.
 */
const MAX_WIDTH = s(360);

/**
 * A ceiling on the card's height, so a dialog can never grow past the screen.
 *
 * Without one, a long list pushes the card taller than the display and the
 * footer action goes off the bottom — the control the operator needs to get
 * out being the first thing lost. Contents that can grow are expected to
 * shrink inside this; the picker's option list does exactly that.
 */
const MAX_HEIGHT = hp(85);

const CenterModalComponent: React.FC<CenterModalProps> = ({
  visible,
  onClose,
  children,
  dismissOnBackdropPress = true,
  inset,
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
            marginHorizontal: inset === undefined ? SIDE_MARGIN : s(inset),
            maxWidth: MAX_WIDTH,
            maxHeight: MAX_HEIGHT,
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
    /*
     * Stretched, not `width: '100%'`.
     *
     * A percentage width resolves against the scrim's content box — the whole
     * screen — and margins are then applied *outside* it, so the card measured
     * `100% + 2 × margin` and simply overflowed. Every side margin set on it
     * was inert: the card drew full-bleed whatever the number said, which is
     * why raising it from 5% to 8% changed nothing on screen.
     *
     * `stretch` fills the cross axis *minus* the margins, which is what a side
     * margin is meant to mean.
     */
    alignSelf: 'stretch',
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
