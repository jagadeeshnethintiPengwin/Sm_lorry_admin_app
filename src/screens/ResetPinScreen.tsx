import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

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
import { isClean, packMobile, validateMobile, type Errors } from '@utils/validation';

type Form = {
  mobile: string;
  currentPin: string;
  pin: string;
  confirm: string;
};

/**
 * Choosing a new PIN, by either of the two routes that lead here.
 *
 * Arriving from Forgot PIN the number has already been proved by OTP, so the
 * `verificationId` travels in the route and the current PIN is not asked for —
 * the whole point is that it is not known. Arriving from Reset PIN there is no
 * verification, and knowing the current PIN is the proof instead.
 *
 * One screen rather than two because everything below the proof is identical,
 * and two copies of "type it twice, reject the obvious ones" is how the two
 * halves of a PIN policy drift apart.
 */
export const ResetPinScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'ResetPin'>>();
  const { verificationId, code } = route.params ?? {};

  /** Proved by OTP already, or still to be proved with the current PIN. */
  const verified = Boolean(verificationId && code);

  const [mobile, setMobile] = useState(route.params?.mobile ?? '');
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors<Form>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The PINs nobody should be allowed to choose.
   *
   * Mirrors `isWeakPin` on the API so the rejection lands on the field being
   * typed rather than after a round trip. The API is still the authority — it
   * refuses these whatever the app does.
   */
  const weak = useMemo(
    () =>
      new Set([
        '012345', '123456', '234567', '345678', '456789', '567890',
        '987654', '876543', '765432', '654321', '543210', '098765',
      ]),
    [],
  );

  const checkPin = useCallback(
    (value: string, what: string): string | undefined => {
      if (!/^\d{6}$/.test(value)) {
        return `The ${what} is six digits`;
      }
      if (/^(\d)\1{5}$/.test(value) || weak.has(value)) {
        return 'Too easy to guess — avoid runs and repeated digits';
      }
      return undefined;
    },
    [weak],
  );

  const submit = useCallback(async () => {
    const found: Errors<Form> = {
      mobile: verified ? undefined : validateMobile(mobile),
      currentPin: verified
        ? undefined
        : /^\d{6}$/.test(currentPin)
          ? undefined
          : 'The current PIN is six digits',
      pin: checkPin(pin, 'new PIN'),
      confirm: pin !== confirm ? 'Both PINs must match' : undefined,
    };

    setErrors(found);
    setFailure(null);
    if (!isClean(found) || busy) {
      return;
    }

    const target = verified
      ? (route.params?.mobile ?? '')
      : `+91${packMobile(mobile)}`;

    setBusy(true);
    try {
      if (verified) {
        await authService.resetPin(target, verificationId!, code!, pin);
      } else {
        await authService.changePin(target, currentPin, pin);
      }
      // Both paths return a session, so the reset ends signed in rather than
      // dropping the operator back at a login form to type the PIN they have
      // this second chosen.
      navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
    } catch (caught) {
      setFailure(
        caught instanceof Error ? caught.message : 'Could not change the PIN',
      );
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    checkPin,
    code,
    confirm,
    currentPin,
    mobile,
    navigation,
    pin,
    route.params,
    verificationId,
    verified,
  ]);

  return (
    <Screen backgroundColor={palette.navy}>
      <LinearGradient
        colors={gradients.navyAuth as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.field}
      >
        <AppHeader
          title={verified ? 'Choose a New PIN' : 'Reset PIN'}
          subtitle={
            verified ? 'Your number is verified' : 'Confirm with your current PIN'
          }
          showBack
          onBackPress={navigation.goBack}
        />

        <Content>
          <View style={styles.badge}>
            <Icon name="lock" size={24} color={palette.gold} />
          </View>

          <Card padding={12}>
            {!verified ? (
              <>
                <Text style={styles.fieldLabel}>
                  MOBILE NUMBER <Text style={styles.star}>*</Text>
                </Text>
                <View
                  style={[styles.prefixWrap, errors.mobile && styles.invalid]}
                >
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
                <FieldError>{errors.mobile}</FieldError>

                <Input
                  label="Current PIN"
                  required
                  value={currentPin}
                  onChangeText={setCurrentPin}
                  placeholder="6-digit PIN"
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  marginBottom={10}
                  error={errors.currentPin}
                />
              </>
            ) : null}

            <Input
              label="New PIN"
              required
              value={pin}
              onChangeText={setPin}
              placeholder="6 digits"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              marginBottom={10}
              error={errors.pin}
            />

            <Input
              label="Confirm New PIN"
              required
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat the PIN"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              marginBottom={0}
              error={errors.confirm}
            />
          </Card>

          {failure ? (
            <Card padding={11} style={styles.errorCard}>
              <Icon name="alert-circle" size={14} color={palette.red} />
              <Text style={styles.errorText}>{failure}</Text>
            </Card>
          ) : null}

          <Button
            label={busy ? 'Saving…' : 'Save New PIN'}
            variant="gold"
            icon="check-circle-2"
            padding={12}
            fontSize={13}
            loading={busy}
            onPress={submit}
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
  invalid: { borderColor: palette.red },
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
