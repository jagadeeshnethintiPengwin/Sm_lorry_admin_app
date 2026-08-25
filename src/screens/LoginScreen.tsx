import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Button, Icon, Screen } from '@components/index';
import { useAppDispatch } from '@store/index';
import { login } from '@store/slices/auth.slice';
import { useTopInset } from '@hooks/useTopInset';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * Screen 2 — Owner Login.
 *
 * Email + password sign-in — the same credentials as the web panel. On success
 * the auth slice flips `isAuthenticated` and the navigator swaps to the app, so
 * there is nothing to navigate to by hand. (The OTP / PIN endpoints are
 * untouched on the server; this is only a change of front door.)
 */
export const LoginScreen: React.FC = () => {
  const topInset = useTopInset();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim().length > 3 && password.length >= 4;

  const signIn = useCallback(async () => {
    if (busy || !canSubmit) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await dispatch(login({ email: email.trim(), password })).unwrap();
    } catch (error) {
      setFailure(
        (error as Error)?.message ||
          'Could not sign in. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, canSubmit, dispatch, email, password]);

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
          <Text style={styles.label}>EMAIL</Text>
          <View style={styles.inputRow}>
            <View style={styles.fieldIcon}>
              <Icon name="mail" size={14} color={palette.navy} />
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@simhadritransport.in"
              placeholderTextColor={palette.slate400}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              style={styles.input}
              accessibilityLabel="Email address"
            />
          </View>

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputRow}>
            <View style={styles.fieldIcon}>
              <Icon name="lock" size={14} color={palette.navy} />
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={palette.slate400}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              onSubmitEditing={signIn}
              returnKeyType="go"
              style={styles.input}
              accessibilityLabel="Password"
            />
          </View>

          {failure ? (
            <View style={styles.failure} accessibilityLiveRegion="polite">
              <Icon name="alert-circle" size={12} color={palette.red} />
              <Text style={styles.failureText}>{failure}</Text>
            </View>
          ) : (
            <View style={styles.failureSpacer} />
          )}

          <Button
            label={busy ? 'Signing in…' : 'Sign In'}
            variant="gold"
            icon="arrow-right"
            loading={busy}
            disabled={busy || !canSubmit}
            onPress={signIn}
          />
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
              <Text style={styles.trustTitle}>Encrypted sign-in</Text>
              <Text style={styles.trustMeta}>Owner and staff access only</Text>
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
  /* The glyph tile on the left of each field — same navy chip as the +91 prefix. */
  fieldIcon: {
    paddingVertical: s(10),
    paddingHorizontal: s(11),
    backgroundColor: palette.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Holds the button in place whether or not the error line is showing. */
  failureSpacer: { marginBottom: s(4) },
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
