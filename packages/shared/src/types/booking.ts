import { BaseEntity } from './index.js';
import {
  EnabledBookingType,
  AllBookingType,
  AccommodationType,
  isBookingTypeEnabled,
  getEnabledBookingTypes
} from '../config/booking-types.js';

// Re-export types for backward compatibility
export type { EnabledBookingType, AccommodationType };

// Event types (temporarily disabled - not working)
export type EventType = 'event' | 'concert' | 'sports' | 'theater';

// Other types (temporarily disabled)
export type OtherBookingType = 'flight' | 'rental';

// All booking types (for backward compatibility and future use)
export type BookingType = AllBookingType;

export type BookingStatus = 'available' | 'locked' | 'swapped' | 'cancelled';
export type VerificationStatus = 'pending' | 'verified' | 'failed';

// Re-export utility functions for backward compatibility
export { isBookingTypeEnabled, getEnabledBookingTypes };

export interface BookingLocation {
  city: string;
  country: string;
  coordinates?: [number, number];
}

export interface BookingDateRange {
  checkIn: Date;
  checkOut: Date;
}

export interface BookingProviderDetails {
  provider: string;
  confirmationNumber: string;
  bookingReference: string;
}

export interface BookingVerification {
  status: VerificationStatus;
  verifiedAt?: Date;
  documents: string[]; // IPFS hashes
}

export interface BookingBlockchain {
  transactionId?: string;
  consensusTimestamp?: string;
  topicId: string;
  nftTokenId?: string;
  nftSerialNumber?: number;
  nftTransactionId?: string;
}

export interface Booking extends BaseEntity {
  userId: string;
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;
  verification: BookingVerification;
  blockchain: BookingBlockchain;
  status: BookingStatus;
}