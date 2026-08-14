import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  BottomSheet,
  Button,
  Card,
  Icon,
  IconWell,
  Screen,
} from '@components/index';
import { useAppDispatch, useAppSelector } from '@store/index';
import { logout } from '@store/slices/auth.slice';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { reportService } from '@services/report.service';
import { useApi } from '@hooks/useApi';

/**
 * Screen 27 — Logout Confirm.
 *
 * Bottom sheet over a dimmed glimpse of the menu: red `log-out` well,
 * headline, a gold warning about pending work, the active-session row, then
 * Cancel / Yes, Log out.
 */
export const LogoutConfirmScreen: React.FC = () => {
  const navigation = useNavigation();
  /* The root stack, not this sheet's — `Auth` lives one level up. */
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  /* Whoever is about to be signed out. */
  const profile = useAppSelector(state => state.auth.profile);

  /*
   * What is still open, for the warning below.
   *
   * The same summary the dashboard is built from, so the two screens cannot
   * disagree about how much work is outstanding. It is allowed to fail
   * silently — a sign-out sheet must not be blocked by a report call, and the
   * warning simply is not drawn if the counts never arrive.
   */
  const summary = useApi(() => reportService.dashboard(), []);
  const pending = Number(summary.data?.pendingBookings ?? 0);
  const running = Number(summary.data?.activeTrips ?? 0);

  const [busy, setBusy] = useState(false);

  /**
   * Signs out, and actually leaves.
   *
   * This dispatched the thunk and stopped there. The token was cleared and the
   * navigator — a plain stack with a fixed `initialRouteName`, not one that
   * watches `isAuthenticated` — never moved, so the operator was left sitting
   * on the confirmation sheet inside the signed-in stack. Every screen behind
   * it was now unauthenticated, so going back showed a dashboard whose every
   * request 401s.
   *
   * `reset` rather than `navigate`: the whole signed-in stack has to go, or the
   * back gesture walks straight into it.
   *
   * The reset runs whatever the request did. `authService.logout` already
   * swallows a failed call and clears the token regardless — a server that
   * cannot be reached must not be able to keep someone signed in on a device
   * they are trying to hand over.
   */
  const confirm = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await dispatch(logout()).unwrap();
    } catch {
      // Already handled in the service; the reset below is what matters.
    } finally {
      /*
       * Cleared before leaving.
       *
       * It never was, which did not show while both buttons stayed live —
       * and the moment they were disabled on `busy`, one press killed them
       * both for good. If the reset below ever fails to unmount this screen,
       * the sheet has to be usable again rather than frozen.
       */
      setBusy(false);
      /*
       * Straight to the sign-in screen, not to `Auth`'s own entry point.
       *
       * The auth stack starts on `Splash`, whose job is to decide where a
       * *returning* user belongs — so resetting to `Auth` sent a person who
       * had just signed out through a loading screen that re-checks the
       * session it has this moment destroyed. Naming `Login` skips a step
       * that can only reach one conclusion.
       */
      rootNavigation.reset({
        index: 0,
        routes: [{ name: 'Auth', params: { screen: 'Login' } }],
      });
    }
  }, [busy, dispatch, rootNavigation]);

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
            {/*
              The number this account actually signs in with. It read
              `+91 98980 XXXXX` — a masked number belonging to nobody — so the
              one line telling an owner how to get back in was wrong.
            */}
            You&apos;ll stop receiving alerts &amp; real-time fleet updates.
            {profile?.mobile ? (
              <>
                {' '}Sign in with{' '}
                <Text style={styles.bodyStrong}>{profile.mobile}</Text>.
              </>
            ) : null}
          </Text>
        </View>

        {/*
          What signing out leaves behind, counted rather than asserted.
          
          This said `7 pending bookings awaiting approval · 18 trips in transit`
          to everyone, always — including at 2am with an empty board. An owner
          deciding whether to sign out was reading two invented numbers.
          
          The counts come from the same summary the dashboard uses, and the
          box is not drawn at all while they are unknown or zero: a warning
          about nothing is worse than no warning.
        */}
        {pending > 0 || running > 0 ? (
          <View style={styles.warningBox}>
            <Icon name="alert-triangle" size={16} color={palette.gold} />
            <Text style={styles.warningText}>
              {pending > 0 ? (
                <>
                  <Text style={styles.warningStrong}>
                    {pending} pending {pending === 1 ? 'booking' : 'bookings'}
                  </Text>{' '}
                  awaiting approval
                </>
              ) : null}
              {pending > 0 && running > 0 ? ' · ' : null}
              {running > 0 ? (
                <>
                  <Text style={styles.warningStrong}>
                    {running} {running === 1 ? 'trip' : 'trips'}
                  </Text>{' '}
                  in transit will continue
                </>
              ) : null}
              .
            </Text>
          </View>
        ) : null}

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
            {/*
              The account being signed out, which is the one thing this row
              can honestly say.
              
              It read `iPhone 17 · Hyderabad · Active since 18 May · 2FA
              verified` — a device, a city, a date and a security claim, none
              of which the app knows and none of which were true. The last was
              the worst of them: this account signs in with a PIN, and telling
              an operator two-factor was verified is the sort of assurance
              somebody makes a decision on.
              
              Who is signed in and on what platform are both known for certain,
              so those are what it shows.
            */}
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {profile?.name ?? 'This account'}
              {profile?.mobile ? ` · ${profile.mobile}` : ''}
            </Text>
            <Text style={styles.sessionMeta}>
              Signed in on this {Platform.OS === 'ios' ? 'iPhone' : 'device'}
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
            /*
             * Closed off once the sign-out is under way.
             *
             * The two buttons were both live throughout, so Cancel during a
             * slow request dismissed the sheet while the session was already
             * being torn down — leaving the operator on a signed-in-looking
             * screen whose every request was about to fail.
             */
            disabled={busy}
            onPress={navigation.goBack}
          />
          <Button
            label={busy ? 'Signing out…' : 'Yes, Log out'}
            variant="red"
            icon="log-out"
            iconSize={14}
            flex={1}
            padding={12}
            fontSize={12}
            gap={5}
            /*
             * Says what it is doing.
             *
             * `confirm` already refused a second press, but silently — so a
             * button that looked idle while the request ran invited exactly
             * that, and read as broken when nothing happened.
             */
            loading={busy}
            disabled={busy}
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
