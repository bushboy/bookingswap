import {
    SwapCardData,
    EnhancedSwapCardData,
    TargetingRestriction,
    TargetingValidationResult,
    EnhancedTargetingRestriction,
    IncomingTargetInfo,
    OutgoingTargetInfo
} from '@booking-swap/shared';
import {
    TargetingDisplayData,
    TargetingIssue,
    TargetingValidationResult as DisplayValidationResult,
    IncomingTargetDisplay,
    OutgoingTargetDisplay
} from './TargetingDataTransformer';
import { logger } from '../../utils/logger';

/**
 * Error handler class for graceful targeting display error recovery
 * Requirements: 3.5, 3.6
 */
export class TargetingDisplayErrorHandler {

    /**
     * Handle cases where targeting data is incomplete or missing
     * Requirements: 3.5, 3.6
     */
    static handlePartialTargetingData(
        swapData: SwapCardData[],
        targetingData: Partial<TargetingDisplayData>[]
    ): EnhancedSwapCardData[] {
        try {
            logger.info('Processing partial targeting data', {
                swapCount: swapData.length,
                targetingDataCount: targetingData.length
            });

            return swapData.map(swap => {
                const targeting = targetingData.find(t => t.swapId === swap.userSwap.id);

                if (targeting && this.isValidTargetingData(targeting)) {
                    // Valid targeting data exists
                    return {
                        ...swap,
                        targeting: {
                            incomingTargets: this.convertIncomingTargetsToInfo(targeting.incomingTargets || []),
                            incomingTargetCount: targeting.incomingCount || 0,
                            outgoingTarget: this.convertOutgoingTargetToInfo(targeting.outgoingTargets?.[0]),
                            canReceiveTargets: true,
                            canTarget: true,
                            targetingRestrictions: []
                        }
                    };
                } else if (targeting && !this.isValidTargetingData(targeting)) {
                    // Partial or corrupted targeting data
                    const restrictions = this.generateRestrictionsForPartialData(targeting);

                    return {
                        ...swap,
                        targeting: {
                            incomingTargets: this.convertIncomingTargetsToInfo(this.sanitizeIncomingTargets(targeting.incomingTargets || [])),
                            incomingTargetCount: this.sanitizeCount(targeting.incomingCount),
                            outgoingTarget: this.convertOutgoingTargetToInfo(this.sanitizeOutgoingTarget(targeting.outgoingTargets?.[0])),
                            canReceiveTargets: true,
                            canTarget: true,
                            targetingRestrictions: restrictions
                        }
                    };
                } else {
                    // No targeting data available
                    return {
                        ...swap,
                        targeting: {
                            incomingTargets: [],
                            incomingTargetCount: 0,
                            outgoingTarget: undefined,
                            canReceiveTargets: true,
                            canTarget: true,
                            targetingRestrictions: [{
                                type: 'swap_unavailable',
                                message: 'Targeting information temporarily unavailable',
                                severity: 'warning'
                            }]
                        }
                    };
                }
            });
        } catch (error) {
            logger.error('Failed to handle partial targeting data', { error });

            // Return safe fallback data
            return swapData.map(swap => ({
                ...swap,
                targeting: {
                    incomingTargets: [],
                    incomingTargetCount: 0,
                    outgoingTarget: undefined,
                    canReceiveTargets: false,
                    canTarget: false,
                    targetingRestrictions: [{
                        type: 'swap_unavailable',
                        message: 'Error processing targeting data',
                        severity: 'error'
                    }]
                }
            }));
        }
    }

