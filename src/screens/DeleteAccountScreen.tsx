import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  ConfirmDialog,
  Content,
  Footer,
  Icon,
  IconWell,
  ListState,
  OtpInput,
  Screen,
} from '@components/index';
import { useApi } from '@hooks/useApi';
import { useAppDispatch } from '@store/index';
import { sessionCleared } from '@store/slices/auth.slice';
import { accountService } from '@services/account.service';
import { clearLocalSession } from '@services/auth.service';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

/**
 * Delete Account — the in-app route App Store 5.1.1(v) and Google Play ask for.
 *
 *   Review:  red warning card · WHAT WILL BE DELETED · WHAT WE KEEP ·
 *            optional reason chips · red "Send verification code"
 *   Confirm: six red-filled code boxes (the sign-in screen's own) · resend
 *            countdown · red "Delete my account" → last-chance dialog
 *
 * Anything that stops the deletion — the only owner on the account, say — is
 * reported in the server's own words, and the flow ends there with Back.
 */
type Step = 'review' | 'confirm';

const CODE_LENGTH = 6;
const EMPTY_CODE: string[] = Array.from({ length: CODE_LENGTH }, () => '');

const REASONS = [
  "I've left the company",
  'I have another account',
  'Privacy concerns',
  'Other',
] as const;

const messageOf = (error: unknown, fallback: string): string =>
  (error as Error)?.message || fallback;

