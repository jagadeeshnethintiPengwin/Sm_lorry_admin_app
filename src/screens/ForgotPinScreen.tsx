import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  FieldError,
  Icon,
  Input,
  Screen,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { AuthStackParamList } from '@navigation/types';
import { authService } from '@services/auth.service';
import { packMobile, validateMobile } from '@utils/validation';

/**
 * Forgot PIN, step one.
 *
 * Takes the number and asks the API for a reset code, then hands off to the
 * OTP screen with `intent: 'reset-pin'` so a correct code leads to choosing a
 * new PIN rather than straight into the dashboard.
 */
export const ForgotPinScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = useCallback(async () => {
    const found = validateMobile(mobile);
    setError(found);
    setFailure(null);
    if (found || busy) {
      return;
    }

    const target = `+91${packMobile(mobile)}`;
    setBusy(true);
    try {
      const result = await authService.forgotPin(target);
      navigation.navigate('OtpVerification', {
        mobile: target,
        verificationId: result.verificationId,
        devCode: (result as { devCode?: string }).devCode,
        intent: 'reset-pin',
      });
    } catch (caught) {
      setFailure(
        caught instanceof Error
          ? caught.message
          : 'Could not send the code. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, mobile, navigation]);

  return (
    <Screen backgroundColor={palette.navy}>
      <LinearGradient
        colors={gradients.navyAuth as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.field}
      >
        <AppHeader
          title="Forgot PIN"
          subtitle="Reset it with a one-time code"
          showBack
          onBackPress={navigation.goBack}
        />

        <Content>
          <View style={styles.badge}>
            <Icon name="shield-check" size={26} color={palette.gold} />
          </View>

          <Text style={styles.lead}>
            We&apos;ll send a six-digit code to your registered mobile number.
            Once it&apos;s verified you can choose a new PIN.
          </Text>

          <Card padding={12}>
            <Text style={styles.fieldLabel}>
              MOBILE NUMBER <Text style={styles.star}>*</Text>
            </Text>
            <View style={[styles.prefixWrap, error && styles.prefixInvalid]}>
              <Text style={styles.prefix}>+91</Text>
              <Input
                value={mobile}
                onChangeText={setMobile}
                placeholder="10-digit mobile"
                keyboardType="phone-pad"
                maxLength={10}
                bare
                marginBottom={0}
                containerStyle={styles.prefixInputWrap}
                accessibilityLabel="Registered mobile number"
              />
            </View>
            <FieldError>{error}</FieldError>
          </Card>

          {failure ? (
            <Card padding={11} style={styles.errorCard}>
              <Icon name="alert-circle" size={14} color={palette.red} />
              <Text style={styles.errorText}>{failure}</Text>
            </Card>
          ) : null}

          <Button
            label={busy ? 'Sending…' : 'Send Reset Code'}
            variant="gold"
            icon="arrow-right"
            padding={12}
            fontSize={13}
            loading={busy}
            onPress={sendCode}
            style={styles.action}
          />
        </Content>
      </LinearGradient>
    </Screen>
  );
};

const styles = StyleSheet.create({
  field: { flex: 1 },
  badge: {
    alignSelf: 'center',
    width: s(58),
    height: s(58),
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: s(1.5),
    borderColor: palette.gold,
    marginBottom: s(14),
  },
  lead: {
    ...font(11, '500', { color: palette.slate300 }),
    textAlign: 'center',
    lineHeight: s(17),
    marginBottom: s(16),
  },
  fieldLabel: {
    ...font(9, '800', { color: palette.slate500, letterSpacing: 1 }),
    textTransform: 'uppercase',
    marginBottom: s(4),
  },
  star: { color: palette.red },
  prefixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  prefixInvalid: { borderColor: palette.red },
  prefix: {
    ...font(12, '800', { color: palette.navy }),
    paddingHorizontal: s(11),
  },
  prefixInputWrap: { flex: 1, minWidth: 0 },
  errorCard: {
    marginTop: s(12),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
    backgroundColor: palette.redTint,
  },
  errorText: { flex: 1, ...font(10, '700', { color: palette.red }) },
  action: { marginTop: s(18) },
});
