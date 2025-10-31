/**
 * Types for wallet balance validation requirements
 */

export interface WalletBalanceRequirement {
    /** Required amount for transaction */
    transactionFee: number;
    /** Required amount for escrow */
    escrowAmount: number;
    /** Platform fee to be deducted from escrow */
    platformFee: number;
    /** Total amount needed in wallet */
    totalRequired: number;
    /** Currency (e.g., 'HBAR', 'USD') */
    currency: string;
}

export interface WalletBalanceValidation {
    /** Whether wallet has sufficient balance */
    isSufficient: boolean;
    /** Current wallet balance */
    currentBalance: number;
    /** Required balance breakdown */
    requirement: WalletBalanceRequirement;
    /** Amount short (if insufficient) */
    shortfall?: number;
    /** Validation error message */
    errorMessage?: string;
}

export interface WalletConnectionValidation {
    /** Whether wallet is connected */
    isConnected: boolean;
    /** Wallet address if connected */
    walletAddress?: string;
    /** Error message if not connected */
    errorMessage?: string;
    /** Detailed diagnostic information for debugging */
    diagnostics?: any;
    /** Actionable recommendations for fixing connection issues */
    recommendations?: string[];
    /** Whether the validation can be retried */
    canRetry?: boolean;
}

export interface SwapWalletValidation {
    /** Wallet connection status */
    connection: WalletConnectionValidation;
    /** Balance validation (only if connected) */
    balance?: WalletBalanceValidation;
    /** Whether validation passed */
    isValid: boolean;
    /** Combined error messages */
    errors: string[];
}

export interface ProposalWalletValidation extends SwapWalletValidation {
    /** Type of proposal (cash vs booking exchange) */
    proposalType: 'cash' | 'booking_exchange' | 'both';
}

