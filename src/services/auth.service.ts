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

/**
 * What `login` answers instead of a session when two-step sign-in is on.
 *
 * The password was right, but it no longer buys tokens on its own: the server
 * has emailed a six-digit code, and `login/verify` trades that code — against
 * this `challengeId` — for the session. Nothing here is a credential.
 */
export type TwoStepChallenge = {
  twoFactorRequired: true;
  challengeId: string;
  channel: 'email';
  /** Masked by the server — `ow•••@simhadritransport.in` — so safe to show. */
  destination: string;
  /** Seconds until another code may be asked for. */
  resendIn: number;
  /** Seconds the emailed code stays good — 300. */
  expiresIn: number;
  /** Only from a development API with no mailer; never in production. */
  devCode?: string;
};

/** A session when two-step is off, or the second step when it is on. */
export type LoginResponse = VerifyOtpResponse | TwoStepChallenge;

/**
 * Forgets the session on this handset, and tells nobody.
 *
 * The local half of `logout`, on its own for the one case where there is no
 * server half: a deleted account. The API revokes every token the moment the
 * deletion succeeds, so a `/auth/logout` after it would only 401 — what is
 * left is to drop the stored credentials and the socket they authenticated.
 */
export async function clearLocalSession(): Promise<void> {
  await setAuthToken(null);
  /* The socket is authenticated by the token that just went; drop it too. */
  disconnectRealtime();
}

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

  /**
   * POST /auth/login — email + password sign-in.
   *
   * The same endpoint the web panel uses, and it hands back the same token pair
   * as the OTP flow, so everything downstream (the socket, push, the refresh
   * token) is set up identically.
   *
   * With two-step sign-in on, a correct password answers a `TwoStepChallenge`
   * and no tokens. That is handed straight back: there is no session yet, so
   * nothing is stored, no socket is opened and no push token is registered
   * until `verifyTwoStep` has the emailed code.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>(
      '/auth/login',
      { email, password },
      { headers: { 'X-Anonymous': 'true' } },
    );
    if ('twoFactorRequired' in data) {
      return data;
    }
    await setAuthToken(data.token, data.refreshToken);
    connectRealtime();
    registerForPush().catch(() => undefined);
    return data;
  },

  /**
   * POST /auth/login/verify — the emailed code, for the challenge `login` opened.
   *
   * Answers the session the password alone no longer hands out, and sets it up
   * exactly as a one-step `login` does.
   */
  async verifyTwoStep(
    challengeId: string,
    code: string,
  ): Promise<VerifyOtpResponse> {
    const { data } = await apiClient.post<VerifyOtpResponse>(
      '/auth/login/verify',
      { challengeId, code },
      { headers: { 'X-Anonymous': 'true' } },
    );
    await setAuthToken(data.token, data.refreshToken);
    connectRealtime();
    registerForPush().catch(() => undefined);
    return data;
  },

  /**
   * POST /auth/login/resend — a fresh code, emailed again.
   *
   * The answer is a *new* challenge — the code in the new email belongs to it,
   * not to the `challengeId` passed in — so the caller verifies against the one
   * returned here from then on.
   */
  async resendTwoStep(challengeId: string): Promise<TwoStepChallenge> {
    const { data } = await apiClient.post<TwoStepChallenge>(
      '/auth/login/resend',
      { challengeId },
      { headers: { 'X-Anonymous': 'true' } },
    );
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

  /** PUT /owner/profile — the signed-in account's own name / mobile / email. */
  async updateProfile(payload: Partial<OwnerProfile>): Promise<OwnerProfile> {
    const { data } = await apiClient.put<OwnerProfile>('/owner/profile', payload);
    return data;
  },

  /**
   * PUT /settings/company — the Business Details form.
   *
   * The company profile (name, GSTIN, address, support contact) is a settings
   * section, not part of the personal account, so it saves here rather than
   * through `/owner/profile` — the same endpoint the web panel's Settings →
   * Company Profile writes to. `GET /owner/profile` reads it back under
   * `company`, which is how the form reloads.
   */
  async updateCompany(company: {
    name?: string;
    gstin?: string;
    email?: string;
    mobile?: string;
    address?: string;
    city?: string;
    state?: string;
  }): Promise<void> {
    await apiClient.put('/settings/company', company);
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
    await clearLocalSession();

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
