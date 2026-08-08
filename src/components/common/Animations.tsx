import React, { memo, useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

import { s } from '@theme/metrics';

/**
 * Reanimated ports of the `@keyframes` blocks in `driver-app.html`.
 * Durations, delays and easing curves are matched 1:1 with the CSS.
 */

/* ------------------------------------------------------------------ *
 * @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.15 } }
 * animation: blink 1.2s infinite
 * ------------------------------------------------------------------ */
type BlinkDotProps = {
  size: number;
  color: string;
  /** `box-shadow:0 0 6px <color>` — rendered as a glow ring. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
};

const BlinkDotComponent: React.FC<BlinkDotProps> = ({
  size,
  color,
  glow = true,
  style,
}) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: s(size),
          height: s(size),
          borderRadius: s(size) / 2,
          backgroundColor: color,
        },
        glow
          ? {
              shadowColor: color,
              shadowOpacity: 0.9,
              shadowRadius: s(3),
              shadowOffset: { width: 0, height: 0 },
              elevation: 3,
            }
          : null,
        animatedStyle,
        style,
      ]}
    />
  );
};
export const BlinkDot = memo(BlinkDotComponent);

/* ------------------------------------------------------------------ *
 * @keyframes twinkle {
 *   0%,100% { opacity:0.2; transform:scale(0.7) }
 *   50%     { opacity:1;   transform:scale(1.2) }
 * }
 * animation: twinkle 2.4s infinite <delay>
 * ------------------------------------------------------------------ */
type TwinkleDotProps = {
  size: number;
  color: string;
  /** CSS animation-delay in seconds. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

const TwinkleDotComponent: React.FC<TwinkleDotProps> = ({
  size,
  color,
  delay = 0,
  style,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay * 1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.2, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1.2]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.absolute,
        {
          width: s(size),
          height: s(size),
          borderRadius: s(size) / 2,
          backgroundColor: color,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};
export const TwinkleDot = memo(TwinkleDotComponent);

/* ------------------------------------------------------------------ *
 * @keyframes radarPulse {
 *   0%   { transform:scale(0.5); opacity:0.6 }
 *   100% { transform:scale(1.4); opacity:0 }
 * }
 * animation: radarPulse 2.4s infinite <delay>
 * ------------------------------------------------------------------ */
type RadarRingProps = {
  /** Ring box size in design px. */
  size: number;
  borderColor: string;
  borderWidth?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

const RadarRingComponent: React.FC<RadarRingProps> = ({
  size,
  borderColor,
  borderWidth = 2,
  delay = 0,
  style,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay * 1000,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.5, 1.4]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          width: s(size),
          height: s(size),
          borderRadius: s(size) / 2,
          borderWidth: s(borderWidth),
          borderColor,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};
export const RadarRing = memo(RadarRingComponent);

/* ------------------------------------------------------------------ *
 * @keyframes pulseGlow — the CSS animates box-shadow spread. RN cannot
 * animate shadow spread, so the equivalent is a soft disc that breathes
 * in scale + opacity behind the element.
 * ------------------------------------------------------------------ */
type PulseGlowProps = {
  /** Duration in ms — 2400 / 2000 / 1800 / 1600 are used in the mock. */
  duration?: number;
  color: string;
  /** Base opacity of the glow disc (`opacity:0.2` / `0.25` / `0.28` in CSS). */
  opacity?: number;
  borderRadius?: number;
  /** Seconds of `animation-delay`, used to stagger a field of pucks. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

const PulseGlowComponent: React.FC<PulseGlowProps> = ({
  duration = 2400,
  color,
  opacity = 0.25,
  borderRadius,
  delay = 0,
  style,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay * 1000,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, duration, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [opacity, opacity * 1.45]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.14]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.fill,
        {
          backgroundColor: color,
          borderRadius: borderRadius ?? 9999,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};
export const PulseGlow = memo(PulseGlowComponent);

/* ------------------------------------------------------------------ *
 * @keyframes spin — used by loaders.
 * ------------------------------------------------------------------ */
export const useSpin = (duration = 1000) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [rotation, duration]);

  return useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
};

/* ------------------------------------------------------------------ *
 * Entrance helpers — "everything should feel premium".
 * ------------------------------------------------------------------ */
type FadeInProps = {
  children: React.ReactNode;
  /** ms */
  delay?: number;
  duration?: number;
  /** Distance to travel on the Y axis, in design px. */
  translateY?: number;
  style?: StyleProp<ViewStyle>;
};

const FadeInViewComponent: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 420,
  translateY = 12,
  style,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
    return () => cancelAnimation(progress);
  }, [progress, delay, duration]);

  // Resolved on the JS runtime — `s()` cannot be called inside a worklet.
  const offsetY = s(translateY);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [offsetY, 0]) },
    ],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
  );
};
export const FadeInView = memo(FadeInViewComponent);

const ScaleInViewComponent: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 420,
  style,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.back(1.4)) }),
    );
    return () => cancelAnimation(progress);
  }, [progress, delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value * 1.6, 1),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.82, 1]) }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
  );
};
export const ScaleInView = memo(ScaleInViewComponent);

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFill },
});

/* ------------------------------------------------------------------ *
 * @keyframes roadmove { from { translateX(0) } to { translateX(-44px) } }
 * animation: roadmove 1.2s linear infinite  — splash road lane markings
 * ------------------------------------------------------------------ */
export const useRoadMove = (distance = 44, duration = 1200) => {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(-s(distance), { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(offset);
  }, [offset, distance, duration]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));
};

/* ------------------------------------------------------------------ *
 * @keyframes truckBob {
 *   0%,100% { translateY(0) } 50% { translateY(-1px) }
 * }
 * animation: truckBob 2.4s ease-in-out infinite
 * ------------------------------------------------------------------ */
export const useTruckBob = (duration = 2400) => {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withRepeat(
      withSequence(
        withTiming(-s(1), {
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(offset);
  }, [offset, duration]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
};

/* ------------------------------------------------------------------ *
 * @keyframes loadbar { 0% { width:22% } 60% { width:78% } 100% { width:90% } }
 * animation: loadbar 2.4s ease-in-out infinite  — splash progress bar
 * ------------------------------------------------------------------ */
export const useLoadBar = (duration = 2400) => {
  const progress = useSharedValue(0.22);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(0.78, {
          duration: duration * 0.6,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0.9, {
          duration: duration * 0.4,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress, duration]);

  return useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
};
