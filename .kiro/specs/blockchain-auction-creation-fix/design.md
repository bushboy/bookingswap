# Design Document

## Overview

This design addresses the blockchain auction creation failures caused by improper date handling in the auction creation process. The core issue is that the `AuctionHederaExtensions.recordAuctionCreation()` method assumes `endDate` is a Date object when calling `toISOString()`, but it may receive a string value from the frontend or other services, causing the error "data.settings.endDate.toISOString is not a function".

The solution involves implementing robust date validation and conversion throughout the auction creation pipeline, from the initial request validation through to the blockchain recording.

## Architecture

### Current Flow (Problematic)
```
Frontend Request → SwapProposalService.createEnhancedSwapProposal() → AuctionManagementService.createAuction() → AuctionHederaExtensions.recordAuctionCreation() → [ERROR: toISOString is not a function]
```

### Proposed Flow (Fixed)
```
Frontend Request → Enhanced Request Validation → Date Normalization → Auction Creation → Validated Blockchain Recording → Success
```

### Key Components

1. **Date Validation Layer**: Validates and normalizes date inputs at service boundaries
2. **Enhanced Error Handling**: Provides detailed error information for debugging
3. **Auction Settings Validator**: Comprehensive validation of all auction parameters
4. **Blockchain Integration Layer**: Robust date handling for blockchain operations

## Components and Interfaces

### 1. Date Validation Utilities

```typescript
// New utility for robust date handling
export class DateValidator {
  static validateAndConvertDate(dateValue: any, fieldName: string): Date {
    // Handle null/undefined
    if (!dateValue) {
      throw new ValidationError(`${fieldName} is required`);
    }

    // If already a Date object, validate it
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) {
        throw new ValidationError(`${fieldName} is not a valid date`);
      }
      return dateValue;
    }

    // If string, try to parse
    if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue);
      if (isNaN(parsed.getTime())) {
        throw new ValidationError(`${fieldName} "${dateValue}" is not a valid date string`);
      }
      return parsed;
    }

    // If number (timestamp), convert
    if (typeof dateValue === 'number') {
      const parsed = new Date(dateValue);
      if (isNaN(parsed.getTime())) {
        throw new ValidationError(`${fieldName} timestamp ${dateValue} is not valid`);
      }
      return parsed;
    }

    throw new ValidationError(`${fieldName} must be a Date object, string, or timestamp`);
  }

  static validateFutureDate(date: Date, fieldName: string): void {
    const now = new Date();
    if (date <= now) {
      throw new ValidationError(`${fieldName} must be in the future (received: ${date.toISOString()}, current: ${now.toISOString()})`);
    }
  }
}
```

### 2. Enhanced Auction Settings Validator

```typescript
// Enhanced validation for auction settings
export class AuctionSettingsValidator {
  static validateAuctionSettings(settings: any): ValidatedAuctionSettings {
    const errors: string[] = [];
    
    try {
      // Validate and convert endDate
      const endDate = DateValidator.validateAndConvertDate(settings.endDate, 'endDate');
      DateValidator.validateFutureDate(endDate, 'endDate');

      // Validate other settings
      if (typeof settings.allowBookingProposals !== 'boolean') {
        errors.push('allowBookingProposals must be a boolean');
      }

      if (typeof settings.allowCashProposals !== 'boolean') {
        errors.push('allowCashProposals must be a boolean');
      }

      if (!settings.allowBookingProposals && !settings.allowCashProposals) {
        errors.push('At least one proposal type (booking or cash) must be allowed');
      }

      if (settings.autoSelectAfterHours !== undefined) {
        if (typeof settings.autoSelectAfterHours !== 'number' || settings.autoSelectAfterHours < 0) {
          errors.push('autoSelectAfterHours must be a positive number');
        }
      }

      if (errors.length > 0) {
        throw new ValidationError(`Auction settings validation failed: ${errors.join(', ')}`);
      }

      return {
        endDate,
        allowBookingProposals: settings.allowBookingProposals,
        allowCashProposals: settings.allowCashProposals,
        minimumCashOffer: settings.minimumCashOffer,
        autoSelectAfterHours: settings.autoSelectAfterHours
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Auction settings validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
```

### 3. Updated AuctionHederaExtensions

