import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { CenterModal } from './CenterModal';
import { Icon, IconName } from '@components/common/Icon';
import { RadialGlow } from '@components/common/RadialGlow';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * "Take photo / choose from gallery / attach a file" dialog.
 *
 * Centred rather than anchored to the bottom edge, and built from the app's own
 * tokens — navy/gold brand ramp, Plus Jakarta Sans, `.card` radii — so it reads
 * as part of the product rather than a system dialog.
 */
export type ImageSourceSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  /** Heading — e.g. `Attach Document`, `Loading Photos`. */
  title?: string;
  subtitle?: string;
  /**
   * Attach an existing file. Supplied only for document slots — the mock's
   * document inputs accept `image/*,application/pdf`, while photo slots are
   * images only.
   */
  onDocument?: () => void;
  /** Allow removing an already-uploaded file. */
  onRemove?: () => void;
};

type OptionProps = {
  icon: IconName;
  label: string;
  hint: string;
  gradient?: readonly string[];
  tileBg?: string;
  tileColor?: string;
  destructive?: boolean;
  onPress: () => void;
};

const Option: React.FC<OptionProps> = ({
  icon,
  label,
  hint,
  gradient,
  tileBg,
  tileColor = palette.navy,
  destructive = false,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${label}. ${hint}`}
    style={({ pressed }) => [
      styles.option,
      destructive && styles.optionDestructive,
      pressed && styles.optionPressed,
    ]}
  >
    {gradient ? (
      <LinearGradient
        colors={gradient as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.tile, shadows.goldSmall]}
      >
        <Icon name={icon} size={18} color={palette.white} />
      </LinearGradient>
    ) : (
      <View style={[styles.tile, { backgroundColor: tileBg }]}>
        <Icon name={icon} size={18} color={tileColor} />
      </View>
    )}

    <View style={styles.optionBody}>
      <Text style={destructive ? styles.optionLabelRed : styles.optionLabel}>
        {label}
      </Text>
      <Text style={styles.optionHint}>{hint}</Text>
    </View>

    <Icon
      name="chevron-right"
      size={15}
      color={destructive ? palette.redSoft : palette.slate400}
    />
  </Pressable>
);

const ImageSourceSheetComponent: React.FC<ImageSourceSheetProps> = ({
  visible,
  onClose,
  onCamera,
  onGallery,
  title = 'Add Photo',
  subtitle = 'Choose how you want to upload',
  onDocument,
  onRemove,
}) => (
  // No `inset`: the side margin is `CenterModal`'s, so this dialog and the
  // picker beside it cannot drift apart again.
  <CenterModal visible={visible} onClose={onClose} padding={0}>
    {/* Navy header cap — the brand moment that lifts this above a plain list */}
    <LinearGradient
      colors={gradients.navyHero as unknown as string[]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <RadialGlow size={110} color={palette.gold} opacity={0.28} top={-34} right={-24} />

      <View style={styles.headerIcon}>
        <Icon name="upload-cloud" size={20} color={palette.gold} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </LinearGradient>

    <View style={styles.body}>
      <Option
        icon="camera"
        label="Take Photo"
        hint="Use the camera"
        gradient={gradients.gold}
        onPress={onCamera}
      />
      <Option
        icon="image"
        label="Choose from Gallery"
        hint="Pick an existing photo"
        tileBg={palette.navyTint}
        tileColor={palette.navy}
        onPress={onGallery}
      />
      {onDocument ? (
        <Option
          icon="file-text"
          label="Choose Document"
          hint="Attach a PDF or image file"
          tileBg={palette.goldTint}
          tileColor={palette.gold}
          onPress={onDocument}
        />
      ) : null}
      {onRemove ? (
        <Option
          icon="x"
          label="Remove Current File"
          hint="Delete the uploaded copy"
          tileBg={palette.redTint}
          tileColor={palette.red}
          destructive
          onPress={onRemove}
        />
      ) : null}

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={({ pressed }) => [styles.cancel, pressed && styles.optionPressed]}
      >
        {/* Uppercase to match the tracking — 1.2 spacing on mixed case reads
            as a rendering fault rather than a deliberate micro-label. */}
        <Text style={styles.cancelText}>CANCEL</Text>
      </Pressable>
    </View>
  </CenterModal>
);

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: s(20),
    paddingBottom: s(18),
    paddingHorizontal: s(18),
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  headerIcon: {
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
  // Matches the picker's cap — smaller, tracked tight, hierarchy carried by
  // spacing rather than by shouting.
  title: font(13, '800', { color: palette.white, letterSpacing: -0.2 }),
  subtitle: {
    ...font(9, '600', { color: palette.white, letterSpacing: 0.2 }),
    opacity: 0.75,
    marginTop: s(3),
    textAlign: 'center',
  },

  body: { padding: s(14), gap: s(8) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    padding: s(11),
    backgroundColor: palette.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.xl,
    ...shadows.card,
  },
  optionDestructive: { borderColor: palette.redSoft },
  optionPressed: { opacity: 0.72 },
  tile: {
    width: s(38),
    height: s(38),
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionBody: { flex: 1, minWidth: 0 },
  optionLabel: font(11, '800', { color: palette.navy }),
  optionLabelRed: font(11, '800', { color: palette.red }),
  optionHint: {
    ...font(8, '600', { color: palette.slate500 }),
    marginTop: s(2),
  },

  /*
   * A footer action, not another row in the list.
   *
   * With a tinted fill and the option rows' radius it read as one more card in
   * the stack. Matching the picker's treatment — hairline above, no fill — is
   * what makes it the way out rather than the last item.
   */
  cancel: {
    marginTop: s(4),
    paddingTop: s(12),
    paddingBottom: s(2),
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.divider,
  },
  cancelText: font(10, '800', { color: palette.slate500, letterSpacing: 1.2 }),
});

export const ImageSourceSheet = memo(ImageSourceSheetComponent);
ImageSourceSheet.displayName = 'ImageSourceSheet';
