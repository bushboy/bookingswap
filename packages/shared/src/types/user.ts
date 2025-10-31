import { BaseEntity } from './index.js';
import { NotificationPreferences } from './notification.js';

export type UserVerificationLevel = 'basic' | 'verified' | 'premium';

export interface SwapCriteria {
  maxAdditionalPayment?: number;
  preferredLocations?: string[];
  bookingTypes?: string[];
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  autoAcceptCriteria?: SwapCriteria;
}

export interface UserProfile {
  displayName?: string;
  email?: string;
  phone?: string;
  preferences: UserPreferences;
}

export interface UserVerification {
  level: UserVerificationLevel;
  documents: string[]; // IPFS hashes
  verifiedAt?: Date;
}

export interface Review {
  id: string;
  reviewerId: string;
  rating: number;
  comment?: string;
  swapId: string;
  createdAt: Date;
}

export interface UserReputation {
  score: number;
  completedSwaps: number;
  cancelledSwaps: number;
  reviews: Review[];
}

export interface User extends BaseEntity {
  walletAddress?: string; // Optional for email/password users
  username?: string; // For email/password users
  email?: string; // For email/password users (also in profile for wallet users)
  passwordHash?: string; // For email/password users
  profile: UserProfile;
  verification: UserVerification;
  reputation: UserReputation;
  lastActiveAt: Date;
}