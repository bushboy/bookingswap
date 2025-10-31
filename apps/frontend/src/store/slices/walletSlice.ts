import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  WalletState,
  WalletError,
  AccountInfo,
  ConnectionStatus,
  WalletConnection,
} from '../../types/wallet';

interface WalletSliceState extends WalletState {
  availableProviders: string[];
  preferences: {
    lastUsedProvider: string | null;
    autoConnect: boolean;
  };
}

const initialState: WalletSliceState = {
  isConnected: false,
  currentProvider: null,
  accountInfo: null,
  connectionStatus: 'idle',
  error: null,
  availableProviders: [],
  preferences: {
    lastUsedProvider: null,
    autoConnect: false,
  },
};

export const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    // Connection lifecycle actions
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
      if (action.payload === 'connecting') {
        state.error = null;
      }
    },

    connectWalletStart: (state, action: PayloadAction<string>) => {
      state.connectionStatus = 'connecting';
      state.currentProvider = action.payload;
      state.error = null;
    },

    connectWalletSuccess: (
      state,
      action: PayloadAction<{
        connection: WalletConnection;
        accountInfo: AccountInfo;
        provider: string;
      }>
    ) => {
      const { connection, accountInfo, provider } = action.payload;
      state.isConnected = connection.isConnected;
      state.currentProvider = provider;
      state.accountInfo = accountInfo;
      state.connectionStatus = 'connected';
      state.error = null;
      state.preferences.lastUsedProvider = provider;
    },

    connectWalletFailure: (state, action: PayloadAction<WalletError>) => {
      state.isConnected = false;
      state.currentProvider = null;
      state.accountInfo = null;
      state.connectionStatus = 'error';
      state.error = action.payload;
    },

    disconnectWallet: state => {
      state.isConnected = false;
      state.currentProvider = null;
      state.accountInfo = null;
      state.connectionStatus = 'idle';
      state.error = null;
    },

    // Account info updates
    updateAccountInfo: (state, action: PayloadAction<AccountInfo>) => {
      state.accountInfo = action.payload;
    },

    updateBalance: (state, action: PayloadAction<string>) => {
      if (state.accountInfo) {
        state.accountInfo.balance = action.payload;
      }
    },

    // Provider management
    setAvailableProviders: (state, action: PayloadAction<string[]>) => {
      state.availableProviders = action.payload;
    },

    addAvailableProvider: (state, action: PayloadAction<string>) => {
      if (!state.availableProviders.includes(action.payload)) {
        state.availableProviders.push(action.payload);
      }
    },

    removeAvailableProvider: (state, action: PayloadAction<string>) => {
      state.availableProviders = state.availableProviders.filter(
        provider => provider !== action.payload
      );
    },

    // Error handling
    setError: (state, action: PayloadAction<WalletError | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.connectionStatus = 'error';
      }
    },

    clearError: state => {
      state.error = null;
      if (state.connectionStatus === 'error') {
        state.connectionStatus = state.isConnected ? 'connected' : 'idle';
      }
    },

    // Preferences
    setPreferences: (
      state,
      action: PayloadAction<Partial<WalletSliceState['preferences']>>
    ) => {
      state.preferences = { ...state.preferences, ...action.payload };
    },

    setAutoConnect: (state, action: PayloadAction<boolean>) => {
      state.preferences.autoConnect = action.payload;
    },

    // Reset state
    resetWalletState: () => initialState,
  },
});

export const {
  setConnectionStatus,
  connectWalletStart,
  connectWalletSuccess,
  connectWalletFailure,
  disconnectWallet,
  updateAccountInfo,
  updateBalance,
  setAvailableProviders,
  addAvailableProvider,
  removeAvailableProvider,
  setError,
  clearError,
  setPreferences,
  setAutoConnect,
  resetWalletState,
} = walletSlice.actions;
