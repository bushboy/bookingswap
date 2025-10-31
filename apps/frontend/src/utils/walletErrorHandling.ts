import { WalletError, WalletErrorType } from '../types/wallet';

/**
 * User-friendly error messages for wallet operations
 * Maps wallet error types to detailed user guidance
 */
export const WALLET_ERROR_MESSAGES = {
  [WalletErrorType.PROVIDER_NOT_FOUND]: {
    title: 'Wallet Not Found',
    message: 'The selected wallet extension is not installed or not available.',
    suggestion: 'Please install the wallet extension and refresh the page.',
    actions: ['install_wallet', 'refresh_page'],
    retryable: false,
    severity: 'error' as const,
    explanation:
      'Wallet extensions must be installed in your browser to connect. Each wallet provider has their own browser extension.',
  },
  [WalletErrorType.CONNECTION_REJECTED]: {
    title: 'Connection Declined',
    message: 'You declined the wallet connection request.',
    suggestion:
      'Click "Connect Wallet" again and approve the connection to continue.',
    actions: ['retry_connection'],
    retryable: true,
    severity: 'warning' as const,
    explanation:
      'Wallet connections require your explicit approval for security. You can try connecting again at any time.',
  },
  [WalletErrorType.WALLET_LOCKED]: {
    title: 'Wallet Locked',
    message: 'Your wallet is currently locked and needs to be unlocked.',
    suggestion:
      'Please unlock your wallet using your password or PIN and try connecting again.',
    actions: ['unlock_wallet', 'retry_connection'],
    retryable: true,
    severity: 'warning' as const,
    explanation:
      'For security, wallets automatically lock after periods of inactivity. Unlock your wallet to access your accounts.',
  },
  [WalletErrorType.WRONG_NETWORK]: {
    title: 'Wrong Network',
    message: 'Your wallet is connected to the wrong network.',
    suggestion:
      'Please switch your wallet to the Hedera mainnet and try again.',
    actions: ['switch_network', 'retry_connection'],
    retryable: true,
    severity: 'warning' as const,
    explanation:
      "This application requires connection to the Hedera mainnet. Check your wallet's network settings.",
  },
  [WalletErrorType.NETWORK_ERROR]: {
    title: 'Network Connection Error',
    message: 'Unable to connect to the Hedera network.',
    suggestion: 'Please check your internet connection and try again.',
    actions: ['check_connection', 'retry_connection'],
    retryable: true,
    severity: 'error' as const,
    explanation:
      'Network issues can be temporary. Check your internet connection and the Hedera network status.',
  },
  [WalletErrorType.UNKNOWN_ERROR]: {
    title: 'Connection Error',
    message: 'An unexpected error occurred while connecting to your wallet.',
    suggestion: 'Please try again. If the problem persists, contact support.',
    actions: ['retry_connection', 'contact_support'],
    retryable: true,
    severity: 'error' as const,
    explanation:
      'Unexpected errors can occur due to various factors. Most issues resolve with a retry.',
  },
};

export interface WalletErrorDisplayInfo {
  title: string;
  message: string;
  suggestion: string;
  actions: string[];
  retryable: boolean;
  severity: 'error' | 'warning' | 'info';
  explanation?: string;
  context?: Record<string, any>;
}

/**
 * Get user-friendly error display information for wallet errors
 */
export const getWalletErrorDisplayInfo = (
  error: WalletError | Error
): WalletErrorDisplayInfo => {
  // Handle WalletError objects
  if (isWalletError(error)) {
    const errorInfo = WALLET_ERROR_MESSAGES[error.type];
    return {
      ...errorInfo,
      context: error.details,
    };
  }

  // Handle generic Error objects - try to infer wallet error type
  const inferredType = inferWalletErrorType(error);
  if (inferredType) {
    const errorInfo = WALLET_ERROR_MESSAGES[inferredType];
    return {
      ...errorInfo,
      context: { originalError: error.message },
    };
  }

  // Fallback for unknown errors
  return {
    title: 'Wallet Error',
    message: 'An unexpected error occurred with your wallet.',
    suggestion: 'Please try again or contact support if the problem persists.',
    actions: ['retry_connection', 'contact_support'],
    retryable: true,
    severity: 'error',
    context: { originalError: error.message },
  };
};

/**
 * Check if an error is a WalletError
 */
export const isWalletError = (error: any): error is WalletError => {
  return (
    error && typeof error === 'object' && 'type' in error && 'message' in error
  );
};

