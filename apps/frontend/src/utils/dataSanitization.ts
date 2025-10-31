/**
 * Data sanitization utilities for feature flag compliance
 * 
 * This module provides functions to sanitize form data and API requests
 * to ensure they comply with feature flag settings. When features are
 * disabled, related properties are removed or set to safe defaults.
 * 
 * Requirements satisfied:
 * - 3.4: API requests are clean regardless of UI state
 * - 4.4: Form data sanitization removes hidden feature properties
 */

import { FEATURE_FLAGS } from '@/config/featureFlags';

// ============================================================================
// Type Definitions for Sanitization
// ============================================================================

/**
 * Enhanced create swap request interface
 * Based on the structure found in SwapCreationModal
 */
export interface EnhancedCreateSwapRequest {
    sourceBookingId: string;
    title: string;
    description: string;
    paymentTypes: {
        bookingExchange: boolean;
        cashPayment: boolean;
        minimumCashAmount?: number;
        preferredCashAmount?: number;
    };
    acceptanceStrategy: {
        type: 'first_match' | 'auction';
        auctionEndDate?: Date;
        autoSelectHighest?: boolean;
    };
    auctionSettings?: {
        endDate: Date;
        allowBookingProposals: boolean;
        allowCashProposals: boolean;
        minimumCashOffer?: number;
        autoSelectAfterHours?: number;
    };
    swapPreferences: {
        preferredLocations?: string[];
        preferredDates?: Date[];
        additionalRequirements?: string[];
    };
    expirationDate: Date;
}

/**
 * Create proposal request interface
 * Based on the structure found in API types
 */
export interface CreateProposalRequest {
    sourceSwapId?: string;
    message?: string;
    conditions: string[];
    agreedToTerms: boolean;
    cashOffer?: {
        amount: number;
        currency: string;
    };
    walletAddress?: string;
}

/**
 * Sanitized create swap request with hidden features removed
 */
export type SanitizedCreateSwapRequest = Omit<EnhancedCreateSwapRequest, 'auctionSettings'> & {
    paymentTypes: {
        bookingExchange: boolean;
        cashPayment: false;
    };
    acceptanceStrategy: {
        type: 'first_match';
    };
};

/**
 * Sanitized create proposal request with hidden features removed
 */
export type SanitizedCreateProposalRequest = Omit<CreateProposalRequest, 'cashOffer'>;

// ============================================================================
// Form Data Sanitization Functions
// ============================================================================

/**
 * Sanitizes create swap request data based on feature flags
 * Removes auction and cash properties when features are disabled
 * Ensures API requests are clean regardless of UI state
 * 
 * @param request - The original create swap request
 * @returns Sanitized request with hidden features removed
 */
export function sanitizeCreateSwapRequest(
    request: EnhancedCreateSwapRequest
): EnhancedCreateSwapRequest {
    const sanitized = { ...request };

    // Handle auction mode sanitization
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        // Force acceptance strategy to first_match
        sanitized.acceptanceStrategy = {
            type: 'first_match',
        };

        // Remove auction settings entirely
        delete sanitized.auctionSettings;
    }

    // Handle cash swap sanitization
    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
        // Force cash payment to false and remove cash amounts
        sanitized.paymentTypes = {
            ...sanitized.paymentTypes,
            cashPayment: false,
        };

        // Remove cash-related properties
        delete sanitized.paymentTypes.minimumCashAmount;
        delete sanitized.paymentTypes.preferredCashAmount;

        // Also clean auction settings if they exist
        if (sanitized.auctionSettings) {
            sanitized.auctionSettings = {
                ...sanitized.auctionSettings,
                allowCashProposals: false,
            };
            delete sanitized.auctionSettings.minimumCashOffer;
        }
    }

    return sanitized;
}

/**
 * Sanitizes create proposal request data based on feature flags
 * Removes cash offer properties when cash proposals are disabled
 * Ensures proposal requests are clean regardless of UI state
 * 
 * @param request - The original create proposal request
 * @returns Sanitized request with hidden features removed
 */
