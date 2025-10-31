/**
 * Auction settings validation utilities
 * Provides comprehensive validation for auction parameters
 */

import { ValidationError } from '@booking-swap/shared';
import { DateValidator } from './DateValidator.js';

export interface ValidatedAuctionSettings {
    endDate: Date;
    allowBookingProposals: boolean;
    allowCashProposals: boolean;
    minimumCashOffer?: number;
    autoSelectAfterHours?: number;
}

export class AuctionSettingsValidator {
    // Platform constants for validation
    private static readonly PLATFORM_MIN_CASH_AMOUNT = 100;
    private static readonly PLATFORM_MAX_CASH_AMOUNT = 10000;
    private static readonly MIN_AUTO_SELECT_HOURS = 1;
    private static readonly MAX_AUTO_SELECT_HOURS = 168; // 7 days
    private static readonly ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    /**
     * Validates comprehensive auction settings
     * @param settings - The auction settings to validate
     * @returns Validated auction settings with proper types
     * @throws ValidationError if any validation fails
     */
    static validateAuctionSettings(settings: any): ValidatedAuctionSettings {
        const errors: string[] = [];

        try {
            // Validate required settings object
            if (!settings || typeof settings !== 'object') {
                throw new ValidationError('Auction settings must be provided as an object');
            }

            // Validate and convert endDate
            let endDate: Date;
            try {
                endDate = DateValidator.validateAndConvertDate(settings.endDate, 'endDate');
                DateValidator.validateFutureDate(endDate, 'endDate');

                // Additional auction-specific date validation
                DateValidator.validateMinimumFutureDate(endDate, 60 * 60 * 1000, 'endDate'); // At least 1 hour in future
                DateValidator.validateReasonableDateRange(endDate, 'endDate', 0, 2); // Within 2 years
            } catch (dateError) {
                if (dateError instanceof ValidationError) {
                    errors.push(dateError.message);
                } else {
                    errors.push(`Invalid endDate: ${dateError instanceof Error ? dateError.message : 'Unknown error'}`);
                }
                // Use a placeholder date to continue validation
                endDate = new Date();
            }

            // Validate proposal type settings
            if (typeof settings.allowBookingProposals !== 'boolean') {
                errors.push('allowBookingProposals must be a boolean value');
            }

            if (typeof settings.allowCashProposals !== 'boolean') {
                errors.push('allowCashProposals must be a boolean value');
            }

            // At least one proposal type must be allowed
            if (settings.allowBookingProposals === false && settings.allowCashProposals === false) {
                errors.push('At least one proposal type (booking or cash) must be allowed');
            }

            // Validate minimum cash offer if provided
            let minimumCashOffer: number | undefined;
            if (settings.minimumCashOffer !== undefined && settings.minimumCashOffer !== null) {
                if (typeof settings.minimumCashOffer !== 'number') {
                    errors.push('minimumCashOffer must be a number');
                } else if (settings.minimumCashOffer < 0) {
                    errors.push('minimumCashOffer cannot be negative');
                } else if (settings.minimumCashOffer < this.PLATFORM_MIN_CASH_AMOUNT) {
                    errors.push(`minimumCashOffer must be at least ${this.PLATFORM_MIN_CASH_AMOUNT}`);
                } else if (settings.minimumCashOffer > this.PLATFORM_MAX_CASH_AMOUNT) {
                    errors.push(`minimumCashOffer cannot exceed ${this.PLATFORM_MAX_CASH_AMOUNT}`);
                } else {
                    minimumCashOffer = settings.minimumCashOffer;
                }
            }

            // Validate auto-select timing if provided
            let autoSelectAfterHours: number | undefined;
            if (settings.autoSelectAfterHours !== undefined && settings.autoSelectAfterHours !== null) {
                if (typeof settings.autoSelectAfterHours !== 'number') {
                    errors.push('autoSelectAfterHours must be a number');
                } else if (settings.autoSelectAfterHours < this.MIN_AUTO_SELECT_HOURS) {
                    errors.push(`autoSelectAfterHours must be at least ${this.MIN_AUTO_SELECT_HOURS} hour(s)`);
                } else if (settings.autoSelectAfterHours > this.MAX_AUTO_SELECT_HOURS) {
                    errors.push(`autoSelectAfterHours cannot exceed ${this.MAX_AUTO_SELECT_HOURS} hours (7 days)`);
                } else {
                    autoSelectAfterHours = settings.autoSelectAfterHours;
                }
            }

            // Validate logical consistency
            if (settings.allowCashProposals && minimumCashOffer === undefined) {
                // This is a warning, not an error - we can allow cash proposals without a minimum
                // but it's recommended to set one
            }

            if (errors.length > 0) {
                throw new ValidationError(`Auction settings validation failed: ${errors.join(', ')}`);
            }

            return {
                endDate: endDate!,
                allowBookingProposals: settings.allowBookingProposals,
                allowCashProposals: settings.allowCashProposals,
                minimumCashOffer,
                autoSelectAfterHours
            };
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ValidationError(`Auction settings validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validates auction timing against event date
     * @param auctionEndDate - The auction end date
     * @param eventDate - The event date
     * @throws ValidationError if timing is invalid
     */
    static validateAuctionTiming(auctionEndDate: Date, eventDate: Date): void {
        const now = new Date();

        // Validate event date is in the future
        if (eventDate <= now) {
            throw new ValidationError('Event date must be in the future');
        }

        // Calculate if event is less than one week away
        const timeToEvent = eventDate.getTime() - now.getTime();
        const isLastMinute = timeToEvent < this.ONE_WEEK_MS;

        // Validate event is not last minute for auctions
        if (isLastMinute) {
            throw new ValidationError('Auctions are not allowed for events less than one week away');
        }

        // Calculate minimum auction end date (one week before event)
        const minimumEndDate = new Date(eventDate.getTime() - this.ONE_WEEK_MS);

        // Validate auction ends at least one week before event
        if (auctionEndDate.getTime() > minimumEndDate.getTime()) {
            throw new ValidationError(
                `Auction must end at least one week before the event. Latest allowed end date: ${minimumEndDate.toISOString()}`
            );
        }
    }

    /**
     * Validates auction settings consistency with payment preferences
     * @param auctionSettings - The validated auction settings
     * @param paymentPreferences - The payment preferences from the swap
     * @throws ValidationError if settings are inconsistent
     */
    static validateSettingsConsistency(
        auctionSettings: ValidatedAuctionSettings,
        paymentPreferences: {
            bookingExchange?: boolean;
            cashPayment?: boolean;
            minimumCashAmount?: number;
        }
    ): void {
        const errors: string[] = [];

        // Check booking proposal consistency
        if (auctionSettings.allowBookingProposals && paymentPreferences.bookingExchange === false) {
            errors.push('Cannot allow booking proposals when booking exchange is disabled in swap preferences');
        }

        // Check cash proposal consistency
        if (auctionSettings.allowCashProposals && paymentPreferences.cashPayment === false) {
            errors.push('Cannot allow cash proposals when cash payments are disabled in swap preferences');
        }

        // Check minimum cash amount consistency
        if (auctionSettings.minimumCashOffer && paymentPreferences.minimumCashAmount) {
            if (auctionSettings.minimumCashOffer < paymentPreferences.minimumCashAmount) {
                errors.push(
                    `Auction minimum cash offer (${auctionSettings.minimumCashOffer}) cannot be less than swap minimum cash amount (${paymentPreferences.minimumCashAmount})`
                );
            }
        }

        if (errors.length > 0) {
            throw new ValidationError(`Auction settings consistency validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Validates a single auction setting field
     * @param fieldName - The name of the field to validate
     * @param value - The value to validate
     * @param settings - The complete settings object for context
     * @returns The validated value
     * @throws ValidationError if validation fails
     */
    static validateSingleField(fieldName: string, value: any, settings?: any): any {
        switch (fieldName) {
            case 'endDate':
                return DateValidator.validateAndConvertDate(value, 'endDate');

            case 'allowBookingProposals':
            case 'allowCashProposals':
                if (typeof value !== 'boolean') {
                    throw new ValidationError(`${fieldName} must be a boolean value`);
                }
                return value;

            case 'minimumCashOffer':
                if (value === undefined || value === null) {
                    return undefined;
                }
                if (typeof value !== 'number') {
                    throw new ValidationError('minimumCashOffer must be a number');
                }
                if (value < 0) {
                    throw new ValidationError('minimumCashOffer cannot be negative');
                }
                if (value < this.PLATFORM_MIN_CASH_AMOUNT) {
                    throw new ValidationError(`minimumCashOffer must be at least ${this.PLATFORM_MIN_CASH_AMOUNT}`);
                }
                if (value > this.PLATFORM_MAX_CASH_AMOUNT) {
                    throw new ValidationError(`minimumCashOffer cannot exceed ${this.PLATFORM_MAX_CASH_AMOUNT}`);
                }
                return value;

            case 'autoSelectAfterHours':
                if (value === undefined || value === null) {
                    return undefined;
                }
                if (typeof value !== 'number') {
                    throw new ValidationError('autoSelectAfterHours must be a number');
                }
                if (value < this.MIN_AUTO_SELECT_HOURS) {
                    throw new ValidationError(`autoSelectAfterHours must be at least ${this.MIN_AUTO_SELECT_HOURS} hour(s)`);
                }
                if (value > this.MAX_AUTO_SELECT_HOURS) {
                    throw new ValidationError(`autoSelectAfterHours cannot exceed ${this.MAX_AUTO_SELECT_HOURS} hours`);
                }
                return value;

            default:
                throw new ValidationError(`Unknown auction setting field: ${fieldName}`);
        }
    }

    /**
     * Creates a summary of validation rules for client-side reference
     * @returns Object containing validation rules and limits
     */
    static getValidationRules() {
        return {
            endDate: {
                required: true,
                type: 'Date | string | number',
                rules: [
                    'Must be in the future',
                    'Must be at least 1 hour from now',
                    'Must be within 2 years from now',
                    'Must be at least 1 week before event date'
                ]
            },
            allowBookingProposals: {
                required: true,
                type: 'boolean',
                rules: ['Must be true or false']
            },
            allowCashProposals: {
                required: true,
                type: 'boolean',
                rules: ['Must be true or false', 'At least one of allowBookingProposals or allowCashProposals must be true']
            },
            minimumCashOffer: {
                required: false,
                type: 'number',
                rules: [
                    'Must be a positive number',
                    `Must be at least ${this.PLATFORM_MIN_CASH_AMOUNT}`,
                    `Must not exceed ${this.PLATFORM_MAX_CASH_AMOUNT}`,
                    'Must not be less than swap minimum cash amount'
                ]
            },
            autoSelectAfterHours: {
                required: false,
                type: 'number',
                rules: [
                    `Must be at least ${this.MIN_AUTO_SELECT_HOURS} hour(s)`,
                    `Must not exceed ${this.MAX_AUTO_SELECT_HOURS} hours (7 days)`
                ]
            }
        };
    }
}