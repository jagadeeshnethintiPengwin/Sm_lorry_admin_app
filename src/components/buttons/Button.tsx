import React, { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Icon, IconName } from '@components/common/Icon';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The four button classes in the mock. All share:
 *
 *   display:flex; width:100%; padding:12px; border-radius:10px;
 *   font-size:13px; align-items:center; justify-content:center; gap:6px;
 *
 *   .btn-primary { background:#0d2647; color:#fff; font-weight:700 }
 *   .btn-red     { background:#dc2626; color:#fff; font-weight:700 }
 *   .btn-gold    { background:#f5a623; color:#0d2647; font-weight:800;
 *                  box-shadow:0 6px 16px rgba(245,166,35,0.35) }
 *   .btn-outline { background:#fff; color:#0d2647; font-weight:700;
 *                  border:1.5px solid #0d2647 }
 */
export type ButtonVariant = 'primary' | 'gold' | 'outline' | 'red' | 'ghost';

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  /** Lucide glyph rendered before the label. */
  icon?: IconName;
  /** Lucide glyph rendered after the label. */
  iconRight?: IconName;
  iconSize?: number;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Overrides `padding:12px`. */
  padding?: number;
  paddingHorizontal?: number;
  /** Overrides `font-size:13px`. */
  fontSize?: number;
  /** Overrides `gap:6px`. */
  gap?: number;
  /** `flex:1` / `flex:1.4` when sitting in a footer row. */
  flex?: number;
  /** Overrides the variant's foreground (icon + label) colour. */
  color?: string;
  /** Overrides the variant's background colour. */
  backgroundColor?: string;
  borderColor?: string;
  /** Replaces the variant's default shadow. */
  shadow?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Custom leading node (e.g. the blinking dot on "Go Online"). */
  leading?: React.ReactNode;
};

type VariantSpec = {
  bg: string;
  fg: string;
  weight: '700' | '800';
  border?: string;
  borderWidth?: number;
  shadow?: ViewStyle;
};

const VARIANTS: Record<ButtonVariant, VariantSpec> = {
  primary: { bg: palette.navy, fg: palette.white, weight: '700' },
  red: { bg: palette.red, fg: palette.white, weight: '700' },
  // customer-app.html: `.btn-gold` carries NO box-shadow (unlike the driver app)
  gold: { bg: palette.gold, fg: palette.navy, weight: '800' },
  outline: {
    bg: palette.white,
    fg: palette.navy,
    weight: '700',
    border: palette.navy,
    borderWidth: 1.5,
  },
  ghost: { bg: 'transparent', fg: palette.slate500, weight: '700' },
};

const ButtonComponent: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  icon,
  iconRight,
  iconSize = 16,
  onPress,
  disabled = false,
  loading = false,
  padding = 12,
  paddingHorizontal,
  fontSize = 13,
  gap = 6,
  flex,
  color,
  backgroundColor,
  borderColor,
  shadow,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
  leading,
}) => {
  const base = VARIANTS[variant];
  const spec: VariantSpec = {
    ...base,
    fg: color ?? base.fg,
    bg: backgroundColor ?? base.bg,
    border: borderColor ?? base.border,
  };
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, { damping: 18, stiffness: 320 });
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, { damping: 18, stiffness: 320 });
  }, [pressed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={isDisabled ? undefined : onPress}
      onPressIn={isDisabled ? undefined : onPressIn}
      onPressOut={isDisabled ? undefined : onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        {
          backgroundColor: spec.bg,
          paddingVertical: s(padding),
          paddingHorizontal:
            paddingHorizontal !== undefined ? s(paddingHorizontal) : s(padding),
          gap: s(gap),
        },
        spec.border
          ? { borderWidth: s(spec.borderWidth ?? 1.5), borderColor: spec.border }
          : null,
        shadow ?? spec.shadow,
        flex !== undefined ? { flex, width: undefined } : null,
        isDisabled ? styles.disabled : null,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spec.fg} />
      ) : (
        <>
          {leading}
          {icon ? <Icon name={icon} size={iconSize} color={spec.fg} /> : null}
          <Text
            style={[
              font(fontSize, spec.weight, { color: spec.fg }),
              textStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {iconRight ? (
            <Icon name={iconRight} size={iconSize} color={spec.fg} />
          ) : null}
        </>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  disabled: { opacity: 0.55 },
  // Multi-select chips — `padding:5px 10px; border-radius:14px`
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(5),
    paddingHorizontal: s(10),
    borderRadius: s(14),
    borderWidth: s(1.5),
  },
  chipOn: {
    backgroundColor: palette.goldTint,
    borderColor: palette.gold,
  },
  chipOff: {
    backgroundColor: palette.white,
    borderColor: palette.gray200,
  },
});

export const Button = memo(ButtonComponent);
Button.displayName = 'Button';

/**
 * The circular call buttons that recur in contact rows:
 *
 *   width:34px; height:34px; border-radius:50%; background:#f5a623
 */
export type IconButtonProps = {
  icon: IconName;
  size?: number;
  iconSize?: number;
  backgroundColor?: string;
  color?: string;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  onPress?: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

const IconButtonComponent: React.FC<IconButtonProps> = ({
  icon,
  size = 34,
  iconSize = 16,
  backgroundColor = palette.gold,
  color = palette.navy,
  borderRadius,
  borderColor,
  borderWidth,
  onPress,
  accessibilityLabel,
  style,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    style={({ pressed }) => [
      {
        width: s(size),
        height: s(size),
        borderRadius: borderRadius !== undefined ? s(borderRadius) : radius.full,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      },
      borderColor
        ? { borderWidth: s(borderWidth ?? 1), borderColor }
        : null,
      pressed ? { opacity: 0.75 } : null,
      style,
    ]}
  >
    <Icon name={icon} size={iconSize} color={color} />
  </Pressable>
);

export const IconButton = memo(IconButtonComponent);
IconButton.displayName = 'IconButton';

/**
 * The pill-shaped multi-select chips (`HMV`, `Telugu`, …):
 *
 *   padding:5px 10px; border-radius:14px; font-size:10px;
 *   selected  : background:#fff7e0; border:1.5px solid #f5a623; color:#8a5a00; weight 800
 *   unselected: background:#fff;     border:1.5px solid #e5e7eb; color:#0d2647; weight 700
 */
export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Renders the leading check glyph on selected chips. */
  showCheck?: boolean;
  style?: StyleProp<ViewStyle>;
};

const ChipComponent: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  showCheck = false,
  style,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    style={({ pressed }) => [
      styles.chip,
      selected ? styles.chipOn : styles.chipOff,
      pressed ? { opacity: 0.8 } : null,
      style,
    ]}
  >
    {selected && showCheck ? (
      <Icon name="check" size={12} color={palette.goldText} strokeWidth={3} />
    ) : null}
    <Text
      style={
        selected
          ? font(10, '800', { color: palette.goldText })
          : font(10, '700', { color: palette.navy })
      }
    >
      {label}
    </Text>
  </Pressable>
);

export const Chip = memo(ChipComponent);
Chip.displayName = 'Chip';
