import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingEditForm, BookingEditData } from '../BookingEditForm';
import { Booking, BookingType } from '@booking-swap/shared';

// Mock the validation utilities
vi.mock('@/utils/validation', () => ({
    validateField: vi.fn((field: string, value: any) => {
        if (field === 'title' && (!value || value.length < 3)) {
            return 'Title must be at least 3 characters';
        }
        if (field === 'description' && (!value || value.length < 10)) {
            return 'Description must be at least 10 characters';
        }
        if (field === 'city' && !value) {
            return 'City is required';
        }
        if (field === 'country' && !value) {
            return 'Country is required';
        }
        if (field === 'originalPrice' && (!value || value <= 0)) {
            return 'Original price must be greater than 0';
        }
        if (field === 'swapValue' && (!value || value <= 0)) {
            return 'Swap value must be greater than 0';
        }
        if (field === 'confirmationNumber' && (!value || value.length < 3)) {
            return 'Confirmation number must be at least 3 characters';
        }
        if (field === 'checkIn' && !value) {
            return 'Check-in date is required';
        }
        if (field === 'checkOut' && !value) {
            return 'Check-out date is required';
        }
        return '';
    }),
    getValidationErrorCount: vi.fn((errors: any) => {
        return Object.keys(errors).filter(key => errors[key]).length;
    }),
    validateCustomProvider: vi.fn((value: string) => {
        if (!value || value.length < 2) {
            return 'Custom provider name must be at least 2 characters';
        }
        if (value.length > 100) {
            return 'Custom provider name must be less than 100 characters';
        }
        if (!/^[a-zA-Z0-9\s\-\.'&]+$/.test(value)) {
            return 'Provider name contains invalid characters';
        }
        return '';
    }),
    validateProviderSelection: vi.fn((provider: string, customProvider: string, isOther: boolean) => {
        if (!provider) {
            return 'Provider is required';
        }
        if (isOther && (!customProvider || customProvider.length < 2)) {
            return 'Custom provider name is required when Other is selected';
        }
        return '';
    }),
    createDebouncedValidator: vi.fn((validator: Function) => validator),
}));

// Mock hooks
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

vi.mock('@/hooks/useResponsive', () => ({
    useResponsive: vi.fn(() => ({ isMobile: false, isTablet: false })),
    useTouch: vi.fn(() => false),
}));

vi.mock('@/hooks/useAccessibility', () => ({
    useFocusManagement: vi.fn(() => ({ restoreFocus: vi.fn() })),
    useAriaLiveRegion: vi.fn(() => ({ announce: vi.fn() })),
    useHighContrast: vi.fn(() => ({ getHighContrastStyles: vi.fn(() => ({})) })),
}));

vi.mock('@/hooks/usePerformanceOptimizations', () => ({
    usePerformanceOptimizations: vi.fn(),
}));

vi.mock('@/utils/bookingDataCache', () => ({
    useBookingCache: vi.fn(),
}));

vi.mock('@/utils/accessibility', () => ({
    getFormFieldAria: vi.fn(() => ({})),
    getButtonAria: vi.fn(() => ({})),
    getFormSectionAria: vi.fn(() => ({})),
    getStatusAria: vi.fn(() => ({})),
    generateAccessibleId: vi.fn((prefix: string) => `${prefix}-test-id`),
    getScreenReaderOnlyStyles: vi.fn(() => ({ position: 'absolute', left: '-9999px' })),
    getFocusVisibleStyles: vi.fn(() => ({})),
}));

// Mock design system
vi.mock('@/design-system/tokens', () => ({
    tokens: {
        spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px' },
        typography: {
            fontSize: { xs: '12px', sm: '14px', base: '16px', lg: '18px' },
            fontWeight: { medium: '500' },
        },
        colors: {
            primary: { 600: '#2563eb' },
            error: { 400: '#f87171', 600: '#dc2626', 700: '#b91c1c' },
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
            content: 'Help content for booking form',
        },
    },
}));

// Mock UI components
vi.mock('@/components/ui/Modal', () => ({
    Modal: ({ children, isOpen, title }: any) =>
        isOpen ? <div data-testid="modal" aria-label={title}>{children}</div> : null,
}));

vi.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, type, variant, loading, disabled, ...props }: any) => (
        <button
            onClick={onClick}
            type={type}
            disabled={loading || disabled}
            data-variant={variant}
            {...props}
        >
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
                value={value}
                onChange={onChange}
                data-testid={`input-${label?.toLowerCase().replace(/\s+/g, '-')}`}
                {...props}
            />
            {error && <div data-testid="error" role="alert">{error}</div>}
        </div>
    ),
}));