```typescript
// Enhanced blockchain integration with robust date handling
export class AuctionHederaExtensions {
  async recordAuctionCreation(data: AuctionCreationData): Promise<string> {
    try {
      logger.info('Recording auction creation on blockchain', { 
        auctionId: data.auctionId,
        originalEndDate: data.settings.endDate,
        endDateType: typeof data.settings.endDate
      });

      // Validate and convert endDate to ensure it's a proper Date object
      const validatedEndDate = DateValidator.validateAndConvertDate(
        data.settings.endDate, 
        'auction endDate'
      );

      // Additional validation for auction timing
      DateValidator.validateFutureDate(validatedEndDate, 'auction endDate');

      const transactionData: TransactionData = {
        type: 'auction_created',
        payload: {
          auctionId: data.auctionId,
          swapId: data.swapId,
          ownerId: data.ownerId,
          settings: {
            endDate: validatedEndDate.toISOString(), // Now guaranteed to work
            allowBookingProposals: data.settings.allowBookingProposals,
            allowCashProposals: data.settings.allowCashProposals,
            minimumCashOffer: data.settings.minimumCashOffer,
            autoSelectAfterHours: data.settings.autoSelectAfterHours
          },
          metadata: {
            auctionType: 'swap_auction',
            status: 'active',
            createdAt: new Date().toISOString(),
            dateValidationPassed: true
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Auction creation recorded on blockchain', {
        auctionId: data.auctionId,
        transactionId: result.transactionId,
        endDate: validatedEndDate.toISOString()
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record auction creation on blockchain', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        data: {
          auctionId: data.auctionId,
          swapId: data.swapId,
          ownerId: data.ownerId,
          endDateValue: data.settings.endDate,
          endDateType: typeof data.settings.endDate
        }
      });
      throw error;
    }
  }
}
```

### 4. Enhanced SwapProposalService

