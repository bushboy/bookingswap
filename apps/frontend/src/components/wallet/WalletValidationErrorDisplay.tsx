import React from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { WalletConnectionGuidance } from './WalletConnectionGuidance';
// Import types from shared package
import {
    SwapWalletValidation
} from '@booking-swap/shared';

/**
 * Swap type enumeration for error display
 */
export enum SwapType {
    BOOKING_EXCHANGE = 'booking_exchange',
    CASH_ENABLED = 'cash_enabled'
}

/**
 * Extended validation interface with swap type information
 */
interface SwapTypeValidationResult extends SwapWalletValidation {
    swapType?: SwapType;
    typeSpecificErrors?: string[];
}

interface WalletValidationErrorDisplayProps {
    validation: SwapTypeValidationResult;
    onConnectWallet?: () => void;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
    isWalletActuallyConnected?: boolean;
}



function getBalanceErrorMessage(swapType?: SwapType): string {
    if (swapType === SwapType.CASH_ENABLED) {
        return 'Your wallet does not have enough funds to create this cash-enabled swap.';
    } else if (swapType === SwapType.BOOKING_EXCHANGE) {
        return 'Your wallet does not have enough funds to create this booking exchange swap.';
    }
    return 'Your wallet does not have enough funds to create this swap.';
}

function getBalanceGuidanceMessage(swapType?: SwapType): string {
    if (swapType === SwapType.CASH_ENABLED) {
        return 'For cash-enabled swaps, you need funds for escrow deposits, platform fees, and transaction costs. Please add funds to your wallet before creating this swap.';
    } else if (swapType === SwapType.BOOKING_EXCHANGE) {
        return 'For booking exchange swaps, you only need to cover transaction fees. Please add funds to your wallet before creating this swap.';
    }
    return 'Please add funds to your wallet before creating this swap.';
}

function getSwapTypeErrorTitle(swapType?: SwapType): string {
    if (swapType === SwapType.CASH_ENABLED) {
        return 'Cash-Enabled Swap Configuration Issues';
    } else if (swapType === SwapType.BOOKING_EXCHANGE) {
        return 'Booking Exchange Swap Configuration Issues';
    }
    return 'Swap Configuration Issues';
}

