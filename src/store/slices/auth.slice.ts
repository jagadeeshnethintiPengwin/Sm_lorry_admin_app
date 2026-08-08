import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { authService, MOCK_OWNER } from '@services/auth.service';
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
    /** The mock signs the owner straight in so every screen has a profile. */
    hydrateMockOwner(state) {
      state.profile = MOCK_OWNER;
    },
  },
  extraReducers: builder => {
    builder
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

export const { setMobile, hydrateMockOwner } = authSlice.actions;
export default authSlice.reducer;