export function sanitizeCreateProposalRequest(
    request: CreateProposalRequest
): CreateProposalRequest {
    const sanitized = { ...request };

    // Handle cash proposal sanitization
    if (!FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
        // Remove cash offer entirely
        delete sanitized.cashOffer;
    }

    return sanitized;
}

/**
 * Validates that a create swap request complies with feature flags
 * Returns validation errors if the request contains disabled features
 * 
 * @param request - The create swap request to validate
 * @returns Array of validation error messages
 */
export function validateCreateSwapRequestCompliance(
    request: EnhancedCreateSwapRequest
): string[] {
    const errors: string[] = [];

    // Check auction mode compliance
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        if (request.acceptanceStrategy.type === 'auction') {
            errors.push('Auction mode is currently disabled');
        }
        if (request.auctionSettings) {
            errors.push('Auction settings are not allowed when auction mode is disabled');
        }
    }

    // Check cash swap compliance
    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
        if (request.paymentTypes.cashPayment) {
            errors.push('Cash payments are currently disabled');
        }
        if (request.paymentTypes.minimumCashAmount || request.paymentTypes.preferredCashAmount) {
            errors.push('Cash amount settings are not allowed when cash swaps are disabled');
        }
    }

    return errors;
}

/**
 * Validates that a create proposal request complies with feature flags
 * Returns validation errors if the request contains disabled features
 * 
 * @param request - The create proposal request to validate
 * @returns Array of validation error messages
 */
export function validateCreateProposalRequestCompliance(
    request: CreateProposalRequest
): string[] {
    const errors: string[] = [];

    // Check cash proposal compliance
    if (!FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
        if (request.cashOffer) {
            errors.push('Cash offers are currently disabled');
        }
    }

    return errors;
}

/**
 * Creates a safe default create swap request with only enabled features
 * Useful for initializing forms or providing fallback values
 * 
 * @param sourceBookingId - The source booking ID for the swap
 * @returns A create swap request with only enabled features
 */
export function createSafeDefaultSwapRequest(sourceBookingId: string): EnhancedCreateSwapRequest {
    const baseRequest: EnhancedCreateSwapRequest = {
        sourceBookingId,
        title: '',
        description: '',
        paymentTypes: {
            bookingExchange: true,
            cashPayment: false,
        },
        acceptanceStrategy: {
            type: 'first_match',
        },
        swapPreferences: {
            preferredLocations: [],
            additionalRequirements: [],
        },
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };

    // Only add cash payment options if enabled
    if (FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
        baseRequest.paymentTypes.cashPayment = false; // Still default to false, but allow user to enable
    }

    // Only add auction options if enabled
    if (FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        // Keep default as first_match, but allow user to change
    }

    return baseRequest;
}

/**
 * Creates a safe default create proposal request with only enabled features
 * Useful for initializing forms or providing fallback values
 * 
 * @returns A create proposal request with only enabled features
 */
