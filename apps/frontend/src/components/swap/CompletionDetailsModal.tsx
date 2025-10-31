import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import {
    SwapCompletionAudit,
    CompletionValidationResult,
    CorrectionAttempt
} from '@booking-swap/shared';

interface CompletionDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    completion: SwapCompletionAudit;
    onExport?: (completionId: string) => void;
    onRetry?: (completionId: string) => void;
}

export const CompletionDetailsModal: React.FC<CompletionDetailsModalProps> = ({
    isOpen,
    onClose,
    completion,
    onExport,
    onRetry,
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'entities' | 'validation' | 'blockchain' | 'audit'>('overview');

    const formatDate = (date: Date | string) => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(new Date(date));
    };

    const getStatusConfig = (status: SwapCompletionAudit['status']) => {
        switch (status) {
            case 'initiated':
                return { icon: '🔄', color: tokens.colors.primary[600], label: 'Initiated' };
            case 'completed':
                return { icon: '✅', color: tokens.colors.success[600], label: 'Completed' };
            case 'failed':
                return { icon: '❌', color: tokens.colors.error[600], label: 'Failed' };
            case 'rolled_back':
                return { icon: '↩️', color: tokens.colors.neutral[600], label: 'Rolled Back' };
            default:
                return { icon: '❓', color: tokens.colors.neutral[500], label: 'Unknown' };
        }
    };

    const statusConfig = getStatusConfig(completion.status);

    const TabButton: React.FC<{
        tab: typeof activeTab;
        label: string;
        count?: number;
    }> = ({ tab, label, count }) => (
        <button
            onClick={() => setActiveTab(tab)}
            style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                border: 'none',
                backgroundColor: activeTab === tab ? tokens.colors.primary[50] : 'transparent',
                color: activeTab === tab ? tokens.colors.primary[700] : tokens.colors.neutral[600],
                borderBottom: activeTab === tab ? `2px solid ${tokens.colors.primary[500]}` : '2px solid transparent',
                cursor: 'pointer',
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[1],
            }}
        >
            {label}
            {count !== undefined && (
                <span
                    style={{
                        backgroundColor: activeTab === tab ? tokens.colors.primary[100] : tokens.colors.neutral[200],
                        color: activeTab === tab ? tokens.colors.primary[700] : tokens.colors.neutral[600],
                        borderRadius: tokens.borderRadius.full,
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        minWidth: '20px',
                        textAlign: 'center',
                    }}
                >
                    {count}
                </span>
            )}
        </button>
    );

    const renderOverviewTab = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
            {/* Status Header */}
            <Card>
                <CardContent>
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
                        <div style={{ fontSize: '32px' }}>{statusConfig.icon}</div>
                        <div>
                            <h3
                                style={{
                                    fontSize: tokens.typography.fontSize.xl,
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
                                {completion.completionType === 'booking_exchange' ? 'Booking Exchange' : 'Cash Payment'}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Basic Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Completion Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: tokens.spacing[4],
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
                                Completion ID
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontFamily: 'monospace',
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {completion.id}
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
                                Proposal ID
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontFamily: 'monospace',
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {completion.proposalId}
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
                                Initiated By
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {completion.initiatedBy}
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
                                Completed At
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {formatDate(completion.completedAt)}
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
                                Database Transaction
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontFamily: 'monospace',
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {completion.databaseTransactionId}
                            </div>
                        </div>

                        {completion.blockchainTransactionId && (
                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[600],
                                        marginBottom: tokens.spacing[1],
                                    }}
                                >
                                    Blockchain Transaction
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontFamily: 'monospace',
                                        color: tokens.colors.neutral[900],
                                    }}
                                >
                                    {completion.blockchainTransactionId}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Error Details */}
            {completion.status === 'failed' && completion.errorDetails && (
                <Card>
                    <CardHeader>
                        <CardTitle style={{ color: tokens.colors.error[600] }}>
                            ❌ Error Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            style={{
                                padding: tokens.spacing[3],
                                backgroundColor: tokens.colors.error[50],
                                border: `1px solid ${tokens.colors.error[200]}`,
                                borderRadius: tokens.borderRadius.md,
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.error[700],
                            }}
                        >
                            {completion.errorDetails}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );

    const renderEntitiesTab = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
            {/* Affected Swaps */}
            <Card>
                <CardHeader>
                    <CardTitle>Affected Swaps ({completion.affectedSwaps.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {completion.affectedSwaps.length === 0 ? (
                        <div
                            style={{
                                textAlign: 'center',
                                color: tokens.colors.neutral[500],
                                fontSize: tokens.typography.fontSize.sm,
                                padding: tokens.spacing[4],
                            }}
                        >
                            No swaps were affected by this completion
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
                            {completion.affectedSwaps.map((swapId) => (
                                <div
                                    key={swapId}
                                    style={{
                                        padding: tokens.spacing[3],
                                        backgroundColor: tokens.colors.neutral[50],
                                        border: `1px solid ${tokens.colors.neutral[200]}`,
                                        borderRadius: tokens.borderRadius.md,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.sm,
                                                fontFamily: 'monospace',
                                                color: tokens.colors.neutral[900],
                                                marginBottom: tokens.spacing[1],
                                            }}
                                        >
                                            {swapId}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.xs,
                                                color: tokens.colors.neutral[600],
                                            }}
                                        >
                                            Status updated to "completed"
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        View Swap
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Affected Bookings */}
            <Card>
                <CardHeader>
                    <CardTitle>Affected Bookings ({completion.affectedBookings.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {completion.affectedBookings.length === 0 ? (
                        <div
                            style={{
                                textAlign: 'center',
                                color: tokens.colors.neutral[500],
                                fontSize: tokens.typography.fontSize.sm,
                                padding: tokens.spacing[4],
                            }}
                        >
                            No bookings were affected by this completion
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
                            {completion.affectedBookings.map((bookingId) => (
                                <div
                                    key={bookingId}
                                    style={{
                                        padding: tokens.spacing[3],
                                        backgroundColor: tokens.colors.neutral[50],
                                        border: `1px solid ${tokens.colors.neutral[200]}`,
                                        borderRadius: tokens.borderRadius.md,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.sm,
                                                fontFamily: 'monospace',
                                                color: tokens.colors.neutral[900],
                                                marginBottom: tokens.spacing[1],
                                            }}
                                        >
                                            {bookingId}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.xs,
                                                color: tokens.colors.neutral[600],
                                            }}
                                        >
                                            Status updated to "swapped"
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        View Booking
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    const renderValidationTab = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
            {/* Pre-Validation Results */}
            {completion.preValidationResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pre-Completion Validation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ValidationResultDisplay validation={completion.preValidationResult} />
                    </CardContent>
                </Card>
            )}

            {/* Post-Validation Results */}
            {completion.postValidationResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Post-Completion Validation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ValidationResultDisplay validation={completion.postValidationResult} />
                    </CardContent>
                </Card>
            )}

            {!completion.preValidationResult && !completion.postValidationResult && (
                <Card>
                    <CardContent>
                        <div
                            style={{
                                textAlign: 'center',
                                color: tokens.colors.neutral[500],
                                fontSize: tokens.typography.fontSize.sm,
                                padding: tokens.spacing[4],
                            }}
                        >
                            No validation results available for this completion
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );

    const ValidationResultDisplay: React.FC<{ validation: CompletionValidationResult }> = ({ validation }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
            {/* Validation Status */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: tokens.spacing[3],
                    backgroundColor: validation.isValid ? tokens.colors.success[50] : tokens.colors.error[50],
                    border: `1px solid ${validation.isValid ? tokens.colors.success[200] : tokens.colors.error[200]}`,
                    borderRadius: tokens.borderRadius.md,
                }}
            >
                <div style={{ fontSize: '20px' }}>
                    {validation.isValid ? '✅' : '❌'}
                </div>
                <div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: validation.isValid ? tokens.colors.success[700] : tokens.colors.error[700],
                        }}
                    >
                        Validation {validation.isValid ? 'Passed' : 'Failed'}
                    </div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: validation.isValid ? tokens.colors.success[600] : tokens.colors.error[600],
                        }}
                    >
                        {validation.errors.length} errors, {validation.warnings.length} warnings
                    </div>
                </div>
            </div>

            {/* Errors */}
            {validation.errors.length > 0 && (
                <div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.error[700],
                            marginBottom: tokens.spacing[2],
                        }}
                    >
                        Validation Errors ({validation.errors.length})
                    </div>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: tokens.spacing[4],
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.error[700],
                        }}
                    >
                        {validation.errors.map((error, index) => (
                            <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                {error}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
                <div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.warning[700],
                            marginBottom: tokens.spacing[2],
                        }}
                    >
                        Validation Warnings ({validation.warnings.length})
                    </div>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: tokens.spacing[4],
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.warning[700],
                        }}
                    >
                        {validation.warnings.map((warning, index) => (
                            <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                {warning}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Inconsistent Entities */}
            {validation.inconsistentEntities.length > 0 && (
                <div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[700],
                            marginBottom: tokens.spacing[2],
                        }}
                    >
                        Inconsistent Entities ({validation.inconsistentEntities.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[1] }}>
                        {validation.inconsistentEntities.map((entityId, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: tokens.spacing[2],
                                    backgroundColor: tokens.colors.neutral[50],
                                    border: `1px solid ${tokens.colors.neutral[200]}`,
                                    borderRadius: tokens.borderRadius.sm,
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontFamily: 'monospace',
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {entityId}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Correction Attempts */}
            {validation.correctionAttempts && validation.correctionAttempts.length > 0 && (
                <div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[700],
                            marginBottom: tokens.spacing[2],
                        }}
                    >
                        Correction Attempts ({validation.correctionAttempts.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
                        {validation.correctionAttempts.map((attempt, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: tokens.spacing[3],
                                    backgroundColor: attempt.correctionApplied ? tokens.colors.success[50] : tokens.colors.error[50],
                                    border: `1px solid ${attempt.correctionApplied ? tokens.colors.success[200] : tokens.colors.error[200]}`,
                                    borderRadius: tokens.borderRadius.md,
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: tokens.spacing[2],
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.sm,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                            color: attempt.correctionApplied ? tokens.colors.success[700] : tokens.colors.error[700],
                                        }}
                                    >
                                        {attempt.entityType.toUpperCase()} {attempt.entityId.slice(0, 8)}...
                                    </div>
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: attempt.correctionApplied ? tokens.colors.success[600] : tokens.colors.error[600],
                                        }}
                                    >
                                        {attempt.correctionApplied ? '✅ Applied' : '❌ Failed'}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.neutral[600],
                                        marginBottom: tokens.spacing[1],
                                    }}
                                >
                                    Expected: {attempt.expectedStatus} → Actual: {attempt.actualStatus}
                                </div>
                                {attempt.correctionError && (
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.error[600],
                                        }}
                                    >
                                        Error: {attempt.correctionError}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderBlockchainTab = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
            <Card>
                <CardHeader>
                    <CardTitle>Blockchain Transaction Details</CardTitle>
                </CardHeader>
                <CardContent>
                    {completion.blockchainTransactionId ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: tokens.spacing[4],
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
                                        Transaction ID
                                    </div>
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.sm,
                                            fontFamily: 'monospace',
                                            color: tokens.colors.neutral[900],
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        {completion.blockchainTransactionId}
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
                                        Status
                                    </div>
                                    <div
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                            backgroundColor: tokens.colors.success[50],
                                            color: tokens.colors.success[700],
                                            borderRadius: tokens.borderRadius.full,
                                            fontSize: tokens.typography.fontSize.sm,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                        }}
                                    >
                                        ✅ Confirmed
                                    </div>
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: tokens.spacing[3],
                                    backgroundColor: tokens.colors.neutral[50],
                                    border: `1px solid ${tokens.colors.neutral[200]}`,
                                    borderRadius: tokens.borderRadius.md,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        color: tokens.colors.neutral[700],
                                        marginBottom: tokens.spacing[2],
                                    }}
                                >
                                    Transaction Details
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[600],
                                        lineHeight: tokens.typography.lineHeight.relaxed,
                                    }}
                                >
                                    This blockchain transaction records the completion of the swap exchange,
                                    providing an immutable record of all entity status changes and ensuring
                                    data integrity across the distributed system.
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                                <Button variant="outline">
                                    View on Explorer
                                </Button>
                                <Button variant="outline">
                                    Copy Transaction ID
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{
                                textAlign: 'center',
                                color: tokens.colors.neutral[500],
                                fontSize: tokens.typography.fontSize.sm,
                                padding: tokens.spacing[4],
                            }}
                        >
                            No blockchain transaction recorded for this completion
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    const renderAuditTab = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
            <Card>
                <CardHeader>
                    <CardTitle>Audit Trail</CardTitle>
                </CardHeader>
                <CardContent>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
                        {/* Timeline */}
                        <div style={{ position: 'relative' }}>
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

                            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
                                    <div
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: tokens.colors.primary[500],
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
                                            {formatDate(completion.createdAt)} by {completion.initiatedBy}
                                        </div>
                                    </div>
                                </div>

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
                                            Completion {statusConfig.label}
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
                            </div>
                        </div>

                        {/* Metadata */}
                        <div
                            style={{
                                padding: tokens.spacing[3],
                                backgroundColor: tokens.colors.neutral[50],
                                border: `1px solid ${tokens.colors.neutral[200]}`,
                                borderRadius: tokens.borderRadius.md,
                                marginTop: tokens.spacing[2],
                            }}
                        >
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.neutral[700],
                                    marginBottom: tokens.spacing[2],
                                }}
                            >
                                Audit Metadata
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: tokens.spacing[3],
                                    fontSize: tokens.typography.fontSize.sm,
                                }}
                            >
                                <div>
                                    <span style={{ color: tokens.colors.neutral[600] }}>Created:</span>{' '}
                                    <span style={{ color: tokens.colors.neutral[900] }}>
                                        {formatDate(completion.createdAt)}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ color: tokens.colors.neutral[600] }}>Updated:</span>{' '}
                                    <span style={{ color: tokens.colors.neutral[900] }}>
                                        {formatDate(completion.updatedAt)}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ color: tokens.colors.neutral[600] }}>DB Transaction:</span>{' '}
                                    <span style={{ color: tokens.colors.neutral[900], fontFamily: 'monospace' }}>
                                        {completion.databaseTransactionId.slice(0, 8)}...
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Completion Details"
            size="xl"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
                {/* Header Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                        }}
                    >
                        Completion ID: {completion.id}
                    </div>
                    <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                        {completion.status === 'failed' && onRetry && (
                            <Button onClick={() => onRetry(completion.id)}>
                                Retry Completion
                            </Button>
                        )}
                        {onExport && (
                            <Button
                                variant="outline"
                                onClick={() => onExport(completion.id)}
                            >
                                Export Details
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div
                    style={{
                        display: 'flex',
                        borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
                        overflowX: 'auto',
                    }}
                >
                    <TabButton tab="overview" label="Overview" />
                    <TabButton
                        tab="entities"
                        label="Entities"
                        count={completion.affectedSwaps.length + completion.affectedBookings.length}
                    />
                    <TabButton
                        tab="validation"
                        label="Validation"
                        count={
                            (completion.preValidationResult?.errors.length || 0) +
                            (completion.postValidationResult?.errors.length || 0)
                        }
                    />
                    <TabButton tab="blockchain" label="Blockchain" />
                    <TabButton tab="audit" label="Audit Trail" />
                </div>

                {/* Tab Content */}
                <div style={{ minHeight: '400px' }}>
                    {activeTab === 'overview' && renderOverviewTab()}
                    {activeTab === 'entities' && renderEntitiesTab()}
                    {activeTab === 'validation' && renderValidationTab()}
                    {activeTab === 'blockchain' && renderBlockchainTab()}
                    {activeTab === 'audit' && renderAuditTab()}
                </div>
            </div>
        </Modal>
    );
};