import React, { useCallback, useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  Icon,
  ProgressBar,
  RadarRing,
  RadialGlow,
  Screen,
  TwinkleDot,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { AuthStackParamList } from '@navigation/types';

/**
 * Screen 1 — Splash.
 *
 *   navy field · gold + red ambient glows · two `radarPulse 2.4s` rings ·
 *   four `twinkle` dots · white logo card · OWNER · ADMIN crown chip ·
 *   "Manage Your Fleet" · red→gold loading bar
 *
 * The mock's bar is a static `width:82%`; here it fills 0→100 and then holds
 * for a second before advancing, matching the driver app's splash behaviour.
 */
const PROGRESS_DURATION = 2000;
const HOLD_AFTER_FILL = 1000;

export const SplashScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProgressComplete = useCallback(() => {
    holdTimer.current = setTimeout(
      () => navigation.replace('Login'),
      HOLD_AFTER_FILL,
    );
  }, [navigation]);

  useEffect(
    () => () => {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
      }
    },
    [],
  );

  return (
    <Screen backgroundColor={palette.navy}>
      <LinearGradient
        colors={gradients.navySplash as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.field}
      >
        {/* Ambient glows */}
        <RadialGlow
          size={200}
          color={palette.gold}
          opacity={0.32}
          top={60}
          right={-40}
        />
        <RadialGlow
          size={160}
          color={palette.red}
          opacity={0.25}
          bottom={80}
          left={-30}
        />

        {/* Radar rings */}
        <View style={styles.radar} pointerEvents="none">
          <RadarRing size={160} borderColor={alpha.gold35} />
          <RadarRing size={160} borderColor={alpha.gold35} delay={0.8} />
        </View>

        {/* Twinkles */}
        <TwinkleDot size={5} color={palette.gold} style={styles.twinkle1} />
        <TwinkleDot
          size={4}
          color={palette.white}
          delay={0.6}
          style={styles.twinkle2}
        />
        <TwinkleDot
          size={3}
          color={palette.gold}
          delay={1.2}
          style={styles.twinkle3}
        />
        <TwinkleDot
          size={3}
          color={palette.red}
          delay={1.6}
          style={styles.twinkle4}
        />

        {/* Logo card */}
        <View style={styles.logoCard}>
          <Image
            source={require('@assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="SMT Simhadri Transport"
          />
        </View>

        {/* Owner badge + tagline */}
        <View style={styles.taglineBlock}>
          <View style={styles.crownChip}>
            <Icon name="crown" size={12} color={palette.gold} />
            <Text style={styles.crownText}>OWNER · ADMIN</Text>
          </View>
          <Text style={styles.tagline}>Manage Your Fleet</Text>
          <Text style={styles.subTagline}>Trusted by 2,400+ drivers</Text>
        </View>

        {/* Loading */}
        <View style={styles.loading}>
          <ProgressBar
            progress={1}
            height={3}
            borderRadius={2}
            colors={gradients.progress}
            trackColor={alpha.white15}
            duration={PROGRESS_DURATION}
            delay={0}
            onComplete={handleProgressComplete}
          />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </LinearGradient>
    </Screen>
  );
};

const styles = StyleSheet.create({
  field: { flex: 1, position: 'relative', overflow: 'hidden' },

  twinkle1: { position: 'absolute', top: s(80), left: s(40) },
  twinkle2: { position: 'absolute', top: s(130), right: s(50) },
  twinkle3: { position: 'absolute', top: s(100), right: s(120) },
  twinkle4: { position: 'absolute', bottom: s(200), left: s(80) },

  radar: {
    position: 'absolute',
    top: s(170),
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  logoCard: {
    position: 'absolute',
    top: s(200),
    alignSelf: 'center',
    backgroundColor: palette.white,
    paddingVertical: s(14),
    paddingHorizontal: s(20),
    borderRadius: radius.x20,
    borderWidth: s(3),
    borderColor: alpha.gold25,
    ...shadows.splashLogo,
  },
  logo: { height: s(48), width: s(120) },

  taglineBlock: {
    position: 'absolute',
    top: s(310),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  crownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(4),
    paddingHorizontal: s(12),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: s(20),
  },
  crownText: font(9, '800', { color: palette.gold, letterSpacing: 2 }),
  tagline: {
    ...font(16, '800', { color: palette.white, letterSpacing: -0.3 }),
    marginTop: s(10),
  },
  subTagline: {
    ...font(10, '600', { color: alpha.white70 }),
    marginTop: s(4),
  },

  loading: { position: 'absolute', bottom: s(80), left: s(40), right: s(40) },
  loadingText: {
    ...font(9, '700', { color: alpha.white75 }),
    textAlign: 'center',
    marginTop: s(8),
  },
});
