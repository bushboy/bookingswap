/**
 * Auction validation utilities index
 * Exports all auction-related validation utilities and error classes
 */

export { DateValidator } from './DateValidator.js';
export { AuctionSettingsValidator, ValidatedAuctionSettings } from './AuctionSettingsValidator.js';
export {
    ValidationError,
    AuctionCreationError,
    DateValidationError,
    AuctionSettingsValidationError,
    AuctionErrorUtils
} from './AuctionErrors.js';

// Re-export commonly used types from shared package for convenience
export {
    ValidationError as BaseValidationError,
    SwapPlatformError,
    ErrorContext,
    ERROR_CODES
} from '@booking-swap/shared';