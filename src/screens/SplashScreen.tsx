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
import { authService } from '@services/auth.service';
import { session } from '@services/storage';
import { connectRealtime } from '@services/realtime';
import { registerForPush } from '@services/push';
import { ApiError } from '@services/api.client';
import type { AuthStackParamList, RootStackParamList } from '@navigation/types';

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
  // `Tabs` belongs to the root navigator; this screen sits in the Auth stack
  // nested inside it, so resuming has to be addressed one level up.
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Whether the stored session still works — settled while the bar fills.
   *
   * A token in storage is not proof of anything on its own. It can be expired,
   * or revoked by a logout on another device, which the opaque tokens the API
   * now issues make possible at any time. Walking an owner into a dashboard on
   * a dead token is worse than asking them to sign in: every panel would load
   * empty and the reason would be invisible.
   *
   * So the check runs against the server, and it runs *in parallel* with the
   * splash animation rather than after it — the request costs no extra waiting,
   * because the bar has to fill anyway.
   */
  const resumable = useRef<Promise<boolean> | null>(null);
  if (resumable.current === null) {
    resumable.current = (async () => {
      // Synchronous, thanks to MMKV: no session, no request.
      if (!session.hasSession()) {
        return false;
      }
      try {
        await authService.getProfile();
        /*
         * A resumed session never passes through sign-in, so this is the only
         * place the socket gets opened for someone who was already logged in —
         * which is most launches.
         */
        connectRealtime();
        /* A resumed session is most launches — the token still has to be current. */
        registerForPush().catch(() => undefined);
        return true;
      } catch (error) {
        /*
         * Only the server gets to say a session is over.
         *
         * This used to clear storage on *any* failure, which meant an
         * unreachable API — a dropped tunnel, a laptop asleep, a lift with no
         * signal — destroyed a perfectly good login and made the owner sign in
         * again. A network error is the app failing to ask the question, not
         * an answer of "no".
         *
         * 401/403 is the answer of "no": expired, revoked from another device,
         * or the account deactivated. That, and only that, clears the token.
         */
        const status = error instanceof ApiError ? error.status : undefined;
        if (status === 401 || status === 403) {
          session.clear();
          return false;
        }

        /*
         * Anything else — offline, timed out, the API returning 500 — leaves
         * the token where it is and lets them through. It has not been
         * rejected, and every screen behind here reports its own failure with
         * a retry, which is a far better place to find out the server is down
         * than a login form that will not accept anyone either.
         */
        return true;
      }
    })();
  }

  const handleProgressComplete = useCallback(() => {
    holdTimer.current = setTimeout(async () => {
      const canResume = await resumable.current;
      if (canResume) {
        // `reset`, not `replace` — the sign-in stack must not stay behind the
        // dashboard for the back gesture to reach.
        rootNavigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      } else {
        navigation.replace('Login');
      }
    }, HOLD_AFTER_FILL);
  }, [navigation, rootNavigation]);

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
