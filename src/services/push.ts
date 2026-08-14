import { PermissionsAndroid, Platform } from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';

import { apiClient } from './api.client';
import { session } from './storage';

/**
 * Registering this device for push.
 *
 * The server has been able to send push for a while — the Firebase credential
 * is stored, `PushService` signs and sends, dead tokens are pruned — and not
 * one notification could arrive, because nothing in the app ever asked
 * Firebase for a token or told the server where to send. Zero devices were
 * registered across every role.
 *
 * Three things had to be true and none of them were:
 *
 *   - the Google Services Gradle plugin has to read `google-services.json`,
 *     or the SDK has no project to talk to (the file was checked in, unread);
 *   - Android 13 made notifications opt-in, so `POST_NOTIFICATIONS` must be
 *     declared *and* granted, or the system drops the tray notification
 *     silently after FCM delivers it;
 *   - the token has to reach `/admin/v1/notifications/token`, which is the
 *     only record of where to push.
 */

/**
 * Asks for permission, the platform's own way.
 *
 * iOS goes through Firebase's prompt; Android 13+ needs the runtime
 * permission, and below 33 it is granted by manifest alone. Returning a plain
 * boolean keeps the caller free of that difference.
 */
async function permitted(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) {
      return true;
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  const status = await requestPermission(getMessaging());
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

/** Hands the token to the server, which is the only place it is kept. */
async function report(token: string): Promise<void> {
  await apiClient.post('/notifications/token', { token });
}

/**
 * Called once the operator is signed in.
 *
 * Deliberately after sign-in rather than at launch: the token is stored
 * *against an account*, so asking before there is one would either fail or
 * file it against nobody. Every failure is swallowed — an office that declines
 * the permission prompt must still get a working panel.
 */
export async function registerForPush(): Promise<void> {
  if (!session.getToken()) {
    return;
  }

  try {
    if (!(await permitted())) {
      if (__DEV__) {
        console.warn('[push] notification permission was refused');
      }
      return;
    }

    const token = await getToken(getMessaging());
    if (!token) {
      return;
    }

    await report(token);
    if (__DEV__) {
      console.log(`[push] device registered (${token.slice(0, 12)}…)`);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(
        `[push] could not register: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}

/**
 * The token this handset is registered under, for retiring it at sign-out.
 *
 * Bounded, and that is the whole point. `getToken` reaches Firebase's servers,
 * and on a weak connection it can sit there for a long time with no timeout of
 * its own — which is fine when it happens in the background after sign-in, and
 * not fine at all on the one action a user takes when they want to leave. Two
 * seconds is longer than a working network needs and short enough that a
 * broken one does not hold up a sign-out.
 *
 * A device that never registered, or one where the answer does not arrive in
 * time, simply sends nothing, and the server leaves its stored registration
 * alone.
 */
export async function currentPushToken(): Promise<string | undefined> {
  try {
    return await Promise.race([
      getToken(getMessaging()).then(token => token || undefined),
      new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 2000)),
    ]);
  } catch {
    return undefined;
  }
}

/**
 * Keeps the server's copy current.
 *
 * Firebase reissues a registration on reinstall, on a restore to a new handset,
 * and occasionally on its own. A stale token is a notification sent into
 * nothing — the server prunes it on the first failure, and this is what stops
 * the device going quiet until the next sign-in.
 */
export function watchPushToken(): () => void {
  return onTokenRefresh(getMessaging(), (token: string) => {
    report(token).catch(() => undefined);
  });
}

/**
 * Opening the app by tapping a notification.
 *
 * Two cases, and they are genuinely different APIs. `onNotificationOpenedApp`
 * fires when the app was *backgrounded* and is brought forward;
 * `getInitialNotification` answers once, at startup, when the app was
 * *closed* and the tap is what launched it. Handling only the first is the
 * common mistake — and it is the closed case that matters most here, because
 * that is the notification a driver or an operator actually sees on a locked
 * phone.
 *
 * Returns the unsubscribe for the live listener.
 */
export function watchNotificationTaps(
  onOpen: (link: string | null) => void,
): () => void {
  const stop = onNotificationOpenedApp(getMessaging(), remote => {
    const link = remote?.data?.link;
    onOpen(typeof link === 'string' ? link : null);
  });

  /*
   * Read once. A cold start caused by a tap has the notification waiting here;
   * an ordinary launch answers null and nothing happens.
   */
  getInitialNotification(getMessaging())
    .then(remote => {
      if (!remote) {
        return;
      }
      const link = remote.data?.link;
      onOpen(typeof link === 'string' ? link : null);
    })
    .catch(() => undefined);

  return stop;
}