export function createSafeDefaultProposalRequest(): CreateProposalRequest {
    const baseRequest: CreateProposalRequest = {
        conditions: [],
        agreedToTerms: false,
    };

    // Only add cash offer option if enabled
    if (FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
        // Don't add cashOffer by default, let user add it
    }

    return baseRequest;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a create swap request has any auction-related properties
 * Useful for detecting if sanitization is needed
 * 
 * @param request - The create swap request to check
 * @returns True if the request has auction properties
 */
export function hasAuctionProperties(request: EnhancedCreateSwapRequest): boolean {
    return (
        request.acceptanceStrategy.type === 'auction' ||
        !!request.acceptanceStrategy.auctionEndDate ||
        !!request.acceptanceStrategy.autoSelectHighest ||
        !!request.auctionSettings
    );
}

/**
 * Checks if a create swap request has any cash-related properties
 * Useful for detecting if sanitization is needed
 * 
 * @param request - The create swap request to check
 * @returns True if the request has cash properties
 */
export function hasCashProperties(request: EnhancedCreateSwapRequest): boolean {
    return (
        request.paymentTypes.cashPayment ||
        !!request.paymentTypes.minimumCashAmount ||
        !!request.paymentTypes.preferredCashAmount ||
        (request.auctionSettings?.allowCashProposals ?? false) ||
        !!request.auctionSettings?.minimumCashOffer
    );
}

/**
 * Checks if a create proposal request has any cash-related properties
 * Useful for detecting if sanitization is needed
 * 
 * @param request - The create proposal request to check
 * @returns True if the request has cash properties
 */
export function hasProposalCashProperties(request: CreateProposalRequest): boolean {
    return !!request.cashOffer;
}

/**
 * Logs sanitization actions for debugging purposes
 * Helps track when and why data is being sanitized
 * 
 * @param action - The sanitization action performed
 * @param originalData - The original data before sanitization
 * @param sanitizedData - The data after sanitization
 */
export function logSanitizationAction(
    action: string,
    originalData: any,
    sanitizedData: any
): void {
    if (process.env.NODE_ENV === 'development') {
        console.log(`🧹 Data Sanitization: ${action}`, {
            original: originalData,
            sanitized: sanitizedData,
            featureFlags: FEATURE_FLAGS,
        });
    }
}

// ============================================================================
// Display Data Sanitization Functions
// ============================================================================

/**
 * Swap data interfaces for display sanitization
 * Based on the shared package types
 */
export interface SwapDisplayData {
    id: string;
    sourceBookingId: string;
    status: string;
    paymentTypes?: {
        bookingExchange: boolean;
        cashPayment: boolean;
        minimumCashAmount?: number;
        preferredCashAmount?: number;
    };
    acceptanceStrategy?: {
        type: 'first_match' | 'auction';
        auctionEndDate?: Date;
        autoSelectHighest?: boolean;
    };
    auctionId?: string;
    auctionSettings?: {
        endDate: Date;
        allowBookingProposals: boolean;
        allowCashProposals: boolean;
        minimumCashOffer?: number;
        autoSelectAfterHours?: number;
    };
    cashDetails?: {
        enabled: boolean;
        minimumAmount: number;
        preferredAmount?: number;
        currency: string;
        escrowRequired: boolean;
        platformFeePercentage: number;
    };
    [key: string]: any; // Allow for additional properties
}

/**
 * Proposal data interface for display sanitization
 */
export interface ProposalDisplayData {
    id: string;
    proposalType?: 'booking' | 'cash';
    cashOffer?: {
        amount: number;
        currency: string;
        escrowAccountId?: string;
        paymentMethodId: string;
    };
    [key: string]: any; // Allow for additional properties
}

/**
 * Sanitizes swap data for display by removing hidden feature properties
 * Handles cases where backend returns auction/cash data when features are disabled
 * Ensures UI doesn't break when receiving unexpected data
 *
 * @param swapData - The original swap data from backend
 * @returns Sanitized swap data with hidden features removed
 */
export function sanitizeSwapData(swapData: SwapDisplayData): SwapDisplayData {
    if (!swapData) return swapData;

    const sanitized = { ...swapData };

    // Handle auction mode sanitization
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        // Remove auction-related properties
        delete sanitized.auctionId;
        delete sanitized.auctionSettings;

        // Clean acceptance strategy
        if (sanitized.acceptanceStrategy) {
            sanitized.acceptanceStrategy = {
                type: 'first_match',
            };
        }
    }

    // Handle cash swap sanitization
    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
        // Remove cash-related properties
        delete sanitized.cashDetails;

        // Clean payment types
        if (sanitized.paymentTypes) {
            sanitized.paymentTypes = {
                ...sanitized.paymentTypes,
                cashPayment: false,
            };
            delete sanitized.paymentTypes.minimumCashAmount;
            delete sanitized.paymentTypes.preferredCashAmount;
        }

        // Clean auction settings if they exist
        if (sanitized.auctionSettings) {
            sanitized.auctionSettings = {
                ...sanitized.auctionSettings,
                allowCashProposals: false,
            };
            delete sanitized.auctionSettings.minimumCashOffer;
        }
    }

    logSanitizationAction('sanitizeSwapData', swapData, sanitized);
    return sanitized;
}

/**
 * Sanitizes an array of swap data for display
 * Applies sanitizeSwapData to each item in the array
 *
 * @param swapDataArray - Array of swap data from backend
 * @returns Array of sanitized swap data
 */