export const WalletValidationErrorDisplay: React.FC<WalletValidationErrorDisplayProps> = ({
    validation,
    onConnectWallet,
    onRetry,
    onDismiss,
    className = '',
    isWalletActuallyConnected = false,
}) => {
    if (validation.isValid) {
        return null;
    }

    const { connection, balance, swapType, typeSpecificErrors } = validation;

    // Connection error display - use the new guidance component
    // Only show connection guidance if wallet is actually not connected
    if (!connection.isConnected && !isWalletActuallyConnected) {
        return (
            <WalletConnectionGuidance
                className={className}
                onConnectWallet={onConnectWallet}
                onDismiss={onDismiss}
                showSteps={true}
            />
        );
    }

    // Balance error display
    if (balance && !balance.isSufficient) {
        return (
            <div
                className={className}
                style={{
                    padding: tokens.spacing[4],
                    backgroundColor: tokens.colors.error[50],
                    border: `1px solid ${tokens.colors.error[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    marginBottom: tokens.spacing[4],
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: tokens.spacing[3],
                    }}
                >
                    <div
                        style={{
                            fontSize: '24px',
                            color: tokens.colors.error[600],
                            marginTop: tokens.spacing[1],
                        }}
                    >
                        💰
                    </div>

                    <div style={{ flex: 1 }}>
                        <h3
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.error[800],
                                margin: `0 0 ${tokens.spacing[2]} 0`,
                            }}
                        >
                            Insufficient Wallet Balance
                        </h3>

                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                color: tokens.colors.error[700],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                                lineHeight: 1.5,
                            }}
                        >
                            {getBalanceErrorMessage(swapType)}
                        </p>

                        {/* Balance breakdown */}
                        <div
                            style={{
                                padding: tokens.spacing[3],
                                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                borderRadius: tokens.borderRadius.sm,
                                marginBottom: tokens.spacing[3],
                            }}
                        >
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    gap: tokens.spacing[2],
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.error[700],
                                }}
                            >
                                <div>Current Balance:</div>
                                <div style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                    {balance.currentBalance.toFixed(2)} {balance.requirement.currency}
                                </div>

                                <div>Required Amount:</div>
                                <div style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                    {balance.requirement.totalRequired.toFixed(2)} {balance.requirement.currency}
                                </div>

                                <div style={{ paddingLeft: tokens.spacing[2] }}>- Transaction Fee:</div>
                                <div>{balance.requirement.transactionFee.toFixed(2)} {balance.requirement.currency}</div>

                                {balance.requirement.escrowAmount > 0 && (
                                    <>
                                        <div style={{ paddingLeft: tokens.spacing[2] }}>- Escrow Amount:</div>
                                        <div>{balance.requirement.escrowAmount.toFixed(2)} {balance.requirement.currency}</div>

                                        <div style={{ paddingLeft: tokens.spacing[2] }}>- Platform Fee:</div>
                                        <div>{balance.requirement.platformFee.toFixed(2)} {balance.requirement.currency}</div>
                                    </>
                                )}

                                <div
                                    style={{
                                        borderTop: `1px solid ${tokens.colors.error[200]}`,
                                        paddingTop: tokens.spacing[2],
                                        fontWeight: tokens.typography.fontWeight.semibold,
                                    }}
                                >
                                    Shortfall:
                                </div>
                                <div
                                    style={{
                                        borderTop: `1px solid ${tokens.colors.error[200]}`,
                                        paddingTop: tokens.spacing[2],
                                        fontWeight: tokens.typography.fontWeight.semibold,
                                        color: tokens.colors.error[800],
                                    }}
                                >
                                    {balance.shortfall?.toFixed(2)} {balance.requirement.currency}
                                </div>
                            </div>
                        </div>

                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.error[600],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                                fontStyle: 'italic',
                            }}
                        >
                            💡 {getBalanceGuidanceMessage(swapType)}
                        </p>

                        <div
                            style={{
                                display: 'flex',
                                gap: tokens.spacing[2],
                                marginTop: tokens.spacing[3],
                            }}
                        >
                            {onRetry && (
                                <Button onClick={onRetry} variant="primary" size="sm">
                                    Check Balance Again
                                </Button>
                            )}
                            <Button
                                onClick={() => window.open('https://portal.hedera.com/', '_blank')}
                                variant="outline"
                                size="sm"
                            >
                                Add Funds
                            </Button>
                        </div>
                    </div>

                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: tokens.colors.error[600],
                                cursor: 'pointer',
                                fontSize: '18px',
                                padding: tokens.spacing[1],
                            }}
                            aria-label="Dismiss error"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Type-specific validation errors
    if (typeSpecificErrors && typeSpecificErrors.length > 0) {
        return (
            <div
                className={className}
                style={{
                    padding: tokens.spacing[4],
                    backgroundColor: tokens.colors.warning[50],
                    border: `1px solid ${tokens.colors.warning[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    marginBottom: tokens.spacing[4],
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: tokens.spacing[3],
                    }}
                >
                    <div
                        style={{
                            fontSize: '24px',
                            color: tokens.colors.warning[600],
                            marginTop: tokens.spacing[1],
                        }}
                    >
                        ⚙️
                    </div>

                    <div style={{ flex: 1 }}>
                        <h3
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.warning[800],
                                margin: `0 0 ${tokens.spacing[2]} 0`,
                            }}
                        >
                            {getSwapTypeErrorTitle(swapType)}
                        </h3>

                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                color: tokens.colors.warning[700],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                                lineHeight: 1.5,
                            }}
                        >
                            {typeSpecificErrors.map((error: string, index: number) => (
                                <p key={index} style={{ margin: `0 0 ${tokens.spacing[2]} 0` }}>
                                    • {error}
                                </p>
                            ))}
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                gap: tokens.spacing[2],
                                marginTop: tokens.spacing[3],
                            }}
                        >
                            {onRetry && (
                                <Button onClick={onRetry} variant="primary" size="sm">
                                    Try Again
                                </Button>
                            )}
                        </div>
                    </div>

                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: tokens.colors.warning[600],
                                cursor: 'pointer',
                                fontSize: '18px',
                                padding: tokens.spacing[1],
                            }}
                            aria-label="Dismiss error"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Generic validation error
    return (
        <div
            className={className}
            style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.error[50],
                border: `1px solid ${tokens.colors.error[200]}`,
                borderRadius: tokens.borderRadius.md,
                marginBottom: tokens.spacing[4],
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: tokens.spacing[3],
                }}
            >
                <div
                    style={{
                        fontSize: '24px',
                        color: tokens.colors.error[600],
                        marginTop: tokens.spacing[1],
                    }}
                >
                    ⚠️
                </div>

                <div style={{ flex: 1 }}>
                    <h3
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.error[800],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        Wallet Validation Failed
                    </h3>

                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.error[700],
                            margin: `0 0 ${tokens.spacing[3]} 0`,
                            lineHeight: 1.5,
                        }}
                    >
                        {validation.errors.map((error: string, index: number) => (
                            <p key={index} style={{ margin: `0 0 ${tokens.spacing[1]} 0` }}>
                                {error}
                            </p>
                        ))}
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: tokens.spacing[2],
                            marginTop: tokens.spacing[3],
                        }}
                    >
                        {onRetry && (
                            <Button onClick={onRetry} variant="primary" size="sm">
                                Try Again
                            </Button>
                        )}
                    </div>
                </div>

                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: tokens.colors.error[600],
                            cursor: 'pointer',
                            fontSize: '18px',
                            padding: tokens.spacing[1],
                        }}
                        aria-label="Dismiss error"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
};