vi.mock('@/components/ui/ContextualHelp', () => ({
    ContextualHelp: ({ title, content }: any) => (
        <div data-testid="contextual-help">
            <h3>{title}</h3>
            <p>{content}</p>
        </div>
    ),
}));

vi.mock('@/components/ui/ThemedCard', () => ({
    ThemedCard: ({ children, title, icon }: any) => (
        <div data-testid="themed-card">
            {title && <h3>{icon} {title}</h3>}
            {children}
        </div>
    ),
}));

vi.mock('@/components/ui/ThemedInterface', () => ({
    ThemedInterface: ({ children }: any) => <div data-testid="themed-interface">{children}</div>,
}));

describe('BookingEditForm - Backward Compatibility Tests', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Legacy Provider Data Handling', () => {
        it('displays existing bookings with custom providers correctly', () => {
            const bookingWithCustomProvider: Booking = {
                id: 'test-booking-1',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Legacy Booking',
                description: 'A booking with custom provider',
                location: { city: 'Paris', country: 'France' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 500,
                swapValue: 450,
                providerDetails: {
                    provider: 'My Travel Agent', // Custom provider not in predefined list
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

            // Should select "Other" in dropdown
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('Other');

            // Should show custom provider input with the custom value
            const customProviderInput = screen.getByLabelText(/custom provider/i);
            expect(customProviderInput).toBeInTheDocument();
            expect(customProviderInput).toHaveValue('My Travel Agent');

            // Other fields should be populated correctly
            expect(screen.getByDisplayValue('Legacy Booking')).toBeInTheDocument();
            expect(screen.getByDisplayValue('CUSTOM123')).toBeInTheDocument();
            expect(screen.getByDisplayValue('REF789')).toBeInTheDocument();
        });

        it('displays existing bookings with predefined providers correctly', () => {
            const bookingWithPredefinedProvider: Booking = {
                id: 'test-booking-2',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Standard Booking',
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

            // Should select the predefined provider in dropdown
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('Booking.com');

            // Should NOT show custom provider input
            expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();

            // Other fields should be populated correctly
            expect(screen.getByDisplayValue('Standard Booking')).toBeInTheDocument();
            expect(screen.getByDisplayValue('BOOK123')).toBeInTheDocument();
            expect(screen.getByDisplayValue('REF456')).toBeInTheDocument();
        });

        it('handles empty or null provider data gracefully', () => {
            const bookingWithEmptyProvider: Booking = {
                id: 'test-booking-3',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Empty Provider Booking',
                description: 'A booking with empty provider',
                location: { city: 'Berlin', country: 'Germany' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 400,
                swapValue: 380,
                providerDetails: {
                    provider: '', // Empty provider
                    confirmationNumber: 'EMPTY123',
                    bookingReference: '',
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
                    booking={bookingWithEmptyProvider}
                />
            );

            // Should show default empty selection
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('');

            // Should NOT show custom provider input
            expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();

            // Other fields should be populated correctly
            expect(screen.getByDisplayValue('Empty Provider Booking')).toBeInTheDocument();
            expect(screen.getByDisplayValue('EMPTY123')).toBeInTheDocument();
        });
    });

    describe('Provider Transition Handling', () => {
        it('handles transition from predefined to custom provider', async () => {
            const user = userEvent.setup();

            const bookingWithPredefinedProvider: Booking = {
                id: 'test-booking-4',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Transition Test Booking',
                description: 'Testing provider transitions',
                location: { city: 'Madrid', country: 'Spain' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 350,
                swapValue: 320,
                providerDetails: {
                    provider: 'Expedia',
                    confirmationNumber: 'EXP123',
                    bookingReference: 'REF999',
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-4' },
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

            // Initially should show Expedia selected
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('Expedia');
            expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();

            // Change to "Other"
            await user.selectOptions(providerSelect, 'Other');

            // Should now show custom provider input
            await waitFor(() => {
                const customProviderInput = screen.getByLabelText(/custom provider/i);
                expect(customProviderInput).toBeInTheDocument();
                expect(customProviderInput).toHaveValue(''); // Should be empty initially
            });

            // Enter custom provider name
            const customProviderInput = screen.getByLabelText(/custom provider/i);
            await user.type(customProviderInput, 'My Custom Travel Service');

            expect(customProviderInput).toHaveValue('My Custom Travel Service');
        });

        it('handles transition from custom to predefined provider', async () => {
            const user = userEvent.setup();

            const bookingWithCustomProvider: Booking = {
                id: 'test-booking-5',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Custom to Predefined Test',
                description: 'Testing reverse transition',
                location: { city: 'Rome', country: 'Italy' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 450,
                swapValue: 420,
                providerDetails: {
                    provider: 'Local Travel Agency',
                    confirmationNumber: 'LOCAL123',
                    bookingReference: 'REF888',
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-5' },
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

            // Initially should show "Other" selected with custom input
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('Other');

            const customProviderInput = screen.getByLabelText(/custom provider/i);
            expect(customProviderInput).toBeInTheDocument();
            expect(customProviderInput).toHaveValue('Local Travel Agency');

            // Change to predefined provider
            await user.selectOptions(providerSelect, 'Hotels.com');

            // Custom provider input should disappear
            await waitFor(() => {
                expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();
            });

            expect(providerSelect).toHaveValue('Hotels.com');
        });

        it('preserves other form data during provider transitions', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Fill in form data
            await user.type(screen.getByTestId('input-title'), 'Test Booking');
            await user.type(screen.getByTestId('input-confirmation-number'), 'CONF123');

            // Select predefined provider
            const providerSelect = screen.getByLabelText(/provider/i);
            await user.selectOptions(providerSelect, 'Booking.com');

            // Change to Other
            await user.selectOptions(providerSelect, 'Other');

            // Other form data should be preserved
            expect(screen.getByTestId('input-title')).toHaveValue('Test Booking');
            expect(screen.getByTestId('input-confirmation-number')).toHaveValue('CONF123');

            // Enter custom provider
            const customProviderInput = screen.getByLabelText(/custom provider/i);
            await user.type(customProviderInput, 'Custom Provider');

            // Change back to predefined
            await user.selectOptions(providerSelect, 'Expedia');

            // All other data should still be preserved
            expect(screen.getByTestId('input-title')).toHaveValue('Test Booking');
            expect(screen.getByTestId('input-confirmation-number')).toHaveValue('CONF123');
        });
    });

    describe('API Integration Compatibility', () => {
        it('maintains existing provider data format for predefined providers', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Fill form with predefined provider
            await user.type(screen.getByTestId('input-title'), 'API Test Booking');
            await user.type(screen.getByRole('textbox', { name: /description/i }), 'Testing API compatibility');
            await user.type(screen.getByTestId('input-city'), 'Amsterdam');
            await user.type(screen.getByTestId('input-country'), 'Netherlands');
            await user.type(screen.getByTestId('input-original-price-($)'), '250');
            await user.type(screen.getByTestId('input-swap-value-($)'), '230');

            const providerSelect = screen.getByLabelText(/provider/i);
            await user.selectOptions(providerSelect, 'Airbnb');

            await user.type(screen.getByTestId('input-confirmation-number'), 'AIRBNB123');
            await user.type(screen.getByTestId('input-booking-reference'), 'REF456');

            // Submit form
            const submitButton = screen.getByText('Update Booking');
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        providerDetails: {
                            provider: 'Airbnb', // Should be the predefined value
                            confirmationNumber: 'AIRBNB123',
                            bookingReference: 'REF456',
                        },
                    })
                );
            });
        });

        it('maintains existing provider data format for custom providers', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Fill form with custom provider
            await user.type(screen.getByTestId('input-title'), 'Custom API Test');
            await user.type(screen.getByRole('textbox', { name: /description/i }), 'Testing custom provider API');
            await user.type(screen.getByTestId('input-city'), 'Vienna');
            await user.type(screen.getByTestId('input-country'), 'Austria');
            await user.type(screen.getByTestId('input-original-price-($)'), '300');
            await user.type(screen.getByTestId('input-swap-value-($)'), '280');

            const providerSelect = screen.getByLabelText(/provider/i);
            await user.selectOptions(providerSelect, 'Other');

            const customProviderInput = screen.getByLabelText(/custom provider/i);
            await user.type(customProviderInput, 'Vienna Travel Experts');

            await user.type(screen.getByTestId('input-confirmation-number'), 'VTE123');
            await user.type(screen.getByTestId('input-booking-reference'), 'REF789');

            // Submit form
            const submitButton = screen.getByText('Update Booking');
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        providerDetails: {
                            provider: 'Vienna Travel Experts', // Should be the custom value
                            confirmationNumber: 'VTE123',
                            bookingReference: 'REF789',
                        },
                    })
                );
            });
        });

        it('handles provider data updates without breaking existing API contracts', async () => {
            const user = userEvent.setup();

            const existingBooking: Booking = {
                id: 'api-test-booking',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Existing API Booking',
                description: 'Testing API updates',
                location: { city: 'Prague', country: 'Czech Republic' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 200,
                swapValue: 180,
                providerDetails: {
                    provider: 'Old Custom Provider',
                    confirmationNumber: 'OLD123',
                    bookingReference: 'OLDREF',
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-api' },
                status: 'available',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                    booking={existingBooking}
                />
            );

            // Should load with custom provider
            expect(screen.getByLabelText(/provider/i)).toHaveValue('Other');
            expect(screen.getByLabelText(/custom provider/i)).toHaveValue('Old Custom Provider');

            // Update to predefined provider
            await user.selectOptions(screen.getByLabelText(/provider/i), 'Vrbo');

            // Submit updated form
            const submitButton = screen.getByText('Update Booking');
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        providerDetails: expect.objectContaining({
                            provider: 'Vrbo', // Updated to predefined provider
                            confirmationNumber: 'OLD123', // Existing data preserved
                            bookingReference: 'OLDREF', // Existing data preserved
                        }),
                    })
                );
            });
        });
    });

    describe('Form State Preservation', () => {
        it('preserves form state during provider changes', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Fill in form data
            await user.type(screen.getByTestId('input-title'), 'State Preservation Test');
            await user.type(screen.getByTestId('input-city'), 'Barcelona');
            await user.type(screen.getByTestId('input-original-price-($)'), '400');

            // Select provider and change multiple times
            const providerSelect = screen.getByLabelText(/provider/i);

            await user.selectOptions(providerSelect, 'Booking.com');
            expect(screen.getByTestId('input-title')).toHaveValue('State Preservation Test');

            await user.selectOptions(providerSelect, 'Other');
            expect(screen.getByTestId('input-title')).toHaveValue('State Preservation Test');
            expect(screen.getByTestId('input-city')).toHaveValue('Barcelona');

            await user.type(screen.getByLabelText(/custom provider/i), 'Custom Provider');
            expect(screen.getByTestId('input-original-price-($)')).toHaveValue('400');

            await user.selectOptions(providerSelect, 'Expedia');
            expect(screen.getByTestId('input-title')).toHaveValue('State Preservation Test');
            expect(screen.getByTestId('input-city')).toHaveValue('Barcelona');
            expect(screen.getByTestId('input-original-price-($)')).toHaveValue('400');
        });

        it('handles form validation during provider transitions', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Try to submit with no provider selected
            const submitButton = screen.getByText('Update Booking');
            await user.click(submitButton);

            // Should show validation errors
            expect(mockOnSubmit).not.toHaveBeenCalled();

            // Select "Other" but don't enter custom provider
            const providerSelect = screen.getByLabelText(/provider/i);
            await user.selectOptions(providerSelect, 'Other');

            // Try to submit again
            await user.click(submitButton);

            // Should still show validation errors for missing custom provider
            expect(mockOnSubmit).not.toHaveBeenCalled();

            // Enter custom provider
            const customProviderInput = screen.getByLabelText(/custom provider/i);
            await user.type(customProviderInput, 'Valid Custom Provider');

            // Fill other required fields
            await user.type(screen.getByTestId('input-title'), 'Valid Title');
            await user.type(screen.getByRole('textbox', { name: /description/i }), 'Valid description text');
            await user.type(screen.getByTestId('input-city'), 'Valid City');
            await user.type(screen.getByTestId('input-country'), 'Valid Country');
            await user.type(screen.getByTestId('input-original-price-($)'), '100');
            await user.type(screen.getByTestId('input-swap-value-($)'), '90');
            await user.type(screen.getByTestId('input-confirmation-number'), 'VALID123');

            // Now submission should work
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        providerDetails: expect.objectContaining({
                            provider: 'Valid Custom Provider',
                        }),
                    })
                );
            });
        });

        it('maintains validation state during provider transitions', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Enter invalid title to trigger validation
            await user.type(screen.getByTestId('input-title'), 'ab'); // Too short

            // Try to submit to trigger validation
            const submitButton = screen.getByText('Update Booking');
            await user.click(submitButton);

            // Should show title validation error
            await waitFor(() => {
                expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
            });

            // Change provider - validation errors should persist
            const providerSelect = screen.getByLabelText(/provider/i);
            await user.selectOptions(providerSelect, 'Booking.com');

            // Title validation error should still be visible
            expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();

            // Change to Other provider
            await user.selectOptions(providerSelect, 'Other');

            // Title validation error should still be visible
            expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();

            // Fix the title
            const titleInput = screen.getByTestId('input-title');
            await user.clear(titleInput);
            await user.type(titleInput, 'Valid Title');

            // Title error should be resolved
            await waitFor(() => {
                expect(screen.queryByText('Title must be at least 3 characters')).not.toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('handles malformed provider data gracefully', () => {
            const bookingWithMalformedProvider: any = {
                id: 'malformed-booking',
                userId: 'user-1',
                type: 'hotel',
                title: 'Malformed Provider Test',
                description: 'Testing malformed data handling',
                location: { city: 'Test City', country: 'Test Country' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 100,
                swapValue: 90,
                providerDetails: {
                    provider: null, // Malformed data
                    confirmationNumber: 'TEST123',
                    bookingReference: undefined, // Malformed data
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-malformed' },
                status: 'available',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Should not crash when rendering with malformed data
            expect(() => {
                render(
                    <BookingEditForm
                        isOpen={true}
                        onClose={mockOnClose}
                        onSubmit={mockOnSubmit}
                        booking={bookingWithMalformedProvider}
                    />
                );
            }).not.toThrow();

            // Should handle null provider gracefully
            const providerSelect = screen.getByLabelText(/provider/i);
            expect(providerSelect).toHaveValue('');

            // Should handle undefined booking reference gracefully
            expect(screen.getByTestId('input-booking-reference')).toHaveValue('');
        });

        it('handles very long custom provider names', async () => {
            const user = userEvent.setup();

            const longProviderName = 'A'.repeat(150); // Exceeds 100 character limit

            const bookingWithLongProvider: Booking = {
                id: 'long-provider-booking',
                userId: 'user-1',
                type: 'hotel' as BookingType,
                title: 'Long Provider Test',
                description: 'Testing long provider names',
                location: { city: 'Test City', country: 'Test Country' },
                dateRange: {
                    checkIn: new Date('2024-12-01'),
                    checkOut: new Date('2024-12-05'),
                },
                originalPrice: 100,
                swapValue: 90,
                providerDetails: {
                    provider: longProviderName,
                    confirmationNumber: 'LONG123',
                    bookingReference: 'REF123',
                },
                verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
                blockchain: { topicId: 'topic-long' },
                status: 'available',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                    booking={bookingWithLongProvider}
                />
            );

            // Should select "Other" and show the long provider name
            expect(screen.getByLabelText(/provider/i)).toHaveValue('Other');
            expect(screen.getByLabelText(/custom provider/i)).toHaveValue(longProviderName);

            // Should show validation error for long provider name
            await waitFor(() => {
                expect(screen.getByText('Custom provider name must be less than 100 characters')).toBeInTheDocument();
            });
        });

        it('handles special characters in custom provider names', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            // Select "Other" provider
            const providerSelect = screen.getByLabelText(/provider/i);
            await user.selectOptions(providerSelect, 'Other');

            const customProviderInput = screen.getByLabelText(/custom provider/i);

            // Test valid special characters
            await user.type(customProviderInput, "O'Reilly Travel & Tours Co.");
            expect(customProviderInput).toHaveValue("O'Reilly Travel & Tours Co.");

            // Clear and test invalid characters
            await user.clear(customProviderInput);
            await user.type(customProviderInput, 'Invalid@Provider#Name!');

            // Should show validation error for invalid characters
            await waitFor(() => {
                expect(screen.getByText('Provider name contains invalid characters')).toBeInTheDocument();
            });
        });

        it('handles rapid provider selection changes', async () => {
            const user = userEvent.setup();

            render(
                <BookingEditForm
                    isOpen={true}
                    onClose={mockOnClose}
                    onSubmit={mockOnSubmit}
                />
            );

            const providerSelect = screen.getByLabelText(/provider/i);

            // Rapidly change provider selections
            await user.selectOptions(providerSelect, 'Booking.com');
            await user.selectOptions(providerSelect, 'Other');
            await user.selectOptions(providerSelect, 'Expedia');
            await user.selectOptions(providerSelect, 'Other');
            await user.selectOptions(providerSelect, 'Airbnb');

            // Should end up with Airbnb selected and no custom input visible
            expect(providerSelect).toHaveValue('Airbnb');
            expect(screen.queryByLabelText(/custom provider/i)).not.toBeInTheDocument();
        });
    });
});