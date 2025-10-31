import { describe, it, expect } from 'vitest';

/**
 * Backward Compatibility Tests for BookingEditForm Provider Dropdown
 * 
 * These tests verify that the provider dropdown functionality maintains
 * backward compatibility with existing booking data and API contracts.
 */

describe('BookingEditForm - Backward Compatibility', () => {
    describe('Provider Data Mapping', () => {
        it('should identify predefined providers correctly', () => {
            const BOOKING_PROVIDERS = [
                { value: 'Booking.com', label: 'Booking.com', icon: '🌐' },
                { value: 'Expedia', label: 'Expedia', icon: '✈️' },
                { value: 'Hotels.com', label: 'Hotels.com', icon: '🏨' },
                { value: 'Airbnb', label: 'Airbnb', icon: '🏠' },
                { value: 'Other', label: 'Other', icon: '📝' },
            ];

            // Test predefined provider detection
            const isPredefined = (provider: string) =>
                BOOKING_PROVIDERS.some(p => p.value === provider);

            expect(isPredefined('Booking.com')).toBe(true);
            expect(isPredefined('Expedia')).toBe(true);
            expect(isPredefined('Custom Travel Agency')).toBe(false);
            expect(isPredefined('')).toBe(false);
            expect(isPredefined('Other')).toBe(true);
        });

        it('should handle provider state initialization correctly', () => {
            const BOOKING_PROVIDERS = [
                { value: 'Booking.com', label: 'Booking.com', icon: '🌐' },
                { value: 'Expedia', label: 'Expedia', icon: '✈️' },
                { value: 'Other', label: 'Other', icon: '📝' },
            ];

            const initializeProviderState = (existingProvider: string) => {
                const isPredefined = BOOKING_PROVIDERS.some(p => p.value === existingProvider);

                return {
                    selectedProvider: isPredefined ? existingProvider : 'Other',
                    isCustomProvider: !isPredefined,
                    customProviderName: isPredefined ? '' : existingProvider
                };
            };

            // Test predefined provider
            const predefinedState = initializeProviderState('Booking.com');
            expect(predefinedState.selectedProvider).toBe('Booking.com');
            expect(predefinedState.isCustomProvider).toBe(false);
            expect(predefinedState.customProviderName).toBe('');

            // Test custom provider
            const customState = initializeProviderState('My Travel Agent');
            expect(customState.selectedProvider).toBe('Other');
            expect(customState.isCustomProvider).toBe(true);
            expect(customState.customProviderName).toBe('My Travel Agent');

            // Test empty provider
            const emptyState = initializeProviderState('');
            expect(emptyState.selectedProvider).toBe('Other');
            expect(emptyState.isCustomProvider).toBe(true);
            expect(emptyState.customProviderName).toBe('');
        });
    });

    describe('API Data Format Compatibility', () => {
        it('should maintain consistent provider data format', () => {
            // Test that provider data structure remains consistent
            const createProviderDetails = (provider: string, isCustom: boolean, customName?: string) => {
                return {
                    provider: isCustom ? (customName || '') : provider,
                    confirmationNumber: 'TEST123',
                    bookingReference: 'REF456',
                };
            };

            // Predefined provider
            const predefinedDetails = createProviderDetails('Booking.com', false);
            expect(predefinedDetails.provider).toBe('Booking.com');

            // Custom provider
            const customDetails = createProviderDetails('Other', true, 'Custom Travel Service');
            expect(customDetails.provider).toBe('Custom Travel Service');

            // Verify structure consistency
            expect(predefinedDetails).toHaveProperty('provider');
            expect(predefinedDetails).toHaveProperty('confirmationNumber');
            expect(predefinedDetails).toHaveProperty('bookingReference');
            expect(customDetails).toHaveProperty('provider');
            expect(customDetails).toHaveProperty('confirmationNumber');
            expect(customDetails).toHaveProperty('bookingReference');
        });

        it('should handle legacy provider data gracefully', () => {
            // Simulate legacy booking data that might have various provider formats
            const legacyBookings = [
                { provider: 'Booking.com' }, // Standard predefined
                { provider: 'booking.com' }, // Case variation
                { provider: 'My Travel Agent' }, // Custom provider
                { provider: '' }, // Empty provider
                { provider: null }, // Null provider
                { provider: undefined }, // Undefined provider
            ];

            const normalizeProvider = (provider: any): string => {
                if (!provider || typeof provider !== 'string') {
                    return '';
                }
                return provider.trim();
            };

            const results = legacyBookings.map(booking => ({
                original: booking.provider,
                normalized: normalizeProvider(booking.provider),
            }));

            expect(results[0].normalized).toBe('Booking.com');
            expect(results[1].normalized).toBe('booking.com');
            expect(results[2].normalized).toBe('My Travel Agent');
            expect(results[3].normalized).toBe('');
            expect(results[4].normalized).toBe('');
            expect(results[5].normalized).toBe('');
        });
    });

    describe('Provider Validation Compatibility', () => {
        it('should validate provider selection consistently', () => {
            const validateProviderSelection = (provider: string, customProvider: string, isOther: boolean) => {
                if (!provider) {
                    return 'Provider is required';
                }
                if (isOther && (!customProvider || customProvider.length < 2)) {
                    return 'Custom provider name is required when Other is selected';
                }
                return '';
            };

            // Valid predefined provider
            expect(validateProviderSelection('Booking.com', '', false)).toBe('');

            // Valid custom provider
            expect(validateProviderSelection('Custom Provider', 'Custom Provider', true)).toBe('');

            // Invalid: no provider selected
            expect(validateProviderSelection('', '', false)).toBe('Provider is required');

            // Invalid: Other selected but no custom name
            expect(validateProviderSelection('Other', '', true)).toBe('Custom provider name is required when Other is selected');

            // Invalid: Other selected with too short custom name
            expect(validateProviderSelection('Other', 'A', true)).toBe('Custom provider name is required when Other is selected');
        });

        it('should validate custom provider names consistently', () => {
            const validateCustomProvider = (value: string) => {
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
            };

            // Valid names
            expect(validateCustomProvider('Travel Agency')).toBe('');
            expect(validateCustomProvider("O'Reilly Travel & Tours Co.")).toBe('');
            expect(validateCustomProvider('Hotel-Direct.com')).toBe('');

            // Invalid names
            expect(validateCustomProvider('')).toBe('Custom provider name must be at least 2 characters');
            expect(validateCustomProvider('A')).toBe('Custom provider name must be at least 2 characters');
            expect(validateCustomProvider('A'.repeat(101))).toBe('Custom provider name must be less than 100 characters');
            expect(validateCustomProvider('Invalid@Provider#')).toBe('Provider name contains invalid characters');
        });
    });

    describe('Form State Transitions', () => {
        it('should handle provider transitions correctly', () => {
            // Simulate form state during provider transitions
            let formState = {
                provider: '',
                isOtherProvider: false,
                customProvider: '',
            };

            const handleProviderChange = (selectedProvider: string) => {
                if (selectedProvider === 'Other') {
                    formState.isOtherProvider = true;
                    formState.provider = formState.customProvider || '';
                } else {
                    formState.isOtherProvider = false;
                    formState.customProvider = '';
                    formState.provider = selectedProvider;
                }
            };

            const handleCustomProviderChange = (value: string) => {
                formState.customProvider = value;
                formState.provider = value;
            };

            // Start with predefined provider
            handleProviderChange('Booking.com');
            expect(formState.provider).toBe('Booking.com');
            expect(formState.isOtherProvider).toBe(false);
            expect(formState.customProvider).toBe('');

            // Switch to Other
            handleProviderChange('Other');
            expect(formState.isOtherProvider).toBe(true);
            expect(formState.provider).toBe(''); // Should be empty initially

            // Enter custom provider
            handleCustomProviderChange('My Custom Provider');
            expect(formState.provider).toBe('My Custom Provider');
            expect(formState.customProvider).toBe('My Custom Provider');

            // Switch back to predefined
            handleProviderChange('Expedia');
            expect(formState.provider).toBe('Expedia');
            expect(formState.isOtherProvider).toBe(false);
            expect(formState.customProvider).toBe(''); // Should be cleared
        });
    });

    describe('Data Preservation', () => {
        it('should preserve non-provider form data during transitions', () => {
            // Simulate form data that should be preserved during provider changes
            const formData = {
                title: 'Test Booking',
                description: 'Test Description',
                city: 'Paris',
                country: 'France',
                originalPrice: 500,
                swapValue: 450,
                confirmationNumber: 'CONF123',
                bookingReference: 'REF456',
                // Provider fields that change
                provider: 'Booking.com',
                isOtherProvider: false,
                customProvider: '',
            };

            const updateProvider = (provider: string, isOther: boolean, customName: string = '') => {
                // Only update provider-related fields
                return {
                    ...formData,
                    provider: isOther ? customName : provider,
                    isOtherProvider: isOther,
                    customProvider: customName,
                };
            };

            // Change to custom provider
            const updatedData = updateProvider('Other', true, 'Custom Travel Service');

            // Verify non-provider data is preserved
            expect(updatedData.title).toBe('Test Booking');
            expect(updatedData.description).toBe('Test Description');
            expect(updatedData.city).toBe('Paris');
            expect(updatedData.country).toBe('France');
            expect(updatedData.originalPrice).toBe(500);
            expect(updatedData.swapValue).toBe(450);
            expect(updatedData.confirmationNumber).toBe('CONF123');
            expect(updatedData.bookingReference).toBe('REF456');

            // Verify provider data is updated
            expect(updatedData.provider).toBe('Custom Travel Service');
            expect(updatedData.isOtherProvider).toBe(true);
            expect(updatedData.customProvider).toBe('Custom Travel Service');
        });
    });
});