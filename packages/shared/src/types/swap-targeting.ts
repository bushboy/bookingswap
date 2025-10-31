import { BaseEntity } from './base.js';

export type SwapTargetStatus = 'active' | 'cancelled' | 'accepted' | 'rejected';

export type TargetingAction = 'targeted' | 'retargeted' | 'removed' | 'accepted' | 'rejected' | 'cancelled';

export interface SwapTarget extends BaseEntity {
    sourceSwapId: string;
    targetSwapId: string;
    status: SwapTargetStatus;
}

export interface TargetingHistory extends BaseEntity {
    sourceSwapId: string;
    targetSwapId?: string;
    action: TargetingAction;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface CreateSwapTargetRequest {
    sourceSwapId: string;
    targetSwapId: string;
    status: SwapTargetStatus;
}

export interface CreateTargetingHistoryRequest {
    sourceSwapId: string;
    targetSwapId?: string;
    action: TargetingAction;
    metadata?: Record<string, any>;
}

export interface TargetingResult {
    success: boolean;
    targetId?: string;
    error?: string;
    warnings?: string[];
}

export interface TargetingValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface TargetingValidation extends TargetingValidationResult {
    canTarget: boolean;
    restrictions: TargetingRestriction[];
    auctionInfo?: AuctionInfo;
}

export interface TargetingRestriction {
    type: 'own_swap' | 'auction_ended' | 'proposal_pending' | 'circular_targeting' | 'swap_unavailable';
    message: string;
    severity: 'error' | 'warning';
}

export interface AuctionInfo {
    isAuction: boolean;
    endDate?: Date;
    proposalCount: number;
    canReceiveMoreProposals: boolean;
}

export interface TargetingRequest {
    sourceSwapId: string;
    targetSwapId: string;
    userId: string;
    message?: string;
    conditions?: string[];
}

export interface AuctionEligibilityResult {
    canTarget: boolean;
    auctionActive: boolean;
    auctionEndDate?: Date;
    currentProposalCount: number;
    reason?: string;
}

export interface OneForOneValidationResult {
    canTarget: boolean;
    hasExistingProposal: boolean;
    existingProposalId?: string;
    mustWaitForResolution: boolean;
    reason?: string;
}

// Enhanced Swap type with targeting information
export interface SwapWithTargeting {
    id: string;
    targeting?: {
        isTargeting: boolean;
        targetSwapId?: string;
        targetedAt?: Date;
    };
    targetedBy?: {
        count: number;
        recentTargets: SwapTarget[];
    };
    auctionInfo?: AuctionInfo;
}

// Derived types for targeting relationships
export interface TargetingRelationship {
    id: string;
    sourceSwapId: string;
    targetSwapId: string;
    status: SwapTargetStatus;
    createdAt: Date;
    updatedAt: Date;

    // Derived relationship data
    sourceProposerId: string;
    sourceProposerName: string;
    targetOwnerId: string;
    targetOwnerName: string;
    sourceBookingId: string;
    targetBookingId: string;
}

// Enhanced SwapTarget with derived relationship information
export interface SwapTargetWithRelationships extends SwapTarget {
    // Derived source swap information
    sourceProposerId: string;
    sourceProposerName: string;
    sourceBookingId: string;

    // Derived target swap information
    targetOwnerId: string;
    targetOwnerName: string;
    targetBookingId: string;
}
// Data Transfer Objects for targeting API responses
export interface TargetingRelationshipDTO {
    id: string;
    sourceSwapId: string;
    targetSwapId: string;
    status: SwapTargetStatus;
    createdAt: Date;
    updatedAt: Date;

    // Derived relationship data
    sourceProposerId: string;
    sourceProposerName: string;
    targetOwnerId: string;
    targetOwnerName: string;
    sourceBookingId: string;
    targetBookingId: string;

    // Optional booking details for rich responses
    sourceBookingDetails?: {
        title: string;
        location: string;
        dateRange: {
            checkIn: Date;
            checkOut: Date;
        };
    };
    targetBookingDetails?: {
        title: string;
        location: string;
        dateRange: {
            checkIn: Date;
            checkOut: Date;
        };
    };
}

export interface TargetingListResponseDTO {
    targetingRelationships: TargetingRelationshipDTO[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
    metadata: {
        activeTargetingCount: number;
        pendingTargetingCount: number;
        completedTargetingCount: number;
    };
}