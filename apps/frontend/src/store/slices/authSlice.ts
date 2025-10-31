import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  walletAddress: string;
  displayName?: string;
  email?: string;
  verificationLevel: 'basic' | 'verified' | 'premium';
}

interface SyncStatus {
  lastSyncTime: string | null; // ISO string instead of Date object
  syncSource: 'localStorage' | 'authContext' | 'api' | null;
  hasSyncError: boolean;
  syncErrorMessage: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  walletConnected: boolean;
  loading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  walletConnected: false,
  loading: false,
  error: null,
  syncStatus: {
    lastSyncTime: null,
    syncSource: null,
    hasSyncError: false,
    syncErrorMessage: null,
  },
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
    initializeFromAuthContext: (state, action: PayloadAction<{
      user: User;
      isAuthenticated: boolean;
      syncSource: 'localStorage' | 'authContext' | 'api';
    }>) => {
      state.user = action.payload.user;
      state.isAuthenticated = action.payload.isAuthenticated;
      state.loading = false;
      state.error = null;
      state.syncStatus = {
        lastSyncTime: new Date().toISOString(),
        syncSource: action.payload.syncSource,
        hasSyncError: false,
        syncErrorMessage: null,
      };
    },
    setSyncStatus: (state, action: PayloadAction<Partial<SyncStatus>>) => {
      state.syncStatus = {
        ...state.syncStatus,
        ...action.payload,
      };
    },
    setSyncError: (state, action: PayloadAction<string>) => {
      state.syncStatus.hasSyncError = true;
      state.syncStatus.syncErrorMessage = action.payload;
    },
    clearSyncError: (state) => {
      state.syncStatus.hasSyncError = false;
      state.syncStatus.syncErrorMessage = null;
    },
    logout: state => {
      state.isAuthenticated = false;
      state.user = null;
      state.walletConnected = false;
      state.error = null;
      state.syncStatus = {
        lastSyncTime: new Date().toISOString(),
        syncSource: null,
        hasSyncError: false,
        syncErrorMessage: null,
      };
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
  initializeFromAuthContext,
  setSyncStatus,
  setSyncError,
  clearSyncError,
  logout,
  clearError,
} = authSlice.actions;
