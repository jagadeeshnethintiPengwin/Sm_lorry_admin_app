import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Icon } from '@components/common/Icon';
import { FieldLabel } from './Input';
import { palette } from '@theme/colors';
import { font, typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

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
}) => {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

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

  const renderItem = useCallback(
    ({ item }: { item: SelectOption }) => {
      const isActive = item.value === value;
      return (
        <Pressable
          onPress={() => handleSelect(item)}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive }}
          style={({ pressed }) => [
            styles.option,
            isActive ? styles.optionActive : null,
            pressed ? { opacity: 0.7 } : null,
          ]}
        >
          <Text
            style={
              isActive
                ? font(12, '800', { color: palette.navy })
                : font(12, '600', { color: palette.navy })
            }
          >
            {item.label}
          </Text>
          {isActive ? (
            <Icon name="check" size={14} color={palette.gold} strokeWidth={3} />
          ) : null}
        </Pressable>
      );
    },
    [handleSelect, value],
  );

  return (
    <View style={[{ marginBottom: s(marginBottom) }, containerStyle]}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        style={[styles.control, { paddingRight: s(paddingRight) }, style]}
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

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        // Without this the Modal window stops above the Android navigation
        // bar, leaving a strip of the screen behind showing under the sheet.
        // Requires statusBarTranslucent; RN warns if it is missing.
        navigationBarTranslucent
      >
        <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close picker"
          />
          <Animated.View
            entering={SlideInDown.duration(260)}
            style={[styles.sheet, { paddingBottom: insets.bottom + s(12) }]}
          >
            <View style={styles.handle} />
            {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
            <FlatList
              data={options}
              keyExtractor={item => item.value}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              bounces={false}
            />
          </Animated.View>
        </Animated.View>
      </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: s(16),
    paddingTop: s(12),
    maxHeight: '70%',
    ...shadows.bottomSheet,
  },
  handle: {
    width: s(36),
    height: s(4),
    backgroundColor: palette.gray200,
    borderRadius: s(2),
    alignSelf: 'center',
    marginBottom: s(14),
  },
  sheetTitle: {
    ...typography.sectionLabel,
    color: palette.red,
    textTransform: 'uppercase',
    marginBottom: s(10),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  optionActive: { backgroundColor: palette.goldTint },
});

export const Select = memo(SelectComponent);
Select.displayName = 'Select';
