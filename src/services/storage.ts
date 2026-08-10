import { createMMKV } from 'react-native-mmkv';

/**
 * Where the panel keeps the session.
 *
 * MMKV rather than `AsyncStorage`, and the reason is not raw speed — it is that
 * MMKV reads are *synchronous*. `AsyncStorage.getItem` returns a promise, which
 * forced two awkward things:
 *
 *   - the axios interceptor `await`ed storage on every single request, so each
 *     call carried a bridge round trip before it even left;
 *   - the splash could not know whether a session existed without waiting, so
 *     the app had no honest way to decide its first screen and simply always
 *     went to Login.
 *
 * A synchronous read removes both. `hasSession()` answers immediately, so the
 * splash can route on the first render.
 */
// v4 mints instances through a factory rather than a constructor; `MMKV` is
// only a type in this version.
const storage = createMMKV({ id: 'smt-admin' });

const TOKEN_KEY = 'auth.accessToken';
const REFRESH_KEY = 'auth.refreshToken';

export const session = {
  /** The access token, or null when signed out. */
  getToken(): string | null {
    return storage.getString(TOKEN_KEY) ?? null;
  },

  getRefreshToken(): string | null {
    return storage.getString(REFRESH_KEY) ?? null;
  },

  /**
   * Stores a signed-in session.
   *
   * Passing `null` clears, so logout and "the server rejected us" are the same
   * call rather than two paths that can drift.
   */
  save(token: string | null, refreshToken?: string | null): void {
    if (token) {
      storage.set(TOKEN_KEY, token);
    } else {
      storage.remove(TOKEN_KEY);
    }

    if (refreshToken) {
      storage.set(REFRESH_KEY, refreshToken);
    } else if (refreshToken === null || !token) {
      storage.remove(REFRESH_KEY);
    }
  },

  clear(): void {
    storage.remove(TOKEN_KEY);
    storage.remove(REFRESH_KEY);
  },

  /**
   * Whether there is a token to try.
   *
   * Deliberately only that. A token being present does not mean it still works
   * — it can be expired, or revoked by a logout on another device, which the
   * opaque tokens the API now issues make possible at any moment. The splash
   * treats this as "worth checking", not as "signed in", and asks the server
   * before it shows the dashboard.
   */
  hasSession(): boolean {
    return Boolean(storage.getString(TOKEN_KEY));
  },
};
