/**
 * API response interfaces and types for swap operations
 * 
 * This module provides comprehensive type definitions for all API interactions
 * related to swap proposals, including request/response types, error handling,
 * and validation schemas.
 * 
 * Requirements satisfied:
 * - 2.1: Real compatibility scores and eligibility reasons
 * - 2.2: Compatibility score display with proper styling thresholds
 * - 3.2: Proposal submission with proper request/response types
 */

// ============================================================================
// Core API Response Interfaces
// ============================================================================

/**
 * Response interface for fetching eligible swaps
 * Used by GET /api/users/{userId}/swaps/eligible
 */
export interface EligibleSwapResponse {
  swaps: EligibleSwap[];
  eligibleSwaps: EligibleSwap[]; // For compatibility with useProposalModal
  totalCount: number;
  compatibilityThreshold: number;
}

/**
 * Individual eligible swap with compatibility analysis
 * Includes real-time scoring and eligibility reasons
 */
export interface EligibleSwap {
  id: string;
  title: string;
  bookingDetails: BookingDetails;
  compatibilityScore: number;
  eligibilityReasons: string[];
  isEligible: boolean;
  restrictions?: string[];
}

/**
 * Booking details for swap listings
 * Contains all relevant accommodation information
 */
export interface BookingDetails {
  location: string;
  dateRange: {
    checkIn: Date;
    checkOut: Date;
  };
  accommodationType: string;
  guests: number;
  estimatedValue: number;
}

/**
 * Request interface for creating a new proposal
 * Used by POST /api/swaps/{targetSwapId}/proposals
 */
export interface CreateProposalRequest {
  sourceSwapId?: string; // Optional for cash proposals
  message?: string;
  conditions: string[];
  agreedToTerms: boolean;
  cashOffer?: {
    amount: number;
    currency: string;
  };
  walletAddress?: string; // Optional: wallet address to use for the proposal (prevents race conditions)
}

/**
 * Response interface for successful proposal creation
 * Returns proposal ID and status information
 */
export interface ProposalResponse {
  proposalId: string;
  status: 'pending' | 'submitted';
  estimatedResponseTime: string;
}

/**
 * Compatibility analysis between two swaps
 * Used by GET /api/swaps/{sourceSwapId}/compatibility/{targetSwapId}
 */
export interface CompatibilityAnalysis {
  score: number;
  reasons: string[];
  isEligible: boolean;
  restrictions?: string[];
}

// ============================================================================
// Error Response Types
// ============================================================================

/**
 * Standard API error response format
 * Consistent error structure across all endpoints
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  timestamp: string;
  requestId: string;
}

/**
 * Validation error details for form fields
 * Used for field-specific error display
 */
export interface ValidationErrorDetails {
  field: string;
  message: string;
  code: string;
}

/**
 * Network error information
 * Used for connection and timeout errors
 */
export interface NetworkError {
  type: 'timeout' | 'connection' | 'abort';
  message: string;
  retryable: boolean;
}

/**
 * Authentication error details
 * Used for token and permission errors
 */
export interface AuthenticationError {
  type: 'missing_token' | 'invalid_token' | 'expired_token' | 'insufficient_permissions';
  message: string;
  redirectToLogin: boolean;
}

// ============================================================================
// Validation Schemas and Types
// ============================================================================

/**
 * Validation schema for proposal creation
 * Defines validation rules and constraints
 */
export interface ProposalValidationSchema {
  sourceSwapId: {
    required: true;
    minLength: 1;
    pattern: string;
  };
  message: {
    required: false;
    maxLength: 1000;
  };
  conditions: {
    required: true;
    minItems: 1;
    maxItems: 10;
    itemMaxLength: 500;
  };
  agreedToTerms: {
    required: true;
    mustBeTrue: true;
  };
}

/**
 * Validation result for form data
 * Contains validation status and error details
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetails[];
  warnings?: string[];
}

/**
 * Field validation state for individual form fields
 * Used for real-time validation feedback
 */
