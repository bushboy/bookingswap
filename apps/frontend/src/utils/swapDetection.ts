import { SwapInfo } from '@booking-swap/shared';

/**
 * Enhanced swap detection utility functions
 * Provides accurate detection of active swaps and tooltip generation
 */

/**
 * Determines if a booking has an active swap based on comprehensive criteria
 * An active swap is one that:
 * 1. Has essential configuration (payment types and acceptance strategy)
 * 2. Has active proposals or pending user proposals
 * 3. Is properly configured with required cash amounts if cash payments are enabled
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3
 */
export const hasActiveSwap = (swapInfo?: SwapInfo): boolean => {
    // Handle null/undefined SwapInfo gracefully
    if (!swapInfo) {
        console.debug('hasActiveSwap: No SwapInfo provided, defaulting to false');
        return false;
    }

    try {
        // Validate SwapInfo structure before processing
        if (typeof swapInfo !== 'object') {
            console.warn('hasActiveSwap: SwapInfo is not an object, defaulting to false', { swapInfo });
            return false;
        }

        // Check for essential swap configuration with null safety
        const hasPaymentTypes = Array.isArray(swapInfo.paymentTypes) && swapInfo.paymentTypes.length > 0;
        const hasAcceptanceStrategy = Boolean(swapInfo.acceptanceStrategy);

        // Check for active proposals with type safety
        const hasActiveProposals = Boolean(swapInfo.hasActiveProposals) ||
            (typeof swapInfo.activeProposalCount === 'number' && swapInfo.activeProposalCount > 0);

        // Check for pending user proposals with string validation
        const hasPendingProposal = swapInfo.userProposalStatus === 'pending';

        // Check for accepted proposals with string validation
        const hasAcceptedProposal = swapInfo.userProposalStatus === 'accepted';

        // Check if any swap has been initiated with boolean validation
        const hasSwapInitiated = Boolean(swapInfo.hasAnySwapInitiated);

        // Swap is active if it's configured AND (has active proposals OR has pending/accepted user proposals OR has been initiated)
        const isConfigured = hasPaymentTypes && hasAcceptanceStrategy;
        const hasActivity = hasActiveProposals || hasPendingProposal || hasAcceptedProposal || hasSwapInitiated;

        const result = isConfigured && hasActivity;

        console.debug('hasActiveSwap: Evaluation completed', {
            isConfigured,
            hasActivity,
            hasPaymentTypes,
            hasAcceptanceStrategy,
            hasActiveProposals,
            hasPendingProposal,
            hasAcceptedProposal,
            hasSwapInitiated,
            result
        });

        return result;
    } catch (error) {
        // Enhanced error handling with detailed logging for debugging
        console.error('hasActiveSwap: Error during swap detection, defaulting to false (allow editing)', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            swapInfo: swapInfo ? {
                hasPaymentTypes: swapInfo.paymentTypes,
                hasAcceptanceStrategy: swapInfo.acceptanceStrategy,
                hasActiveProposals: swapInfo.hasActiveProposals,
                activeProposalCount: swapInfo.activeProposalCount,
                userProposalStatus: swapInfo.userProposalStatus,
                hasAnySwapInitiated: swapInfo.hasAnySwapInitiated
            } : null
        });

        // Graceful degradation - default to false (allow editing) to prevent blocking users
        // This ensures that if swap detection fails, users can still edit their bookings
        return false;
    }
};

/**
 * Determines if a swap is configured (has basic setup) but may not be active
 * This is used for display purposes and backward compatibility
 * 
 * Requirements: 4.1, 4.2, 4.3, 8.1, 8.2, 8.3
 */
