import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { WalletProtectedRoute } from '../WalletProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';
import { WalletContextProvider } from '@/contexts/WalletContext';

import { vi } from 'vitest';

// Mock the hooks
const mockUseAuth = vi.fn();
const mockUseWallet = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock('@/contexts/WalletContext', () => ({
  WalletContextProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useWalletContext: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: false,
    accountInfo: null,
  }),
}));

// Create a mock store
const mockStore = configureStore({
  reducer: {
    wallet: (state = {}) => state,
  },
});

const TestChild = () => <div>Test Content</div>;

describe('WalletProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
    });

    mockUseWallet.mockReturnValue({
      isConnected: true,
      isConnecting: false,
    });
  });

  it('renders children when user is authenticated and wallet not required', () => {
    render(
      <Provider store={mockStore}>
        <AuthProvider>
          <WalletContextProvider>
            <WalletProtectedRoute requireWallet={false}>
              <TestChild />
            </WalletProtectedRoute>
          </WalletContextProvider>
        </AuthProvider>
      </Provider>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders children when user is authenticated and wallet is connected', () => {
    render(
      <Provider store={mockStore}>
        <AuthProvider>
          <WalletContextProvider>
            <WalletProtectedRoute requireWallet={true}>
              <TestChild />
            </WalletProtectedRoute>
          </WalletContextProvider>
        </AuthProvider>
      </Provider>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('shows wallet connection prompt when wallet is required but not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      isConnecting: false,
    });

    render(
      <Provider store={mockStore}>
        <AuthProvider>
          <WalletContextProvider>
            <WalletProtectedRoute requireWallet={true}>
              <TestChild />
            </WalletProtectedRoute>
          </WalletContextProvider>
        </AuthProvider>
      </Provider>
    );

    expect(screen.getByText('Wallet Connection Required')).toBeInTheDocument();
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('shows loading state when wallet is connecting', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      isConnecting: true,
    });

    render(
      <Provider store={mockStore}>
        <AuthProvider>
          <WalletContextProvider>
            <WalletProtectedRoute requireWallet={true}>
              <TestChild />
            </WalletProtectedRoute>
          </WalletContextProvider>
        </AuthProvider>
      </Provider>
    );

    expect(screen.getByText('Connecting wallet...')).toBeInTheDocument();
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });
});