    /**
     * Validate targeting data consistency and identify issues
     * Requirements: 3.5, 3.6
     */
    static validateTargetingConsistency(
        targetingData: TargetingDisplayData[]
    ): DisplayValidationResult {
        try {
            const issues: TargetingIssue[] = [];

            targetingData.forEach(data => {
                // Check for count mismatch
                const totalTargets = data.incomingCount + data.outgoingCount;
                const actualTargets = data.incomingTargets.length + data.outgoingTargets.length;

                if (totalTargets !== actualTargets) {
                    issues.push({
                        type: 'missing_bidirectional',
                        description: `Count mismatch for swap ${data.swapId}: expected ${totalTargets}, got ${actualTargets}`,
                        affectedSwapIds: [data.swapId],
                        severity: 'medium'
                    });
                }

                // Check for duplicate relationships
                const incomingIds = new Set(data.incomingTargets.map(t => t.targetId));
                const outgoingIds = new Set(data.outgoingTargets.map(t => t.targetId));

                if (incomingIds.size !== data.incomingTargets.length) {
                    issues.push({
                        type: 'duplicate_relationship',
                        description: `Duplicate incoming targets found for swap ${data.swapId}`,
                        affectedSwapIds: [data.swapId],
                        severity: 'high'
                    });
                }

                if (outgoingIds.size !== data.outgoingTargets.length) {
                    issues.push({
                        type: 'duplicate_relationship',
                        description: `Duplicate outgoing targets found for swap ${data.swapId}`,
                        affectedSwapIds: [data.swapId],
                        severity: 'high'
                    });
                }

                // Check for orphaned targets (targets without valid swap references)
                data.incomingTargets.forEach(target => {
                    if (!target.sourceSwapId || !target.targetId) {
                        issues.push({
                            type: 'orphaned_target',
                            description: `Orphaned incoming target found for swap ${data.swapId}`,
                            affectedSwapIds: [data.swapId],
                            severity: 'high'
                        });
                    }
                });

                data.outgoingTargets.forEach(target => {
                    if (!target.targetSwapId || !target.targetId) {
                        issues.push({
                            type: 'orphaned_target',
                            description: `Orphaned outgoing target found for swap ${data.swapId}`,
                            affectedSwapIds: [data.swapId],
                            severity: 'high'
                        });
                    }
                });

                // Check for status mismatches
                const allTargets = [...data.incomingTargets, ...data.outgoingTargets];
                allTargets.forEach(target => {
                    if (!['active', 'accepted', 'rejected', 'cancelled'].includes(target.status)) {
                        issues.push({
                            type: 'status_mismatch',
                            description: `Invalid status '${target.status}' found for target ${target.targetId}`,
                            affectedSwapIds: [data.swapId],
                            severity: 'medium'
                        });
                    }
                });
            });

            return {
                isValid: issues.length === 0,
                issues,
                recommendations: this.generateRecommendations(issues)
            };
        } catch (error) {
            logger.error('Failed to validate targeting consistency', { error });
            return {
                isValid: false,
                issues: [{
                    type: 'orphaned_target',
                    description: 'Validation failed due to system error',
                    affectedSwapIds: [],
                    severity: 'high'
                }],
                recommendations: ['Contact system administrator to investigate validation errors']
            };
        }
    }

    /**
     * Generate user-friendly error messages for targeting issues
     * Requirements: 3.6
     */
    static generateUserFriendlyErrorMessages(
        issues: TargetingIssue[]
    ): { [swapId: string]: string[] } {
        const messageMap: { [swapId: string]: string[] } = {};

        issues.forEach(issue => {
            issue.affectedSwapIds.forEach(swapId => {
                if (!messageMap[swapId]) {
                    messageMap[swapId] = [];
                }

                let userMessage: string;
                switch (issue.type) {
                    case 'missing_bidirectional':
                        userMessage = 'Some targeting information may be incomplete. Refresh to see the latest data.';
                        break;
                    case 'duplicate_relationship':
                        userMessage = 'Duplicate targeting relationships detected. This may cause display issues.';
                        break;
                    case 'orphaned_target':
                        userMessage = 'Some targeting connections appear broken. Please try refreshing the page.';
                        break;
                    case 'status_mismatch':
                        userMessage = 'Targeting status information may be outdated. Refresh for the latest status.';
                        break;
                    default:
                        userMessage = 'Targeting information may not be fully accurate. Please refresh the page.';
                }

                if (!messageMap[swapId].includes(userMessage)) {
                    messageMap[swapId].push(userMessage);
                }
            });
        });

        return messageMap;
    }

    /**
     * Create fallback targeting display for error scenarios
     * Requirements: 3.5, 3.6
     */
    static createFallbackTargetingDisplay(swapId: string, errorType: string): TargetingDisplayData {
        return {
            swapId,
            incomingTargets: [],
            incomingCount: 0,
            outgoingTargets: [],
            outgoingCount: 0,
            hasTargeting: false,
            displayMode: 'compact',
            indicators: [{
                type: 'incoming',
                count: 0,
                icon: 'alert-triangle',
                color: '#f59e0b', // amber
                tooltip: 'Targeting information unavailable',
                priority: 0
            }]
        };
    }