/**
 * Infer wallet error type from generic error messages
 */
export const inferWalletErrorType = (error: Error): WalletErrorType | null => {
  const message = error.message.toLowerCase();

  if (message.includes('user rejected') || message.includes('user denied')) {
    return WalletErrorType.CONNECTION_REJECTED;
  }

  if (message.includes('locked') || message.includes('unlock')) {
    return WalletErrorType.WALLET_LOCKED;
  }

  if (message.includes('network') || message.includes('chain')) {
    return WalletErrorType.WRONG_NETWORK;
  }

  if (
    message.includes('not found') ||
    message.includes('not installed') ||
    message.includes('not available')
  ) {
    return WalletErrorType.PROVIDER_NOT_FOUND;
  }

  if (
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('fetch')
  ) {
    return WalletErrorType.NETWORK_ERROR;
  }

  return null;
};

/**
 * Create a standardized wallet error
 */
export const createWalletError = (
  type: WalletErrorType,
  message: string,
  details?: any
): WalletError => {
  return {
    type,
    message,
    details,
  };
};

/**
 * Enhanced error handler for wallet operations with context
 */
export class WalletErrorHandler {
  /**
   * Handle provider detection errors
   */
  static handleProviderError(error: Error, providerId: string): WalletError {
    const message = `${providerId} wallet is not available. Please install the ${providerId} extension.`;
    return createWalletError(WalletErrorType.PROVIDER_NOT_FOUND, message, {
      providerId,
      originalError: error,
    });
  }

  /**
   * Handle connection errors with provider context
   */
  static handleConnectionError(error: Error, providerId: string): WalletError {
    const inferredType = inferWalletErrorType(error);

    if (inferredType) {
      return createWalletError(inferredType, error.message, {
        providerId,
        originalError: error,
      });
    }

    return createWalletError(
      WalletErrorType.UNKNOWN_ERROR,
      `Failed to connect to ${providerId}: ${error.message}`,
      { providerId, originalError: error }
    );
  }

  /**
   * Handle network-related errors
   */
  static handleNetworkError(
    error: Error,
    expectedNetwork?: string
  ): WalletError {
    if (expectedNetwork) {
      return createWalletError(
        WalletErrorType.WRONG_NETWORK,
        `Please switch your wallet to ${expectedNetwork}`,
        { expectedNetwork, originalError: error }
      );
    }

    return createWalletError(
      WalletErrorType.NETWORK_ERROR,
      'Network connection error. Please check your connection.',
      { originalError: error }
    );
  }

  /**
   * Handle account info retrieval errors
   */
  static handleAccountError(error: Error): WalletError {
    if (error.message.includes('locked')) {
      return createWalletError(
        WalletErrorType.WALLET_LOCKED,
        'Please unlock your wallet to access account information.',
        { originalError: error }
      );
    }

    return createWalletError(
      WalletErrorType.UNKNOWN_ERROR,
      'Failed to retrieve account information.',
      { originalError: error }
    );
  }
}

/**
 * Retry configuration for different wallet operations
 */
export const WALLET_RETRY_CONFIG = {
  connection: {
    maxRetries: 3,
    baseDelay: 1000,
    backoffMultiplier: 1.5,
    retryableErrors: [
      WalletErrorType.NETWORK_ERROR,
      WalletErrorType.UNKNOWN_ERROR,
    ],
  },
  accountInfo: {
    maxRetries: 2,
    baseDelay: 500,
    backoffMultiplier: 2,
    retryableErrors: [
      WalletErrorType.NETWORK_ERROR,
      WalletErrorType.UNKNOWN_ERROR,
    ],
  },
  balance: {
    maxRetries: 3,
    baseDelay: 1000,
    backoffMultiplier: 2,
    retryableErrors: [
      WalletErrorType.NETWORK_ERROR,
      WalletErrorType.UNKNOWN_ERROR,
    ],
  },
};

/**
 * Determine if a wallet error is retryable
 */
export const isWalletErrorRetryable = (
  error: WalletError,
  operation: keyof typeof WALLET_RETRY_CONFIG
): boolean => {
  const config = WALLET_RETRY_CONFIG[operation];
  return config.retryableErrors.includes(error.type);
};

/**
 * Create a retry handler for wallet operations
 */