interface WalletConnectionStatusProps {
    isConnected: boolean;
    walletAddress?: string;
    isValidating?: boolean;
    isRecovering?: boolean;
    className?: string;
}

export const WalletConnectionStatus: React.FC<WalletConnectionStatusProps> = ({
    isConnected,
    walletAddress,
    isValidating = false,
    isRecovering = false,
    className = '',
}) => {
    if (isValidating) {
        const message = isRecovering ? 'Recovering wallet connection...' : 'Validating wallet...';
        const bgColor = isRecovering ? tokens.colors.success[50] : tokens.colors.primary[50];
        const borderColor = isRecovering ? tokens.colors.success[200] : tokens.colors.primary[200];
        const textColor = isRecovering ? tokens.colors.success[700] : tokens.colors.primary[700];
        const spinnerColor = isRecovering ? tokens.colors.success[600] : tokens.colors.primary[600];

        return (
            <div
                className={className}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    backgroundColor: bgColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: tokens.borderRadius.sm,
                    fontSize: tokens.typography.fontSize.sm,
                    color: textColor,
                }}
            >
                <div
                    style={{
                        width: '16px',
                        height: '16px',
                        border: `2px solid ${borderColor}`,
                        borderTop: `2px solid ${spinnerColor}`,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }}
                />
                <span>{message}</span>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div
                className={className}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    backgroundColor: tokens.colors.warning[50],
                    border: `1px solid ${tokens.colors.warning[200]}`,
                    borderRadius: tokens.borderRadius.sm,
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.warning[700],
                }}
            >
                <span>🔗</span>
                <span>No wallet connected</span>
            </div>
        );
    }

    return (
        <div
            className={className}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                backgroundColor: tokens.colors.success[50],
                border: `1px solid ${tokens.colors.success[200]}`,
                borderRadius: tokens.borderRadius.sm,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.success[700],
            }}
        >
            <span>✅</span>
            <span>
                Connected: {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'Unknown'}
            </span>
        </div>
    );
};