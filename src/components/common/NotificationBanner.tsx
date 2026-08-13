import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { getMessaging, onMessage } from '@react-native-firebase/messaging';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { watchPushToken } from '@services/push';
import {
  connectRealtime,
  onLiveNotification,
  type LiveNotification,
} from '@services/realtime';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * What a notification looks like while the app is open.
 *
 * The foreground case is the one push handles worst: Android does not raise a
 * tray notification for an app that is already in front of the user, so a
 * message arriving during a shift went nowhere until the operator happened to
 * open the notifications screen. This is the banner that was missing.
 *
 * Mounted once, above everything, listening to the socket the office is
 * already connected to.
 */
const VISIBLE_MS = 5000;

const NotificationBannerComponent: React.FC<{
  onPress?: (notification: LiveNotification) => void;
}> = ({ onPress }) => {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<LiveNotification | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* The id on screen, so socket and push cannot show the same one twice. */
  const lastShown = useRef<string | null>(null);

  /*
   * Raising the banner, from either source.
   *
   * The socket and FCM both end here so a notification looks and behaves the
   * same however it arrived — and so the de-duplication below has one place to
   * live rather than two that can disagree.
   */
  const show = useCallback((notification: LiveNotification) => {
    /*
     * The same notification can arrive twice: once over the socket and once
     * over push, if both are connected. Showing it twice is worse than either
     * alone, so a repeat of the id currently on screen is ignored.
     */
    if (lastShown.current === notification.id) {
      return;
    }
    lastShown.current = notification.id;

    if (timer.current) {
      clearTimeout(timer.current);
    }
    setCurrent(notification);
    timer.current = setTimeout(() => setCurrent(null), VISIBLE_MS);
  }, []);

  const dismiss = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setCurrent(null);
  }, []);

  /*
   * The banner owns the connection, rather than trusting it already exists.
   *
   * `connectRealtime` was called only from sign-in and from the splash. Both
   * are one-shot: a session that predates this code, a Metro reload, or a
   * socket dropped while the phone was in a pocket all leave the app running
   * with no connection and no way to notice. Reconnecting here — and again
   * whenever the app comes back to the foreground — makes the live banner
   * independent of which path got the operator to this screen.
   *
   * `connectRealtime` returns immediately when a socket is already open or
   * there is no session, so calling it often costs nothing.
   */
  useEffect(() => {
    connectRealtime();

    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        connectRealtime();
      }
    });

    /*
     * A reissued token, reported without waiting for the next sign-in.
     *
     * Firebase rotates a registration on reinstall, on a restore to a new
     * handset, and sometimes on its own. The server prunes a token that fails,
     * so without this the device simply goes quiet until somebody signs in
     * again — which on a panel left open all day may be weeks.
     */
    const stopWatching = watchPushToken();

    /*
     * A push arriving while the app is open.
     *
     * Android does not raise a tray notification for a foregrounded app — FCM
     * hands the message over and expects the app to show something. That is
     * this banner, so the same message reads the same whether it came over the
     * socket or over push.
     */
    const stopMessages = onMessage(
      getMessaging(),
      remote => {
        const { notification, data } = remote;
        if (!notification?.title) {
          return;
        }
        show({
          id: String(data?.id ?? remote.messageId ?? notification.title),
          title: notification.title,
          detail: notification.body ?? '',
          link: typeof data?.link === 'string' ? data.link : null,
        });
      },
    );

    return () => {
      subscription.remove();
      stopWatching();
      stopMessages();
    };
  }, [show]);


  useEffect(() => {
    const unsubscribe = onLiveNotification(notification => {
      /*
       * The newest wins outright rather than queueing. Six approvals in a row
       * would otherwise hold the banner for half a minute, and the first is
       * the least interesting by then — the feed keeps them all.
       */
      show(notification);
    });

    return () => {
      unsubscribe();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [show]);

  if (!current) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInUp.duration(260)}
      exiting={SlideOutUp.duration(200)}
      /* Below the status bar, above every screen. */
      style={[styles.wrap, { top: insets.top + s(6) }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          const notification = current;
          dismiss();
          onPress?.(notification);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${current.title}. ${current.detail}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.iconWell}>
          <Icon name="bell" size={14} color={palette.gold} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.detail} numberOfLines={2}>
            {current.detail}
          </Text>
        </View>

        <Pressable
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Icon name="x" size={14} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: s(10),
    right: s(10),
    // Above the tab bar, sheets and modals — a notification that slides in
    // behind the screen it is announcing is worse than none.
    zIndex: 1000,
    elevation: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    backgroundColor: palette.navy,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,166,35,0.35)',
    ...shadows.elevatedCard,
  },
  pressed: { opacity: 0.9 },
  iconWell: {
    width: s(28),
    height: s(28),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,166,35,0.16)',
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  title: font(11, '800', { color: palette.white }),
  detail: {
    ...font(9, '500', { color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }),
    marginTop: s(1),
  },
});

export const NotificationBanner = memo(NotificationBannerComponent);
NotificationBanner.displayName = 'NotificationBanner';
