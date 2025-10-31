/**
 * Separated data models for swap specification operations
 * This file contains interfaces specifically for swap-only operations,
 * separated from booking edit functionality
 */

import { AcceptanceStrategyType } from './swap.js';

/**
 * Interface for swap specification data - contains only swap-related fields
 * Used for creating and managing swap proposals independently of booking edits
 */
export interface SwapSpecificationData {
  bookingId: string;
  paymentTypes: ('booking' | 'cash')[];
  minCashAmount?: number;
  maxCashAmount?: number;
  acceptanceStrategy: AcceptanceStrategyType;
  auctionEndDate?: Date;
  swapConditions: string[];
  swapEnabled: boolean;
}

/**
 * Interface for partial swap specification updates
 */
export interface SwapSpecificationUpdateData {
  paymentTypes?: ('booking' | 'cash')[];
  minCashAmount?: number;
  maxCashAmount?: number;
  acceptanceStrategy?: AcceptanceStrategyType;
  auctionEndDate?: Date;
  swapConditions?: string[];
  swapEnabled?: boolean;
}

/**
 * Validation errors specific to swap specification operations
 */
export interface SwapSpecificationErrors {
  paymentTypes?: string;
  minCashAmount?: string;
  maxCashAmount?: string;
  acceptanceStrategy?: string;
  auctionEndDate?: string;
  swapConditions?: string;
  walletConnection?: string;
  [key: string]: string | undefined;
}

/**
 * Request interface for creating swap specifications
 */
export interface CreateSwapSpecificationRequest {
  bookingId: string;
  paymentTypes: ('booking' | 'cash')[];
  minCashAmount?: number;
  maxCashAmount?: number;
  acceptanceStrategy: AcceptanceStrategyType;
  auctionEndDate?: Date;
  swapConditions: string[];
  walletAddress?: string;
}

/**
 * Request interface for updating swap specifications
 */
export interface UpdateSwapSpecificationRequest {
  paymentTypes?: ('booking' | 'cash')[];
  minCashAmount?: number;
  maxCashAmount?: number;
  acceptanceStrategy?: AcceptanceStrategyType;
  auctionEndDate?: Date;
  swapConditions?: string[];
}

/**
 * Response interface for swap specification operations
 */
export interface SwapSpecificationResponse {
  swapSpecification: SwapSpecificationData & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  nftInfo?: {
    tokenId: string;
    serialNumber: number;
    transactionId: string;
  };
  validationWarnings?: string[];
}

/**
 * Interface for swap specification context (read-only booking info)
 */
export interface SwapSpecificationContext {
  booking: {
    id: string;
    title: string;
    description: string;
    type: string;
    location: {
      city: string;
      country: string;
    };
    dateRange: {
      checkIn: Date;
      checkOut: Date;
    };
    originalPrice: number;
    swapValue: number;
  };
  existingSwap?: {
    id: string;
    status: string;
    hasActiveProposals: boolean;
    activeProposalCount: number;
  };
}