export const isSwapConfigured = (swapInfo?: SwapInfo): boolean => {
    // Handle null/undefined SwapInfo gracefully
    if (!swapInfo) {
        console.debug('isSwapConfigured: No SwapInfo provided, defaulting to false');
        return false;
    }

    try {
        // Validate SwapInfo structure before processing
        if (typeof swapInfo !== 'object') {
            console.warn('isSwapConfigured: SwapInfo is not an object, defaulting to false', { swapInfo });
            return false;
        }

        // Check if there are actual swap preferences configured with enhanced validation
        // A swap is considered configured if:
        // 1. It has payment types defined (booking or cash) and they are valid
        // 2. It has an acceptance strategy that is valid
        // 3. It has cash amount requirements (if cash is enabled) that are valid numbers

        const hasPaymentTypes = Array.isArray(swapInfo.paymentTypes) &&
            swapInfo.paymentTypes.length > 0 &&
            swapInfo.paymentTypes.every(type => ['booking', 'cash'].includes(type));

        const hasAcceptanceStrategy = Boolean(swapInfo.acceptanceStrategy) &&
            ['first_match', 'auction'].includes(swapInfo.acceptanceStrategy);

        // Enhanced cash requirements validation
        let hasCashRequirements = true;
        if (swapInfo.paymentTypes?.includes('cash')) {
            const minAmount = swapInfo.minCashAmount;
            const maxAmount = swapInfo.maxCashAmount;

            // At least one cash amount should be specified and be a valid positive number
            hasCashRequirements = (
                (typeof minAmount === 'number' && minAmount >= 0) ||
                (typeof maxAmount === 'number' && maxAmount >= 0)
            );

            // If both are specified, min should not be greater than max
            if (typeof minAmount === 'number' && typeof maxAmount === 'number') {
                hasCashRequirements = hasCashRequirements && minAmount <= maxAmount;
            }
        }

        const result = hasPaymentTypes && hasAcceptanceStrategy && hasCashRequirements;

        console.debug('isSwapConfigured: Evaluation completed', {
            hasPaymentTypes,
            hasAcceptanceStrategy,
            hasCashRequirements,
            paymentTypes: swapInfo.paymentTypes,
            acceptanceStrategy: swapInfo.acceptanceStrategy,
            minCashAmount: swapInfo.minCashAmount,
            maxCashAmount: swapInfo.maxCashAmount,
            result
        });

        return result;
    } catch (error) {
        // Enhanced error handling with detailed logging for debugging
        console.error('isSwapConfigured: Error during swap configuration check, defaulting to false', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            swapInfo: swapInfo ? {
                paymentTypes: swapInfo.paymentTypes,
                acceptanceStrategy: swapInfo.acceptanceStrategy,
                minCashAmount: swapInfo.minCashAmount,
                maxCashAmount: swapInfo.maxCashAmount
            } : null
        });

        // Graceful degradation - default to false (not configured)
        return false;
    }
};

/**
 * Gets the reason why a swap restricts editing
 * Returns null if no restriction applies
 * 
 * Requirements: 1.1, 1.2, 8.1, 8.2, 8.3
 */
export const getSwapRestrictionReason = (swapInfo?: SwapInfo): string | null => {
    try {
        // First check if there's actually an active swap
        if (!hasActiveSwap(swapInfo)) {
            console.debug('getSwapRestrictionReason: No active swap detected, no restriction');
            return null;
        }

        // Handle null/undefined SwapInfo (shouldn't happen if hasActiveSwap returned true, but safety check)
        if (!swapInfo) {
            console.warn('getSwapRestrictionReason: SwapInfo is null but hasActiveSwap returned true');
            return 'Cannot edit booking with active swap';
        }

        // Validate SwapInfo structure
        if (typeof swapInfo !== 'object') {
            console.warn('getSwapRestrictionReason: SwapInfo is not an object', { swapInfo });
            return 'Cannot edit booking with active swap';
        }

        // Check specific reasons for restriction with enhanced validation
        if (typeof swapInfo.userProposalStatus === 'string') {
            switch (swapInfo.userProposalStatus) {
                case 'accepted':
                    return 'Cannot edit booking with accepted swap proposal';
                case 'pending':
                    return 'Cannot edit booking with pending swap proposal';
                case 'rejected':
                    // Rejected proposals shouldn't restrict editing, but log for debugging
                    console.debug('getSwapRestrictionReason: User proposal is rejected, should not restrict editing');
                    break;
            }
        }

        // Check for active proposals with proper type validation
        if (swapInfo.hasActiveProposals || (typeof swapInfo.activeProposalCount === 'number' && swapInfo.activeProposalCount > 0)) {
            const count = typeof swapInfo.activeProposalCount === 'number' ? swapInfo.activeProposalCount : 0;
            if (count > 0) {
                const proposalText = count === 1 ? 'proposal' : 'proposals';
                return `Cannot edit booking with ${count} active swap ${proposalText}`;
            } else if (swapInfo.hasActiveProposals) {
                return 'Cannot edit booking with active swap proposals';
            }
        }

        // Check if any swap has been initiated
        if (swapInfo.hasAnySwapInitiated) {
            return 'Cannot edit booking with initiated swap';
        }

        // If we reach here, there's an active swap but we couldn't determine the specific reason
        console.debug('getSwapRestrictionReason: Active swap detected but specific reason unclear', {
            userProposalStatus: swapInfo.userProposalStatus,
            hasActiveProposals: swapInfo.hasActiveProposals,
            activeProposalCount: swapInfo.activeProposalCount,
            hasAnySwapInitiated: swapInfo.hasAnySwapInitiated
        });

        // Default restriction message
        return 'Cannot edit booking with active swap';
    } catch (error) {
        // Enhanced error handling with detailed logging
        console.error('getSwapRestrictionReason: Error determining restriction reason, using default message', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            swapInfo: swapInfo ? {
                userProposalStatus: swapInfo.userProposalStatus,
                hasActiveProposals: swapInfo.hasActiveProposals,
                activeProposalCount: swapInfo.activeProposalCount,
                hasAnySwapInitiated: swapInfo.hasAnySwapInitiated
            } : null
        });

        // Graceful degradation - return default restriction message
        return 'Cannot edit booking with active swap';
    }
};

