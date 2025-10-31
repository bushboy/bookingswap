import {
    SwapTargetStatus,
    EnhancedSwapCardData,
    IncomingTargetInfo,
    OutgoingTargetInfo,
    TargetingCapabilities,
    EnhancedTargetingRestriction,
    SwapTargetingContext,
    TargetingModeInfo,
    AcceptanceStrategy
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';

/**
 * Raw query result structure from SwapTargetingRepository
 */
export interface BidirectionalQueryResult {
    direction: 'incoming' | 'outgoing';
    target_id: string;
    target_swap_id: string;
    source_swap_id: string;
    proposal_id: string;
    status: SwapTargetStatus;
    created_at: Date;
    updated_at: Date;
    booking_title: string;
    booking_city: string;
    booking_country: string;
    check_in: Date;
    check_out: Date;
    price: number;
    owner_name: string;
    owner_email: string;
    data_source: 'swap_targets' | 'proposals';
}

/**
 * Transformed targeting display data structure
 */
export interface TargetingDisplayData {
    swapId: string;
    incomingTargets: IncomingTargetDisplay[];
    incomingCount: number;
    outgoingTargets: OutgoingTargetDisplay[];
    outgoingCount: number;
    hasTargeting: boolean;
    displayMode: 'compact' | 'detailed';
    indicators: TargetingIndicator[];
}

/**
 * Display-ready incoming target information
 */
export interface IncomingTargetDisplay {
    targetId: string;
    sourceSwapId: string;
    sourceSwapDetails: {
        id: string;
        bookingTitle: string;
        bookingLocation: string;
        checkIn: Date;
        checkOut: Date;
        price: number;
        ownerName: string;
        ownerAvatar?: string;
    };
    status: SwapTargetStatus;
    createdAt: Date;
    displayLabel: string;
    statusIcon: string;
    statusColor: string;
    actionable: boolean;
}

/**
 * Display-ready outgoing target information
 */
export interface OutgoingTargetDisplay {
    targetId: string;
    targetSwapId: string;
    targetSwapDetails: {
        id: string;
        bookingTitle: string;
        bookingLocation: string;
        checkIn: Date;
        checkOut: Date;
        price: number;
        ownerName: string;
        ownerAvatar?: string;
    };
    status: SwapTargetStatus;
    createdAt: Date;
    displayLabel: string;
    statusIcon: string;
    statusColor: string;
    actionable: boolean;
}

/**
 * Visual indicator for targeting status
 */
export interface TargetingIndicator {
    type: 'incoming' | 'outgoing' | 'bidirectional';
    count: number;
    icon: string;
    color: string;
    tooltip: string;
    priority: number;
}

/**
 * Targeting validation issue
 */
export interface TargetingIssue {
    type: 'missing_bidirectional' | 'duplicate_relationship' | 'orphaned_target' | 'status_mismatch';
    description: string;
    affectedSwapIds: string[];
    severity: 'low' | 'medium' | 'high';
}

/**
 * Targeting validation result
 */
export interface TargetingValidationResult {
    isValid: boolean;
    issues: TargetingIssue[];
    recommendations: string[];
}

/**
 * Data transformer class for processing bidirectional targeting relationships
 * Addresses display issues where only one side of targeting relationships was shown
 * Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 4.5
 */
export class TargetingDataTransformer {

    /**
     * Transform raw query results into display-ready format
     * Fixes the issue where only one direction was being shown
     * Requirements: 1.1, 1.2, 2.1, 2.2
     */
    static transformBidirectionalData(
        queryResults: BidirectionalQueryResult[]
    ): TargetingDisplayData[] {
        try {
            const swapTargetingMap = new Map<string, TargetingDisplayData>();

            // Process each result and group by swap ID
            queryResults.forEach(result => {
                const swapId = result.direction === 'incoming'
                    ? result.target_swap_id
                    : result.source_swap_id;

                if (!swapTargetingMap.has(swapId)) {
                    swapTargetingMap.set(swapId, {
                        swapId,
                        incomingTargets: [],
                        incomingCount: 0,
                        outgoingTargets: [],
                        outgoingCount: 0,
                        hasTargeting: false,
                        displayMode: 'compact',
                        indicators: []
                    });
                }

                const targetingData = swapTargetingMap.get(swapId)!;

                if (result.direction === 'incoming') {
                    const incomingTarget = this.transformIncomingTarget(result);
                    targetingData.incomingTargets.push(incomingTarget);
                    targetingData.incomingCount++;
                } else {
                    const outgoingTarget = this.transformOutgoingTarget(result);
                    targetingData.outgoingTargets.push(outgoingTarget);
                    targetingData.outgoingCount++;
                }

                targetingData.hasTargeting = true;
            });

            // Generate indicators for each swap
            swapTargetingMap.forEach(data => {
                data.indicators = this.generateTargetingIndicators(data);
            });

            return Array.from(swapTargetingMap.values());
        } catch (error) {
            logger.error('Failed to transform bidirectional targeting data', { error });
            return [];
        }
    }

    /**
     * Transform raw query result into incoming target display format
     * Requirements: 2.1, 2.2
     */
    private static transformIncomingTarget(result: BidirectionalQueryResult): IncomingTargetDisplay {
        const location = `${result.booking_city || 'Unknown'}, ${result.booking_country || 'Unknown'}`;
        const displayLabel = `${result.owner_name || 'Unknown User'}'s ${result.booking_title || 'booking'} is targeting your swap`;

        return {
            targetId: result.target_id,
            sourceSwapId: result.source_swap_id,
            sourceSwapDetails: {
                id: result.source_swap_id,
                bookingTitle: result.booking_title || 'Untitled Booking',
                bookingLocation: location,
                checkIn: new Date(result.check_in),
                checkOut: new Date(result.check_out),
                price: result.price || 0,
                ownerName: result.owner_name || 'Unknown User',
                ownerAvatar: undefined // Will be populated from user service if needed
            },
            status: result.status,
            createdAt: new Date(result.created_at),
            displayLabel,
            statusIcon: this.getStatusIcon(result.status),
            statusColor: this.getStatusColor(result.status),
            actionable: this.isActionable(result.status, 'incoming')
        };
    }

    /**
     * Transform raw query result into outgoing target display format
     * Requirements: 2.1, 2.2
     */
    private static transformOutgoingTarget(result: BidirectionalQueryResult): OutgoingTargetDisplay {
        const location = `${result.booking_city || 'Unknown'}, ${result.booking_country || 'Unknown'}`;
        const displayLabel = `Your swap is targeting ${result.owner_name || 'Unknown User'}'s ${result.booking_title || 'booking'}`;

        return {
            targetId: result.target_id,
            targetSwapId: result.target_swap_id,
            targetSwapDetails: {
                id: result.target_swap_id,
                bookingTitle: result.booking_title || 'Untitled Booking',
                bookingLocation: location,
                checkIn: new Date(result.check_in),
                checkOut: new Date(result.check_out),
                price: result.price || 0,
                ownerName: result.owner_name || 'Unknown User',
                ownerAvatar: undefined // Will be populated from user service if needed
            },
            status: result.status,
            createdAt: new Date(result.created_at),
            displayLabel,
            statusIcon: this.getStatusIcon(result.status),
            statusColor: this.getStatusColor(result.status),
            actionable: this.isActionable(result.status, 'outgoing')
        };
    }

    /**
     * Generate visual indicators based on targeting data
     * Requirements: 4.1, 4.2, 4.5
     */
    static generateTargetingIndicators(data: TargetingDisplayData): TargetingIndicator[] {
        const indicators: TargetingIndicator[] = [];

        if (data.incomingCount > 0) {
            indicators.push({
                type: 'incoming',
                count: data.incomingCount,
                icon: 'arrow-down-circle',
                color: '#10b981', // green
                tooltip: `${data.incomingCount} swap${data.incomingCount > 1 ? 's' : ''} targeting this`,
                priority: 1
            });
        }

        if (data.outgoingCount > 0) {
            indicators.push({
                type: 'outgoing',
                count: data.outgoingCount,
                icon: 'arrow-up-circle',
                color: '#3b82f6', // blue
                tooltip: `Targeting ${data.outgoingCount} other swap${data.outgoingCount > 1 ? 's' : ''}`,
                priority: 2
            });
        }

        if (data.incomingCount > 0 && data.outgoingCount > 0) {
            indicators.push({
                type: 'bidirectional',
                count: data.incomingCount + data.outgoingCount,
                icon: 'arrows-up-down',
                color: '#8b5cf6', // purple
                tooltip: 'Both targeting and being targeted',
                priority: 0
            });
        }

        return indicators.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Convert transformed data to enhanced swap card format
     * Requirements: 1.1, 1.2, 4.1, 4.2
     */
    static convertToEnhancedSwapCardFormat(
        targetingData: TargetingDisplayData[]
    ): Map<string, { incomingTargets: IncomingTargetInfo[]; outgoingTarget?: OutgoingTargetInfo }> {
        const enhancedDataMap = new Map();

        targetingData.forEach(data => {
            const incomingTargets: IncomingTargetInfo[] = data.incomingTargets.map(target => ({
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
                    ownerId: target.sourceSwapDetails.id,
                    ownerName: target.sourceSwapDetails.ownerName,
                    ownerAvatar: target.sourceSwapDetails.ownerAvatar
                },
                proposalId: target.targetId, // Using targetId as proposalId for now
                status: target.status,
                createdAt: target.createdAt,
                updatedAt: target.createdAt
            }));

            const outgoingTarget: OutgoingTargetInfo | undefined = data.outgoingTargets.length > 0 ? {
                targetId: data.outgoingTargets[0]?.targetId || '',
                targetSwapId: data.outgoingTargets[0]?.targetSwapId || '',
                targetSwap: {
                    id: data.outgoingTargets[0]?.targetSwapDetails.id || '',
                    bookingDetails: {
                        id: data.outgoingTargets[0]?.targetSwapDetails.id || '',
                        title: data.outgoingTargets[0]?.targetSwapDetails.bookingTitle || 'Untitled Booking',
                        location: {
                            city: data.outgoingTargets[0]?.targetSwapDetails.bookingLocation.split(',')[0]?.trim() || 'Unknown',
                            country: data.outgoingTargets[0]?.targetSwapDetails.bookingLocation.split(',')[1]?.trim() || 'Unknown'
                        },
                        dateRange: {
                            checkIn: data.outgoingTargets[0]?.targetSwapDetails.checkIn || new Date(),
                            checkOut: data.outgoingTargets[0]?.targetSwapDetails.checkOut || new Date()
                        },
                        originalPrice: data.outgoingTargets[0]?.targetSwapDetails.price || 0,
                        swapValue: data.outgoingTargets[0]?.targetSwapDetails.price || 0
                    },
                    ownerId: data.outgoingTargets[0]?.targetSwapDetails.id || '',
                    ownerName: data.outgoingTargets[0]?.targetSwapDetails.ownerName || 'Unknown User',
                    ownerAvatar: data.outgoingTargets[0]?.targetSwapDetails.ownerAvatar
                },
                proposalId: data.outgoingTargets[0]?.targetId || '',
                status: data.outgoingTargets[0]?.status || 'active',
                createdAt: data.outgoingTargets[0]?.createdAt || new Date(),
                updatedAt: data.outgoingTargets[0]?.createdAt || new Date(),
                targetSwapInfo: {
                    acceptanceStrategy: {
                        type: 'first_match' // Default strategy
                    }
                }
            } : undefined;

            enhancedDataMap.set(data.swapId, {
                incomingTargets,
                outgoingTarget
            });
        });

        return enhancedDataMap;
    }

    /**
     * Validate targeting data consistency
     * Requirements: 1.3, 2.2
     */
    static validateTargetingConsistency(
        targetingData: TargetingDisplayData[]
    ): TargetingValidationResult {
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
        });

        return {
            isValid: issues.length === 0,
            issues,
            recommendations: this.generateRecommendations(issues)
        };
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

        if (issues.some(i => i.severity === 'high')) {
            recommendations.push('Consider implementing data consistency checks in the repository layer');
        }

        return recommendations;
    }

    /**
     * Get status icon for targeting status
     */
    private static getStatusIcon(status: SwapTargetStatus): string {
        switch (status) {
            case 'active':
                return 'clock';
            case 'accepted':
                return 'check-circle';
            case 'rejected':
                return 'x-circle';
            case 'cancelled':
                return 'minus-circle';
            default:
                return 'help-circle';
        }
    }

    /**
     * Get status color for targeting status
     */
    private static getStatusColor(status: SwapTargetStatus): string {
        switch (status) {
            case 'active':
                return '#f59e0b'; // amber
            case 'accepted':
                return '#10b981'; // green
            case 'rejected':
                return '#ef4444'; // red
            case 'cancelled':
                return '#6b7280'; // gray
            default:
                return '#6b7280'; // gray
        }
    }

    /**
     * Determine if a targeting relationship is actionable
     */
    private static isActionable(status: SwapTargetStatus, direction: 'incoming' | 'outgoing'): boolean {
        if (status === 'active') {
            return true; // Active targets can be accepted/rejected (incoming) or cancelled (outgoing)
        }
        return false; // Completed statuses are not actionable
    }
}