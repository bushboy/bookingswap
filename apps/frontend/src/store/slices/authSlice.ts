import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  walletAddress: string;
  displayName?: string;
  email?: string;
  verificationLevel: 'basic' | 'verified' | 'premium';
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  walletConnected: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  walletConnected: false,
  loading: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setWalletConnected: (state, action: PayloadAction<boolean>) => {
      state.walletConnected = action.payload;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    logout: state => {
      state.isAuthenticated = false;
      state.user = null;
      state.walletConnected = false;
      state.error = null;
    },
    clearError: state => {
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setWalletConnected,
  setUser,
  logout,
  clearError,
} = authSlice.actions;