export interface FieldValidationState {
  value: any;
  isValid: boolean;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

// ============================================================================
// Compatibility Analysis Types
// ============================================================================

/**
 * Compatibility score categories for styling
 * Based on score thresholds from requirements
 */
export type CompatibilityLevel = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Compatibility score with styling information
 * Includes level determination for UI display
 */
export interface CompatibilityScore {
  value: number;
  level: CompatibilityLevel;
  displayText: string;
  styleClass: string;
}

/**
 * Detailed compatibility analysis with reasons
 * Extended analysis for user understanding
 */
export interface DetailedCompatibilityAnalysis extends CompatibilityAnalysis {
  scoreBreakdown: {
    location: number;
    dates: number;
    accommodationType: number;
    guests: number;
    value: number;
  };
  improvementSuggestions?: string[];
}

// ============================================================================
// Request Configuration Types
// ============================================================================

/**
 * API request options for eligible swaps
 * Query parameters and pagination options
 */
export interface EligibleSwapsRequestOptions {
  targetSwapId: string;
  limit?: number;
  offset?: number;
  includeIneligible?: boolean;
  minCompatibilityScore?: number;
}

/**
 * API request configuration with cancellation support
 * Used for request management and cleanup
 */
export interface ApiRequestConfig {
  timeout?: number;
  retries?: number;
  abortController?: AbortController;
  headers?: Record<string, string>;
}

/**
 * Retry configuration for failed requests
 * Exponential backoff and retry logic
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  retryableErrors: string[];
}

// ============================================================================
// Response Metadata Types
// ============================================================================

/**
 * API response metadata
 * Common metadata across all API responses
 */
export interface ApiResponseMetadata {
  requestId: string;
  timestamp: string;
  version: string;
  processingTime: number;
}

/**
 * Paginated response wrapper
 * Used for endpoints that return paginated data
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  metadata: ApiResponseMetadata;
}

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type guard for API error responses
 * Helps identify error responses vs success responses
 */
export function isApiErrorResponse(response: any): response is ApiErrorResponse {
  return (
    response &&
    typeof response === 'object' &&
    response.error &&
    typeof response.error.code === 'string' &&
    typeof response.error.message === 'string'
  );
}

/**
 * Type guard for validation errors
 * Identifies validation-specific errors
 */
export function isValidationError(error: any): error is ValidationErrorDetails[] {
  return (
    Array.isArray(error) &&
    error.every(
      (item) =>
        item &&
        typeof item.field === 'string' &&
        typeof item.message === 'string' &&
        typeof item.code === 'string'
    )
  );
}

/**
 * Type guard for network errors
 * Identifies network-related errors
 */
export function isNetworkError(error: any): error is NetworkError {
  return (
    error &&
    typeof error === 'object' &&
    ['timeout', 'connection', 'abort'].includes(error.type) &&
    typeof error.message === 'string' &&
    typeof error.retryable === 'boolean'
  );
}

// ============================================================================
// Utility Functions for Compatibility Scoring
// ============================================================================

/**
 * Determine compatibility level based on score
 * Maps numeric scores to categorical levels
 */
export function getCompatibilityLevel(score: number): CompatibilityLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Get display text for compatibility score
 * User-friendly text representation of scores
 */
export function getCompatibilityDisplayText(score: number): string {
  const level = getCompatibilityLevel(score);
  switch (level) {
    case 'excellent':
      return `${score}% - Excellent Match`;
    case 'good':
      return `${score}% - Good Match`;
    case 'fair':
      return `${score}% - Fair Match`;
    case 'poor':
      return `${score}% - Poor Match`;
    default:
      return `${score}%`;
  }
}

/**
 * Get CSS class for compatibility score styling
 * Maps compatibility levels to CSS classes
 */
export function getCompatibilityStyleClass(score: number): string {
  const level = getCompatibilityLevel(score);
  switch (level) {
    case 'excellent':
      return 'compatibility-excellent';
    case 'good':
      return 'compatibility-good';
    case 'fair':
      return 'compatibility-fair';
    case 'poor':
      return 'compatibility-poor';
    default:
      return 'compatibility-unknown';
  }
}

/**
 * Create a complete compatibility score object
 * Combines score with all display information
 */
export function createCompatibilityScore(score: number): CompatibilityScore {
  return {
    value: score,
    level: getCompatibilityLevel(score),
    displayText: getCompatibilityDisplayText(score),
    styleClass: getCompatibilityStyleClass(score),
  };
}