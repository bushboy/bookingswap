import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingEditForm } from '../BookingEditForm';
import { Booking, BookingType } from '@booking-swap/shared';

// Mock only essential dependencies to avoid memory issues
vi.mock('@/utils/validation', () => ({
    validateField: vi.fn(() => ''),
    getValidationErrorCount: vi.fn(() => 0),
    validateCustomProvider: vi.fn(() => ''),
    validateProviderSelection: vi.fn(() => ''),
    createDebouncedValidator: vi.fn((fn) => fn),
}));

vi.mock('@/hooks/useUnsavedChanges', () => ({
    useUnsavedChanges: vi.fn(() => ({
        hasUnsavedChanges: false,
        navigateWithConfirmation: vi.fn(() => Promise.resolve(true)),
        markAsSaved: vi.fn(),
        isSaving: false,
    })),
    useStatePreservation: vi.fn(() => ({
        hasSavedState: vi.fn(() => false),
        clearState: vi.fn(),
    })),
}));

// Mock other hooks with minimal implementations
vi.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false, isTablet: false }),
    useTouch: () => false,
}));

vi.mock('@/hooks/useAccessibility', () => ({
    useFocusManagement: () => ({ restoreFocus: vi.fn() }),
    useAriaLiveRegion: () => ({ announce: vi.fn() }),
    useHighContrast: () => ({ getHighContrastStyles: () => ({}) }),
}));

vi.mock('@/hooks/usePerformanceOptimizations', () => ({
    usePerformanceOptimizations: vi.fn(),
}));

vi.mock('@/utils/bookingDataCache', () => ({
    useBookingCache: vi.fn(),
}));

vi.mock('@/utils/accessibility', () => ({
    getFormFieldAria: () => ({}),
    getButtonAria: () => ({}),
    getFormSectionAria: () => ({}),
    getStatusAria: () => ({}),
    generateAccessibleId: (prefix: string) => `${prefix}-test`,
    getScreenReaderOnlyStyles: () => ({ position: 'absolute', left: '-9999px' }),
    getFocusVisibleStyles: () => ({}),
}));

// Mock design system with minimal tokens
vi.mock('@/design-system/tokens', () => ({
    tokens: {
        spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px' },
        typography: {
            fontSize: { xs: '12px', sm: '14px', base: '16px', lg: '18px' },
            fontWeight: { medium: '500' },
        },
        colors: {
            primary: { 600: '#2563eb' },
            error: { 400: '#f87171', 600: '#dc2626' },
            warning: { 50: '#fffbeb', 300: '#fcd34d', 700: '#a16207', 800: '#92400e' },
            success: { 600: '#059669' },
            neutral: { 300: '#d1d5db', 600: '#4b5563', 900: '#111827' },
        },
        borderRadius: { md: '6px' },
    },
}));

vi.mock('@/design-system/interface-themes', () => ({
    bookingTheme: {
        colors: {
            primary: '#2563eb',
            background: '#ffffff',
            border: '#d1d5db',
            text: '#111827',
        },
    },
    contextualHelp: {
        booking: {
            title: 'Booking Help',
            icon: '📝',
            content: 'Help content',
        },
    },
}));

// Mock UI components with simple implementations
vi.mock('@/components/ui/Modal', () => ({
    Modal: ({ children, isOpen }: any) => isOpen ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, type, loading, disabled }: any) => (
        <button onClick={onClick} type={type} disabled={loading || disabled}>
            {loading ? 'Loading...' : children}
        </button>
    ),
}));

vi.mock('@/components/ui/Input', () => ({
    Input: ({ label, value, onChange, error, required, type = 'text', ...props }: any) => (
        <div>
            <label>{label}{required && ' *'}</label>
            <input
                type={type}
                value={value || ''}
                onChange={onChange}
                data-testid={`input-${label?.toLowerCase().replace(/\s+/g, '-')}`}
                {...props}
            />
            {error && <div data-testid="error">{error}</div>}
        </div>
    ),
}));

vi.mock('@/components/ui/ContextualHelp', () => ({
    ContextualHelp: () => <div data-testid="contextual-help">Help</div>,
}));