export const createWalletRetryHandler = (
  operation: keyof typeof WALLET_RETRY_CONFIG
) => {
  const config = WALLET_RETRY_CONFIG[operation];

  return async <T>(
    operationFn: () => Promise<T>,
    shouldRetry?: (error: WalletError, attempt: number) => boolean
  ): Promise<T> => {
    let lastError: WalletError;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        return await operationFn();
      } catch (error) {
        const walletError = isWalletError(error)
          ? error
          : createWalletError(
              WalletErrorType.UNKNOWN_ERROR,
              error instanceof Error ? error.message : 'Unknown error',
              error
            );

        lastError = walletError;

        // Check if error is retryable
        const isRetryable = shouldRetry
          ? shouldRetry(walletError, attempt)
          : isWalletErrorRetryable(walletError, operation);

        if (!isRetryable || attempt === config.maxRetries) {
          break;
        }

        // Calculate delay with jitter
        const delay =
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        const jitter = Math.random() * 0.1 * delay;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }

    throw lastError!;
  };
};

/**
 * Format wallet error for user display with action buttons
 */
export const formatWalletErrorForUser = (
  error: WalletError | Error
): {
  title: string;
  message: string;
  details?: string;
  explanation?: string;
  actions: Array<{
    label: string;
    action: string;
    primary?: boolean;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  }>;
  severity: 'error' | 'warning' | 'info';
} => {
  const errorInfo = getWalletErrorDisplayInfo(error);

  const actionMap = {
    install_wallet: {
      label: 'Install Wallet',
      action: 'install_wallet',
      primary: true,
      variant: 'primary' as const,
    },
    refresh_page: {
      label: 'Refresh Page',
      action: 'refresh_page',
      variant: 'outline' as const,
    },
    retry_connection: {
      label: 'Try Again',
      action: 'retry_connection',
      primary: true,
      variant: 'primary' as const,
    },
    unlock_wallet: {
      label: 'Unlock Wallet',
      action: 'unlock_wallet',
      variant: 'outline' as const,
    },
    switch_network: {
      label: 'Switch Network',
      action: 'switch_network',
      primary: true,
      variant: 'primary' as const,
    },
    check_connection: {
      label: 'Check Connection',
      action: 'check_connection',
      variant: 'outline' as const,
    },
    contact_support: {
      label: 'Contact Support',
      action: 'contact_support',
      variant: 'ghost' as const,
    },
  };

  const actions = errorInfo.actions.map(
    actionKey =>
      actionMap[actionKey as keyof typeof actionMap] || {
        label: 'OK',
        action: 'dismiss',
        variant: 'ghost' as const,
      }
  );

  return {
    title: errorInfo.title,
    message: errorInfo.message,
    details: errorInfo.suggestion,
    explanation: errorInfo.explanation,
    actions,
    severity: errorInfo.severity,
  };
};

/**
 * Provider-specific error handling utilities
 */
export const PROVIDER_ERROR_HANDLERS = {
  hashpack: {
    detectInstallation: () => {
      return typeof window !== 'undefined' && 'hashpack' in window;
    },
    getInstallUrl: () =>
      'https://chrome.google.com/webstore/detail/hashpack/gjagmgiddbbciopjhllkdnddhcglnemk',
    handleSpecificErrors: (error: Error): WalletError | null => {
      if (error.message.includes('HashPack')) {
        return createWalletError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'HashPack wallet extension is not installed.',
          {
            installUrl:
              'https://chrome.google.com/webstore/detail/hashpack/gjagmgiddbbciopjhllkdnddhcglnemk',
          }
        );
      }
      return null;
    },
  },
  blade: {
    detectInstallation: () => {
      return typeof window !== 'undefined' && 'bladeWallet' in window;
    },
    getInstallUrl: () =>
      'https://chrome.google.com/webstore/detail/blade-hedera-web3-digital/abogmiocnneedmmepnohnhlijcjpcifd',
    handleSpecificErrors: (error: Error): WalletError | null => {
      if (error.message.includes('Blade')) {
        return createWalletError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'Blade wallet extension is not installed.',
          {
            installUrl:
              'https://chrome.google.com/webstore/detail/blade-hedera-web3-digital/abogmiocnneedmmepnohnhlijcjpcifd',
          }
        );
      }
      return null;
    },
  },
};

/**
 * Get provider-specific error handling
 */
export const getProviderErrorHandler = (providerId: string) => {
  return (
    PROVIDER_ERROR_HANDLERS[
      providerId as keyof typeof PROVIDER_ERROR_HANDLERS
    ] || {
      detectInstallation: () => false,
      getInstallUrl: () => '#',
      handleSpecificErrors: () => null,
    }
  );
};
