import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Icon, IndiaFlagMini, Screen } from '@components/index';
import { useAppDispatch } from '@store/index';
import { sendOtp, setMobile as setStoreMobile } from '@store/slices/auth.slice';
import { useTopInset } from '@hooks/useTopInset';
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

  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [pinVisible, setPinVisible] = useState(false);

  const togglePin = useCallback(() => setPinVisible(current => !current), []);

  const signIn = useCallback(() => {
    const target = mobile.length === 10 ? `+91 ${mobile}` : '+91 98980 XXXXX';
    dispatch(setStoreMobile(target));
    dispatch(sendOtp(target));
    navigation.navigate('OtpVerification', { mobile: target });
  }, [dispatch, mobile, navigation]);

  return (
    <Screen backgroundColor={palette.navy}>
      <LinearGradient
        colors={gradients.navyAuth as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.field}
      >
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

          <Text style={styles.label}>OWNER PIN</Text>
          <View style={[styles.inputRow, styles.pinRow]}>
            <Icon name="lock" size={16} color={palette.slate500} />
            <TextInput
              value={pin}
              onChangeText={setPin}
              placeholder="6-digit PIN"
              placeholderTextColor={palette.slate400}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry={!pinVisible}
              style={styles.pinInput}
              accessibilityLabel="Owner PIN"
            />
            <Pressable
              onPress={togglePin}
              accessibilityRole="button"
              accessibilityLabel={pinVisible ? 'Hide PIN' : 'Show PIN'}
              hitSlop={s(8)}
            >
              <Icon name="eye" size={16} color={palette.slate500} />
            </Pressable>
          </View>

          <Button
            label="Sign In"
            variant="gold"
            icon="arrow-right"
            onPress={signIn}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forgot PIN, reset via OTP"
            style={styles.resetWrap}
          >
            <Text style={styles.reset}>Forgot PIN? Reset via OTP</Text>
          </Pressable>
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
      </LinearGradient>
    </Screen>
  );
};

const styles = StyleSheet.create({
  field: { flex: 1 },
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
  resetWrap: { alignItems: 'center', marginTop: s(10) },
  reset: font(10, '800', { color: palette.red }),

  trustWrap: { marginTop: 'auto', marginHorizontal: s(16), marginBottom: s(16) },
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
