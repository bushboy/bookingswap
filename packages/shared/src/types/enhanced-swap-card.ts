import { SwapCardData, SwapStatus, AcceptanceStrategy, SwapProposal, SwapProposalCard } from './swap.js';
import { SwapTargetStatus, TargetingRestriction } from './swap-targeting.js';
import { BookingDetails } from './swap-with-booking-details.js';

/**
 * Enhanced swap card data that extends the existing SwapCardData
 * with comprehensive targeting information for display purposes
 */
export interface EnhancedSwapCardData extends SwapCardData {
    // Existing properties remain unchanged for backward compatibility
    userSwap: {
        id: string;
        bookingDetails: BookingDetails;
        status: SwapStatus;
        createdAt: Date;
        expiresAt?: Date;
    };
    proposalsFromOthers: SwapProposalCard[];
    proposalCount: number;

    // New targeting information
    targeting: {
        // Swaps targeting this user's swap (incoming)
        incomingTargets: IncomingTargetInfo[];
        incomingTargetCount: number;

        // This user's swap targeting another swap (outgoing)
        outgoingTarget?: OutgoingTargetInfo;

        // Targeting capabilities and restrictions
        canReceiveTargets: boolean;
        canTarget: boolean;
        targetingRestrictions?: (TargetingRestriction | EnhancedTargetingRestriction)[];
    };
}

/**
 * Information about swaps targeting the current user's swap (incoming targets)
 */
export interface IncomingTargetInfo {
    targetId: string;
    sourceSwapId: string;
    sourceSwap: {
        id: string;
        bookingDetails: BookingDetails;
        ownerId: string;
        ownerName: string;
        ownerAvatar?: string;
    };
    proposalId: string;
    status: SwapTargetStatus;
    createdAt: Date;
    updatedAt: Date;

    // Auction context if applicable
    auctionInfo?: {
        isAuction: boolean;
        endDate?: Date;
        currentProposalCount: number;
    };
}

/**
 * Information about the user's swap targeting another swap (outgoing target)
 */
export interface OutgoingTargetInfo {
    targetId: string;
    targetSwapId: string;
    targetSwap: {
        id: string;
        bookingDetails: BookingDetails;
        ownerId: string;
        ownerName: string;
        ownerAvatar?: string;
    };
    proposalId: string;
    status: SwapTargetStatus;
    createdAt: Date;
    updatedAt: Date;

    // Target swap context
    targetSwapInfo: {
        acceptanceStrategy: AcceptanceStrategy;
        auctionInfo?: {
            isAuction: boolean;
            endDate?: Date;
            currentProposalCount: number;
        };
    };
}

/**
 * Targeting capabilities for a specific swap
 */
export interface TargetingCapabilities {
    canReceiveTargets: boolean;
    canTarget: boolean;
    restrictions: TargetingRestriction[];
    maxIncomingTargets?: number;
    currentIncomingTargets: number;
}

/**
 * Additional restriction scenarios for swap targeting beyond the base types
 */
export type AdditionalTargetingRestrictions =
    | 'already_targeted'
    | 'max_targets_reached'
    | 'insufficient_permissions';

/**
 * All possible targeting restriction types
 */
export type SwapTargetingRestrictions =
    | 'own_swap'
    | 'auction_ended'
    | 'proposal_pending'
    | 'circular_targeting'
    | 'swap_unavailable'
    | AdditionalTargetingRestrictions;

/**
 * Enhanced targeting restriction with additional context
 */
export interface EnhancedTargetingRestriction extends TargetingRestriction {
    context?: {
        auctionEndDate?: Date;
        existingProposalId?: string;
        maxTargetsAllowed?: number;
        currentTargetCount?: number;
    };
    // Additional properties for error handling
    affectedSwapIds?: string[];
    recoveryAction?: string;
    userFriendlyMessage?: string;
}

/**
 * Data structure for service layer data transformation
 */
export interface TargetingDisplayData {
    incomingTargetsBySwap: Map<string, IncomingTargetInfo[]>;
    outgoingTargetsBySwap: Map<string, OutgoingTargetInfo>;
    targetingCapabilitiesBySwap: Map<string, TargetingCapabilities>;
}

/**
 * Targeting mode distinctions for auction vs one-for-one
 */
export type TargetingMode = 'auction' | 'one_for_one';

/**
 * Mode-specific targeting information
 */
export interface TargetingModeInfo {
    mode: TargetingMode;
    auctionDetails?: {
        endDate: Date;
        currentBidCount: number;
        minimumBid?: number;
        autoSelectHighest: boolean;
    };
    oneForOneDetails?: {
        hasExistingProposal: boolean;
        proposalStatus?: SwapTargetStatus;
        mustWaitForResolution: boolean;
    };
}

/**
 * Complete targeting context for a swap
 */
export interface SwapTargetingContext {
    swapId: string;
    mode: TargetingModeInfo;
    capabilities: TargetingCapabilities;
    incomingTargets: IncomingTargetInfo[];
    outgoingTarget?: OutgoingTargetInfo;
    restrictions: EnhancedTargetingRestriction[];
}

// Re-export SwapProposal from swap.ts for consistency
export { SwapProposal } from './swap.js';