export function sanitizeSwapDataArray(swapDataArray: SwapDisplayData[]): SwapDisplayData[] {
    if (!Array.isArray(swapDataArray)) return swapDataArray;

    return swapDataArray.map(swapData => sanitizeSwapData(swapData));
}

/**
 * Sanitizes proposal data for display by removing hidden feature properties
 * Handles cases where backend returns cash proposal data when features are disabled
 * Ensures UI doesn't break when receiving unexpected proposal data
 *
 * @param proposalData - The original proposal data from backend
 * @returns Sanitized proposal data with hidden features removed
 */
export function sanitizeProposalData(proposalData: ProposalDisplayData): ProposalDisplayData {
    if (!proposalData) return proposalData;

    const sanitized = { ...proposalData };

    // Handle cash proposal sanitization
    if (!FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
        // Remove cash offer properties
        delete sanitized.cashOffer;

        // If this was a cash proposal, mark it as booking type
        if (sanitized.proposalType === 'cash') {
            sanitized.proposalType = 'booking';
        }
    }

    logSanitizationAction('sanitizeProposalData', proposalData, sanitized);
    return sanitized;
}

/**
 * Sanitizes an array of proposal data for display
 * Applies sanitizeProposalData to each item in the array
 *
 * @param proposalDataArray - Array of proposal data from backend
 * @returns Array of sanitized proposal data
 */
export function sanitizeProposalDataArray(proposalDataArray: ProposalDisplayData[]): ProposalDisplayData[] {
    if (!Array.isArray(proposalDataArray)) return proposalDataArray;

    return proposalDataArray.map(proposalData => sanitizeProposalData(proposalData));
}

/**
 * Sanitizes API response data that may contain swap or proposal information
 * Handles nested data structures and mixed response types
 *
 * @param responseData - The API response data
 * @returns Sanitized response data
 */
export function sanitizeApiResponseData(responseData: any): any {
    if (!responseData || typeof responseData !== 'object') {
        return responseData;
    }

    const sanitized = { ...responseData };

    // Handle different response structures
    if (sanitized.swaps && Array.isArray(sanitized.swaps)) {
        sanitized.swaps = sanitizeSwapDataArray(sanitized.swaps);
    }

    if (sanitized.swap && typeof sanitized.swap === 'object') {
        sanitized.swap = sanitizeSwapData(sanitized.swap);
    }

    if (sanitized.proposals && Array.isArray(sanitized.proposals)) {
        sanitized.proposals = sanitizeProposalDataArray(sanitized.proposals);
    }

    if (sanitized.proposal && typeof sanitized.proposal === 'object') {
        sanitized.proposal = sanitizeProposalData(sanitized.proposal);
    }

    // Handle eligible swaps response
    if (sanitized.eligibleSwaps && Array.isArray(sanitized.eligibleSwaps)) {
        sanitized.eligibleSwaps = sanitizeSwapDataArray(sanitized.eligibleSwaps);
    }

    // Handle nested data in pagination responses
    if (sanitized.data && Array.isArray(sanitized.data)) {
        sanitized.data = sanitized.data.map((item: any) => {
            if (item && typeof item === 'object') {
                // Try to sanitize as swap data first, then as proposal data
                if (item.sourceBookingId || item.paymentTypes || item.acceptanceStrategy) {
                    return sanitizeSwapData(item);
                } else if (item.proposalType || item.cashOffer) {
                    return sanitizeProposalData(item);
                }
            }
            return item;
        });
    }

    logSanitizationAction('sanitizeApiResponseData', responseData, sanitized);
    return sanitized;
}

/**
 * Filters out cash proposals from a list of proposals when cash proposals are disabled
 * Useful for completely hiding cash proposals from UI components
 *
 * @param proposals - Array of proposal data
 * @returns Filtered array with cash proposals removed if feature is disabled
 */
export function filterCashProposals(proposals: ProposalDisplayData[]): ProposalDisplayData[] {
    if (!Array.isArray(proposals)) return proposals;

    if (!FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
        return proposals.filter(proposal => proposal.proposalType !== 'cash');
    }

    return proposals;
}

