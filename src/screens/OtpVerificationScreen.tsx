import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputInstance,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Callout, Icon, RadarRing, Screen } from '@components/index';
import { useAppDispatch } from '@store/index';
import { verifyOtp } from '@store/slices/auth.slice';
import { useTopInset } from '@hooks/useTopInset';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { AuthStackParamList, RootStackParamList } from '@navigation/types';

/**
 * Screen 3 — OTP Verification.
 *
 *   gold shield-check tile with a `radarPulse 2s` halo · "Verify it's you" ·
 *   phone chip · white card with six 36×46 boxes (filled = gold border on
 *   #fff7e0) · gold Verify & Continue · "Resend in 32s" · gold expiry note
 */
const CODE_LENGTH = 6;
const RESEND_SECONDS = 32;

/**
 * Empty, every box.
 *
 * The design mock drew `9 2 4 8` typed in to illustrate the filled state, and
 * that literal was left in as the initial value — so the screen opened with
 * four digits of somebody's example code already entered. Two taps then
 * submitted a code the owner never received and never chose.
 */
const INITIAL_CODE = ['', '', '', '', '', ''];

export const OtpVerificationScreen: React.FC = () => {
  const topInset = useTopInset();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<AuthStackParamList & RootStackParamList>
    >();
  const route = useRoute<RouteProp<AuthStackParamList, 'OtpVerification'>>();
  const dispatch = useAppDispatch();

  const [code, setCode] = useState<string[]>(INITIAL_CODE);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // `TextInputInstance`, not `TextInput`: as of React Native 0.87 the name
  // `TextInput` used in type position is the component, not what a ref to one
  // holds, so it no longer carries `focus`/`blur`.
  const inputs = useRef<Array<TextInputInstance | null>>([]);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }
    const timer = setTimeout(() => setSeconds(current => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const handleChange = useCallback((value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    setCode(current => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !code[index] && index > 0) {
        inputs.current[index - 1]?.focus();
      }
    },
    [code],
  );

  const complete = useMemo(() => code.every(digit => digit !== ''), [code]);

  /**
   * Checks the code, and only signs in if the API agrees.
   *
   * This dispatched and then navigated on the next line, without awaiting
   * either — so any six digits opened the dashboard. The panel looked signed
   * in while holding no token, and the first real request would 401. It also
   * posted the literal `'mock-verification'` as the challenge id, so even a
   * correct code was being checked against nothing.
   */
  const verify = useCallback(async () => {
    if (!complete || busy) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const entered = code.join('');

      /*
       * A reset does not verify here.
       *
       * Forgot PIN sends the operator through this same screen, but the code
       * has to be spent by `pin/reset` together with the new PIN — verifying
       * it now would consume the challenge and leave the reset holding a code
       * the API has already marked used. So the digits are carried forward and
       * checked once, at the point they actually buy something.
       */
      if (route.params.intent === 'reset-pin') {
        navigation.replace('ResetPin', {
          mobile: route.params.mobile,
          verificationId: route.params.verificationId,
          code: entered,
        });
        return;
      }

      await dispatch(
        verifyOtp({
          mobile: route.params.mobile,
          code: entered,
          verificationId: route.params.verificationId,
        }),
      ).unwrap();
      navigation.replace('Tabs', { screen: 'Home' });
    } catch (error) {
      setFailure(
        (error as Error)?.message ||
          'That code was not accepted. Check it and try again.',
      );
      setCode(INITIAL_CODE);
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    code,
    complete,
    dispatch,
    navigation,
    route.params.intent,
    route.params.mobile,
    route.params.verificationId,
  ]);

  return (
    <Screen backgroundColor={palette.navy}>
      <LinearGradient
        colors={gradients.navyAuth as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.field}
      >
        <View style={[styles.head, { paddingTop: topInset + s(16) }]}>
          <View style={styles.shield}>
            <View style={styles.halo} pointerEvents="none">
              <RadarRing size={72} borderColor={alpha.gold25} />
            </View>
            <Icon name="shield-check" size={28} color={palette.gold} />
          </View>

          <Text style={styles.title}>Verify it&apos;s you</Text>

          <View style={styles.phoneChip}>
            <Icon name="phone" size={12} color={palette.gold} />
            <Text style={styles.phoneText}>{route.params.mobile}</Text>
          </View>
        </View>

        {/* Code card */}
        <View style={styles.card}>
          <Text style={styles.hint}>Enter the 6-digit code we sent</Text>

          <View style={styles.boxes}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={element => {
                  inputs.current[index] = element;
                }}
                value={digit}
                onChangeText={value => handleChange(value, index)}
                onKeyPress={event => handleKeyPress(event.nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                placeholder="•"
                placeholderTextColor={palette.slate400}
                style={[styles.box, digit ? styles.boxFilled : null]}
                accessibilityLabel={`Digit ${index + 1} of ${CODE_LENGTH}`}
              />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          {failure ? (
            <View style={styles.failure} accessibilityLiveRegion="polite">
              <Icon name="alert-circle" size={12} color={palette.red} />
              <Text style={styles.failureText}>{failure}</Text>
            </View>
          ) : null}

          <Button
            label={busy ? 'Verifying…' : 'Verify & Continue'}
            variant="gold"
            icon="check"
            loading={busy}
            disabled={!complete || busy}
            onPress={verify}
          />

          <Text style={styles.resend}>
            Didn&apos;t receive?{' '}
            <Pressable
              onPress={() => setSeconds(RESEND_SECONDS)}
              disabled={seconds > 0}
              accessibilityRole="button"
              accessibilityLabel="Resend code"
            >
              <Text style={styles.resendLink}>
                {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
              </Text>
            </Pressable>
          </Text>
        </View>

        <View style={styles.noteWrap}>
          <Callout
            icon="lock"
            iconSize={14}
            iconColor={palette.gold}
            text="Code expires in 5 minutes · Encrypted end-to-end"
            backgroundColor={palette.goldTint}
            borderColor={palette.goldSoft}
            textColor={palette.goldText}
            borderRadius={radius.lg}
            paddingVertical={9}
            paddingHorizontal={12}
            marginBottom={0}
          />
        </View>
      </LinearGradient>
    </Screen>
  );
};

const styles = StyleSheet.create({
  field: { flex: 1 },
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
  shield: {
    width: s(60),
    height: s(60),
    backgroundColor: alpha.gold20,
    borderWidth: s(1.5),
    borderColor: alpha.gold40,
    borderRadius: radius.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(10),
  },
  halo: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: font(19, '800', { color: palette.white, letterSpacing: -0.4 }),
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    marginTop: s(6),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    backgroundColor: alpha.white15,
    borderRadius: s(14),
  },
  phoneText: font(11, '800', { color: palette.white }),

  card: {
    marginTop: s(20),
    marginHorizontal: s(16),
    backgroundColor: palette.white,
    borderRadius: radius.xxxl,
    padding: s(16),
    ...shadows.authPane,
  },
  hint: {
    ...font(10, '700', { color: palette.slate500 }),
    textAlign: 'center',
    marginBottom: s(12),
  },
  boxes: {
    flexDirection: 'row',
    gap: s(6),
    justifyContent: 'center',
    marginBottom: s(6),
  },
  box: {
    width: s(36),
    height: s(46),
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    borderRadius: radius.lg,
    textAlign: 'center',
    ...font(18, '800', { color: palette.slate400 }),
  },
  boxFilled: {
    borderColor: palette.gold,
    backgroundColor: palette.goldTint,
    color: palette.navy,
  },

  actions: { paddingTop: s(14), paddingHorizontal: s(20) },
  resend: {
    ...font(10, '600', { color: palette.slate500 }),
    textAlign: 'center',
    marginTop: s(12),
  },
  resendLink: font(10, '800', { color: palette.red }),

  noteWrap: { marginTop: 'auto', marginHorizontal: s(16), marginBottom: s(16) },
});