/**
 * Generates tooltip text for Edit button based on swap state
 * 
 * Requirements: 1.1, 1.2, 8.1, 8.2, 8.3
 */
export const getEditButtonTooltip = (swapInfo?: SwapInfo, isBookingActive: boolean = true): string => {
    try {
        // Validate booking active status
        if (typeof isBookingActive !== 'boolean') {
            console.warn('getEditButtonTooltip: isBookingActive is not a boolean, defaulting to true', { isBookingActive });
            isBookingActive = true;
        }

        // Check booking status first
        if (!isBookingActive) {
            return 'Cannot edit inactive booking';
        }

        // Check for swap restrictions
        const restrictionReason = getSwapRestrictionReason(swapInfo);
        if (restrictionReason) {
            console.debug('getEditButtonTooltip: Restriction found', { restrictionReason });
            return restrictionReason;
        }

        // Default tooltip for editable booking
        return 'Edit booking details';
    } catch (error) {
        // Enhanced error handling with detailed logging
        console.error('getEditButtonTooltip: Error generating tooltip, using default', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            isBookingActive,
            swapInfo: swapInfo ? {
                userProposalStatus: swapInfo.userProposalStatus,
                hasActiveProposals: swapInfo.hasActiveProposals,
                activeProposalCount: swapInfo.activeProposalCount
            } : null
        });

        // Graceful degradation - return default tooltip that allows editing
        return 'Edit booking details';
    }
};

/**
 * Generates tooltip text for View button
 * 
 * Requirements: 2.5
 */
export const getViewButtonTooltip = (): string => {
    return 'View booking details (read-only)';
};

/**
 * Determines if Edit button should be enabled
 * 
 * Requirements: 1.1, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3
 */
export const isEditButtonEnabled = (swapInfo?: SwapInfo, isBookingActive: boolean = true): boolean => {
    try {
        // Validate booking active status
        if (typeof isBookingActive !== 'boolean') {
            console.warn('isEditButtonEnabled: isBookingActive is not a boolean, defaulting to true', { isBookingActive });
            isBookingActive = true;
        }

        // If booking is not active, edit should be disabled regardless of swap status
        if (!isBookingActive) {
            console.debug('isEditButtonEnabled: Booking is not active, disabling edit');
            return false;
        }

        // Check if there's an active swap that would prevent editing
        const hasActiveSwapResult = hasActiveSwap(swapInfo);
        const result = !hasActiveSwapResult;

        console.debug('isEditButtonEnabled: Evaluation completed', {
            isBookingActive,
            hasActiveSwap: hasActiveSwapResult,
            result
        });

        return result;
    } catch (error) {
        // Enhanced error handling with detailed logging
        console.error('isEditButtonEnabled: Error determining edit button state, defaulting to allow editing', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            isBookingActive,
            swapInfo: swapInfo ? {
                userProposalStatus: swapInfo.userProposalStatus,
                hasActiveProposals: swapInfo.hasActiveProposals,
                activeProposalCount: swapInfo.activeProposalCount
            } : null
        });

        // Graceful degradation - default to allowing editing if booking is active
        // This ensures users aren't blocked from editing due to errors in swap detection
        return Boolean(isBookingActive);
    }
};

/**
 * Determines if View button should be visible
 * 
 * Requirements: 2.1, 3.1, 3.2, 8.1, 8.2, 8.3
 */
export const shouldShowViewButton = (
    swapInfo?: SwapInfo,
    hasViewCallback: boolean = false
): boolean => {
    try {
        // Validate callback availability
        if (typeof hasViewCallback !== 'boolean') {
            console.warn('shouldShowViewButton: hasViewCallback is not a boolean, defaulting to false', { hasViewCallback });
            hasViewCallback = false;
        }

        // View button should only be visible if:
        // 1. There's an active swap (which would disable the Edit button)
        // 2. There's a callback available to handle the view action
        if (!hasViewCallback) {
            console.debug('shouldShowViewButton: No view callback available, hiding view button');
            return false;
        }

        const hasActiveSwapResult = hasActiveSwap(swapInfo);
        const result = hasActiveSwapResult;

        console.debug('shouldShowViewButton: Evaluation completed', {
            hasActiveSwap: hasActiveSwapResult,
            hasViewCallback,
            result
        });

        return result;
    } catch (error) {
        // Enhanced error handling with detailed logging
        console.error('shouldShowViewButton: Error determining view button visibility, defaulting to false', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            hasViewCallback,
            swapInfo: swapInfo ? {
                userProposalStatus: swapInfo.userProposalStatus,
                hasActiveProposals: swapInfo.hasActiveProposals,
                activeProposalCount: swapInfo.activeProposalCount
            } : null
        });

        // Graceful degradation - default to not showing view button on error
        return false;
    }
};

/**
 * Legacy function name for backward compatibility
 * Maps to the new isSwapConfigured function
 * 
 * @deprecated Use isSwapConfigured instead
 */
export const hasSwapConfigured = isSwapConfigured;