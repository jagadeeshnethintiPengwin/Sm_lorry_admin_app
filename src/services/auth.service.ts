import { apiClient, setAuthToken } from './api.client';
import { connectRealtime, disconnectRealtime } from './realtime';
import { currentPushToken, registerForPush } from './push';
import { session } from './storage';
import type { OwnerProfile } from '@apptypes/index';

export type SendOtpResponse = {
  /** Seconds until resend is allowed — drives the `Resend in 00:24` label. */
  resendIn: number;
  verificationId: string;
};

export type VerifyOtpResponse = {
  token: string;
  /** Kept alongside the access token so a session can outlive its 15 minutes. */
  refreshToken?: string;
  profile: OwnerProfile;
};

/**
 * What `pin/login` answers.
 *
 * `pinSet: false` is not a failure — it is an account that has never chosen a
 * PIN, and the screen falls back to the OTP flow exactly as it did before PINs
 * existed. A number with no account answers the same way on purpose, so the
 * login form cannot be used to discover which numbers are staff.
 */
export type PinLoginResponse =
  | { pinSet: false; mobile: string }
  | ({ pinSet: true } & VerifyOtpResponse);

export const authService = {
  /** POST /auth/pin/status — whether this number signs in with a PIN. */
  async pinStatus(mobile: string): Promise<{ pinSet: boolean }> {
    const { data } = await apiClient.post<{ pinSet: boolean }>(
      '/auth/pin/status',
      { mobile },
      { headers: { 'X-Anonymous': 'true' } },
    );
    return data;
  },

  /** POST /auth/pin/login — sign in with the six-digit PIN. */
  async pinLogin(mobile: string, pin: string): Promise<PinLoginResponse> {
    const { data } = await apiClient.post<PinLoginResponse>(
      '/auth/pin/login',
      { mobile, pin },
      { headers: { 'X-Anonymous': 'true' } },
    );
    if (data.pinSet) {
      await setAuthToken(data.token, data.refreshToken);
    connectRealtime();
    registerForPush().catch(() => undefined);
    }
    return data;
  },

  /** POST /auth/pin/forgot — sends the OTP that authorises a reset. */
  async forgotPin(mobile: string): Promise<SendOtpResponse> {
    const { data } = await apiClient.post<SendOtpResponse>(
      '/auth/pin/forgot',
      { mobile },
      { headers: { 'X-Anonymous': 'true' } },
    );
    return data;
  },

  /** POST /auth/pin/reset — a new PIN against a verified OTP. */
  async resetPin(
    mobile: string,
    verificationId: string,
    code: string,
    pin: string,
  ): Promise<VerifyOtpResponse> {
    const { data } = await apiClient.post<VerifyOtpResponse>(
      '/auth/pin/reset',
      { mobile, verificationId, code, pin },
      { headers: { 'X-Anonymous': 'true' } },
    );
    await setAuthToken(data.token, data.refreshToken);
    connectRealtime();
    registerForPush().catch(() => undefined);
    return data;
  },

  /** POST /auth/pin/change — a new PIN proved by the current one, no OTP. */
  async changePin(
    mobile: string,
    currentPin: string,
    pin: string,
  ): Promise<VerifyOtpResponse> {
    const { data } = await apiClient.post<VerifyOtpResponse>(
      '/auth/pin/change',
      { mobile, currentPin, pin },
      { headers: { 'X-Anonymous': 'true' } },
    );
    await setAuthToken(data.token, data.refreshToken);
    connectRealtime();
    registerForPush().catch(() => undefined);
    return data;
  },

  /** POST /auth/pin/set — chooses a PIN for the account already signed in. */
  async setPin(pin: string): Promise<{ pinSet: boolean }> {
    const { data } = await apiClient.post<{ pinSet: boolean }>('/auth/pin/set', {
      pin,
    });
    return data;
  },

  /** POST /auth/otp/send */
  async sendOtp(mobile: string): Promise<SendOtpResponse> {
    const { data } = await apiClient.post<SendOtpResponse>(
      '/auth/otp/send',
      { mobile },
      { headers: { 'X-Anonymous': 'true' } },
    );
    return data;
  },

  /** POST /auth/otp/verify */
  async verifyOtp(
    mobile: string,
    code: string,
    verificationId: string,
  ): Promise<VerifyOtpResponse> {
    const { data } = await apiClient.post<VerifyOtpResponse>(
      '/auth/otp/verify',
      { mobile, code, verificationId },
      { headers: { 'X-Anonymous': 'true' } },
    );
    // The refresh token is stored with it: the access token is short-lived,
    // and throwing this away would mean signing in again every fifteen minutes.
    await setAuthToken(data.token, data.refreshToken);
    connectRealtime();
    registerForPush().catch(() => undefined);
    return data;
  },

  /** POST /auth/otp/resend */
  async resendOtp(
    mobile: string,
    verificationId: string,
  ): Promise<SendOtpResponse> {
    const { data } = await apiClient.post<SendOtpResponse>(
      '/auth/otp/resend',
      { mobile, verificationId },
      { headers: { 'X-Anonymous': 'true' } },
    );
    return data;
  },

  /**
   * GET /owner/profile — and the way a stored token is proved still good.
   *
   * The splash uses this rather than trusting that a token exists. Since the
   * API moved to opaque tokens, a session can be ended from anywhere — a logout
   * on another device, or the account being deactivated — and the token sitting
   * in storage looks exactly the same either way. The only honest test is to
   * ask the server.
   */
  async getProfile(): Promise<OwnerProfile> {
    const { data } = await apiClient.get<OwnerProfile>('/owner/profile');
    return data;
  },

  /** PUT /owner/profile — the Business Details form. */
  async updateProfile(payload: Partial<OwnerProfile>): Promise<OwnerProfile> {
    const { data } = await apiClient.put<OwnerProfile>('/owner/profile', payload);
    return data;
  },

  /**
   * POST /auth/logout — this device, and only this device.
   *
   * Both values in the body matter, and both were missing.
   *
   * Without `refreshToken` the server reads the request as "end every session
   * for this account" — that is what the endpoint documents an omitted token
   * to mean — so signing out of the phone also signed the owner out of the web
   * panel they had open on a desk. Naming the session ends that one.
   *
   * Without `pushToken` the registration stayed on the account, because it is
   * not part of a session and nothing else clears it. The handset carried on
   * receiving push for an account that had signed out of it — the wrong
   * person's bookings arriving on a phone that had been handed back.
   *
   * The local session is cleared whatever the request did: a server that
   * cannot be reached must not be able to keep somebody signed in on a device
   * they are trying to hand over.
   */
  async logout(): Promise<void> {
    const refreshToken = session.getRefreshToken() ?? undefined;

    /*
     * Asked of Firebase rather than remembered.
     *
     * `registerForPush` reports the token and keeps no copy, and it can be
     * reissued at any point in between — the one the server holds is whatever
     * was reported last, so that is what has to be named here. A device that
     * never registered, or one where Firebase is unavailable, simply sends
     * nothing and the account's other handset keeps its registration.
     */
    /*
     * Read before the session goes, and bounded to two seconds inside
     * `currentPushToken` — a handset that cannot reach Firebase simply retires
     * no registration rather than delaying the sign-out.
     */
    const pushToken = await currentPushToken();

    /*
     * The token, kept for the request that is about to end it.
     *
     * The local session is cleared first — see below — and the interceptor
     * reads the bearer from exactly that storage, so without holding a copy
     * the sign-out request would go out unauthenticated, get a 401, and revoke
     * nothing at all on the server.
     */
    const bearer = session.getToken();

    /*
     * Signed out of this device immediately, told to the server afterwards.
     *
     * This used to run the other way round: a Firebase lookup, then a request
     * with a twenty-second timeout, and only then was the local session
     * cleared. On a weak connection the button did nothing visible for the
     * better part of half a minute, which reads as broken — and an operator
     * handing over a phone wants it signed out now, not once a server has
     * agreed. Locally it is already gone by the time the request is made.
     */
    await setAuthToken(null);
    /* The socket is authenticated by the token that just went; drop it too. */
    disconnectRealtime();

    /*
     * Bounded well under the client default. Revocation matters, but a slow
     * network must not hold a person on a screen they have asked to leave —
     * and an unreachable server cannot keep them signed in, because the
     * credentials are already gone from this handset.
     */
    /*
     * Sent, but not waited for.
     *
     * Revoking the session on the server matters and is not something the
     * operator should be held on a screen for: by this line the credentials
     * are already gone from this handset, so there is nothing left for the
     * request to protect them from. Awaiting it meant the sign-out took as
     * long as the network did — up to six seconds of a dead-looking button on
     * a bad connection, which is what made this read as broken.
     *
     * The bearer is passed explicitly because the interceptor reads it from
     * storage, which has just been cleared.
     */
    apiClient
      .post(
        '/auth/logout',
        { refreshToken, pushToken },
        {
          timeout: 6000,
          ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
        },
      )
      .catch(() => {
        // A failed logout must still clear the local session — already done.
      });
  },
};
