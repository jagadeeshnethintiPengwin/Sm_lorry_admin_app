import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import {
  BottomSheet,
  Button,
  Card,
  Icon,
  IconWell,
  Screen,
} from '@components/index';
import { useAppDispatch } from '@store/index';
import { logout } from '@store/slices/auth.slice';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * Screen 27 — Logout Confirm.
 *
 * Bottom sheet over a dimmed glimpse of the menu: red `log-out` well,
 * headline, a gold warning about pending work, the active-session row, then
 * Cancel / Yes, Log out.
 */
export const LogoutConfirmScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const confirm = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  return (
    <Screen backgroundColor={palette.screenBg}>
      {/* Dimmed glimpse of the menu underneath */}
      <View style={styles.backdrop} pointerEvents="none">
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileCard}
        >
          <View style={styles.profileAvatar} />
          <View style={styles.profileName} />
        </LinearGradient>
        <Card>
          <View style={styles.skeleton} />
        </Card>
        <Card>
          <View style={styles.skeleton} />
        </Card>
      </View>

      <BottomSheet
        visible
        onClose={navigation.goBack}
        paddingTop={20}
        paddingHorizontal={18}
        paddingBottom={18}
      >
        <View style={styles.warn}>
          <Icon name="log-out" size={26} color={palette.red} />
        </View>

        <View style={styles.center}>
          <Text style={styles.title}>Log out of admin app?</Text>
          <Text style={styles.body}>
            You&apos;ll stop receiving alerts &amp; real-time fleet updates. Sign
            in with <Text style={styles.bodyStrong}>+91 98980 XXXXX</Text>.
          </Text>
        </View>

        {/* Warning */}
        <View style={styles.warningBox}>
          <Icon name="alert-triangle" size={16} color={palette.gold} />
          <Text style={styles.warningText}>
            <Text style={styles.warningStrong}>7 pending bookings</Text> awaiting
            approval · <Text style={styles.warningStrong}>18 trips</Text> in
            transit will continue.
          </Text>
        </View>

        {/* Session info */}
        <View style={styles.session}>
          <IconWell
            icon="smartphone"
            size={26}
            iconSize={14}
            backgroundColor={palette.navyTint}
            color={palette.navy}
            borderRadius={radius.md}
          />
          <View style={styles.sessionBody}>
            <Text style={styles.sessionTitle}>iPhone 17 · Hyderabad</Text>
            <Text style={styles.sessionMeta}>
              Active since 18 May · 2FA verified
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label="Cancel"
            variant="outline"
            flex={1}
            padding={12}
            fontSize={12}
            onPress={navigation.goBack}
          />
          <Button
            label="Yes, Log out"
            variant="red"
            icon="log-out"
            iconSize={14}
            flex={1}
            padding={12}
            fontSize={12}
            gap={5}
            onPress={confirm}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: s(12), opacity: 0.55 },
  profileCard: {
    borderRadius: radius.xl,
    padding: s(16),
    marginBottom: s(12),
  },
  profileAvatar: {
    width: s(50),
    height: s(50),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignSelf: 'center',
    marginBottom: s(6),
  },
  profileName: {
    height: s(10),
    borderRadius: s(5),
    width: '60%',
    alignSelf: 'center',
    backgroundColor: alpha.white20,
  },
  skeleton: { height: s(40) },

  warn: {
    width: s(60),
    height: s(60),
    borderRadius: radius.full,
    backgroundColor: palette.redTint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: s(12),
  },
  center: { alignItems: 'center' },
  title: font(16, '800', { color: palette.navy }),
  body: {
    ...font(10, '400', { color: palette.slate500, lineHeight: 1.5 }),
    marginTop: s(5),
    paddingHorizontal: s(8),
    textAlign: 'center',
  },
  bodyStrong: font(10, '800', { color: palette.navy }),

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    backgroundColor: palette.goldTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.goldSoft,
    borderRadius: radius.lg,
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    marginVertical: s(14),
  },
  warningText: {
    ...font(9, '700', { color: palette.goldText, lineHeight: 1.4 }),
    flex: 1,
  },
  warningStrong: font(9, '800', { color: palette.goldText }),

  session: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(9),
    backgroundColor: palette.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.lg,
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    marginBottom: s(14),
  },
  sessionBody: { flex: 1 },
  sessionTitle: font(10, '800', { color: palette.navy }),
  sessionMeta: {
    ...font(8, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },

  actions: { flexDirection: 'row', gap: s(8) },
});