    /**
     * Recover from targeting data corruption
     * Requirements: 3.5, 3.6
     */
    static recoverFromDataCorruption(
        corruptedData: Partial<TargetingDisplayData>
    ): TargetingDisplayData {
        try {
            return {
                swapId: corruptedData.swapId || 'unknown',
                incomingTargets: this.sanitizeIncomingTargets(corruptedData.incomingTargets || []),
                incomingCount: this.sanitizeCount(corruptedData.incomingCount),
                outgoingTargets: this.sanitizeOutgoingTargets(corruptedData.outgoingTargets || []),
                outgoingCount: this.sanitizeCount(corruptedData.outgoingCount),
                hasTargeting: (corruptedData.incomingCount || 0) > 0 || (corruptedData.outgoingCount || 0) > 0,
                displayMode: corruptedData.displayMode || 'compact',
                indicators: corruptedData.indicators || []
            };
        } catch (error) {
            logger.error('Failed to recover from data corruption', { error, corruptedData });
            return this.createFallbackTargetingDisplay(
                corruptedData.swapId || 'unknown',
                'data_corruption'
            );
        }
    }

    /**
     * Check if targeting data is valid and complete
     */
    private static isValidTargetingData(data: Partial<TargetingDisplayData>): boolean {
        if (!data.swapId) return false;

        // Check if counts match actual arrays
        const incomingCount = data.incomingCount || 0;
        const outgoingCount = data.outgoingCount || 0;
        const actualIncoming = data.incomingTargets?.length || 0;
        const actualOutgoing = data.outgoingTargets?.length || 0;

        return incomingCount === actualIncoming && outgoingCount === actualOutgoing;
    }

    /**
     * Generate restrictions for partial targeting data
     */
    private static generateRestrictionsForPartialData(
        data: Partial<TargetingDisplayData>
    ): TargetingRestriction[] {
        const restrictions: TargetingRestriction[] = [];

        if (data.incomingCount !== data.incomingTargets?.length) {
            restrictions.push({
                type: 'swap_unavailable',
                message: 'Incoming targeting data is incomplete',
                severity: 'warning'
            });
        }

        if (data.outgoingCount !== data.outgoingTargets?.length) {
            restrictions.push({
                type: 'swap_unavailable',
                message: 'Outgoing targeting data is incomplete',
                severity: 'warning'
            });
        }

        return restrictions;
    }

    /**
     * Sanitize incoming targets array
     */
    private static sanitizeIncomingTargets(targets: IncomingTargetDisplay[]): IncomingTargetDisplay[] {
        return targets.filter(target =>
            target &&
            target.targetId &&
            target.sourceSwapId &&
            target.sourceSwapDetails
        ).map(target => ({
            ...target,
            sourceSwapDetails: {
                ...target.sourceSwapDetails,
                bookingTitle: target.sourceSwapDetails.bookingTitle || 'Untitled Booking',
                bookingLocation: target.sourceSwapDetails.bookingLocation || 'Unknown Location',
                ownerName: target.sourceSwapDetails.ownerName || 'Unknown User'
            }
        }));
    }

    /**
     * Sanitize outgoing targets array
     */
    private static sanitizeOutgoingTargets(targets: OutgoingTargetDisplay[]): OutgoingTargetDisplay[] {
        return targets.filter(target =>
            target &&
            target.targetId &&
            target.targetSwapId &&
            target.targetSwapDetails
        ).map(target => ({
            ...target,
            targetSwapDetails: {
                ...target.targetSwapDetails,
                bookingTitle: target.targetSwapDetails.bookingTitle || 'Untitled Booking',
                bookingLocation: target.targetSwapDetails.bookingLocation || 'Unknown Location',
                ownerName: target.targetSwapDetails.ownerName || 'Unknown User'
            }
        }));
    }

    /**
     * Sanitize outgoing target (single)
     */
    private static sanitizeOutgoingTarget(target?: OutgoingTargetDisplay): OutgoingTargetDisplay | undefined {
        if (!target || !target.targetId || !target.targetSwapId) {
            return undefined;
        }

        return {
            ...target,
            targetSwapDetails: {
                ...target.targetSwapDetails,
                bookingTitle: target.targetSwapDetails?.bookingTitle || 'Untitled Booking',
                bookingLocation: target.targetSwapDetails?.bookingLocation || 'Unknown Location',
                ownerName: target.targetSwapDetails?.ownerName || 'Unknown User'
            }
        };
    }

