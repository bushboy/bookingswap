import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { OwnerActions, BrowserActions, ProposerActions } from '../BookingActions';
import { Booking, SwapInfo } from '@booking-swap/shared';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';

// Mock the error recovery service
vi.mock('@/services/errorRecoveryService', () => ({
    errorRecoveryService: {
        executeWithRecovery: vi.fn((operation) => {
            // Execute the operation directly and return a result object
            return operation().then(
                (result) => ({ success: true, data: result }),
                (error) => ({ success: false, error })
            );
        }),
    },
}));

// Mock the error handling utilities
vi.mock('@/utils/errorHandling', () => ({
    formatErrorForUser: vi.fn((error: Error) => ({
        title: 'Test Error',
        message: error.message,
        details: 'Test error details',
        actions: [
            { label: 'Try Again', action: 'retry', primary: true, variant: 'primary' },
            { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
        ],
        severity: 'error' as const,
    })),
}));

// Mock the swap button state utilities
vi.mock('@/utils/swapButtonState', () => ({
    getSwapButtonState: vi.fn(() => ({
        visible: true,
        enabled: true,
        tooltip: 'Create a swap proposal for this booking',
        variant: 'primary',
    })),
    shouldShowManageSwap: vi.fn(() => false),
    getManageSwapTooltip: vi.fn(() => 'Manage swap settings'),
}));

const mockBooking: Booking = {
    id: 'booking-1',
    userId: 'user-1',
    type: 'hotel',
    title: 'Test Booking',
    description: 'Test Description',
    location: {
        city: 'Test City',
        country: 'Test Country',
    },
    dateRange: {
        checkIn: new Date('2024-12-01'),
        checkOut: new Date('2024-12-03'),
    },
    originalPrice: 500,
    swapValue: 500,
    providerDetails: {
        provider: 'Test Provider',
        confirmationNumber: 'TEST123',
        bookingReference: 'REF123',
    },
    verification: {
        status: 'verified',
        documents: [],
    },
    blockchain: {
        topicId: 'test-topic',
    },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockSwapInfo: SwapInfo = {
    hasActiveProposals: false,
    activeProposalCount: 0,
    acceptanceStrategy: 'first_match',
    userProposalStatus: null,
    timeRemaining: null,
};

describe('BookingActions Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('OwnerActions Error Handling', () => {
        it('should show loading state when creating swap', async () => {
            const mockOnCreateSwap = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onCreateSwap={mockOnCreateSwap}
                />
            );

            const createSwapButton = screen.getByText('Create Swap');
            fireEvent.click(createSwapButton);

            // Should show loading state
            expect(screen.getByText('Creating...')).toBeInTheDocument();
            expect(createSwapButton).toBeDisabled();

            // Wait for operation to complete
            await waitFor(() => {
                expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
            });
        });

        it('should display error message when swap creation fails', async () => {
            const testError = new SwapPlatformError(
                ERROR_CODES.BOOKING_NOT_FOUND,
                'Booking not found',
                'business',
                false
            );

            const mockOnCreateSwap = vi.fn(() => Promise.reject(testError));

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onCreateSwap={mockOnCreateSwap}
                />
            );

            const createSwapButton = screen.getByText('Create Swap');
            fireEvent.click(createSwapButton);

            // Wait for error to appear
            await waitFor(() => {
                expect(screen.getByText('Test Error')).toBeInTheDocument();
                expect(screen.getByText('Booking not found')).toBeInTheDocument();
            });

            // Should show retry button
            expect(screen.getByText('Try Again')).toBeInTheDocument();
            expect(screen.getByText('Dismiss')).toBeInTheDocument();
        });

        it('should call onError callback when error occurs', async () => {
            const testError = new SwapPlatformError(
                ERROR_CODES.BOOKING_NOT_FOUND,
                'Booking not found',
                'business',
                false
            );

            const mockOnCreateSwap = vi.fn(() => Promise.reject(testError));
            const mockOnError = vi.fn();

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onCreateSwap={mockOnCreateSwap}
                    onError={mockOnError}
                />
            );

            const createSwapButton = screen.getByText('Create Swap');
            fireEvent.click(createSwapButton);

            // Wait for error callback to be called
            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith(testError, 'create_swap');
            });
        });
    });

    describe('Error Display Component', () => {
        it('should not render when no error is present', () => {
            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onCreateSwap={vi.fn()}
                />
            );

            // Should not show any error display
            expect(screen.queryByText('Test Error')).not.toBeInTheDocument();
        });

        it('should render compact error display', async () => {
            const testError = new SwapPlatformError(
                ERROR_CODES.BOOKING_NOT_FOUND,
                'Booking not found',
                'business',
                false
            );

            const mockOnCreateSwap = vi.fn(() => Promise.reject(testError));

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onCreateSwap={mockOnCreateSwap}
                    showErrorInline={true}
                />
            );

            const createSwapButton = screen.getByText('Create Swap');
            fireEvent.click(createSwapButton);

            // Wait for error to appear
            await waitFor(() => {
                expect(screen.getByText('Test Error')).toBeInTheDocument();
                expect(screen.getByText('Booking not found')).toBeInTheDocument();
            });
        });

        it('should hide error display when showErrorInline is false', async () => {
            const testError = new SwapPlatformError(
                ERROR_CODES.BOOKING_NOT_FOUND,
                'Booking not found',
                'business',
                false
            );

            const mockOnCreateSwap = vi.fn(() => Promise.reject(testError));

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onCreateSwap={mockOnCreateSwap}
                    showErrorInline={false}
                />
            );

            const createSwapButton = screen.getByText('Create Swap');
            fireEvent.click(createSwapButton);

            // Wait a bit to ensure error would have appeared if it was going to
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should not show inline error display
            expect(screen.queryByText('Test Error')).not.toBeInTheDocument();
        });
    });
});