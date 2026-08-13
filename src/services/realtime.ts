import { io, type Socket } from 'socket.io-client';

import { API_ORIGIN } from './api.client';
import { session } from './storage';

/**
 * The office's live connection.
 *
 * Notifications were only ever *fetched* — the panel and the app read the feed
 * when a screen opened, so a booking arriving while someone was looking at the
 * dashboard showed up whenever they next navigated. The server has been
 * pushing these the whole time: `NotifyProcessor` emits to the signed-in
 * account's room and to their role's room the moment a notification is
 * recorded.
 *
 * Foreground delivery is what this is for, and it is the case push handles
 * worst. Android does not raise a tray notification while the app is open —
 * FCM hands the message to the app and expects it to display something — so
 * even with push fully wired, the in-app banner has to exist. This gets it
 * without a native dependency: `socket.io-client` is plain JavaScript, so it
 * needs a Metro reload rather than a rebuild.
 *
 * One socket for the whole app, opened on sign-in and closed on sign-out.
 */
export type LiveNotification = {
  id: string;
  title: string;
  detail: string;
  link?: string | null;
};

type Listener = (notification: LiveNotification) => void;

let socket: Socket | null = null;
const listeners = new Set<Listener>();

/**
 * Opens the connection, or leaves the open one alone.
 *
 * Safe to call repeatedly — every screen that wants live notifications calls
 * it on focus, and reconnecting on each would drop the room membership the
 * server assigns at handshake.
 */
export function connectRealtime(): void {
  const token = session.getToken();
  if (!token || socket?.connected) {
    return;
  }

  socket?.close();

  /*
   * The token travels in the handshake, not a header.
   *
   * A WebSocket upgrade carries no Authorization header of its own, and the
   * gateway reads `auth.token` to decide which rooms this client joins. Sent
   * once at connect rather than per message.
   */
  socket = io(API_ORIGIN, {
    path: '/realtime',
    transports: ['websocket'],
    auth: { token },
    // The office leaves the panel open all day; a dropped Wi-Fi should heal.
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  /*
   * Said out loud in development.
   *
   * A socket that silently fails to connect is indistinguishable from one that
   * connects and receives nothing — both look like "notifications don't work".
   * These three lines are the difference between guessing and knowing, and
   * they cost nothing in a release build.
   */
  if (__DEV__) {
    socket.on('connect', () =>
      console.log(`[realtime] connected to ${API_ORIGIN} as ${socket?.id}`),
    );
    socket.on('connect_error', (error: Error) =>
      console.warn(`[realtime] could not connect to ${API_ORIGIN}: ${error.message}`),
    );
    socket.on('disconnect', (reason: string) =>
      console.log(`[realtime] disconnected: ${reason}`),
    );
  }

  socket.on('notification', (payload: LiveNotification) => {
    if (__DEV__) {
      console.log(`[realtime] notification: ${payload.title}`);
    }
    /*
     * Handed to every listener, and a throwing one must not stop the others.
     * A banner that fails to render should not also cost the badge its update.
     */
    listeners.forEach(listener => {
      try {
        listener(payload);
      } catch {
        // Deliberately swallowed — see above.
      }
    });
  });
}

export function disconnectRealtime(): void {
  socket?.close();
  socket = null;
}

/** Subscribes to live notifications; returns the unsubscribe. */
export function onLiveNotification(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
