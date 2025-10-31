import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { WalletStatusIndicator } from './WalletStatusIndicator';
import { walletSlice } from '@/store/slices/walletSlice';
import { WalletErrorType } from '@/types/wallet';

// Example store setup
const exampleStore = configureStore({
  reducer: {
    wallet: walletSlice.reducer,
  },
  preloadedState: {
    wallet: {
      isConnected: true,
      currentProvider: 'hashpack',
      accountInfo: {
        accountId: '0.0.123456',
        balance: '1000.50',
        network: 'mainnet' as const,
      },
      connectionStatus: 'connected' as const,
      error: null,
      availableProviders: ['hashpack', 'blade'],
      preferences: {
        lastUsedProvider: 'hashpack',
        autoConnect: true,
      },
    },
  },
});

// Example usage components
export const WalletStatusIndicatorExamples: React.FC = () => {
  return (
    <Provider store={exampleStore}>
      <div
        style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <h2>Wallet Status Indicator Examples</h2>

        <div>
          <h3>Detailed Variant (Default)</h3>
          <WalletStatusIndicator />
        </div>

        <div>
          <h3>Compact Variant</h3>
          <WalletStatusIndicator variant="compact" />
        </div>

        <div>
          <h3>Minimal Variant</h3>
          <WalletStatusIndicator variant="minimal" />
        </div>

        <div>
          <h3>Without Network Display</h3>
          <WalletStatusIndicator showNetwork={false} />
        </div>

        <div>
          <h3>Without Error Details</h3>
          <WalletStatusIndicator showErrorDetails={false} />
        </div>
      </div>
    </Provider>
  );
};

// Example with different states
export const WalletStatusStatesExample: React.FC = () => {
  const createStoreWithState = (walletState: any) => {
    return configureStore({
      reducer: {
        wallet: walletSlice.reducer,
      },
      preloadedState: {
        wallet: {
          isConnected: false,
          currentProvider: null,
          accountInfo: null,
          connectionStatus: 'idle' as const,
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

  return (
    <div
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <h2>Different Connection States</h2>

      <div>
        <h3>Idle State</h3>
        <Provider store={createStoreWithState({ connectionStatus: 'idle' })}>
          <WalletStatusIndicator />
        </Provider>
      </div>

      <div>
        <h3>Connecting State</h3>
        <Provider
          store={createStoreWithState({ connectionStatus: 'connecting' })}
        >
          <WalletStatusIndicator />
        </Provider>
      </div>

      <div>
        <h3>Connected State (Mainnet)</h3>
        <Provider
          store={createStoreWithState({
            connectionStatus: 'connected',
            isConnected: true,
            accountInfo: {
              accountId: '0.0.123456',
              balance: '1000.50',
              network: 'mainnet',
            },
          })}
        >
          <WalletStatusIndicator />
        </Provider>
      </div>

      <div>
        <h3>Connected State (Testnet)</h3>
        <Provider
          store={createStoreWithState({
            connectionStatus: 'connected',
            isConnected: true,
            accountInfo: {
              accountId: '0.0.789012',
              balance: '50.25',
              network: 'testnet',
            },
          })}
        >
          <WalletStatusIndicator />
        </Provider>
      </div>

      <div>
        <h3>Error State - Provider Not Found</h3>
        <Provider
          store={createStoreWithState({
            connectionStatus: 'error',
            error: {
              type: WalletErrorType.PROVIDER_NOT_FOUND,
              message:
                'HashPack wallet extension not found. Please install it from the Chrome Web Store.',
            },
          })}
        >
          <WalletStatusIndicator />
        </Provider>
      </div>

      <div>
        <h3>Error State - Connection Rejected</h3>
        <Provider
          store={createStoreWithState({
            connectionStatus: 'error',
            error: {
              type: WalletErrorType.CONNECTION_REJECTED,
              message: 'User rejected the connection request.',
            },
          })}
        >
          <WalletStatusIndicator />
        </Provider>
      </div>

      <div>
        <h3>Error State - Wrong Network</h3>
        <Provider
          store={createStoreWithState({
            connectionStatus: 'error',
            error: {
              type: WalletErrorType.WRONG_NETWORK,
              message: 'Please switch your wallet to the Hedera mainnet.',
            },
          })}
        >
          <WalletStatusIndicator />
        </Provider>
      </div>
    </div>
  );
};

export default WalletStatusIndicatorExamples;