```typescript
// Updated service with comprehensive validation
export class SwapProposalService {
  async createEnhancedSwapProposal(request: EnhancedCreateSwapRequest): Promise<EnhancedSwapResult> {
    try {
      logger.info('Creating enhanced swap proposal with enhanced validation', {
        sourceBookingId: request.sourceBookingId,
        paymentTypes: request.paymentTypes,
        acceptanceStrategy: request.acceptanceStrategy.type,
        auctionEndDate: request.auctionSettings?.endDate,
        auctionEndDateType: typeof request.auctionSettings?.endDate
      });

      // Enhanced validation with date normalization
      await this.validateEnhancedSwapProposalWithDateHandling(request);

      // ... existing code ...

      // Create auction with validated settings
      if (request.acceptanceStrategy.type === 'auction' && request.auctionSettings) {
        try {
          // Validate auction settings before passing to auction service
          const validatedSettings = AuctionSettingsValidator.validateAuctionSettings(request.auctionSettings);
          
          const auctionResult = await this.auctionService.createAuction({
            swapId: swap.id,
            settings: validatedSettings, // Now guaranteed to have proper Date objects
          });
          auction = auctionResult.auction;
        } catch (auctionError) {
          // Enhanced error logging for auction creation failures
          logger.error('Auction creation failed with detailed context', {
            swapId: swap.id,
            error: auctionError instanceof Error ? auctionError.message : auctionError,
            stack: auctionError instanceof Error ? auctionError.stack : undefined,
            auctionSettings: request.auctionSettings,
            validationAttempted: true
          });
          
          // Clean up swap if auction creation fails
          await this.swapRepository.delete(swap.id);
          throw new Error(`Failed to create auction: ${auctionError instanceof Error ? auctionError.message : 'Unknown error'}`);
        }
      }

      // ... rest of existing code ...
    } catch (error) {
      logger.error('Failed to create enhanced swap proposal', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        request: {
          sourceBookingId: request.sourceBookingId,
          auctionSettings: request.auctionSettings
        }
      });
      throw error;
    }
  }

  private async validateEnhancedSwapProposalWithDateHandling(request: EnhancedCreateSwapRequest): Promise<void> {
    // Existing validation...
    await this.validateEnhancedSwapProposal(request);

    // Additional date-specific validation for auction settings
    if (request.acceptanceStrategy.type === 'auction' && request.auctionSettings) {
      try {
        AuctionSettingsValidator.validateAuctionSettings(request.auctionSettings);
      } catch (validationError) {
        throw new Error(`Auction settings validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
      }
    }
  }
}
```

## Data Models

### Enhanced Error Types

```typescript
export class ValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuctionCreationError extends Error {
  constructor(
    message: string, 
    public auctionId?: string, 
    public swapId?: string, 
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AuctionCreationError';
  }
}
```

### Validated Auction Settings Interface

```typescript
export interface ValidatedAuctionSettings {
  endDate: Date; // Guaranteed to be a Date object
  allowBookingProposals: boolean;
  allowCashProposals: boolean;
  minimumCashOffer?: number;
  autoSelectAfterHours?: number;
}
```

## Error Handling

### 1. Comprehensive Error Logging

- Log the original value and type of `endDate` when validation fails
- Include full stack traces for debugging
- Provide structured error data for monitoring systems
- Log successful validations for audit trails

### 2. Graceful Degradation

- If auction creation fails, properly clean up the created swap
- Provide clear error messages to users about what went wrong
- Maintain data consistency by rolling back partial operations

### 3. Validation Error Responses

```typescript
// Structured error responses for API consumers
export interface AuctionValidationErrorResponse {
  error: 'AUCTION_VALIDATION_FAILED';
  message: string;
  details: {
    field: string;
    value: any;
    expectedType: string;
    validationRule: string;
  }[];
}
```

## Testing Strategy

### 1. Unit Tests for Date Validation

```typescript
describe('DateValidator', () => {
  it('should convert string dates to Date objects', () => {
    const result = DateValidator.validateAndConvertDate('2025-11-02T15:00:00.000Z', 'endDate');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2025-11-02T15:00:00.000Z');
  });

  it('should handle Date objects correctly', () => {
    const date = new Date('2025-11-02T15:00:00.000Z');
    const result = DateValidator.validateAndConvertDate(date, 'endDate');
    expect(result).toBe(date);
  });

  it('should reject invalid date strings', () => {
    expect(() => DateValidator.validateAndConvertDate('invalid-date', 'endDate'))
      .toThrow('endDate "invalid-date" is not a valid date string');
  });

  it('should reject past dates', () => {
    const pastDate = new Date(Date.now() - 1000);
    expect(() => DateValidator.validateFutureDate(pastDate, 'endDate'))
      .toThrow('endDate must be in the future');
  });
});
```

### 2. Integration Tests for Auction Creation

```typescript
describe('Enhanced Auction Creation', () => {
  it('should handle string endDate in auction settings', async () => {
    const request = {
      sourceBookingId: 'test-booking',
      acceptanceStrategy: { type: 'auction' },
      auctionSettings: {
        endDate: '2025-11-02T15:00:00.000Z', // String instead of Date
        allowBookingProposals: true,
        allowCashProposals: false,
        autoSelectAfterHours: 24
      }
    };

    const result = await swapProposalService.createEnhancedSwapProposal(request);
    expect(result.auction).toBeDefined();
    expect(result.swap).toBeDefined();
  });

  it('should provide detailed error for invalid dates', async () => {
    const request = {
      sourceBookingId: 'test-booking',
      acceptanceStrategy: { type: 'auction' },
      auctionSettings: {
        endDate: 'invalid-date',
        allowBookingProposals: true,
        allowCashProposals: false
      }
    };

    await expect(swapProposalService.createEnhancedSwapProposal(request))
      .rejects.toThrow('endDate "invalid-date" is not a valid date string');
  });
});
```

### 3. Blockchain Integration Tests

```typescript
describe('AuctionHederaExtensions', () => {
  it('should handle various date formats in blockchain recording', async () => {
    const testCases = [
      new Date('2025-11-02T15:00:00.000Z'),
      '2025-11-02T15:00:00.000Z',
      1730559600000 // timestamp
    ];

    for (const endDate of testCases) {
      const data = {
        auctionId: 'test-auction',
        swapId: 'test-swap',
        ownerId: 'test-owner',
        settings: { endDate, allowBookingProposals: true, allowCashProposals: false }
      };

      const result = await auctionHederaExtensions.recordAuctionCreation(data);
      expect(result).toBeDefined();
    }
  });
});
```

## Implementation Plan

### Phase 1: Core Date Validation
1. Create `DateValidator` utility class
2. Create `AuctionSettingsValidator` class
3. Add comprehensive error types
4. Write unit tests for validation logic

### Phase 2: Service Layer Updates
1. Update `SwapProposalService.createEnhancedSwapProposal()`
2. Enhance `AuctionHederaExtensions.recordAuctionCreation()`
3. Add validation to `AuctionManagementService.createAuction()`
4. Implement rollback mechanisms

### Phase 3: Error Handling Enhancement
1. Improve error logging throughout the pipeline
2. Add structured error responses
3. Implement monitoring for validation failures
4. Create debugging utilities

### Phase 4: Testing and Validation
1. Write comprehensive unit tests
2. Create integration tests for the full flow
3. Test with various date formats and edge cases
4. Validate error handling scenarios

This design ensures that the blockchain auction creation process is robust, handles various date formats gracefully, and provides clear error information when issues occur.