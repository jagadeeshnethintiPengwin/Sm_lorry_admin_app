import { apiClient, mockDelay, setAuthToken, USE_MOCK_DATA } from './api.client';
import type { OwnerProfile } from '@apptypes/index';

/** The signed-in owner shown across the app (`admin-mobile-app.html`). */
export const MOCK_OWNER: OwnerProfile = {
  id: 'owner-1',
  name: 'Suresh Reddy',
  initials: 'SR',
  mobile: '+91 98765 43210',
  email: 'owner@smt.co.in',
  businessName: 'SMT Simhadri Transport Pvt Ltd',
  gstin: '36AABCS1234H1Z5',
  pan: 'AABCS1234H',
  address: 'Plot 42, Industrial Estate,\nGachibowli, Hyderabad - 500032',
};

export type SendOtpResponse = {
  /** Seconds until resend is allowed — drives the `Resend in 00:24` label. */
  resendIn: number;
  verificationId: string;
};

export type VerifyOtpResponse = {
  token: string;
  profile: OwnerProfile;
};

export const authService = {
  /** POST /auth/otp/send */
  async sendOtp(mobile: string): Promise<SendOtpResponse> {
    if (USE_MOCK_DATA) {
      return mockDelay({ resendIn: 24, verificationId: 'mock-verification' });
    }
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
    if (USE_MOCK_DATA) {
      const result = await mockDelay({
        token: 'mock-token',
        profile: MOCK_OWNER,
      });
      await setAuthToken(result.token);
      return result;
    }
    const { data } = await apiClient.post<VerifyOtpResponse>(
      '/auth/otp/verify',
      { mobile, code, verificationId },
      { headers: { 'X-Anonymous': 'true' } },
    );
    await setAuthToken(data.token);
    return data;
  },

  /** POST /auth/otp/resend */
  async resendOtp(
    mobile: string,
    verificationId: string,
  ): Promise<SendOtpResponse> {
    if (USE_MOCK_DATA) {
      return mockDelay({ resendIn: 24, verificationId });
    }
    const { data } = await apiClient.post<SendOtpResponse>(
      '/auth/otp/resend',
      { mobile, verificationId },
      { headers: { 'X-Anonymous': 'true' } },
    );
    return data;
  },

  /** PUT /owner/profile — the Business Details form. */
  async updateProfile(payload: Partial<OwnerProfile>): Promise<OwnerProfile> {
    if (USE_MOCK_DATA) {
      return mockDelay({ ...MOCK_OWNER, ...payload }, 600);
    }
    const { data } = await apiClient.put<OwnerProfile>('/owner/profile', payload);
    return data;
  },

  /** POST /auth/logout */
  async logout(): Promise<void> {
    if (!USE_MOCK_DATA) {
      await apiClient.post('/auth/logout').catch(() => {
        // A failed logout must still clear the local session.
      });
    }
    await setAuthToken(null);
  },
};
