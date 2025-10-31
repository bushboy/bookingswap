# Swap Offer Workflow Service

## Overview

The `SwapOfferWorkflowService` orchestrates the complete swap offer submission process, handling both auction and direct swap scenarios while ensuring proper validation and data consistency. This service addresses the foreign key constraint violations that were occurring during payment transaction creation.

## Key Features

### 1. User-Selected Offer Mode (Requirements 1.9, 2.6, 2.10)

The service uses **user-selected offer mode** instead of inferring from swap configuration:

```typescript
// User explicitly selects auction or direct mode
const request: SwapOfferRequest = {
    swapId: 'swap-123',
    userId: 'user-456',
    offerMode: 'auction', // or 'direct'
    amount: 100,
    currency: 'USD'
};

const result = await workflowService.submitSwapOffer(request);
```

### 2. Complete Workflow Orchestration (Requirements 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3)

The `submitSwapOffer` method handles the complete process:

1. **Determine offer mode** based on user selection
2. **Validate swap** exists and accepts the offer type
3. **Validate offer mode compatibility** with swap configuration
4. **Create auction proposal** (only if user selects auction mode)
5. **Create payment transaction** with proper foreign key validation
6. **Link records** together for data consistency
7. **Handle rollback** if any step fails

### 3. Comprehensive Validation

- **Foreign key validation** before database operations
- **Swap compatibility** checking
- **User permission** validation
- **Payment method** verification

### 4. Robust Error Handling

- **Automatic rollback** of partial operations
- **Detailed error messages** with context
- **Proper logging** for debugging
- **Graceful failure** handling

## Usage Examples

### Direct Swap Offer

```typescript
const directOfferRequest: SwapOfferRequest = {
    swapId: 'swap-123',
    userId: 'user-456',
    offerMode: 'direct',
    amount: 150,
    currency: 'USD',
    paymentMethodId: 'pm-789'
};

const result = await workflowService.submitSwapOffer(directOfferRequest);
// Result will have paymentTransaction but no auctionProposal
```

### Auction Swap Offer

```typescript
const auctionOfferRequest: SwapOfferRequest = {
    swapId: 'swap-123',
    userId: 'user-456',
    offerMode: 'auction',
    amount: 200,
    currency: 'USD',
    paymentMethodId: 'pm-789',
    message: 'Competitive offer for your swap'
};

const result = await workflowService.submitSwapOffer(auctionOfferRequest);
// Result will have both paymentTransaction and auctionProposal
```

## Service Dependencies

The service requires these dependencies:

- `Pool` - Database connection pool
- `EnhancedPaymentTransactionService` - For payment processing
- `EnhancedAuctionProposalService` - For auction proposal management
- `SwapOfferErrorHandler` - For error handling (optional)

## Factory Usage

Use the factory for easy instantiation:

```typescript
import { SwapOfferWorkflowServiceFactory } from './SwapOfferWorkflowServiceFactory';

const workflowService = SwapOfferWorkflowServiceFactory.create(
    pool,
    paymentRepository,
    auctionService
);
```

## Error Handling

The service throws `SwapOfferError` instances with specific error codes:

- `SWAP_NOT_FOUND` - Referenced swap doesn't exist
- `SCENARIO_MISMATCH` - User selection doesn't match swap configuration
- `CASH_OFFERS_NOT_ACCEPTED` - Swap doesn't accept cash offers
- `AUCTION_NOT_ACTIVE` - No active auction for auction mode
- `FOREIGN_KEY_VIOLATION` - Database constraint violation

## Rollback Mechanism

If any step fails, the service automatically rolls back:

1. **Delete auction proposal** (if created)
2. **Rollback payment transaction** (if created)
3. **Revert swap status** (if modified)

## Validation Process

The service performs comprehensive validation:

1. **Swap validation** - Exists, active, accepts offer type
2. **Foreign key validation** - All references exist
3. **User permission validation** - User can make offers
4. **Payment method validation** - Valid and verified

## Integration Points

### Controllers

```typescript
// In swap controller
const result = await workflowService.submitSwapOffer({
    swapId: req.params.swapId,
    userId: req.user.id,
    offerMode: req.body.offerMode,
    amount: req.body.amount,
    currency: req.body.currency,
    paymentMethodId: req.body.paymentMethodId
});

res.status(201).json({ success: true, data: result });
```

### Frontend Integration

The frontend should provide clear UI for users to select offer mode:

```typescript
// User explicitly chooses between auction and direct
const offerMode = userSelection === 'auction' ? 'auction' : 'direct';

const response = await api.post('/swaps/offer', {
    swapId,
    offerMode,
    amount,
    currency,
    paymentMethodId
});
```

## Benefits

1. **Prevents foreign key violations** through proper validation
2. **Ensures data consistency** with transaction management
3. **Provides clear user control** over offer type
4. **Enables robust error recovery** with automatic rollback
5. **Improves debugging** with comprehensive logging
6. **Supports both scenarios** (auction and direct) seamlessly

## Requirements Satisfied

- **1.1-1.4**: Fix proposal creation order and optional references
- **1.9, 2.6, 2.10**: User-selected offer mode instead of inference
- **6.1-6.3**: Improved swap offer workflow with real-time feedback
- **2.1-2.5**: Comprehensive foreign key validation
- **3.1-3.8**: Transaction rollback mechanisms
- **4.1-4.7**: Enhanced error handling and logging