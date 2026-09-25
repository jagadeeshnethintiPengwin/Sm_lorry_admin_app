import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { authService } from '@services/auth.service';
import type { OwnerProfile } from '@apptypes/index';

type AuthState = {
  mobile: string;
  verificationId: string | null;
  resendIn: number;
  profile: OwnerProfile | null;
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'failed';
  error: string | null;
};

const initialState: AuthState = {
  mobile: '',
  verificationId: null,
  resendIn: 24,
  profile: null,
  isAuthenticated: false,
  status: 'idle',
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  ({ email, password }: { email: string; password: string }) =>
    authService.login(email, password),
);

export const sendOtp = createAsyncThunk('auth/sendOtp', (mobile: string) =>
  authService.sendOtp(mobile),
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  ({
    mobile,
    code,
    verificationId,
  }: {
    mobile: string;
    code: string;
    verificationId: string;
  }) => authService.verifyOtp(mobile, code, verificationId),
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  (payload: Partial<OwnerProfile>) => authService.updateProfile(payload),
);

export const logout = createAsyncThunk('auth/logout', () =>
  authService.logout(),
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setMobile(state, action: PayloadAction<string>) {
      state.mobile = action.payload;
    },
    /**
     * The session ended without a sign-out — the account was deleted, and the
     * server revoked its tokens itself. Nothing of it is kept: not the profile,
     * and not the number the sign-in form was last given.
     */
    sessionCleared() {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'idle';
        state.profile = action.payload.profile;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Email or password is not correct';
      })
      .addCase(sendOtp.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(sendOtp.fulfilled, (state, action) => {
        state.status = 'idle';
        state.verificationId = action.payload.verificationId;
        state.resendIn = action.payload.resendIn;
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Could not send the code';
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.status = 'idle';
        state.profile = action.payload.profile;
        state.isAuthenticated = true;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'That code did not match';
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
      })
      .addCase(logout.fulfilled, state => {
        state.profile = null;
        state.isAuthenticated = false;
        state.verificationId = null;
      });
  },
});

export const { setMobile, sessionCleared } = authSlice.actions;
export default authSlice.reducer;
