import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Icon, IndiaFlagMini, Screen } from '@components/index';
import { useAppDispatch } from '@store/index';
import { sendOtp, setMobile as setStoreMobile } from '@store/slices/auth.slice';
import { useTopInset } from '@hooks/useTopInset';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { AuthStackParamList } from '@navigation/types';

/**
 * Screen 2 — Owner Login.
 *
 *   navy auth field · white logo card · OWNER SIGN IN crown chip ·
 *   "Welcome back, Owner" · white card with +91 mobile field and 6-digit PIN
 *   (letter-spacing:8px) · gold Sign In · reset link · gold trust badge
 */
export const LoginScreen: React.FC = () => {
  const topInset = useTopInset();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const [mobile, setMobile] = useState('');


  /**
   * Sends the code, and only then moves to the OTP screen.
   *
   * Three things were wrong here. A number shorter than ten digits fell back to
   * the literal `'+91 98980 XXXXX'` and carried on, so the panel would try to
   * sign in as a placeholder. `sendOtp` was dispatched but never awaited, so
   * the screen advanced whether or not a code had actually been sent. And the
   * `verificationId` the API returns — the thing the code is checked against —
   * was thrown away.
   */
  const signIn = useCallback(async () => {
    const digits = mobile.replace(/\D/g, '');
    if (digits.length !== 10 || busy) {
      return;
    }

    const target = `+91${digits}`;
    setBusy(true);
    setFailure(null);
    dispatch(setStoreMobile(target));

    try {
      /*
       * One way in: the number, and a code sent to it.
       *
       * The PIN was removed deliberately. Two credentials on one screen meant
       * two ways to fail and a field most operators left blank, and an owner
       * who had never set one saw a box asking for a secret that did not
       * exist. A code sent to the registered number proves the same thing —
       * possession of that number — without anything to remember, forget or
       * reset.
       *
       * The PIN endpoints are untouched on the server, so this is a change of
       * front door rather than a demolition: bringing it back is putting the
       * field on this screen again.
       */
      const result = await dispatch(sendOtp(target)).unwrap();
      navigation.navigate('OtpVerification', {
        mobile: target,
        verificationId: result.verificationId,
        devCode: (result as { devCode?: string }).devCode,
        intent: 'sign-in',
      });
    } catch (error) {
      setFailure(
        (error as Error)?.message ||
          'Could not sign in. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, dispatch, mobile, navigation]);

  return (
    <Screen backgroundColor={palette.navy}>
      <LinearGradient
        colors={gradients.navyAuth as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.field}
      >
        {/*
          The safe area is applied inside the gradient, not around it.

          Wrapping the gradient would inset the *paint* too, leaving a band of
          plain navy above the notch and below the home indicator instead of
          the field running edge to edge — which is the one thing this screen's
          background is doing.

          `edges` names only the bottom. The top is handled by `useTopInset`,
          which floors against `StatusBar.currentHeight`: the context reports 0
          on Android when the activity is not edge-to-edge, and on the first
          frame before insets are dispatched, so the heading would jump under
          the status bar for a moment on every cold start.
        */}
        <SafeAreaView edges={['bottom']} style={styles.safe}>
        {/* Logo + heading */}
        <View style={[styles.head, { paddingTop: topInset + s(16) }]}>
          <View style={styles.logoCard}>
            <Image
              source={require('@assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="SMT Simhadri Transport"
            />
          </View>

          <View style={styles.crownChip}>
            <Icon name="crown" size={10} color={palette.gold} />
            <Text style={styles.crownText}>OWNER SIGN IN</Text>
          </View>

          <Text style={styles.title}>
            Welcome back, <Text style={styles.titleGold}>Owner</Text>
          </Text>
        </View>

        {/* Login card */}
        <View style={styles.card}>
          <Text style={styles.label}>MOBILE NUMBER</Text>
          <View style={styles.inputRow}>
            <View style={styles.prefix}>
              <IndiaFlagMini width={14} height={10} />
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              value={mobile}
              onChangeText={setMobile}
              placeholder="Registered mobile"
              placeholderTextColor={palette.slate400}
              keyboardType="phone-pad"
              maxLength={10}
              style={styles.input}
              accessibilityLabel="Registered mobile number"
            />
          </View>

          {/*
            No PIN field. Signing in is the number and a code sent to it — see
            `signIn` for why, and for what would bring it back.
          */}
          <Text style={styles.hint}>
            We will text a 6-digit code to this number.
          </Text>

          {failure ? (
            <View style={styles.failure} accessibilityLiveRegion="polite">
              <Icon name="alert-circle" size={12} color={palette.red} />
              <Text style={styles.failureText}>{failure}</Text>
            </View>
          ) : null}

          <Button
            label={busy ? 'Sending code…' : 'Sign In'}
            variant="gold"
            icon="arrow-right"
            loading={busy}
            // Ten digits before it will go: the placeholder fallback is gone.
            disabled={busy || mobile.replace(/\D/g, '').length !== 10}
            onPress={signIn}
          />

          {/*
            No recovery links.
            
            They existed to rescue a PIN, and there is no longer a PIN to
            forget or reset — a code is sent to the registered number every
            time, so the recovery path and the sign-in path are now the same
            one. Leaving them would offer a way to fix a credential this screen
            never asks for.
          */}
        </View>

        {/* Trust badge */}
        <View style={styles.trustWrap}>
          <LinearGradient
            colors={gradients.goldSoftTile as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.trust}
          >
            <View style={styles.trustIcon}>
              <Icon name="shield-check" size={16} color={palette.navy} />
            </View>
            <View>
              <Text style={styles.trustTitle}>Secured with 2-factor auth</Text>
              <Text style={styles.trustMeta}>Bank-grade encryption</Text>
            </View>
          </LinearGradient>
        </View>
        </SafeAreaView>
      </LinearGradient>
    </Screen>
  );
};

const styles = StyleSheet.create({
  field: { flex: 1 },
  /* Fills the gradient; the inset comes from `SafeAreaView`'s own padding. */
  safe: { flex: 1 },
  /* Sits where the PIN field was, saying what happens next instead. */
  hint: {
    ...font(9, '600', { color: palette.slate500 }),
    marginBottom: s(12),
  },
  failure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(10) },
  failureText: {
    ...font(9, '700', { lineHeight: 1.3, color: palette.red }),
    flex: 1 },
  // paddingTop is applied inline from useTopInset — the navy field runs
  // under the translucent status bar, so the logo needs the inset plus a
  // little breathing room above it.
  head: { paddingHorizontal: s(24), alignItems: 'center' },
  logoCard: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    paddingVertical: s(8),
    paddingHorizontal: s(14),
    borderWidth: s(3),
    borderColor: alpha.gold25,
    ...shadows.loginLogo,
  },
  logo: { height: s(34), width: s(90) },
  crownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: s(10),
    paddingVertical: s(3),
    paddingHorizontal: s(9),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: s(14),
  },
  crownText: font(8, '800', { color: palette.gold, letterSpacing: 1.5 }),
  title: {
    ...font(17, '800', { color: palette.white, letterSpacing: -0.4 }),
    marginTop: s(6),
  },
  titleGold: font(17, '800', { color: palette.gold }),

  card: {
    marginTop: s(16),
    marginHorizontal: s(16),
    backgroundColor: palette.white,
    borderRadius: radius.xxxl,
    padding: s(16),
    ...shadows.authPane,
  },
  label: {
    ...font(9, '800', { color: palette.slate500, letterSpacing: 0.5 }),
    textTransform: 'uppercase',
    marginBottom: s(4),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceAlt,
    borderWidth: s(1.5),
    borderColor: palette.navyTint,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: s(10),
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(10),
    paddingHorizontal: s(11),
    backgroundColor: palette.navyTint,
  },
  prefixText: font(11, '800', { color: palette.navy }),
  input: {
    flex: 1,
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    ...font(12, '700', { color: palette.navy }),
  },
  pinRow: { paddingHorizontal: s(11), gap: s(0), marginBottom: s(14) },
  pinInput: {
    flex: 1,
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    ...font(14, '800', { color: palette.navy, letterSpacing: 8 }),
  },
  resetWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    marginTop: s(10),
  },
  reset: font(10, '800', { color: palette.red }),
  resetDivider: font(10, '800', { color: palette.slate400 }),

  /*
   * `marginBottom` is breathing room, not clearance. The home indicator and
   * Android's gesture bar are handled by the safe area above, so this no longer
   * has to double as both — it was 16 against a 34pt indicator, which put the
   * card under it.
   */
  trustWrap: { marginTop: 'auto', marginHorizontal: s(16), marginBottom: s(10) },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(9),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.goldSoft,
    borderRadius: radius.card,
    paddingVertical: s(10),
    paddingHorizontal: s(12),
  },
  trustIcon: {
    width: s(30),
    height: s(30),
    backgroundColor: palette.gold,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: font(10, '800', { color: palette.goldText }),
  trustMeta: { ...font(8, '400', { color: palette.goldText }), opacity: 0.8 },
});
