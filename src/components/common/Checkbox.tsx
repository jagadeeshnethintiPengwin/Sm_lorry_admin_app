import React, { memo } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Icon } from './Icon';
import { palette } from '@theme/colors';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * Two checkbox treatments appear in the mock:
 *
 *   terms (login)      : 16px, radius 4px, #0d2647 fill, white check (stroke 3.5)
 *   checklist (8b)     : 22px, radius 6px, #f5a623 fill, white check (stroke 3)
 *                        unchecked: #fff with 1.5px #e5e7eb border
 */
export type CheckboxProps = {
  checked: boolean;
  onValueChange?: (next: boolean) => void;
  size?: number;
  borderRadius?: number;
  checkedColor?: string;
  checkColor?: string;
  checkSize?: number;
  strokeWidth?: number;
  borderColor?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const CheckboxComponent: React.FC<CheckboxProps> = ({
  checked,
  onValueChange,
  size = 16,
  borderRadius = 4,
  checkedColor = palette.navy,
  checkColor = palette.white,
  checkSize,
  strokeWidth = 3.5,
  borderColor = palette.gray200,
  accessibilityLabel,
  style,
}) => {
  const box = (
    <View
      style={[
        styles.box,
        {
          width: s(size),
          height: s(size),
          borderRadius: s(borderRadius),
        },
        checked
          ? { backgroundColor: checkedColor }
          : {
              backgroundColor: palette.white,
              borderWidth: s(1.5),
              borderColor,
            },
        style,
      ]}
    >
      {checked ? (
        <Icon
          name="check"
          size={checkSize ?? size * 0.75}
          color={checkColor}
          strokeWidth={strokeWidth}
        />
      ) : null}
    </View>
  );

  if (!onValueChange) {
    return box;
  }

  return (
    <Pressable
      onPress={() => onValueChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {box}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: radius.xs,
  },
});

export const Checkbox = memo(CheckboxComponent);
Checkbox.displayName = 'Checkbox';