/**
 * Filters out auction swaps from a list of swaps when auction mode is disabled
 * Useful for completely hiding auction swaps from UI components
 *
 * @param swaps - Array of swap data
 * @returns Filtered array with auction swaps removed if feature is disabled
 */
export function filterAuctionSwaps(swaps: SwapDisplayData[]): SwapDisplayData[] {
    if (!Array.isArray(swaps)) return swaps;

    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        return swaps.filter(swap =>
            !swap.acceptanceStrategy ||
            swap.acceptanceStrategy.type !== 'auction'
        );
    }

    return swaps;
}

/**
 * Filters out cash swaps from a list of swaps when cash swaps are disabled
 * Useful for completely hiding cash swaps from UI components
 *
 * @param swaps - Array of swap data
 * @returns Filtered array with cash swaps removed if feature is disabled
 */
export function filterCashSwaps(swaps: SwapDisplayData[]): SwapDisplayData[] {
    if (!Array.isArray(swaps)) return swaps;

    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
        return swaps.filter(swap =>
            !swap.paymentTypes ||
            !swap.paymentTypes.cashPayment
        );
    }

    return swaps;
}

/**
 * Comprehensive filter that removes all disabled feature data from swap arrays
 * Combines all filtering logic for convenience
 *
 * @param swaps - Array of swap data
 * @returns Filtered array with all disabled features removed
 */
export function filterDisabledFeatureSwaps(swaps: SwapDisplayData[]): SwapDisplayData[] {
    let filtered = swaps;

    filtered = filterAuctionSwaps(filtered);
    filtered = filterCashSwaps(filtered);

    return filtered;
}

/**
 * Checks if swap data contains any properties that should be hidden
 * Useful for detecting if sanitization or filtering is needed
 *
 * @param swapData - The swap data to check
 * @returns True if the swap contains hidden feature properties
 */
export function hasHiddenFeatureProperties(swapData: SwapDisplayData): boolean {
    if (!swapData) return false;

    // Check for auction properties when auction is disabled
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        if (swapData.auctionId ||
            swapData.auctionSettings ||
            (swapData.acceptanceStrategy?.type === 'auction')) {
            return true;
        }
    }

    // Check for cash properties when cash is disabled
    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
        if (swapData.cashDetails ||
            swapData.paymentTypes?.cashPayment ||
            swapData.paymentTypes?.minimumCashAmount ||
            swapData.paymentTypes?.preferredCashAmount) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if proposal data contains any properties that should be hidden
 * Useful for detecting if sanitization or filtering is needed
 *
 * @param proposalData - The proposal data to check
 * @returns True if the proposal contains hidden feature properties
 */
export function hasHiddenProposalProperties(proposalData: ProposalDisplayData): boolean {
    if (!proposalData) return false;

    // Check for cash proposal properties when cash proposals are disabled
    if (!FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
        if (proposalData.proposalType === 'cash' || proposalData.cashOffer) {
            return true;
        }
    }

    return false;
}

// ============================================================================
// Error Boundary Helpers
// ============================================================================

/**
 * Safe sanitization wrapper that handles errors gracefully
 * Returns original data if sanitization fails to prevent UI breaks
 *
 * @param data - The data to sanitize
 * @param sanitizeFn - The sanitization function to apply
 * @returns Sanitized data or original data if sanitization fails
 */
export function safeSanitize<T>(data: T, sanitizeFn: (data: T) => T): T {
    try {
        return sanitizeFn(data);
    } catch (error) {
        console.warn('Data sanitization failed, returning original data:', error);
        return data;
    }
}

/**
 * Creates a sanitization error boundary function
 * Wraps sanitization functions with error handling
 *
 * @param functionName - Name of the function for logging
 * @returns Error boundary wrapper function
 */
export function createSanitizationErrorBoundary(functionName: string) {
    return function <T>(data: T, sanitizeFn: (data: T) => T): T {
        try {
            return sanitizeFn(data);
        } catch (error) {
            console.error(`Sanitization error in ${functionName}:`, error);

            // Log the error for debugging but don't break the UI
            if (process.env.NODE_ENV === 'development') {
                console.log('Original data that caused error:', data);
            }

            return data;
        }
    };
}