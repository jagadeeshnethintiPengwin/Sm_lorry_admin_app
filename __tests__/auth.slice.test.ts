/**
 * The auth slice — the state behind email + password sign-in.
 *
 * The service is mocked so this exercises the reducer in isolation (importing
 * the real service would pull in the native API client, MMKV storage and the
 * socket). What matters here is that a successful `login` authenticates and
 * stores the profile — the exact transition the navigator watches to swap to
 * the app — and that a failure surfaces a message without signing anyone in.
 */
jest.mock('@services/auth.service', () => ({ authService: {} }));

import authReducer, {
  login,
  logout,
  sessionCleared,
  verifyTwoStep,
} from '../src/store/slices/auth.slice';
import type { OwnerProfile } from '../src/types';

const EMAIL = 'owner@simhadritransport.in';
const PROFILE: OwnerProfile = {
  id: 'u1',
  name: 'Suresh Reddy',
  initials: 'SR',
  mobile: '+919876500001',
  email: EMAIL,
  businessName: 'Simhadri Transport',
};

describe('auth slice — email/password sign-in', () => {
  it('authenticates and stores the profile on login.fulfilled', () => {
    const next = authReducer(
      undefined,
      login.fulfilled(
        { token: 'access-token', refreshToken: 'refresh', profile: PROFILE },
        'req-1',
        { email: EMAIL, password: 'admin1234' },
      ),
    );
    expect(next.isAuthenticated).toBe(true);
    expect(next.profile).toEqual(PROFILE);
    expect(next.status).toBe('idle');
    expect(next.error).toBeNull();
  });

  it('moves to loading while the request is in flight', () => {
    const next = authReducer(
      undefined,
      login.pending('req-2', { email: EMAIL, password: 'x' }),
    );
    expect(next.status).toBe('loading');
    expect(next.isAuthenticated).toBe(false);
  });

  it('surfaces the message and stays signed out on login.rejected', () => {
    const next = authReducer(
      undefined,
      login.rejected(new Error('Email or password is not correct'), 'req-3', {
        email: EMAIL,
        password: 'wrong',
      }),
    );
    expect(next.isAuthenticated).toBe(false);
    expect(next.status).toBe('failed');
    expect(next.error).toBe('Email or password is not correct');
  });

  it('clears the session on logout.fulfilled', () => {
    const signedIn = authReducer(
      undefined,
      login.fulfilled({ token: 't', profile: PROFILE }, 'req-4', {
        email: EMAIL,
        password: 'admin1234',
      }),
    );
    const next = authReducer(
      signedIn,
      logout.fulfilled(undefined, 'req-5', undefined),
    );
    expect(next.isAuthenticated).toBe(false);
    expect(next.profile).toBeNull();
  });

  it('forgets everything on sessionCleared (a deleted account)', () => {
    const signedIn = authReducer(
      undefined,
      login.fulfilled({ token: 't', profile: PROFILE }, 'req-6', {
        email: EMAIL,
        password: 'admin1234',
      }),
    );
    const next = authReducer(signedIn, sessionCleared());
    expect(next.isAuthenticated).toBe(false);
    expect(next.profile).toBeNull();
    expect(next.verificationId).toBeNull();
    expect(next.mobile).toBe('');
  });
});

describe('auth slice — two-step sign-in', () => {
  const CHALLENGE = {
    twoFactorRequired: true as const,
    challengeId: 'ch-1',
    channel: 'email' as const,
    destination: 'ow•••@simhadritransport.in',
    resendIn: 24,
    expiresIn: 300,
  };

  it('does not sign in when the password answers a challenge', () => {
    const next = authReducer(
      undefined,
      login.fulfilled(CHALLENGE, 'req-7', {
        email: EMAIL,
        password: 'admin1234',
      }),
    );
    expect(next.isAuthenticated).toBe(false);
    expect(next.profile).toBeNull();
    expect(next.status).toBe('idle');
  });

  it('authenticates and stores the profile on verifyTwoStep.fulfilled', () => {
    const next = authReducer(
      undefined,
      verifyTwoStep.fulfilled(
        { token: 'access-token', refreshToken: 'refresh', profile: PROFILE },
        'req-8',
        { challengeId: 'ch-1', code: '123456' },
      ),
    );
    expect(next.isAuthenticated).toBe(true);
    expect(next.profile).toEqual(PROFILE);
    expect(next.status).toBe('idle');
  });

  it('surfaces the message and stays signed out on verifyTwoStep.rejected', () => {
    const next = authReducer(
      undefined,
      verifyTwoStep.rejected(new Error('That code is not correct'), 'req-9', {
        challengeId: 'ch-1',
        code: '000000',
      }),
    );
    expect(next.isAuthenticated).toBe(false);
    expect(next.status).toBe('failed');
    expect(next.error).toBe('That code is not correct');
  });
});
