import React, { memo, useCallback, useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { gradients } from '@theme/colors';
import { s } from '@theme/metrics';

const AnimatedLinearGradient =
  Animated.createAnimatedComponent(LinearGradient);

/**
 * The trip / splash progress bars:
 *
 *   track: height:5px; background:rgba(255,255,255,0.15); border-radius:3px
 *   fill : height:100%; width:21%;
 *          background:linear-gradient(90deg,#f5a623,#dc2626); border-radius:3px
 *
 * The fill animates from 0 to `progress` on mount so the bar "fills in",
 * matching the premium feel asked for in the brief.
 */
export type ProgressBarProps = {
  /** 0 – 1 */
  progress: number;
  height?: number;
  borderRadius?: number;
  trackColor?: string;
  /** Two-stop gradient for the fill. */
  colors?: readonly string[];
  /** Solid fill instead of a gradient. */
  fillColor?: string;
  /** Animation duration in ms. Pass 0 to render statically. */
  duration?: number;
  delay?: number;
  /**
   * Fired on the JS thread once the fill reaches `progress`. Not called when
   * the animation is interrupted, or when `duration` is 0.
   */
  onComplete?: () => void;
  style?: StyleProp<ViewStyle>;
};

const ProgressBarComponent: React.FC<ProgressBarProps> = ({
  progress,
  height = 5,
  borderRadius = 3,
  trackColor = 'rgba(255,255,255,0.15)',
  colors = gradients.progress,
  fillColor,
  duration = 900,
  delay = 180,
  onComplete,
  style,
}) => {
  const value = useSharedValue(duration === 0 ? progress : 0);

  // Kept in a ref so the worklet callback never captures a stale closure and
  // the effect does not re-run just because the parent re-rendered.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const notifyComplete = useCallback(() => {
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    if (duration === 0) {
      value.value = progress;
      return;
    }
    value.value = withDelay(
      delay,
      withTiming(
        progress,
        { duration, easing: Easing.out(Easing.cubic) },
        finished => {
          // Runs on the UI runtime — hop back to JS before calling the callback.
          if (finished) {
            runOnJS(notifyComplete)();
          }
        },
      ),
    );
    return () => cancelAnimation(value);
  }, [progress, duration, delay, value, notifyComplete]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, value.value)) * 100}%`,
  }));

  const trackStyle: ViewStyle = {
    height: s(height),
    borderRadius: s(borderRadius),
    backgroundColor: trackColor,
    overflow: 'hidden',
  };

  return (
    <View
      style={[trackStyle, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      {fillColor ? (
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: fillColor, borderRadius: s(borderRadius) },
            fillStyle,
          ]}
        />
      ) : (
        <AnimatedLinearGradient
          colors={colors as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.fill,
            { borderRadius: s(borderRadius) },
            fillStyle,
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { height: '100%' },
});

export const ProgressBar = memo(ProgressBarComponent);
ProgressBar.displayName = 'ProgressBar';
