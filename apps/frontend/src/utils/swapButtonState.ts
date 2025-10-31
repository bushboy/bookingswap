import { Booking, SwapInfo } from '@booking-swap/shared';

/**
 * Configuration interface for swap button state
 */
export interface SwapButtonConfig {
    visible: boolean;
    enabled: boolean;
    tooltip: string;
    variant: 'primary' | 'secondary' | 'outline';
}

/**
 * Props interface for swap button state calculation
 */
export interface SwapButtonStateProps {
    booking: Booking;
    swapInfo?: SwapInfo;
    onCreateSwap?: (booking: Booking) => void;
}

// Cache for expensive business rule calculations
const businessRuleCache = new Map<string, string | null>();

/**
 * Determines the state and configuration for the Create Swap button
 * Optimized with caching for expensive calculations
 * 
 * @param booking - The booking object
 * @param swapInfo - Optional swap information for the booking
 * @param onCreateSwap - Optional callback function for creating swaps
 * @returns SwapButtonConfig object with visibility, state, and tooltip information
 */
export const getSwapButtonState = (
    booking: Booking,
    swapInfo?: SwapInfo,
    onCreateSwap?: (booking: Booking) => void
): SwapButtonConfig => {
    const hasActiveSwap = swapInfo?.hasActiveProposals;
    const isBookingActive = booking.status === 'available';
    const hasCreateHandler = Boolean(onCreateSwap);

    console.log('🟡 getSwapButtonState called for booking:', booking.id, {
        hasActiveSwap,
        isBookingActive,
        hasCreateHandler,
        onCreateSwap: typeof onCreateSwap
    });

    // Button is not visible if there's already an active swap
    if (hasActiveSwap) {
        console.log('🔴 Button hidden - hasActiveSwap:', hasActiveSwap);
        return {
            visible: false,
            enabled: false,
            tooltip: '',
            variant: 'primary'
        };
    }

    // Button is visible but disabled if booking is not active
    if (!isBookingActive) {
        console.log('🟠 Button disabled - booking not active:', booking.status);
        return {
            visible: true,
            enabled: false,
            tooltip: getInactiveBookingTooltip(booking.status),
            variant: 'primary'
        };
    }

    // Button is visible but disabled if no handler is provided
    if (!hasCreateHandler) {
        console.log('🟠 Button disabled - no handler provided');
        return {
            visible: true,
            enabled: false,
            tooltip: 'Swap creation not available',
            variant: 'primary'
        };
    }

    // Check for additional business rule constraints with caching
    const cacheKey = `${booking.id}-${booking.dateRange.checkIn}-${booking.verification.status}`;
    let businessRuleConstraint = businessRuleCache.get(cacheKey);

    if (businessRuleConstraint === undefined) {
        businessRuleConstraint = checkBusinessRuleConstraints(booking, swapInfo);
        businessRuleCache.set(cacheKey, businessRuleConstraint);

        // Clear cache after 5 minutes to prevent memory leaks
        setTimeout(() => {
            businessRuleCache.delete(cacheKey);
        }, 5 * 60 * 1000);
    }

    if (businessRuleConstraint) {
        return {
            visible: true,
            enabled: false,
            tooltip: businessRuleConstraint,
            variant: 'primary'
        };
    }

    // Button is fully functional
    const result = {
        visible: true,
        enabled: true,
        tooltip: 'Create a swap proposal for this booking',
        variant: 'primary' as const
    };
    console.log('🟢 Button enabled and visible!', result);
    return result;
};

/**
 * Generates tooltip text for inactive bookings based on status
 * 
 * @param status - The booking status
 * @returns Appropriate tooltip text for the booking status
 */
const getInactiveBookingTooltip = (status: string): string => {
    switch (status) {
        case 'locked':
            return 'Cannot create swap for locked booking';
        case 'swapped':
            return 'Booking has already been swapped';
        case 'cancelled':
            return 'Cannot create swap for cancelled booking';
        default:
            return 'Cannot create swap for inactive booking';
    }
};

/**
 * Checks for business rule constraints that might prevent swap creation
 * 
 * @param booking - The booking object
 * @param swapInfo - Optional swap information
 * @returns Error message if constraints exist, null otherwise
 */
const checkBusinessRuleConstraints = (
    booking: Booking,
    swapInfo?: SwapInfo
): string | null => {
    // Check if booking date has passed
    const now = new Date();
    const checkInDate = new Date(booking.dateRange.checkIn);

    if (checkInDate <= now) {
        return 'Cannot create swap for past bookings';
    }

    // Check if booking is too close to check-in date (within 24 hours)
    const timeUntilCheckIn = checkInDate.getTime() - now.getTime();
    const hoursUntilCheckIn = timeUntilCheckIn / (1000 * 60 * 60);

    if (hoursUntilCheckIn < 24) {
        return 'Cannot create swap within 24 hours of check-in';
    }

    // Check if booking verification is required but not completed
    if (booking.verification.status === 'pending') {
        return 'Booking verification required before creating swap';
    }

    if (booking.verification.status === 'failed') {
        return 'Cannot create swap for unverified booking';
    }

    // Check if there's a previous swap that was recently cancelled
    if (swapInfo?.hasAnySwapInitiated) {
        // This could be expanded to check for cooldown periods or other constraints
        // For now, we allow swap creation even if previous swaps existed
    }

    return null;
};

/**
 * Determines if the swap button should show "Manage Swap" instead of "Create Swap"
 * 
 * @param swapInfo - Swap information for the booking
 * @returns True if should show manage swap button
 */
export const shouldShowManageSwap = (swapInfo?: SwapInfo): boolean => {
    return Boolean(swapInfo?.hasActiveProposals);
};

/**
 * Gets the appropriate button text based on swap state
 * 
 * @param swapInfo - Swap information for the booking
 * @returns Button text string
 */
export const getSwapButtonText = (swapInfo?: SwapInfo): string => {
    if (shouldShowManageSwap(swapInfo)) {
        return 'Manage Swap';
    }
    return 'Create Swap';
};

/**
 * Gets tooltip text for the manage swap button
 * 
 * @param swapInfo - Swap information for the booking
 * @returns Tooltip text for manage swap button
 */
export const getManageSwapTooltip = (swapInfo?: SwapInfo): string => {
    if (!swapInfo) {
        return 'Manage swap settings';
    }

    const proposalCount = swapInfo.activeProposalCount;
    if (proposalCount > 0) {
        return `Manage swap with ${proposalCount} active proposal${proposalCount > 1 ? 's' : ''}`;
    }

    return 'Manage swap settings';
};