vi.mock('@/components/ui/ThemedCard', () => ({
    ThemedCard: ({ children, title }: any) => (
        <div data-testid="themed-card">
            {title && <h3>{title}</h3>}
            {children}
        </div>
    ),
}));

vi.mock('@/components/ui/ThemedInterface', () => ({
    ThemedInterface: ({ children }: any) => <div>{children}</div>,
}));

describe('BookingEditForm - Integration Tests for Backward Compatibility', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Legacy Provider Data Loading', () => {
        it('loads booking with custom provider correctly', async () => {
            const bookingWithCustomProvider: Booking = {
                id: 'test-1',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Legacy Hotel Booking',
                description: 'A booking with custom provider',
                location: { city: 'Paris', country: 'France' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 500,
                swapValue: 450,
                providerDetails: {
                    provider: 'My Travel Agent', // Custom provider
                    confirmationNumber: 'CUSTOM123',
                    bookingReference: 'REF789',
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-1' },
                status: 'available',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                    booking={bookingWithCustomProvider}
                />
            );

            // Should display the form
            expect(screen.getByTestId('modal')).toBeInTheDocument();

            // Should populate basic booking fields
            expect(screen.getByDisplayValue('Legacy Hotel Booking')).toBeInTheDocument();
            expect(screen.getByDisplayValue('CUSTOM123')).toBeInTheDocument();

            // Provider dropdown should show "Other" selected
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('Other');

            // Custom provider input should be visible with the custom value
            const customProviderInput = screen.getByLabelText(/custom provider/i);
            expect(customProviderInput).toBeInTheDocument();
            expect(customProviderInput).toHaveValue('My Travel Agent');
        });

        it('loads booking with predefined provider correctly', async () => {
            const bookingWithPredefinedProvider: Booking = {
                id: 'test-2',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Standard Hotel Booking',
                description: 'A booking with predefined provider',
                location: { city: 'London', country: 'UK' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 300,
                swapValue: 280,
                providerDetails: {
                    provider: 'Booking.com', // Predefined provider
                    confirmationNumber: 'BOOK123',
                    bookingReference: 'REF456',
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-2' },
                status: 'available',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                    booking={bookingWithPredefinedProvider}
                />
            );

            // Should populate basic booking fields
            expect(screen.getByDisplayValue('Standard Hotel Booking')).toBeInTheDocument();
            expect(screen.getByDisplayValue('BOOK123')).toBeInTheDocument();

            // Provider dropdown should show the predefined provider
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('Booking.com');

            // Custom provider input should NOT be visible
            expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();
        });
    });

    describe('Provider Transition Behavior', () => {
        it('handles transition from predefined to custom provider', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            const providerSelect = screen.getByLabelText(/provider/i);

            // Select a predefined provider first
            await user.selectOptions(providerSelect, 'Booking.com');
            expect(providerSelect).toHaveValue('Booking.com');
            expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();

            // Switch to "Other"
            await user.selectOptions(providerSelect, 'Other');
            expect(providerSelect).toHaveValue('Other');

            // Custom provider input should appear
            await waitFor(() => {
                const customProviderInput = screen.getByLabelText(/custom provider/i);
                expect(customProviderInput).toBeInTheDocument();
                expect(customProviderInput).toHaveValue(''); // Should be empty initially
            });
        });

        it('handles transition from custom to predefined provider', async () => {
            const user = userEvent.setup();

            const bookingWithCustomProvider: Booking = {
                id: 'test-3',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Transition Test',
                description: 'Testing transitions',
                location: { city: 'Rome', country: 'Italy' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 400,
                swapValue: 380,
                providerDetails: {
                    provider: 'Local Travel Agency',
                    confirmationNumber: 'LOCAL123',
                    bookingReference: 'REF888',
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-3' },
                status: 'available',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                    booking={bookingWithCustomProvider}
                />
            );

            const providerSelect = screen.getByLabelText(/provider/i);

            // Should start with "Other" selected and custom input visible
            expect(providerSelect).toHaveValue('Other');
            expect(screen.getByLabelText(/custom provider/i)).toHaveValue('Local Travel Agency');

            // Switch to predefined provider
            await user.selectOptions(providerSelect, 'Expedia');
            expect(providerSelect).toHaveValue('Expedia');

            // Custom provider input should disappear
            await waitFor(() => {
                expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('Form Submission with Provider Data', () => {
        it('submits correct data for predefined provider', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Fill in required fields
            await user.type(screen.getByTestId('input-title'), 'Test Booking');
            await user.type(screen.getByRole('textbox', { name: /description/i }), 'Test description for booking');
            await user.type(screen.getByTestId('input-city'), 'Amsterdam');
            await user.type(screen.getByTestId('input-country'), 'Netherlands');
            await user.type(screen.getByTestId('input-original-price-($)'), '200');
            await user.type(screen.getByTestId('input-swap-value-($)'), '180');

            // Select predefined provider
            await user.selectOptions(screen.getByLabelText(/provider/i), 'Hotels.com');

            await user.type(screen.getByTestId('input-confirmation-number'), 'HOTEL123');

            // Submit form
            const submitButton = screen.getByText('Update Booking');
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Test Booking',
                        providerDetails: expect.objectContaining({
                            provider: 'Hotels.com', // Should be the predefined value
                            confirmationNumber: 'HOTEL123',
                        }),
                    })
                );
            });
        });

        it('submits correct data for custom provider', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Fill in required fields
            await user.type(screen.getByTestId('input-title'), 'Custom Provider Test');
            await user.type(screen.getByRole('textbox', { name: /description/i }), 'Testing custom provider submission');
            await user.type(screen.getByTestId('input-city'), 'Vienna');
            await user.type(screen.getByTestId('input-country'), 'Austria');
            await user.type(screen.getByTestId('input-original-price-($)'), '300');
            await user.type(screen.getByTestId('input-swap-value-($)'), '280');

            // Select "Other" provider
            await user.selectOptions(screen.getByLabelText(/provider/i), 'Other');

            // Enter custom provider name
            const customProviderInput = screen.getByLabelText(/custom provider/i);
            await user.type(customProviderInput, 'Vienna Travel Experts');

            await user.type(screen.getByTestId('input-confirmation-number'), 'VTE123');

            // Submit form
            const submitButton = screen.getByText('Update Booking');
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Custom Provider Test',
                        providerDetails: expect.objectContaining({
                            provider: 'Vienna Travel Experts', // Should be the custom value
                            confirmationNumber: 'VTE123',
                        }),
                    })
                );
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('handles malformed provider data gracefully', () => {
            const malformedBooking: any = {
                id: 'malformed-1',
                userId: 'user-1',
                type: 'hotel',
                title: 'Malformed Test',
                description: 'Testing malformed data',
                location: { city: 'Test City', country: 'Test Country' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 100,
                swapValue: 90,
                providerDetails: {
                    provider: null, // Malformed
                    confirmationNumber: 'TEST123',
                    bookingReference: undefined, // Malformed
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-malformed' },
                status: 'available',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Should not crash
            expect(() => {
                render(
                    <BookingEditForm
                        isOpen={true}
                        onClose={mockOnClose}
                        onSubmit={mockOnSubmit}
                        booking={malformedBooking}
                    />
                );
            }).not.toThrow();

            // Should handle null provider gracefully
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('');

            // Should handle undefined booking reference gracefully
            expect(screen.getByTestId('input-booking-reference')).toHaveValue('');
        });

        it('preserves form state during rapid provider changes', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Fill in some form data
            await user.type(screen.getByTestId('input-title'), 'Rapid Change Test');
            await user.type(screen.getByTestId('input-city'), 'Barcelona');

            const providerSelect = screen.getByLabelText(/provider/i);

            // Rapidly change providers
            await user.selectOptions(providerSelect, 'Booking.com');
            await user.selectOptions(providerSelect, 'Other');
            await user.selectOptions(providerSelect, 'Expedia');
            await user.selectOptions(providerSelect, 'Other');
            await user.selectOptions(providerSelect, 'Airbnb');

            // Form data should be preserved
            expect(screen.getByTestId('input-title')).toHaveValue('Rapid Change Test');
            expect(screen.getByTestId('input-city')).toHaveValue('Barcelona');

            // Should end with Airbnb selected
            expect(providerSelect).toHaveValue('Airbnb');
            expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();
        });
    });
});