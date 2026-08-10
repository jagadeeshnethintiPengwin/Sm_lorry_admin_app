import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Icon } from '@components/common/Icon';
import { RadialGlow } from '@components/common/RadialGlow';
import { CenterModal } from '@components/modals/CenterModal';
import { FieldError, FieldLabel } from './Input';
import { gradients, palette } from '@theme/colors';
import { font, typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s, wp } from '@theme/metrics';

/**
 * `select.f7b-input` from the mock. The CSS renders a native `<select>` with a
 * chevron painted via an inline SVG background:
 *
 *   appearance:none; background-image:url('…polyline 6 9 12 15 18 9…');
 *   background-position:right 10px center; padding-right:28px;
 *
 * RN has no native inline picker, so the control keeps the exact closed-state
 * appearance and opens an action-sheet styled to match the app.
 */
export type SelectOption = { label: string; value: string };

export type SelectProps = {
  label?: string;
  required?: boolean;
  options: SelectOption[];
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  marginBottom?: number;
  /** `padding-right:28px` vs `24px` in the two-column variants. */
  paddingRight?: number;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Why this field was rejected, shown beneath it in red. */
  error?: string;
};

const SelectComponent: React.FC<SelectProps> = ({
  label,
  required = false,
  options,
  value,
  placeholder = 'Select',
  onChange,
  marginBottom = 0,
  paddingRight = 28,
  containerStyle,
  style,
  error,
}) => {
  const [open, setOpen] = useState(false);

  /**
   * Opening the picker puts the keyboard away first.
   *
   * An open keyboard is drawn over the lower half of any modal. The options
   * underneath are still in the view tree and still report themselves as
   * tappable — but the keyboard window takes the touch before the modal ever
   * sees it, so they simply cannot be chosen.
   *
   * On a seven-option list opened from the field above it, that was five of
   * the seven: tapping them dismissed the picker and left the previous value.
   * A picker accepts no typing, so there is nothing the keyboard is for here.
   */
  const openPicker = useCallback(() => {
    Keyboard.dismiss();
    setOpen(true);
  }, []);

  const selected = useMemo(
    () => options.find(o => o.value === value),
    [options, value],
  );

  const handleSelect = useCallback(
    (option: SelectOption) => {
      onChange?.(option.value);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <View style={[{ marginBottom: s(marginBottom) }, containerStyle]}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}

      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={
          error ? `${label ?? placeholder}, ${error}` : (label ?? placeholder)
        }
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        style={[
          styles.control,
          { paddingRight: s(paddingRight) },
          error ? styles.controlInvalid : null,
          style,
        ]}
      >
        <Text
          style={selected ? styles.valueText : styles.placeholderText}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <View style={styles.chevron}>
          {/* `<polyline points="6 9 12 15 18 9"/>` == chevron-down */}
          <Icon name="chevron-right" size={12} color={palette.slate400} />
        </View>
      </Pressable>

      <FieldError>{error}</FieldError>

      <CenterModal
        visible={open}
        onClose={() => setOpen(false)}
        padding={0}
        style={styles.dialog}
      >
        {/*
          The same navy cap the Upload Document dialog wears.

          This picker used to be a plain white drawer with a grip and a red
          caption, which read as a different app to the dialog one field below
          it. Sharing the header, the card rows and the tile treatment makes
          the two feel like one product — and being centred rather than
          bottom-anchored sidesteps the drawer's other problem entirely: a
          sheet welded to the bottom of the screen sat 204px clear of it,
          because a modal lays its contents out inside the app's content area
          while its window covers the display.
        */}
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
          <View style={styles.headerIcon}>
            <Icon name="chevron-down" size={20} color={palette.gold} />
          </View>
          <Text style={styles.headerTitle}>{label ?? 'Select'}</Text>
          <Text style={styles.headerSubtitle}>
            {selected ? selected.label : `${options.length} to choose from`}
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {options.map(option => {
              const isActive = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelect(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={({ pressed }) => [
                    styles.option,
                    isActive ? styles.optionActive : null,
                    pressed ? styles.optionPressed : null,
                  ]}
                >
                  <View
                    style={[
                      styles.optionTile,
                      isActive ? styles.optionTileActive : null,
                    ]}
                  >
                    <Icon
                      name={isActive ? 'check' : 'chevron-right'}
                      size={14}
                      color={isActive ? palette.white : palette.slate400}
                      strokeWidth={isActive ? 3 : 2}
                    />
                  </View>

                  <Text
                    style={isActive ? styles.optionLabelOn : styles.optionLabel}
                    numberOfLines={2}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close picker"
            style={({ pressed }) => [
              styles.cancel,
              pressed ? styles.optionPressed : null,
            ]}
          >
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>
        </View>
      </CenterModal>
    </View>
  );
};

const styles = StyleSheet.create({
  control: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(9),
    paddingLeft: s(11),
    backgroundColor: palette.white,
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    borderRadius: radius.md,
  },
  controlInvalid: {
    borderColor: palette.red,
  },
  valueText: {
    ...typography.input,
    color: palette.navy,
    flex: 1,
  },
  placeholderText: {
    ...font(11, '500', { color: palette.slate400 }),
    flex: 1,
  },
  chevron: {
    position: 'absolute',
    right: s(10),
    // The CSS chevron points down; the shared glyph points right.
    transform: [{ rotate: '90deg' }],
  },
  /** A share of the screen, matching the Upload Document dialog. */
  dialog: { marginHorizontal: wp(5) },

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
    width: s(46),
    height: s(46),
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,166,35,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,166,35,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(10),
  },
  headerTitle: font(15, '800', { color: palette.white }),
  headerSubtitle: {
    ...font(10, '600', { color: palette.white }),
    opacity: 0.8,
    marginTop: s(3),
    textAlign: 'center',
  },

  body: { padding: s(14), gap: s(8) },
  /*
   * Capped so a long catalogue scrolls inside the card instead of pushing the
   * dialog off the screen — seven vehicle types already reach further than a
   * short handset has room for.
   */
  list: { maxHeight: s(300) },
  listContent: { gap: s(8), paddingBottom: s(2) },

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
  optionActive: {
    backgroundColor: palette.goldTint,
    borderColor: palette.gold,
  },
  optionPressed: { opacity: 0.72 },
  optionTile: {
    width: s(34),
    height: s(34),
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
    flexShrink: 0,
  },
  optionTileActive: { backgroundColor: palette.gold },
  optionLabel: {
    ...font(12, '600', { color: palette.navy }),
    flex: 1,
    minWidth: 0,
  },
  optionLabelOn: {
    ...font(12, '800', { color: palette.navy }),
    flex: 1,
    minWidth: 0,
  },

  cancel: {
    marginTop: s(2),
    paddingVertical: s(12),
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceAlt,
  },
  cancelText: font(12, '800', { color: palette.slate500 }),
});

export const Select = memo(SelectComponent);
Select.displayName = 'Select';
