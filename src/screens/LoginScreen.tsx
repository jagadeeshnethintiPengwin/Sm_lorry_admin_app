import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Icon, OtpInput, Screen } from '@components/index';
import { useAppDispatch } from '@store/index';
import { login, verifyTwoStep } from '@store/slices/auth.slice';
import { authService } from '@services/auth.service';
import type { TwoStepChallenge } from '@services/auth.service';
import type { RootStackParamList } from '@navigation/types';
import { useTopInset } from '@hooks/useTopInset';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/** Six empty boxes — the second step before anything is typed. */
const EMPTY_CODE = ['', '', '', '', '', ''];

/**
 * The one refusal the second step cannot recover from on its own.
 *
 * A wrong code, an expired code and too many attempts are all answered here,
 * by typing again or asking for a new code. "This sign-in has expired — enter
 * your email and password again." means the challenge itself is gone, so no
 * code can succeed and the only way on is the password. The server sends only
 * the sentence, so it is recognised by its wording; should that ever change,
 * the message still shows — on the code step rather than the password one.
 */
const SIGN_IN_EXPIRED = /email and password again/i;

/**
 * Screen 2 — Owner Login.
 *
 * Email + password sign-in — the same credentials as the web panel. On success
 * the auth slice flips `isAuthenticated` and the screen steps onto the app by
 * hand (see `enterApp`). (The OTP / PIN endpoints are untouched on the server;
 * this is only a change of front door.)
 *
 * With two-step sign-in on, a right password answers a challenge instead of a
 * session, and the same card turns into the second step: the six-digit code
 * the server has just emailed. No new route — "Use a different account" is the
 * way back, with the email still typed in.
 */
