import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { WalletAuthIntegration } from '../WalletAuthIntegration';
import { AuthProvider } from '@/contexts/AuthContext';
import { WalletContextProvider } from '@/contexts/WalletContext';

import { vi } from 'vitest';

// Mock the hooks
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    isConnected: false,
    accountInfo: null,
    disconnect: vi.fn(),
  }),
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

describe('WalletAuthIntegration', () => {
  it('renders without crashing', () => {
    render(
      <Provider store={mockStore}>
        <AuthProvider>
          <WalletContextProvider>
            <WalletAuthIntegration />
          </WalletContextProvider>
        </AuthProvider>
      </Provider>
    );
  });

  it('does not render any visible content', () => {
    const { container } = render(
      <Provider store={mockStore}>
        <AuthProvider>
          <WalletContextProvider>
            <WalletAuthIntegration />
          </WalletContextProvider>
        </AuthProvider>
      </Provider>
    );

    // The component itself returns null, but the mocked providers render divs
    // So we check that there's no text content from the WalletAuthIntegration component
    expect(container.textContent).toBe('');
  });
});
