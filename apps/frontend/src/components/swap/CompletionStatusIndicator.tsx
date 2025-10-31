import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import {
    CompletedSwapInfo,
    CompletedBookingInfo,
    SwapCompletionErrorCodes
} from '@booking-swap/shared';

export interface CompletionStatus {
    id: string;
    status: 'initiated' | 'processing' | 'completed' | 'failed' | 'rolled_back';
    completionType: 'booking_exchange' | 'cash_payment';
    completedAt?: Date;
    initiatedAt: Date;
    completedSwaps: CompletedSwapInfo[];
    updatedBookings: CompletedBookingInfo[];
    errorDetails?: string;
    errorCode?: SwapCompletionErrorCodes;
    blockchainTransactionId?: string;
    validationWarnings?: string[];
}

interface CompletionStatusIndicatorProps {
    completion: CompletionStatus;
    onViewDetails?: (completionId: string) => void;
    onRetry?: (completionId: string) => void;
    compact?: boolean;
    showTimeline?: boolean;
}

export const CompletionStatusIndicator: React.FC<CompletionStatusIndicatorProps> = ({
    completion,
    onViewDetails,
    onRetry,
    compact = false,
    showTimeline = true,
}) => {
    const getStatusConfig = (status: CompletionStatus['status']) => {
        switch (status) {
            case 'initiated':
                return {
                    icon: '🔄',
                    label: 'Initiated',
                    color: tokens.colors.primary[500],
                    bgColor: tokens.colors.primary[50],
                    borderColor: tokens.colors.primary[200],
                    description: 'Completion workflow has been started',
                };
            case 'processing':
                return {
                    icon: '⚡',
                    label: 'Processing',
                    color: tokens.colors.warning[600],
                    bgColor: tokens.colors.warning[50],
                    borderColor: tokens.colors.warning[200],
                    description: 'Updating related swaps and bookings',
                };
            case 'completed':
                return {
                    icon: '✅',
                    label: 'Completed',
                    color: tokens.colors.success[600],
                    bgColor: tokens.colors.success[50],
                    borderColor: tokens.colors.success[200],
                    description: 'All entities successfully updated',
                };
            case 'failed':
                return {
                    icon: '❌',
                    label: 'Failed',
                    color: tokens.colors.error[600],
                    bgColor: tokens.colors.error[50],
                    borderColor: tokens.colors.error[200],
                    description: 'Completion workflow failed',
                };
            case 'rolled_back':
                return {
                    icon: '↩️',
                    label: 'Rolled Back',
                    color: tokens.colors.neutral[600],
                    bgColor: tokens.colors.neutral[50],
                    borderColor: tokens.colors.neutral[200],
                    description: 'Changes have been reverted',
                };
            default:
                return {
                    icon: '❓',
                    label: 'Unknown',
                    color: tokens.colors.neutral[500],
                    bgColor: tokens.colors.neutral[50],
                    borderColor: tokens.colors.neutral[200],
                    description: 'Status unknown',
                };
        }
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(date));
    };

    const getCompletionTypeLabel = (type: CompletionStatus['completionType']) => {
        return type === 'booking_exchange' ? 'Booking Exchange' : 'Cash Payment';
    };

    const statusConfig = getStatusConfig(completion.status);
    const isProcessing = completion.status === 'initiated' || completion.status === 'processing';
    const canRetry = completion.status === 'failed' && onRetry;

    if (compact) {
        return (
            <Card variant="outlined" padding="small">
                <CardContent style={{ padding: tokens.spacing[3] }}>
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
                                gap: tokens.spacing[2],
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '20px',
                                    animation: isProcessing ? 'spin 2s linear infinite' : 'none',
                                }}
                            >
                                {statusConfig.icon}
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        color: statusConfig.color,
                                    }}
                                >
                                    {statusConfig.label}
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    {getCompletionTypeLabel(completion.completionType)}
                                </div>
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                            }}
                        >
                            {canRetry && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onRetry(completion.id)}
                                >
                                    Retry
                                </Button>
                            )}
                            {onViewDetails && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onViewDetails(completion.id)}
                                >
                                    Details
                                </Button>
                            )}
                        </div>
                    </div>

                    {completion.validationWarnings && completion.validationWarnings.length > 0 && (
                        <div
                            style={{
                                marginTop: tokens.spacing[2],
                                padding: tokens.spacing[2],
                                backgroundColor: tokens.colors.warning[50],
                                border: `1px solid ${tokens.colors.warning[200]}`,
                                borderRadius: tokens.borderRadius.sm,
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.warning[700],
                            }}
                        >
                            ⚠️ {completion.validationWarnings.length} validation warning(s)
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card
            variant="outlined"
            style={{
                borderColor: statusConfig.borderColor,
                backgroundColor: statusConfig.bgColor,
            }}
        >
            <CardContent>
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: tokens.spacing[4],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[3],
                        }}
                    >
                        <div
                            style={{
                                fontSize: '32px',
                                animation: isProcessing ? 'spin 2s linear infinite' : 'none',
                            }}
                        >
                            {statusConfig.icon}
                        </div>
                        <div>
                            <h3
                                style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: statusConfig.color,
                                    margin: 0,
                                    marginBottom: tokens.spacing[1],
                                }}
                            >
                                Completion {statusConfig.label}
                            </h3>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                {statusConfig.description}
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                        }}
                    >
                        {canRetry && (
                            <Button
                                variant="outline"
                                onClick={() => onRetry(completion.id)}
                            >
                                Retry Completion
                            </Button>
                        )}
                        {onViewDetails && (
                            <Button
                                variant="outline"
                                onClick={() => onViewDetails(completion.id)}
                            >
                                View Details
                            </Button>
                        )}
                    </div>
                </div>

                {/* Completion Info */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: tokens.spacing[4],
                        marginBottom: tokens.spacing[4],
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                                marginBottom: tokens.spacing[1],
                            }}
                        >
                            Completion Type
                        </div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[900],
                            }}
                        >
                            {getCompletionTypeLabel(completion.completionType)}
                        </div>
                    </div>

                    <div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                                marginBottom: tokens.spacing[1],
                            }}
                        >
                            Initiated
                        </div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                color: tokens.colors.neutral[900],
                            }}
                        >
                            {formatDate(completion.initiatedAt)}
                        </div>
                    </div>

                    {completion.completedAt && (
                        <div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                    marginBottom: tokens.spacing[1],
                                }}
                            >
                                Completed
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.base,
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {formatDate(completion.completedAt)}
                            </div>
                        </div>
                    )}

                    {completion.blockchainTransactionId && (
                        <div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                    marginBottom: tokens.spacing[1],
                                }}
                            >
                                Blockchain TX
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontFamily: 'monospace',
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {completion.blockchainTransactionId.slice(0, 8)}...
                                {completion.blockchainTransactionId.slice(-8)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Affected Entities */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: tokens.spacing[4],
                        marginBottom: tokens.spacing[4],
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            Updated Swaps ({completion.completedSwaps.length})
                        </div>
                        {completion.completedSwaps.map((swap) => (
                            <div
                                key={swap.swapId}
                                style={{
                                    padding: tokens.spacing[2],
                                    backgroundColor: tokens.colors.white,
                                    border: `1px solid ${tokens.colors.neutral[200]}`,
                                    borderRadius: tokens.borderRadius.sm,
                                    marginBottom: tokens.spacing[2],
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontFamily: 'monospace',
                                        color: tokens.colors.neutral[900],
                                        marginBottom: tokens.spacing[1],
                                    }}
                                >
                                    {swap.swapId.slice(0, 8)}...{swap.swapId.slice(-8)}
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    {swap.previousStatus} → {swap.newStatus}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            Updated Bookings ({completion.updatedBookings.length})
                        </div>
                        {completion.updatedBookings.map((booking) => (
                            <div
                                key={booking.bookingId}
                                style={{
                                    padding: tokens.spacing[2],
                                    backgroundColor: tokens.colors.white,
                                    border: `1px solid ${tokens.colors.neutral[200]}`,
                                    borderRadius: tokens.borderRadius.sm,
                                    marginBottom: tokens.spacing[2],
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontFamily: 'monospace',
                                        color: tokens.colors.neutral[900],
                                        marginBottom: tokens.spacing[1],
                                    }}
                                >
                                    {booking.bookingId.slice(0, 8)}...{booking.bookingId.slice(-8)}
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    {booking.previousStatus} → {booking.newStatus}
                                    {booking.newOwnerId && ' (ownership transferred)'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline */}
                {showTimeline && (
                    <div
                        style={{
                            padding: tokens.spacing[3],
                            backgroundColor: tokens.colors.white,
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                            borderRadius: tokens.borderRadius.md,
                            marginBottom: tokens.spacing[4],
                        }}
                    >
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                                marginBottom: tokens.spacing[3],
                            }}
                        >
                            Completion Timeline
                        </div>
                        <div style={{ position: 'relative' }}>
                            {/* Timeline line */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '10px',
                                    top: '10px',
                                    bottom: '10px',
                                    width: '2px',
                                    backgroundColor: tokens.colors.neutral[200],
                                }}
                            />

                            {/* Timeline steps */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
                                    <div
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: tokens.colors.success[500],
                                            zIndex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: tokens.colors.white,
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.sm,
                                                fontWeight: tokens.typography.fontWeight.medium,
                                                color: tokens.colors.neutral[900],
                                            }}
                                        >
                                            Completion Initiated
                                        </div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.xs,
                                                color: tokens.colors.neutral[600],
                                            }}
                                        >
                                            {formatDate(completion.initiatedAt)}
                                        </div>
                                    </div>
                                </div>

                                {completion.completedAt && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                backgroundColor: completion.status === 'completed'
                                                    ? tokens.colors.success[500]
                                                    : tokens.colors.error[500],
                                                zIndex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: tokens.colors.white,
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    fontWeight: tokens.typography.fontWeight.medium,
                                                    color: tokens.colors.neutral[900],
                                                }}
                                            >
                                                Completion {completion.status === 'completed' ? 'Finished' : 'Failed'}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xs,
                                                    color: tokens.colors.neutral[600],
                                                }}
                                            >
                                                {formatDate(completion.completedAt)}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Validation Warnings */}
                {completion.validationWarnings && completion.validationWarnings.length > 0 && (
                    <div
                        style={{
                            padding: tokens.spacing[3],
                            backgroundColor: tokens.colors.warning[50],
                            border: `1px solid ${tokens.colors.warning[200]}`,
                            borderRadius: tokens.borderRadius.md,
                            marginBottom: tokens.spacing[4],
                        }}
                    >
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.warning[700],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            ⚠️ Validation Warnings
                        </div>
                        <ul
                            style={{
                                margin: 0,
                                paddingLeft: tokens.spacing[4],
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.warning[700],
                            }}
                        >
                            {completion.validationWarnings.map((warning, index) => (
                                <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                    {warning}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Error Details */}
                {completion.status === 'failed' && completion.errorDetails && (
                    <div
                        style={{
                            padding: tokens.spacing[3],
                            backgroundColor: tokens.colors.error[50],
                            border: `1px solid ${tokens.colors.error[200]}`,
                            borderRadius: tokens.borderRadius.md,
                        }}
                    >
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.error[700],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            ❌ Error Details
                        </div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.error[700],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            {completion.errorDetails}
                        </div>
                        {completion.errorCode && (
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    fontFamily: 'monospace',
                                    color: tokens.colors.error[600],
                                }}
                            >
                                Error Code: {completion.errorCode}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </Card>
    );
};