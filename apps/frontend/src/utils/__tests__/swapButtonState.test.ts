import { describe, it, expect } from 'vitest';
import { getSwapButtonState, shouldShowManageSwap, getSwapButtonText, getManageSwapTooltip } from '../swapButtonState';
import { Booking, SwapInfo } from '@booking-swap/shared';

// Mock booking data
const mockActiveBooking: Booking = {
    id: '1',
    userId: 'user1',
    type: 'hotel',
    title: 'Test Booking',
    description: 'Test Description',
    location: { city: 'Test City', country: 'Test Country' },
    dateRange: {
        checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
    },
    originalPrice: 100,
    swapValue: 100,
    providerDetails: {
        provider: 'Test Provider',
        confirmationNumber: 'TEST123',
        bookingReference: 'REF123'
    },
    verification: {
        status: 'verified',
        verifiedAt: new Date(),
        documents: []
    },
    blockchain: {
        topicId: 'topic1'
    },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date()
};

const mockInactiveBooking: Booking = {
    ...mockActiveBooking,
    status: 'cancelled'
};

const mockPastBooking: Booking = {
    ...mockActiveBooking,
    dateRange: {
        checkIn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        checkOut: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
    }
};

const mockUnverifiedBooking: Booking = {
    ...mockActiveBooking,
    verification: {
        status: 'pending',
        documents: []
    }
};

const mockActiveSwapInfo: SwapInfo = {
    swapId: 'swap1',
    paymentTypes: ['booking'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: true,
    activeProposalCount: 2,
    userProposalStatus: 'none',
    swapConditions: [],
    hasAnySwapInitiated: true
};

const mockInactiveSwapInfo: SwapInfo = {
    swapId: 'swap1',
    paymentTypes: ['booking'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: false,
    activeProposalCount: 0,
    userProposalStatus: 'none',
    swapConditions: [],
    hasAnySwapInitiated: false
};

describe('getSwapButtonState', () => {
    it('should return visible and enabled state for active booking with no swap', () => {
        const mockOnCreateSwap = () => { };
        const result = getSwapButtonState(mockActiveBooking, undefined, mockOnCreateSwap);

        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(true);
        expect(result.tooltip).toBe('Create a swap proposal for this booking');
        expect(result.variant).toBe('primary');
    });

    it('should return invisible state when active swap exists', () => {
        const mockOnCreateSwap = () => { };
        const result = getSwapButtonState(mockActiveBooking, mockActiveSwapInfo, mockOnCreateSwap);

        expect(result.visible).toBe(false);
        expect(result.enabled).toBe(false);
    });

    it('should return disabled state for inactive booking', () => {
        const mockOnCreateSwap = () => { };
        const result = getSwapButtonState(mockInactiveBooking, undefined, mockOnCreateSwap);

        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(false);
        expect(result.tooltip).toBe('Cannot create swap for cancelled booking');
    });

    it('should return disabled state when no create handler provided', () => {
        const result = getSwapButtonState(mockActiveBooking, undefined, undefined);

        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(false);
        expect(result.tooltip).toBe('Swap creation not available');
    });

    it('should return disabled state for past bookings', () => {
        const mockOnCreateSwap = () => { };
        const result = getSwapButtonState(mockPastBooking, undefined, mockOnCreateSwap);

        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(false);
        expect(result.tooltip).toBe('Cannot create swap for past bookings');
    });

    it('should return disabled state for unverified bookings', () => {
        const mockOnCreateSwap = () => { };
        const result = getSwapButtonState(mockUnverifiedBooking, undefined, mockOnCreateSwap);

        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(false);
        expect(result.tooltip).toBe('Booking verification required before creating swap');
    });
});

describe('shouldShowManageSwap', () => {
    it('should return true when swap has active proposals', () => {
        const result = shouldShowManageSwap(mockActiveSwapInfo);
        expect(result).toBe(true);
    });

    it('should return false when swap has no active proposals', () => {
        const result = shouldShowManageSwap(mockInactiveSwapInfo);
        expect(result).toBe(false);
    });

    it('should return false when no swap info provided', () => {
        const result = shouldShowManageSwap(undefined);
        expect(result).toBe(false);
    });
});

describe('getSwapButtonText', () => {
    it('should return "Manage Swap" when swap has active proposals', () => {
        const result = getSwapButtonText(mockActiveSwapInfo);
        expect(result).toBe('Manage Swap');
    });

    it('should return "Create Swap" when no active swap', () => {
        const result = getSwapButtonText(mockInactiveSwapInfo);
        expect(result).toBe('Create Swap');
    });

    it('should return "Create Swap" when no swap info provided', () => {
        const result = getSwapButtonText(undefined);
        expect(result).toBe('Create Swap');
    });
});

describe('getManageSwapTooltip', () => {
    it('should return tooltip with proposal count when active proposals exist', () => {
        const result = getManageSwapTooltip(mockActiveSwapInfo);
        expect(result).toBe('Manage swap with 2 active proposals');
    });

    it('should return generic tooltip when no active proposals', () => {
        const result = getManageSwapTooltip(mockInactiveSwapInfo);
        expect(result).toBe('Manage swap settings');
    });

    it('should return generic tooltip when no swap info provided', () => {
        const result = getManageSwapTooltip(undefined);
        expect(result).toBe('Manage swap settings');
    });
});