    /**
     * Sanitize count values
     */
    private static sanitizeCount(count?: number): number {
        return typeof count === 'number' && count >= 0 ? count : 0;
    }

    /**
     * Generate recommendations based on validation issues
     */
    private static generateRecommendations(issues: TargetingIssue[]): string[] {
        const recommendations: string[] = [];

        if (issues.some(i => i.type === 'missing_bidirectional')) {
            recommendations.push('Review database query logic to ensure both directions are captured');
        }

        if (issues.some(i => i.type === 'duplicate_relationship')) {
            recommendations.push('Add DISTINCT clauses to targeting queries to prevent duplicates');
        }

        if (issues.some(i => i.type === 'orphaned_target')) {
            recommendations.push('Implement referential integrity checks for targeting relationships');
        }

        if (issues.some(i => i.type === 'status_mismatch')) {
            recommendations.push('Validate targeting status values during data processing');
        }

        if (issues.some(i => i.severity === 'high')) {
            recommendations.push('Consider implementing data consistency checks in the repository layer');
        }

        return recommendations;
    }

    /**
     * Convert IncomingTargetDisplay to IncomingTargetInfo
     */
    private static convertIncomingTargetsToInfo(targets: IncomingTargetDisplay[]): IncomingTargetInfo[] {
        return targets.map(target => ({
            targetId: target.targetId,
            sourceSwapId: target.sourceSwapId,
            sourceSwap: {
                id: target.sourceSwapDetails.id,
                bookingDetails: {
                    id: target.sourceSwapDetails.id,
                    title: target.sourceSwapDetails.bookingTitle,
                    location: {
                        city: target.sourceSwapDetails.bookingLocation.split(',')[0]?.trim() || 'Unknown',
                        country: target.sourceSwapDetails.bookingLocation.split(',')[1]?.trim() || 'Unknown'
                    },
                    dateRange: {
                        checkIn: target.sourceSwapDetails.checkIn,
                        checkOut: target.sourceSwapDetails.checkOut
                    },
                    originalPrice: target.sourceSwapDetails.price,
                    swapValue: target.sourceSwapDetails.price
                },
                ownerId: target.sourceSwapId, // Using sourceSwapId as ownerId for now
                ownerName: target.sourceSwapDetails.ownerName,
                ownerAvatar: target.sourceSwapDetails.ownerAvatar
            },
            proposalId: target.targetId, // Using targetId as proposalId
            status: target.status,
            createdAt: target.createdAt,
            updatedAt: target.createdAt // Using createdAt as updatedAt for now
        }));
    }

    /**
     * Convert OutgoingTargetDisplay to OutgoingTargetInfo
     */
    private static convertOutgoingTargetToInfo(target?: OutgoingTargetDisplay): OutgoingTargetInfo | undefined {
        if (!target) return undefined;

        return {
            targetId: target.targetId,
            targetSwapId: target.targetSwapId,
            targetSwap: {
                id: target.targetSwapDetails.id,
                bookingDetails: {
                    id: target.targetSwapDetails.id,
                    title: target.targetSwapDetails.bookingTitle,
                    location: {
                        city: target.targetSwapDetails.bookingLocation.split(',')[0]?.trim() || 'Unknown',
                        country: target.targetSwapDetails.bookingLocation.split(',')[1]?.trim() || 'Unknown'
                    },
                    dateRange: {
                        checkIn: target.targetSwapDetails.checkIn,
                        checkOut: target.targetSwapDetails.checkOut
                    },
                    originalPrice: target.targetSwapDetails.price,
                    swapValue: target.targetSwapDetails.price
                },
                ownerId: target.targetSwapId, // Using targetSwapId as ownerId for now
                ownerName: target.targetSwapDetails.ownerName,
                ownerAvatar: target.targetSwapDetails.ownerAvatar
            },
            proposalId: target.targetId, // Using targetId as proposalId
            status: target.status,
            createdAt: target.createdAt,
            updatedAt: target.createdAt, // Using createdAt as updatedAt for now
            targetSwapInfo: {
                acceptanceStrategy: {
                    type: 'first_match' // Default strategy
                }
            }
        };
    }
}