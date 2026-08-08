import React, { memo } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@theme/colors';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * The iOS-style toggle from the mock:
 *
 *   .switch          { width:38px; height:22px }
 *   .slider          { background:#cbd5e1; border-radius:22px; transition:0.2s }
 *   .slider::before  { height:16px; width:16px; left:3px; top:3px;
 *                      background:#fff; border-radius:50%;
 *                      box-shadow:0 2px 4px rgba(0,0,0,0.2) }
 *   input:checked + .slider          { background:#f5a623 }
 *   input:checked + .slider::before  { transform:translateX(16px) }
 */
export type ToggleProps = {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const TRACK_W = 38;
const TRACK_H = 22;
const KNOB = 16;
const KNOB_INSET = 3;
const TRAVEL = 16;

const ToggleComponent: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  style,
}) => {
  const progress = useDerivedValue(
    () => withTiming(value ? 1 : 0, { duration: 200 }),
    [value],
  );

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [palette.slate300, palette.gold],
    ),
  }));

  // `s()` runs on the JS runtime, so it must be resolved BEFORE the worklet:
  // calling it inside `useAnimatedStyle` would be a cross-runtime remote call.
  const travel = s(TRAVEL);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travel }],
  }));

  return (
    <Pressable
      onPress={disabled ? undefined : () => onValueChange?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.wrap, disabled && styles.disabled, style]}
    >
      <Animated.View style={[styles.track, trackStyle]} />
      <Animated.View style={[styles.knob, knobStyle]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: s(TRACK_W),
    height: s(TRACK_H),
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  track: {
    ...StyleSheet.absoluteFill,
    borderRadius: s(TRACK_H),
  },
  knob: {
    position: 'absolute',
    left: s(KNOB_INSET),
    width: s(KNOB),
    height: s(KNOB),
    borderRadius: s(KNOB) / 2,
    backgroundColor: palette.white,
    ...shadows.switchKnob,
  },
});

export const Toggle = memo(ToggleComponent);
Toggle.displayName = 'Toggle';
