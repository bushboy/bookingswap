import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  WalletState,
  WalletError,
  AccountInfo,
  ConnectionStatus,
  WalletConnection,
} from '../../types/wallet';

// Serializable versions of wallet types
interface SerializableWalletError extends Omit<WalletError, 'timestamp'> {
  timestamp?: string; // ISO string instead of Date
}

interface SerializableAccountInfo extends Omit<AccountInfo, 'lastUpdated'> {
  lastUpdated?: string; // ISO string instead of Date
}

interface WalletSliceState extends Omit<WalletState, 'error'> {
  availableProviders: string[];
  preferences: {
    lastUsedProvider: string | null;
    autoConnect: boolean;
  };
  error: SerializableWalletError | null;
  accountInfo: SerializableAccountInfo | null;
  // New fields for reliability and serialization
  isInitialized: boolean;
  lastStateUpdate: string | null; // ISO string timestamp
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
  isInitialized: false,
  lastStateUpdate: null,
};

export const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    // Connection lifecycle actions
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
      state.lastStateUpdate = new Date().toISOString();
      if (action.payload === 'connecting') {
        state.error = null;
      }
    },

    connectWalletStart: (state, action: PayloadAction<string>) => {
      state.connectionStatus = 'connecting';
      state.currentProvider = action.payload;
      state.error = null;
      state.lastStateUpdate = new Date().toISOString();
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
      // Ensure accountInfo is serializable
      state.accountInfo = {
        ...accountInfo,
        lastUpdated: new Date().toISOString(),
      };
      state.connectionStatus = 'connected';
      state.error = null;
      state.preferences.lastUsedProvider = provider;
      state.lastStateUpdate = new Date().toISOString();
    },

    connectWalletFailure: (state, action: PayloadAction<WalletError>) => {
      state.isConnected = false;
      state.currentProvider = null;
      state.accountInfo = null;
      state.connectionStatus = 'error';
      // Ensure error is serializable
      state.error = {
        ...action.payload,
        timestamp: new Date().toISOString(),
      };
      state.lastStateUpdate = new Date().toISOString();
    },

    disconnectWallet: state => {
      state.isConnected = false;
      state.currentProvider = null;
      state.accountInfo = null;
      state.connectionStatus = 'idle';
      state.error = null;
      state.lastStateUpdate = new Date().toISOString();
    },

    // Account info updates
    updateAccountInfo: (state, action: PayloadAction<AccountInfo>) => {
      // Ensure accountInfo is serializable
      state.accountInfo = {
        ...action.payload,
        lastUpdated: new Date().toISOString(),
      };
      state.lastStateUpdate = new Date().toISOString();
    },

    updateBalance: (state, action: PayloadAction<string>) => {
      if (state.accountInfo) {
        state.accountInfo.balance = action.payload;
        state.accountInfo.lastUpdated = new Date().toISOString();
        state.lastStateUpdate = new Date().toISOString();
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
      if (action.payload) {
        // Ensure error is serializable
        state.error = {
          ...action.payload,
          timestamp: new Date().toISOString(),
        };
        state.connectionStatus = 'error';
      } else {
        state.error = null;
      }
      state.lastStateUpdate = new Date().toISOString();
    },

    clearError: state => {
      state.error = null;
      if (state.connectionStatus === 'error') {
        state.connectionStatus = state.isConnected ? 'connected' : 'idle';
      }
      state.lastStateUpdate = new Date().toISOString();
    },

    // Preferences
    setPreferences: (
      state,
      action: PayloadAction<Partial<WalletSliceState['preferences']>>
    ) => {
      state.preferences = { ...state.preferences, ...action.payload };
      state.lastStateUpdate = new Date().toISOString();
    },

    setAutoConnect: (state, action: PayloadAction<boolean>) => {
      state.preferences.autoConnect = action.payload;
      state.lastStateUpdate = new Date().toISOString();
    },

    // New action for initialization
    initializeWalletService: (state) => {
      state.isInitialized = true;
      state.lastStateUpdate = new Date().toISOString();
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
  initializeWalletService,
  resetWalletState,
} = walletSlice.actions;