export const LoginScreen: React.FC = () => {
  const topInset = useTopInset();
  const dispatch = useAppDispatch();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim().length > 3 && password.length >= 4;

  /*
   * The second step, once the password has answered one. `null` is the email +
   * password form; a challenge swaps the card for the code boxes.
   */
  const [challenge, setChallenge] = useState<TwoStepChallenge | null>(null);
  const [code, setCode] = useState<string[]>(EMPTY_CODE);
  const [codeFailure, setCodeFailure] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  /* Seconds until "Resend code" is offered — seeded from `resendIn`. */
  const [seconds, setSeconds] = useState(0);
  /* Bumped to put the cursor back in the first box once they are emptied. */
  const [focusSignal, setFocusSignal] = useState(0);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }
    const timer = setTimeout(() => setSeconds(current => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  /**
   * Move to the app.
   *
   * The root stack does not watch `isAuthenticated` — it is a plain stack
   * fixed on `Auth`, and nothing anywhere reads that flag to navigate — so
   * a successful sign-in has to leave the auth flow by hand, the same way
   * the OTP screen and Splash already do. `reset`, like Splash on resume,
   * so the login stack is not left behind the dashboard for the back
   * gesture to reach.
   *
   * Without this the sign-in *worked* — a 201, the token stored, push
   * registered — and the screen simply sat there, so it read as "unable to
   * log in" when the only thing missing was the step onto the dashboard.
   *
   * Shared by both doors: a one-step password sign-in, and the emailed code.
   */
  const enterApp = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }, [navigation]);

  const signIn = useCallback(async () => {
    if (busy || !canSubmit) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const result = await dispatch(
        login({ email: email.trim(), password }),
      ).unwrap();
      if ('twoFactorRequired' in result) {
        /* Right password, but two-step is on: a code is on its way by email. */
        setChallenge(result);
        setSeconds(result.resendIn);
        setCode(EMPTY_CODE);
        setCodeFailure(null);
        setBusy(false);
        return;
      }
      enterApp();
    } catch (error) {
      setFailure(
        (error as Error)?.message ||
          'Could not sign in. Check your connection and try again.',
      );
      setBusy(false);
    }
  }, [busy, canSubmit, dispatch, email, enterApp, password]);

  /**
   * Back to email + password, with the email kept.
   *
   * The password is cleared: this is "a different account", or a sign-in that
   * has to start over, and either way the old one should not sit in the field.
   */
  const backToPassword = useCallback(() => {
    setChallenge(null);
    setPassword('');
    setCode(EMPTY_CODE);
    setCodeFailure(null);
    setSeconds(0);
    setVerifying(false);
    setFailure(null);
  }, []);

  /*
   * Android's back button steps back to the password rather than leaving the
   * app — the second step is the same route, so without this there is nothing
   * for back to return to.
   */
  useEffect(() => {
    if (!challenge) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        backToPassword();
        return true;
      },
    );
    return () => subscription.remove();
  }, [backToPassword, challenge]);

  /**
   * Checks the emailed code, and only signs in if the API agrees.
   *
   * A refusal empties the boxes and puts the cursor back in the first one, with
   * the server's own sentence underneath — it already says which it was: not
   * correct, expired, or too many attempts.
   */
  const verify = useCallback(
    async (entered: string) => {
      if (!challenge || verifying || entered.length !== EMPTY_CODE.length) {
        return;
      }
      setVerifying(true);
      setCodeFailure(null);
      try {
        await dispatch(
          verifyTwoStep({ challengeId: challenge.challengeId, code: entered }),
        ).unwrap();
        enterApp();
      } catch (error) {
        const message =
          (error as Error)?.message ||
          'That code was not accepted. Check it and try again.';
        if (SIGN_IN_EXPIRED.test(message)) {
          backToPassword();
          setFailure(message);
          return;
        }
        setCodeFailure(message);
        setCode(EMPTY_CODE);
        setFocusSignal(current => current + 1);
        setVerifying(false);
      }
    },
    [backToPassword, challenge, dispatch, enterApp, verifying],
  );

  /* Submits on the sixth digit — there is nothing left to type. */
  const changeCode = useCallback(
    (next: string[]) => {
      setCode(next);
      if (next.every(digit => digit !== '')) {
        verify(next.join(''));
      }
    },
    [verify],
  );

  const complete = code.every(digit => digit !== '');
  const waiting = seconds > 0 || resending;

  /**
   * Emails a fresh code.
   *
   * The answer is a new challenge, and the new code belongs to it — so it
   * replaces the one held here, and every verify from then on names it. The
   * countdown restarts only once the request succeeds, so a failed resend can
   * be retried straight away.
   */
  const resendCode = useCallback(async () => {
    if (!challenge || waiting || verifying) {
      return;
    }
    setResending(true);
    setCodeFailure(null);
    try {
      const next = await authService.resendTwoStep(challenge.challengeId);
      setChallenge(next);
      setSeconds(next.resendIn);
      setCode(EMPTY_CODE);
      setFocusSignal(current => current + 1);
    } catch (error) {
      const message =
        (error as Error)?.message ||
        'Could not send a new code. Check your connection and try again.';
      if (SIGN_IN_EXPIRED.test(message)) {
        backToPassword();
        setFailure(message);
        return;
      }
      setCodeFailure(message);
    } finally {
      setResending(false);
    }
  }, [backToPassword, challenge, verifying, waiting]);

  /* The server says 300 seconds; the sentence says it in minutes. */
  const minutes = challenge
    ? Math.max(1, Math.round((challenge.expiresIn || 300) / 60))
    : 0;

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
              source={require('@assets/images/admin-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="SMT Simhadri Transport — Admin"
            />
          </View>

          <View style={styles.crownChip}>
            <Icon
              name={challenge ? 'shield-check' : 'crown'}
              size={10}
              color={palette.gold}
            />
            <Text style={styles.crownText}>
              {challenge ? 'TWO-STEP SIGN IN' : 'OWNER SIGN IN'}
            </Text>
          </View>

          {challenge ? (
            <Text style={styles.title}>
              Check your <Text style={styles.titleGold}>email</Text>
            </Text>
          ) : (
            <Text style={styles.title}>
              Welcome back, <Text style={styles.titleGold}>Owner</Text>
            </Text>
          )}
        </View>

        {challenge ? (
          /* Second step — the code the server just emailed */
          <View style={styles.card}>
            <Text style={styles.lead}>
              We sent a 6-digit code to{' '}
              <Text style={styles.leadStrong}>{challenge.destination}</Text>. It
              expires in {minutes} {minutes === 1 ? 'minute' : 'minutes'}.
            </Text>

            {/*
              Only a development API with no mailer hands the code back;
              production never does, and a release build would not show it.
            */}
            {__DEV__ && challenge.devCode ? (
              <Text style={styles.devCode}>Dev code: {challenge.devCode}</Text>
            ) : null}

            <OtpInput
              value={code}
              onChange={changeCode}
              autoFocus
              focusSignal={focusSignal}
              editable={!verifying}
            />

            {codeFailure ? (
              <View style={styles.failure} accessibilityLiveRegion="polite">
                <Icon name="alert-circle" size={12} color={palette.red} />
                <Text style={styles.failureText}>{codeFailure}</Text>
              </View>
            ) : (
              <View style={styles.failureSpacer} />
            )}

            <Button
              label={verifying ? 'Verifying…' : 'Verify & Sign In'}
              variant="gold"
              icon="check"
              loading={verifying}
              disabled={!complete || verifying}
              onPress={() => verify(code.join(''))}
            />

            {/*
              `Text` links, like the OTP screen's resend line. The waiting
              state is the same link in a muted tone rather than a different
              shape, so the row keeps its layout while the countdown runs.
              Neither acts while a code is being checked.
            */}
            <View style={styles.stepLinks}>
              <Text
                style={
                  waiting || verifying ? styles.linkWaiting : styles.linkActive
                }
                onPress={waiting || verifying ? undefined : resendCode}
                suppressHighlighting={waiting || verifying}
                accessibilityRole="button"
                accessibilityLabel="Resend code"
                accessibilityState={{
                  disabled: waiting || verifying,
                  busy: resending,
                }}
              >
                {resending
                  ? 'Sending…'
                  : seconds > 0
                    ? `Resend in ${seconds}s`
                    : 'Resend code'}
              </Text>
              <Text
                style={verifying ? styles.linkWaiting : styles.linkNavy}
                onPress={verifying ? undefined : backToPassword}
                suppressHighlighting={verifying}
                accessibilityRole="button"
                accessibilityState={{ disabled: verifying }}
              >
                Use a different account
              </Text>
            </View>
          </View>
        ) : (
          /* Login card */
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
        )}

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
  /*
   * Sized for the admin lockup, which is about twice as wide as it is tall and
   * carries a line of small print — the old 90×34 box would have shrunk
   * "Transport Contractors Services" to nothing. The artwork brings its own
   * transparent margin, so the card's padding is trimmed to match.
   */
  logoCard: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    paddingVertical: s(4),
    paddingHorizontal: s(8),
    borderWidth: s(3),
    borderColor: alpha.gold25,
    ...shadows.loginLogo,
  },
  /* 707×353 source: the width sets the size and the ratio keeps it uncropped. */
  logo: { width: s(150), aspectRatio: 707 / 353 },
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

  /* Second step */
  lead: {
    ...font(10, '600', { lineHeight: 1.45, color: palette.slate500 }),
    textAlign: 'center',
    marginBottom: s(12),
  },
  leadStrong: font(10, '800', { color: palette.navy }),
  devCode: {
    ...font(9, '800', { color: palette.goldText, letterSpacing: 0.5 }),
    textAlign: 'center',
    marginTop: s(-6),
    marginBottom: s(10),
  },
  stepLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: s(12),
  },
  linkActive: font(10, '800', { color: palette.red }),
  linkWaiting: font(10, '800', { color: palette.slate400 }),
  linkNavy: font(10, '800', { color: palette.navy }),

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
