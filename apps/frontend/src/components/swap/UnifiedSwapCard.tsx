import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useUnifiedSwapData } from '../../hooks/useUnifiedSwapData';
import { FinancialDataHandler } from '../../utils/financialDataHandler';
import { dataConsistencyValidator } from '../../utils/dataConsistencyValidator';

/**
 * Unified Swap Card Component
 * 
 * This component demonstrates the use of unified data source and consistency validation.
 * All data displayed comes from a single, synchronized source to ensure consistency
 * across all UI elements.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

interface UnifiedSwapCardProps {
    swapId: string;
    onViewDetails?: () => void;
    onAcceptProposal?: (proposalId: string) => void;
    onRejectProposal?: (proposalId: string) => void;
    showConsistencyInfo?: boolean;
}

export const UnifiedSwapCard: React.FC<UnifiedSwapCardProps> = ({
    swapId,
    onViewDetails,
    onAcceptProposal,
    onRejectProposal,
    showConsistencyInfo = false
}) => {
    const { isMobile } = useResponsive();
    const [validationResult, setValidationResult] = useState<any>(null);

    // Use unified data hook for consistent data access
    const {
        data: swapData,
        loading,
        error,
        consistencyReport,
        refresh,
        synchronize,
        isConsistent
    } = useUnifiedSwapData(swapId, {
        includeTargeting: true,
        includeProposals: true,
        validateConsistency: true,
        autoRefresh: true,
        refreshInterval: 30000
    });

    // Validate data consistency when data changes
    useEffect(() => {
        if (swapData) {
            const validation = dataConsistencyValidator.validateSwapData(swapData);
            setValidationResult(validation);
        }
    }, [swapData]);

    // Handle data synchronization
    const handleSynchronize = async () => {
        try {
            await synchronize();
            console.log(`Data synchronized for swap ${swapId}`);
        } catch (error) {
            console.error('Failed to synchronize data:', error);
        }
    };

    // Handle manual refresh
    const handleRefresh = async () => {
        try {
            await refresh();
            console.log(`Data refreshed for swap ${swapId}`);
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    };

    if (loading) {
        return (
            <Card variant="elevated" style={{ width: '100%', maxWidth: isMobile ? '100%' : '800px' }}>
                <CardContent style={{ padding: tokens.spacing[6] }}>
                    <div style={{ textAlign: 'center', color: tokens.colors.neutral[500] }}>
                        Loading unified swap data...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card variant="elevated" style={{ width: '100%', maxWidth: isMobile ? '100%' : '800px' }}>
                <CardContent style={{ padding: tokens.spacing[6] }}>
                    <div style={{ textAlign: 'center', color: tokens.colors.error[600] }}>
                        Error loading swap data: {error}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: tokens.spacing[4] }}>
                        <Button onClick={handleRefresh} variant="outline" size="sm">
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!swapData) {
        return (
            <Card variant="elevated" style={{ width: '100%', maxWidth: isMobile ? '100%' : '800px' }}>
                <CardContent style={{ padding: tokens.spacing[6] }}>
                    <div style={{ textAlign: 'center', color: tokens.colors.neutral[500] }}>
                        No swap data available
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { userSwap } = swapData;
    const isEnhanced = 'targeting' in swapData;
    const targeting = isEnhanced ? (swapData as any).targeting : null;

    // Format financial data using the handler
    const formattedPrice = FinancialDataHandler.formatCurrency(
        userSwap.bookingDetails.swapValue,
        userSwap.bookingDetails.currency
    );

    // Get status styling
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return tokens.colors.warning[500];
            case 'accepted': return tokens.colors.success[500];
            case 'rejected': return tokens.colors.error[500];
            case 'completed': return tokens.colors.primary[500];
            default: return tokens.colors.neutral[500];
        }
    };

    const statusColor = getStatusColor(userSwap.status);

    return (
        <Card
            variant="elevated"
            style={{
                width: '100%',
                maxWidth: isMobile ? '100%' : '800px',
                cursor: onViewDetails ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                // Add visual indicator for consistency issues
                border: !isConsistent ? `2px solid ${tokens.colors.warning[400]}` : undefined
            }}
            onClick={onViewDetails}
        >
            <CardHeader
                style={{
                    padding: isMobile
                        ? tokens.spacing[4]
                        : `${tokens.spacing[6]} ${tokens.spacing[6]} ${tokens.spacing[4]}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: tokens.spacing[3],
                    }}
                >
                    {/* Status and Consistency Indicators */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
                        {/* Status Badge */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                                borderRadius: tokens.borderRadius.full,
                                backgroundColor: `${statusColor}20`,
                                border: `1px solid ${statusColor}`,
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>
                                {userSwap.status === 'pending' ? '⏳' :
                                    userSwap.status === 'accepted' ? '✅' :
                                        userSwap.status === 'rejected' ? '❌' :
                                            userSwap.status === 'completed' ? '🎉' : '❓'}
                            </span>
                            <span
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: statusColor,
                                    textTransform: 'capitalize',
                                }}
                            >
                                {userSwap.status}
                            </span>
                        </div>

                        {/* Consistency Indicator */}
                        {showConsistencyInfo && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: tokens.spacing[1],
                                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                    borderRadius: tokens.borderRadius.full,
                                    backgroundColor: isConsistent ? '#dcfce7' : '#fef3c7',
                                    border: `1px solid ${isConsistent ? '#10b981' : '#f59e0b'}`,
                                    fontSize: tokens.typography.fontSize.xs,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: isConsistent ? '#15803d' : '#92400e',
                                }}
                            >
                                <span>{isConsistent ? '✓' : '⚠'}</span>
                                <span>{isConsistent ? 'Consistent' : 'Check Data'}</span>
                            </div>
                        )}

                        {/* Targeting Count */}
                        {targeting && (targeting.incomingTargets.length > 0 || targeting.outgoingTarget) && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: tokens.spacing[1],
                                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                    backgroundColor: '#dbeafe',
                                    border: '1px solid #3b82f6',
                                    borderRadius: tokens.borderRadius.full,
                                    fontSize: tokens.typography.fontSize.xs,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: '#1d4ed8',
                                }}
                            >
                                <span>🎯</span>
                                <span>{targeting.incomingTargets.length}</span>
                                {!isMobile && <span>targeting</span>}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSynchronize();
                            }}
                            variant="outline"
                            size="sm"
                            style={{ fontSize: tokens.typography.fontSize.xs }}
                        >
                            Sync
                        </Button>
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRefresh();
                            }}
                            variant="outline"
                            size="sm"
                            style={{ fontSize: tokens.typography.fontSize.xs }}
                        >
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {/* Main Booking Information */}
                <div
                    style={{
                        border: `2px solid ${tokens.colors.primary[300]}`,
                        borderRadius: tokens.borderRadius.lg,
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.primary[50],
                        marginBottom: tokens.spacing[4],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                            marginBottom: tokens.spacing[3],
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>🏨</span>
                        <span
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.primary[600],
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            {userSwap.bookingDetails.type}
                        </span>
                    </div>

                    <h4
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                            lineHeight: tokens.typography.lineHeight.tight,
                        }}
                    >
                        {userSwap.bookingDetails.title}
                    </h4>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[1],
                            marginBottom: tokens.spacing[2],
                            color: tokens.colors.neutral[600],
                            fontSize: tokens.typography.fontSize.sm,
                        }}
                    >
                        <span>📍</span>
                        <span>
                            {userSwap.bookingDetails.location.city}, {userSwap.bookingDetails.location.country}
                        </span>
                    </div>

                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.primary[600],
                        }}
                    >
                        {formattedPrice}
                    </div>
                </div>

                {/* Targeting Information */}
                {targeting && (
                    <div
                        style={{
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                            borderRadius: tokens.borderRadius.md,
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.neutral[50],
                        }}
                    >
                        <h5
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[900],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                            }}
                        >
                            Targeting Activity
                        </h5>

                        {targeting.incomingTargets.length === 0 && !targeting.outgoingTarget ? (
                            <div style={{ color: tokens.colors.neutral[500], fontSize: tokens.typography.fontSize.sm }}>
                                No targeting activity
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
                                {targeting.incomingTargets.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.medium }}>
                                            Incoming: {targeting.incomingTargets.length} proposals
                                        </div>
                                        {targeting.incomingTargets.slice(0, 3).map((target: any, index: number) => (
                                            <div
                                                key={target.id}
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xs,
                                                    color: tokens.colors.neutral[600],
                                                    marginLeft: tokens.spacing[4],
                                                }}
                                            >
                                                • {target.proposerName} - {target.proposerSwapTitle}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {targeting.outgoingTarget && (
                                    <div>
                                        <div style={{ fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.medium }}>
                                            Outgoing: Targeting {targeting.outgoingTarget.targetOwnerName}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.xs,
                                                color: tokens.colors.neutral[600],
                                                marginLeft: tokens.spacing[4],
                                            }}
                                        >
                                            • {targeting.outgoingTarget.targetSwapTitle}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Consistency Information (Debug Mode) */}
                {showConsistencyInfo && (validationResult || consistencyReport) && (
                    <div
                        style={{
                            marginTop: tokens.spacing[4],
                            padding: tokens.spacing[3],
                            backgroundColor: tokens.colors.neutral[100],
                            borderRadius: tokens.borderRadius.md,
                            fontSize: tokens.typography.fontSize.xs,
                        }}
                    >
                        <div style={{ fontWeight: tokens.typography.fontWeight.semibold, marginBottom: tokens.spacing[2] }}>
                            Data Consistency Report
                        </div>

                        {validationResult && (
                            <div style={{ marginBottom: tokens.spacing[2] }}>
                                <div>Validation Score: {validationResult.score}/100</div>
                                <div>Valid: {validationResult.isValid ? 'Yes' : 'No'}</div>
                                {validationResult.errors.length > 0 && (
                                    <div>Errors: {validationResult.errors.length}</div>
                                )}
                                {validationResult.warnings.length > 0 && (
                                    <div>Warnings: {validationResult.warnings.length}</div>
                                )}
                            </div>
                        )}

                        {consistencyReport && (
                            <div>
                                <div>Consistent: {consistencyReport.isConsistent ? 'Yes' : 'No'}</div>
                                {consistencyReport.discrepancies && consistencyReport.discrepancies.length > 0 && (
                                    <div>Discrepancies: {consistencyReport.discrepancies.length}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};