export const DeleteAccountScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();

  /* What deleting would do, and whether anything stands in the way. */
  const info = useApi(() => accountService.deletionInfo(), []);

  const [step, setStep] = useState<Step>('review');
  const [reason, setReason] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendFailure, setSendFailure] = useState<string | null>(null);

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [code, setCode] = useState<string[]>(EMPTY_CODE);
  const [focusSignal, setFocusSignal] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }
    const timer = setTimeout(() => setSeconds(current => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const complete = useMemo(() => code.every(digit => digit !== ''), [code]);
  const waiting = seconds > 0 || sending;

  /**
   * Asks for a code — the first, and every resend.
   *
   * A resend issues a new challenge, so the boxes are emptied and the new
   * `verificationId` replaces the old one; a code from the earlier message
   * would be checked against the wrong challenge.
   */
  const sendCode = useCallback(async () => {
    if (sending) {
      return;
    }
    setSending(true);
    setSendFailure(null);
    setFailure(null);
    try {
      const sent = await accountService.sendDeletionCode();
      setVerificationId(sent.verificationId);
      setSentTo(sent.mobile);
      setSeconds(sent.resendIn);
      /* A development API hands the code back so it can be typed without SMS. */
      const dev = __DEV__ && sent.devCode ? sent.devCode : null;
      setDevCode(dev);
      setCode(dev && dev.length === CODE_LENGTH ? dev.split('') : EMPTY_CODE);
      setStep('confirm');
      setFocusSignal(current => current + 1);
    } catch (error) {
      const message = messageOf(
        error,
        'Could not send the code. Check your signal and try again.',
      );
      if (step === 'confirm') {
        setFailure(message);
      } else {
        setSendFailure(message);
      }
    } finally {
      setSending(false);
    }
  }, [sending, step]);

  /** Leaves for the sign-in screen — the signed-in stack has nothing left. */
  const leave = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Auth', params: { screen: 'Login' } }],
    });
  }, [navigation]);

  /**
   * Spends the code on the deletion.
   *
   * On success the server has already revoked every token, so the session is
   * cleared here and nowhere else — a `/auth/logout` now would only 401. The
   * screen stays up underneath the result dialog, and leaves when it is closed.
   */
  const deleteAccount = useCallback(async () => {
    if (!verificationId || !complete || deleting) {
      return;
    }
    setDeleting(true);
    setFailure(null);
    try {
      await accountService.deleteAccount({
        code: code.join(''),
        verificationId,
        ...(reason ? { reason } : {}),
      });
      await clearLocalSession();
      dispatch(sessionCleared());
      setDeleted(true);
    } catch (error) {
      setConfirmOpen(false);
      setFailure(
        messageOf(error, 'That code was not accepted. Check it and try again.'),
      );
      setCode(EMPTY_CODE);
      setFocusSignal(current => current + 1);
    } finally {
      setDeleting(false);
    }
  }, [code, complete, deleting, dispatch, reason, verificationId]);

  /* Back from the code step returns to the review, not out of the flow. */
  const back = useCallback(() => {
    if (step === 'confirm') {
      setStep('review');
      setFailure(null);
      setCode(EMPTY_CODE);
      return;
    }
    navigation.goBack();
  }, [navigation, step]);

  const data = info.data;
  const blocked = data !== null && !data.canDelete;

  const renderReview = () => {
    if (!data) {
      return (
        <ListState
          loading={info.loading}
          error={info.error}
          what="account details"
          onRetry={info.refetch}
        />
      );
    }

    if (blocked) {
      return (
        <Card padding={16} style={styles.blockedCard}>
          <View style={styles.blockedWell}>
            <Icon name="alert-triangle" size={22} color={palette.red} />
          </View>
          <Text style={styles.blockedTitle}>
            This account can&apos;t be deleted yet
          </Text>
          {data.blockers.map(blocker => (
            <View key={blocker} style={styles.blocker}>
              <Icon name="alert-circle" size={13} color={palette.red} />
              <Text style={styles.blockerText}>{blocker}</Text>
            </View>
          ))}
        </Card>
      );
    }

    return (
      <>
        {/* Warning */}
        <View style={styles.warnCard}>
          <IconWell
            icon="trash-2"
            size={38}
            iconSize={18}
            backgroundColor={palette.white}
            color={palette.red}
            borderRadius={radius.full}
          />
          <View style={styles.warnBody}>
            <Text style={styles.warnTitle}>
              Delete your account permanently
            </Text>
            <Text style={styles.warnText}>
              You&apos;ll be signed out on every device and won&apos;t be able
              to sign in again. This can&apos;t be undone.
            </Text>
          </View>
        </View>

        {data.removes.length > 0 ? (
          <>
            <Text style={styles.section}>WHAT WILL BE DELETED</Text>
            <Card padding={12} style={styles.listCard}>
              {data.removes.map((item, index) => (
                <View
                  key={item}
                  style={[styles.item, index > 0 && styles.itemGap]}
                >
                  <Icon name="x" size={13} color={palette.red} />
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {data.keeps.length > 0 ? (
          <>
            <Text style={styles.section}>WHAT WE KEEP</Text>
            <Card padding={12} style={styles.listCard}>
              {data.keeps.map((item, index) => (
                <View
                  key={item}
                  style={[styles.item, index > 0 && styles.itemGap]}
                >
                  <Icon name="lock" size={12} color={palette.slate500} />
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Text style={styles.section}>
          WHY ARE YOU LEAVING?{' '}
          <Text style={styles.sectionHint}>(optional)</Text>
        </Text>
        <View style={styles.chips}>
          {REASONS.map(label => {
            const on = reason === label;
            return (
              <Pressable
                key={label}
                onPress={() => setReason(on ? null : label)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={label}
                style={({ pressed }) => [
                  styles.chip,
                  on && styles.chipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  const renderConfirm = () => (
    <Card padding={16} style={styles.codeCard}>
      <View style={styles.codeWell}>
        <Icon name="shield-check" size={22} color={palette.red} />
      </View>
      <Text style={styles.codeTitle}>Confirm it&apos;s you</Text>
      <Text style={styles.codeHint}>
        Enter the 6-digit code we sent to{' '}
        <Text style={styles.codeHintStrong}>{sentTo}</Text>
      </Text>

      <OtpInput
        value={code}
        onChange={setCode}
        tone="danger"
        focusSignal={focusSignal}
        editable={!deleting}
      />

      {devCode ? <Text style={styles.devCode}>Dev code: {devCode}</Text> : null}

      {failure ? (
        <View style={styles.failure} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={12} color={palette.red} />
          <Text style={styles.failureText}>{failure}</Text>
        </View>
      ) : null}

      {/* Nested `Text`, as on the sign-in screen, so both runs share a baseline. */}
      <Text style={styles.resend}>
        Didn&apos;t receive?{' '}
        <Text
          style={waiting ? styles.resendWaiting : styles.resendLink}
          onPress={waiting || deleting ? undefined : sendCode}
          suppressHighlighting={waiting}
          accessibilityRole="button"
          accessibilityLabel="Resend code"
          accessibilityState={{ disabled: waiting, busy: sending }}
        >
          {sending
            ? 'Sending…'
            : waiting
            ? `Resend in ${seconds}s`
            : 'Resend code'}
        </Text>
      </Text>
    </Card>
  );

  const renderFooter = () => {
    if (step === 'confirm') {
      return (
        <Footer>
          <Button
            label="Delete my account"
            variant="red"
            icon="trash-2"
            padding={12}
            fontSize={13}
            disabled={!complete || deleting}
            onPress={() => setConfirmOpen(true)}
          />
        </Footer>
      );
    }
    if (!data) {
      return null;
    }
    if (blocked) {
      return (
        <Footer>
          <Button
            label="Back"
            variant="outline"
            icon="chevron-left"
            padding={12}
            fontSize={13}
            onPress={navigation.goBack}
          />
        </Footer>
      );
    }
    return (
      <Footer>
        {sendFailure ? (
          <View style={styles.failure} accessibilityLiveRegion="polite">
            <Icon name="alert-circle" size={12} color={palette.red} />
            <Text style={styles.failureText}>{sendFailure}</Text>
          </View>
        ) : null}
        <Button
          label={sending ? 'Sending…' : 'Send verification code'}
          variant="red"
          icon="send"
          padding={12}
          fontSize={13}
          loading={sending}
          disabled={sending}
          onPress={sendCode}
        />
        {data.mobile ? (
          <Text style={styles.sendNote}>
            We&apos;ll send a code to{' '}
            <Text style={styles.sendNoteStrong}>{data.mobile}</Text>
          </Text>
        ) : null}
      </Footer>
    );
  };

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Delete account"
        subtitle={
          step === 'review' ? 'Step 1 of 2 · Review' : 'Step 2 of 2 · Confirm'
        }
        showBack
        /* A no-op while deleting — undefined would fall back to `goBack`. */
        onBackPress={deleting ? () => undefined : back}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Content>
          {step === 'review' ? renderReview() : renderConfirm()}
        </Content>
        {renderFooter()}
      </KeyboardAvoidingView>

      {/*
        One dialog for both the last chance and the result, rather than two.

        Closing one modal while opening another is exactly the moment iOS drops
        the second, which here would leave a deleted account sitting on a
        signed-in screen with nothing to tap. The same dialog changes its
        words instead.
      */}
      <ConfirmDialog
        visible={confirmOpen || deleted}
        tone={deleted ? 'success' : 'danger'}
        icon={deleted ? 'check-circle-2' : 'trash-2'}
        title={deleted ? 'Account deleted' : 'Delete your account?'}
        message={
          deleted
            ? 'Your account has been deleted and you have been signed out.'
            : 'This permanently deletes your account and signs you out on every device. It cannot be undone.'
        }
        confirmLabel={deleted ? 'OK' : 'Delete account'}
        cancelLabel={deleted ? undefined : 'Cancel'}
        busy={deleting}
        onConfirm={deleted ? leave : deleteAccount}
        onCancel={deleted ? leave : () => setConfirmOpen(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },

  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    backgroundColor: palette.redTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.redSoft,
    borderRadius: radius.xl,
    padding: s(14),
    marginBottom: s(14),
  },
  warnBody: { flex: 1 },
  warnTitle: font(13, '800', { color: palette.redDark }),
  warnText: {
    ...font(10, '600', { color: palette.red, lineHeight: 1.45 }),
    marginTop: s(3),
  },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionHint: font(9, '600', { color: palette.slate400, letterSpacing: 0 }),

  listCard: { marginBottom: s(14) },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: s(8) },
  itemGap: { marginTop: s(8) },
  itemText: {
    ...font(10, '600', { color: palette.navy, lineHeight: 1.4 }),
    flex: 1,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(6) },
  chip: {
    paddingVertical: s(7),
    paddingHorizontal: s(12),
    borderRadius: radius.full,
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    backgroundColor: palette.white,
    marginRight: s(8),
    marginBottom: s(8),
  },
  chipOn: { borderColor: palette.red, backgroundColor: palette.redTint },
  chipText: font(10, '700', { color: palette.slate500 }),
  chipTextOn: { color: palette.red },

  blockedCard: { alignItems: 'center' },
  blockedWell: {
    width: s(52),
    height: s(52),
    borderRadius: radius.full,
    backgroundColor: palette.redTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(10),
  },
  blockedTitle: {
    ...font(14, '800', { color: palette.navy }),
    textAlign: 'center',
    marginBottom: s(6),
  },
  blocker: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
    alignSelf: 'stretch',
    backgroundColor: palette.redTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.redSoft,
    borderRadius: radius.lg,
    padding: s(10),
    marginTop: s(8),
  },
  blockerText: {
    ...font(10, '700', { color: palette.redDark, lineHeight: 1.45 }),
    flex: 1,
  },

  codeCard: { alignItems: 'center' },
  codeWell: {
    width: s(52),
    height: s(52),
    borderRadius: radius.full,
    backgroundColor: palette.redTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(10),
  },
  codeTitle: font(15, '800', { color: palette.navy }),
  codeHint: {
    ...font(10, '600', { color: palette.slate500, lineHeight: 1.45 }),
    textAlign: 'center',
    marginTop: s(4),
    marginBottom: s(14),
  },
  codeHintStrong: font(10, '800', { color: palette.navy }),
  devCode: {
    ...font(9, '700', { color: palette.slate400 }),
    marginTop: s(4),
  },

  failure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    alignSelf: 'stretch',
    marginTop: s(8),
    marginBottom: s(4),
  },
  failureText: {
    ...font(9, '700', { lineHeight: 1.3, color: palette.red }),
    flex: 1,
  },

  resend: {
    ...font(10, '600', { color: palette.slate500 }),
    textAlign: 'center',
    marginTop: s(12),
  },
  resendLink: font(10, '800', { color: palette.red }),
  resendWaiting: font(10, '800', { color: palette.slate400 }),

  sendNote: {
    ...font(9, '600', { color: palette.slate500 }),
    textAlign: 'center',
    marginTop: s(8),
  },
  sendNoteStrong: font(9, '800', { color: palette.navy }),

  pressed: { opacity: 0.8 },
});
