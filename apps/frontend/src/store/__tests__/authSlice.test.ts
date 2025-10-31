import { describe, it, expect } from 'vitest';
import {
  authSlice,
  setUser,
  logout,
  setWalletConnected,
} from '../slices/authSlice';

describe('authSlice', () => {
  const initialState = {
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

  it('should return the initial state', () => {
    expect(authSlice.reducer(undefined, { type: undefined })).toEqual(
      initialState
    );
  });

  it('should handle setUser', () => {
    const user = {
      id: '1',
      walletAddress: '0.0.123456',
      displayName: 'Test User',
      email: 'test@example.com',
      verificationLevel: 'verified' as const,
    };

    const actual = authSlice.reducer(initialState, setUser(user));
    expect(actual.user).toEqual(user);
    expect(actual.isAuthenticated).toBe(true);
    expect(actual.error).toBe(null);
  });

  it('should handle logout', () => {
    const authenticatedState = {
      ...initialState,
      isAuthenticated: true,
      user: {
        id: '1',
        walletAddress: '0.0.123456',
        displayName: 'Test User',
        verificationLevel: 'verified' as const,
      },
      walletConnected: true,
    };

    const actual = authSlice.reducer(authenticatedState, logout());
    expect(actual.isAuthenticated).toBe(false);
    expect(actual.user).toBe(null);
    expect(actual.walletConnected).toBe(false);
    expect(actual.error).toBe(null);
  });

  it('should handle setWalletConnected', () => {
    const actual = authSlice.reducer(initialState, setWalletConnected(true));
    expect(actual.walletConnected).toBe(true);
  });
});
