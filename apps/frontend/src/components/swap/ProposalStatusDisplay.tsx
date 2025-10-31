import React, { useState } from 'react';
import { tokens } from '../../design-system/tokens';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';
import { BlockchainStatusDisplay } from './BlockchainStatusDisplay';
import { Button } from '../ui/Button';
import { PaymentTransaction, PaymentStatus } from '@booking-swap/shared';

export interface ProposalStatusData {
    // Payment information
    paymentTransaction?: PaymentTransaction;
    paymentStatus?: PaymentStatus;
    paymentAmount?: number;
    paymentCurrency?: string;
    paymentError?: string;
    isPaymentProcessing?: boolean;

    // Blockchain information
    blockchainTransactionId?: string;
    blockchainConsensusTimestamp?: string;
    blockchainStatus?: 'pending' | 'confirmed' | 'failed';
    blockchainError?: string;
    isBlockchainProcessing?: boolean;

    // General information
    proposalId: string;
    actionType: 'accept' | 'reject';
    overallStatus: 'processing' | 'completed' | 'failed' | 'partial';
}

export interface ProposalStatusDisplayProps {
    /** Proposal status data */
    statusData: ProposalStatusData;

    /** Whether to show in compact mode */
    compact?: boolean;

    /** Whether to show detailed information by default */
    showDetailsDefault?: boolean;

    /** Whether to allow expanding/collapsing details */
    allowToggleDetails?: boolean;

    /** Callback when retry is requested */
    onRetry?: (proposalId: string) => void;

    /** Whether retry is available */
    canRetry?: boolean;

    /** Custom styling */
    className?: string;
}

