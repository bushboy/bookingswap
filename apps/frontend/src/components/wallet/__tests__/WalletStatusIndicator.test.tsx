import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { WalletStatusIndicator } from '../WalletStatusIndicator';
import { walletSlice } from '@/store/slices/walletSlice';
import { WalletErrorType, ConnectionStatus } from '@/types/wallet';

// Mock the LoadingSpinner component
jest.mock('@/components/ui/LoadingIndicator', () => ({
  LoadingSpinner: ({ size, color }: { size: string; color: string }) => (
    <div data-testid="loading-spinner" data-size={size} data-color={color}>
      Loading...
    </div>
  ),
}));

// Helper function to create a mock store
const createMockStore = (walletState: any) => {
  return configureStore({
    reducer: {
      wallet: walletSlice.reducer,
    },
    preloadedState: {
      wallet: {
        isConnected: false,
        currentProvider: null,
        accountInfo: null,
        connectionStatus: 'idle' as ConnectionStatus,
        error: null,
        availableProviders: [],
        preferences: {
          lastUsedProvider: null,
          autoConnect: false,
        },
        ...walletState,
      },
    },
  });
};

// Helper function to render component with store
const renderWithStore = (
  component: React.ReactElement,
  walletState: any = {}
) => {
  const store = createMockStore(walletState);
  return render(<Provider store={store}>{component}</Provider>);
};

describe('WalletStatusIndicator', () => {
  describe('Connection Status Display', () => {
    it('should display "Not Connected" status when idle', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'idle',
        isConnected: false,
      });

      expect(screen.getByText('Not Connected')).toBeInTheDocument();
    });

    it('should display "Connecting..." status when connecting', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connecting',
        isConnected: false,
      });

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should display "Connected" status when connected', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connected',
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.0',
          network: 'mainnet',
        },
      });

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should display "Connection Error" status when error', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
        isConnected: false,
        error: {
          type: WalletErrorType.NETWORK_ERROR,
          message: 'Network connection failed',
        },
      });

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });
  });

  describe('Network Display', () => {
    it('should display mainnet network when connected', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connected',
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.0',
          network: 'mainnet',
        },
      });

      expect(screen.getByText('Mainnet')).toBeInTheDocument();
    });

    it('should display testnet network when connected', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connected',
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.0',
          network: 'testnet',
        },
      });

      expect(screen.getByText('Testnet')).toBeInTheDocument();
    });

    it('should not display network when not connected', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'idle',
        isConnected: false,
      });

      expect(screen.queryByText('Mainnet')).not.toBeInTheDocument();
      expect(screen.queryByText('Testnet')).not.toBeInTheDocument();
    });

    it('should not display network when showNetwork is false', () => {
      renderWithStore(<WalletStatusIndicator showNetwork={false} />, {
        connectionStatus: 'connected',
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.0',
          network: 'mainnet',
        },
      });

      expect(screen.queryByText('Mainnet')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display provider not found error', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
        error: {
          type: WalletErrorType.PROVIDER_NOT_FOUND,
          message: 'HashPack wallet extension not found',
        },
      });

      expect(screen.getByText('Wallet not installed')).toBeInTheDocument();
      expect(
        screen.getByText('HashPack wallet extension not found')
      ).toBeInTheDocument();
    });

    it('should display connection rejected error', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
        error: {
          type: WalletErrorType.CONNECTION_REJECTED,
          message: 'User rejected the connection request',
        },
      });

      expect(screen.getByText('Connection rejected')).toBeInTheDocument();
    });

    it('should display wallet locked error', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
        error: {
          type: WalletErrorType.WALLET_LOCKED,
          message: 'Please unlock your wallet',
        },
      });

      expect(screen.getByText('Wallet locked')).toBeInTheDocument();
    });

    it('should display wrong network error', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
        error: {
          type: WalletErrorType.WRONG_NETWORK,
          message: 'Please switch to mainnet',
        },
      });

      expect(screen.getByText('Wrong network')).toBeInTheDocument();
    });

    it('should display network error', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
        error: {
          type: WalletErrorType.NETWORK_ERROR,
          message: 'Network connection failed',
        },
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should display unknown error', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
        error: {
          type: WalletErrorType.UNKNOWN_ERROR,
          message: 'An unexpected error occurred',
        },
      });

      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('should not display error details when showErrorDetails is false', () => {
      renderWithStore(<WalletStatusIndicator showErrorDetails={false} />, {
        connectionStatus: 'error',
        error: {
          type: WalletErrorType.NETWORK_ERROR,
          message: 'Network connection failed',
        },
      });

      expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Network connection failed')
      ).not.toBeInTheDocument();
    });
  });

  describe('Variant Rendering', () => {
    it('should render minimal variant correctly', () => {
      const { container } = renderWithStore(
        <WalletStatusIndicator variant="minimal" />,
        {
          connectionStatus: 'connected',
          isConnected: true,
          accountInfo: {
            accountId: '0.0.123456',
            balance: '100.0',
            network: 'mainnet',
          },
        }
      );

      // Should not show status text in minimal variant
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
      // Should still show network
      expect(screen.getByText('Mainnet')).toBeInTheDocument();
    });

    it('should render compact variant correctly', () => {
      renderWithStore(<WalletStatusIndicator variant="compact" />, {
        connectionStatus: 'connected',
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.0',
          network: 'mainnet',
        },
      });

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Mainnet')).toBeInTheDocument();
    });

    it('should render detailed variant correctly', () => {
      renderWithStore(<WalletStatusIndicator variant="detailed" />, {
        connectionStatus: 'error',
        error: {
          type: WalletErrorType.NETWORK_ERROR,
          message: 'Detailed error message',
        },
      });

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Detailed error message')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading spinner when connecting', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connecting',
      });

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('data-size', 'sm');
    });

    it('should not show loading spinner when not connecting', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connected',
        isConnected: true,
      });

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for status indicator', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connected',
        isConnected: true,
      });

      expect(
        screen.getByLabelText('Connection status: Connected')
      ).toBeInTheDocument();
    });

    it('should have proper aria-label for different statuses', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
      });

      expect(
        screen.getByLabelText('Connection status: Connection Error')
      ).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('should apply custom className', () => {
      const { container } = renderWithStore(
        <WalletStatusIndicator className="custom-class" />,
        { connectionStatus: 'idle' }
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should apply custom styles', () => {
      const customStyle = { backgroundColor: 'red' };
      const { container } = renderWithStore(
        <WalletStatusIndicator style={customStyle} />,
        { connectionStatus: 'idle' }
      );

      expect(container.firstChild).toHaveStyle('background-color: red');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing network gracefully', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connected',
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.0',
          network: null,
        },
      });

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.queryByText('Mainnet')).not.toBeInTheDocument();
      expect(screen.queryByText('Testnet')).not.toBeInTheDocument();
    });

    it('should handle unknown network type', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'connected',
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.0',
          network: 'unknown-network',
        },
      });

      expect(screen.getByText('Unknown-network')).toBeInTheDocument();
    });

    it('should handle missing error type', () => {
      renderWithStore(<WalletStatusIndicator />, {
        connectionStatus: 'error',
        error: {
          type: null,
          message: 'Some error occurred',
        },
      });

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });
  });
});
