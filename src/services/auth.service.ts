import { apiClient, setAuthToken } from './api.client';
import { connectRealtime, disconnectRealtime } from './realtime';
import { registerForPush } from './push';
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

  /** POST /auth/logout */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout').catch(() => {
      // A failed logout must still clear the local session.
    });
    await setAuthToken(null);
    /* The socket is authenticated by the token that just went; drop it too. */
    disconnectRealtime();
  },
};