export const ProposalStatusDisplay: React.FC<ProposalStatusDisplayProps> = ({
    statusData,
    compact = false,
    showDetailsDefault = false,
    allowToggleDetails = true,
    onRetry,
    canRetry = false,
    className = '',
}) => {
    const [showDetails, setShowDetails] = useState(showDetailsDefault);

    const {
        paymentTransaction,
        paymentStatus,
        paymentAmount,
        paymentCurrency,
        paymentError,
        isPaymentProcessing,
        blockchainTransactionId,
        blockchainConsensusTimestamp,
        blockchainStatus,
        blockchainError,
        isBlockchainProcessing,
        proposalId,
        actionType,
        overallStatus,
    } = statusData;

    // Determine if we have payment or blockchain information to show
    const hasPaymentInfo = paymentTransaction || paymentAmount || paymentStatus || paymentError || isPaymentProcessing;
    const hasBlockchainInfo = blockchainTransactionId || blockchainStatus || blockchainError || isBlockchainProcessing;

    // Overall status configuration
    const overallStatusConfig = {
        processing: {
            icon: '⏳',
            label: 'Processing',
            color: tokens.colors.primary[600],
            bgColor: tokens.colors.primary[50],
            borderColor: tokens.colors.primary[200],
            description: 'Your proposal response is being processed'
        },
        completed: {
            icon: '✅',
            label: 'Completed',
            color: tokens.colors.success[600],
            bgColor: tokens.colors.success[50],
            borderColor: tokens.colors.success[200],
            description: `Proposal ${actionType}ed successfully`
        },
        failed: {
            icon: '❌',
            label: 'Failed',
            color: tokens.colors.error[600],
            bgColor: tokens.colors.error[50],
            borderColor: tokens.colors.error[200],
            description: 'There was an error processing your response'
        },
        partial: {
            icon: '⚠️',
            label: 'Partially Completed',
            color: tokens.colors.warning[600],
            bgColor: tokens.colors.warning[50],
            borderColor: tokens.colors.warning[200],
            description: 'Some operations completed, but others failed'
        }
    };

    const config = overallStatusConfig[overallStatus] || overallStatusConfig.processing;

    // Don't render if no relevant information
    if (!hasPaymentInfo && !hasBlockchainInfo) {
        return null;
    }

    // Compact display
    if (compact) {
        return (
            <div
                className={className}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    backgroundColor: config.bgColor,
                    border: `1px solid ${config.borderColor}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.sm,
                }}
            >
                <span style={{ fontSize: '16px' }}>{config.icon}</span>
                <span style={{ color: config.color, fontWeight: tokens.typography.fontWeight.medium }}>
                    {config.label}
                </span>

                {hasPaymentInfo && (
                    <PaymentStatusDisplay
                        paymentTransaction={paymentTransaction}
                        status={paymentStatus}
                        amount={paymentAmount}
                        currency={paymentCurrency}
                        isProcessing={isPaymentProcessing}
                        error={paymentError}
                        compact={true}
                    />
                )}

                {hasBlockchainInfo && (
                    <BlockchainStatusDisplay
                        transactionId={blockchainTransactionId}
                        consensusTimestamp={blockchainConsensusTimestamp}
                        status={blockchainStatus}
                        isProcessing={isBlockchainProcessing}
                        error={blockchainError}
                        actionType={actionType}
                        compact={true}
                    />
                )}
            </div>
        );
    }

    // Full display
    return (
        <div
            className={className}
            style={{
                backgroundColor: 'white',
                border: `2px solid ${config.borderColor}`,
                borderRadius: tokens.borderRadius.lg,
                overflow: 'hidden',
                marginBottom: tokens.spacing[4],
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: tokens.spacing[4],
                    backgroundColor: config.bgColor,
                    borderBottom: `1px solid ${config.borderColor}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[3],
                        }}
                    >
                        <span style={{ fontSize: '24px' }}>{config.icon}</span>
                        <div>
                            <h3
                                style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: config.color,
                                    margin: 0,
                                }}
                            >
                                {config.label}
                            </h3>
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

                    <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                        {allowToggleDetails && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDetails(!showDetails)}
                                style={{
                                    color: config.color,
                                }}
                            >
                                {showDetails ? 'Hide Details' : 'Show Details'}
                            </Button>
                        )}

                        {canRetry && onRetry && overallStatus === 'failed' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRetry(proposalId)}
                                style={{
                                    borderColor: config.color,
                                    color: config.color,
                                }}
                            >
                                🔄 Retry
                            </Button>
                        )}
                    </div>
                </div>

                {/* Progress indicator for processing */}
                {overallStatus === 'processing' && (
                    <div
                        style={{
                            marginTop: tokens.spacing[3],
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                height: '6px',
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
                    </div>
                )}
            </div>

            {/* Content */}
            <div
                style={{
                    padding: tokens.spacing[4],
                }}
            >
                {/* Payment Status */}
                {hasPaymentInfo && (
                    <div style={{ marginBottom: hasBlockchainInfo ? tokens.spacing[4] : 0 }}>
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[800],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                            }}
                        >
                            <span>💳</span>
                            Payment Processing
                        </h4>
                        <PaymentStatusDisplay
                            paymentTransaction={paymentTransaction}
                            status={paymentStatus}
                            amount={paymentAmount}
                            currency={paymentCurrency}
                            isProcessing={isPaymentProcessing}
                            error={paymentError}
                            showDetails={showDetails}
                        />
                    </div>
                )}

                {/* Blockchain Status */}
                {hasBlockchainInfo && (
                    <div>
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[800],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                            }}
                        >
                            <span>🔗</span>
                            Blockchain Recording
                        </h4>
                        <BlockchainStatusDisplay
                            transactionId={blockchainTransactionId}
                            consensusTimestamp={blockchainConsensusTimestamp}
                            status={blockchainStatus}
                            isProcessing={isBlockchainProcessing}
                            error={blockchainError}
                            actionType={actionType}
                            showDetails={showDetails}
                        />
                    </div>
                )}

                {/* Summary for completed status */}
                {overallStatus === 'completed' && (
                    <div
                        style={{
                            marginTop: tokens.spacing[4],
                            padding: tokens.spacing[3],
                            backgroundColor: tokens.colors.success[50],
                            border: `1px solid ${tokens.colors.success[200]}`,
                            borderRadius: tokens.borderRadius.md,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                            }}
                        >
                            <span style={{ fontSize: '20px' }}>🎉</span>
                            <div>
                                <h5
                                    style={{
                                        fontSize: tokens.typography.fontSize.base,
                                        fontWeight: tokens.typography.fontWeight.semibold,
                                        color: tokens.colors.success[800],
                                        margin: 0,
                                    }}
                                >
                                    All Operations Completed Successfully
                                </h5>
                                <p
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.success[700],
                                        margin: 0,
                                    }}
                                >
                                    Your proposal {actionType} has been fully processed and recorded.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error summary for failed status */}
                {overallStatus === 'failed' && (
                    <div
                        style={{
                            marginTop: tokens.spacing[4],
                            padding: tokens.spacing[3],
                            backgroundColor: tokens.colors.error[50],
                            border: `1px solid ${tokens.colors.error[200]}`,
                            borderRadius: tokens.borderRadius.md,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                            }}
                        >
                            <span style={{ fontSize: '20px' }}>⚠️</span>
                            <div>
                                <h5
                                    style={{
                                        fontSize: tokens.typography.fontSize.base,
                                        fontWeight: tokens.typography.fontWeight.semibold,
                                        color: tokens.colors.error[800],
                                        margin: 0,
                                    }}
                                >
                                    Operation Failed
                                </h5>
                                <p
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.error[700],
                                        margin: 0,
                                    }}
                                >
                                    There was an error processing your proposal {actionType}.
                                    {canRetry && ' You can try again using the retry button above.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes progress-indeterminate {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default ProposalStatusDisplay;