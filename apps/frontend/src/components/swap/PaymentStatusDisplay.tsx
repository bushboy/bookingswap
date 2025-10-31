import React from 'react';
import { tokens } from '../../design-system/tokens';
import { PaymentTransaction, PaymentStatus } from '@booking-swap/shared';

export interface PaymentStatusDisplayProps {
    /** Payment transaction data */
    paymentTransaction?: PaymentTransaction;

    /** Current payment status */
    status?: PaymentStatus;

    /** Amount being processed */
    amount?: number;

    /** Currency code */
    currency?: string;

    /** Whether payment is currently processing */
    isProcessing?: boolean;

    /** Payment error message if any */
    error?: string;

    /** Compact display mode */
    compact?: boolean;

    /** Show detailed transaction info */
    showDetails?: boolean;
}

export const PaymentStatusDisplay: React.FC<PaymentStatusDisplayProps> = ({
    paymentTransaction,
    status,
    amount,
    currency = 'USD',
    isProcessing = false,
    error,
    compact = false,
    showDetails = false,
}) => {
    // Determine the display status
    const displayStatus = paymentTransaction?.status || status || (isProcessing ? 'processing' : 'pending');
    const displayAmount = paymentTransaction?.amount || amount || 0;
    const displayCurrency = paymentTransaction?.currency || currency;

    // Status configuration
    const statusConfig = {
        pending: {
            icon: '⏳',
            label: 'Payment Pending',
            color: tokens.colors.warning[600],
            bgColor: tokens.colors.warning[50],
            borderColor: tokens.colors.warning[200],
            description: 'Payment is being prepared'
        },
        processing: {
            icon: '💳',
            label: 'Processing Payment',
            color: tokens.colors.primary[600],
            bgColor: tokens.colors.primary[50],
            borderColor: tokens.colors.primary[200],
            description: 'Payment is being processed'
        },
        completed: {
            icon: '✅',
            label: 'Payment Completed',
            color: tokens.colors.success[600],
            bgColor: tokens.colors.success[50],
            borderColor: tokens.colors.success[200],
            description: 'Payment has been successfully processed'
        },
        failed: {
            icon: '❌',
            label: 'Payment Failed',
            color: tokens.colors.error[600],
            bgColor: tokens.colors.error[50],
            borderColor: tokens.colors.error[200],
            description: 'Payment processing failed'
        },
        refunded: {
            icon: '↩️',
            label: 'Payment Refunded',
            color: tokens.colors.neutral[600],
            bgColor: tokens.colors.neutral[50],
            borderColor: tokens.colors.neutral[200],
            description: 'Payment has been refunded'
        },
        rolled_back: {
            icon: '🔄',
            label: 'Payment Rolled Back',
            color: tokens.colors.neutral[600],
            bgColor: tokens.colors.neutral[50],
            borderColor: tokens.colors.neutral[200],
            description: 'Payment has been rolled back'
        }
    };

    const config = statusConfig[displayStatus] || statusConfig.pending;

    const formatCurrency = (amount: number, currency: string): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    const formatDate = (date: Date): string => {
        return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Compact display
    if (compact) {
        return (
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                    backgroundColor: config.bgColor,
                    border: `1px solid ${config.borderColor}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.sm,
                    color: config.color,
                }}
            >
                <span>{config.icon}</span>
                <span>{formatCurrency(displayAmount, displayCurrency)}</span>
                {isProcessing && (
                    <div
                        style={{
                            width: '12px',
                            height: '12px',
                            border: `2px solid ${config.color}`,
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                )}
            </div>
        );
    }

    // Full display
    return (
        <div
            style={{
                padding: tokens.spacing[4],
                backgroundColor: config.bgColor,
                border: `1px solid ${config.borderColor}`,
                borderRadius: tokens.borderRadius.lg,
                marginBottom: tokens.spacing[3],
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: tokens.spacing[3],
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                    }}
                >
                    <span style={{ fontSize: '20px' }}>{config.icon}</span>
                    <div>
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: config.color,
                                margin: 0,
                            }}
                        >
                            {config.label}
                        </h4>
                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                                margin: 0,
                            }}
                        >
                            {config.description}
                        </p>
                    </div>
                </div>

                <div
                    style={{
                        textAlign: 'right',
                    }}
                >
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.bold,
                            color: config.color,
                        }}
                    >
                        {formatCurrency(displayAmount, displayCurrency)}
                    </div>
                    {paymentTransaction?.platformFee && (
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[500],
                            }}
                        >
                            Fee: {formatCurrency(paymentTransaction.platformFee, displayCurrency)}
                        </div>
                    )}
                </div>
            </div>

            {/* Progress indicator for processing */}
            {(isProcessing || displayStatus === 'processing') && (
                <div
                    style={{
                        marginBottom: tokens.spacing[3],
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '4px',
                            backgroundColor: tokens.colors.neutral[200],
                            borderRadius: tokens.borderRadius.full,
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: config.color,
                                animation: 'progress-indeterminate 2s ease-in-out infinite',
                            }}
                        />
                    </div>
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.neutral[600],
                            margin: `${tokens.spacing[1]} 0 0 0`,
                            textAlign: 'center',
                        }}
                    >
                        Processing payment...
                    </p>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div
                    style={{
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.error[50],
                        border: `1px solid ${tokens.colors.error[200]}`,
                        borderRadius: tokens.borderRadius.md,
                        marginBottom: tokens.spacing[3],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>⚠️</span>
                        <div>
                            <h5
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.error[800],
                                    margin: 0,
                                }}
                            >
                                Payment Error
                            </h5>
                            <p
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.error[700],
                                    margin: 0,
                                }}
                            >
                                {error}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction details */}
            {showDetails && paymentTransaction && (
                <div
                    style={{
                        borderTop: `1px solid ${config.borderColor}`,
                        paddingTop: tokens.spacing[3],
                    }}
                >
                    <h5
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[700],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        Transaction Details
                    </h5>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: tokens.spacing[2],
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                        }}
                    >
                        <div>
                            <strong>Transaction ID:</strong>
                            <br />
                            <code style={{ fontSize: tokens.typography.fontSize.xs }}>
                                {paymentTransaction.id}
                            </code>
                        </div>
                        <div>
                            <strong>Gateway ID:</strong>
                            <br />
                            <code style={{ fontSize: tokens.typography.fontSize.xs }}>
                                {paymentTransaction.gatewayTransactionId}
                            </code>
                        </div>
                        {paymentTransaction.completedAt && (
                            <div>
                                <strong>Completed:</strong>
                                <br />
                                {formatDate(paymentTransaction.completedAt)}
                            </div>
                        )}
                        {paymentTransaction.netAmount && (
                            <div>
                                <strong>Net Amount:</strong>
                                <br />
                                {formatCurrency(paymentTransaction.netAmount, displayCurrency)}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes progress-indeterminate {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default PaymentStatusDisplay;