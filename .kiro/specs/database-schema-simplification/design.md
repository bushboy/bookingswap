# Database Schema Simplification Design

## Overview

This design simplifies the current swap database schema by removing redundant foreign key relationships and leveraging the existing booking-user relationship to infer ownership. The current schema has unnecessary complexity with multiple ID references that can be derived from core relationships, making queries more complex and error-prone.

## Current Schema Analysis

### Current Swaps Table Structure
```sql
CREATE TABLE swaps (
    id UUID PRIMARY KEY,
    source_booking_id UUID NOT NULL REFERENCES bookings(id),
    target_booking_id UUID NOT NULL REFERENCES bookings(id),  -- REDUNDANT
    proposer_id UUID NOT NULL REFERENCES users(id),           -- REDUNDANT  
    owner_id UUID NOT NULL REFERENCES users(id),              -- REDUNDANT
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- ... other fields
);
```

### Current Swap Targets Table Structure
```sql
CREATE TABLE swap_targets (
    id UUID PRIMARY KEY,
    source_swap_id UUID NOT NULL REFERENCES swaps(id),
    target_swap_id UUID NOT NULL REFERENCES swaps(id),
    proposal_id UUID NOT NULL REFERENCES swaps(id),           -- REDUNDANT
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- ... other fields
);
```

### Problems with Current Schema
1. **Redundant target_booking_id**: Can be inferred from the target swap's source_booking_id
2. **Redundant proposer_id**: Always equals the user_id of the source_booking_id owner
3. **Redundant owner_id**: Always equals the user_id of the target_booking_id owner  
4. **Redundant proposal_id**: Always equals the source_swap_id in swap_targets
5. **Complex queries**: Multiple joins required to get basic information
6. **Data inconsistency risk**: Multiple sources of truth for the same information

## Architecture

### Simplified Schema Design

#### Simplified Swaps Table
```sql
CREATE TABLE swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    additional_payment DECIMAL(10,2) CHECK (additional_payment >= 0),
    conditions TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    blockchain_proposal_transaction_id VARCHAR(255) NOT NULL,
    blockchain_execution_transaction_id VARCHAR(255),
    blockchain_escrow_contract_id VARCHAR(255),
    proposed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Enhanced fields (preserved)
    payment_types JSONB NOT NULL DEFAULT '{"bookingExchange": true, "cashPayment": false}',
    acceptance_strategy JSONB NOT NULL DEFAULT '{"type": "first_match"}',
    cash_details JSONB,
    is_targeted BOOLEAN DEFAULT FALSE,
    target_count INTEGER DEFAULT 0,
    last_targeted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT check_expires_future CHECK (expires_at > NOW()),
    CONSTRAINT check_responded_after_proposed CHECK (responded_at IS NULL OR responded_at >= proposed_at),
    CONSTRAINT check_completed_after_responded CHECK (completed_at IS NULL OR (responded_at IS NOT NULL AND completed_at >= responded_at))
);
```

#### Simplified Swap Targets Table
```sql
CREATE TABLE swap_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    target_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_source_swap UNIQUE(source_swap_id),
    CONSTRAINT check_different_swaps CHECK (source_swap_id != target_swap_id)
);
```

### Derived Relationships

#### Getting Swap Owner (Proposer)
```sql
-- Instead of storing proposer_id, derive it from booking relationship
SELECT s.*, b.user_id as proposer_id
FROM swaps s
JOIN bookings b ON s.source_booking_id = b.id;
```

#### Getting Target Booking and Owner
```sql
-- Instead of storing target_booking_id and owner_id, derive from targeting relationship
SELECT 
    s.*,
    b.user_id as proposer_id,
    ts.source_booking_id as target_booking_id,
    tb.user_id as target_owner_id
FROM swaps s
JOIN bookings b ON s.source_booking_id = b.id
LEFT JOIN swap_targets st ON s.id = st.source_swap_id
LEFT JOIN swaps ts ON st.target_swap_id = ts.id
LEFT JOIN bookings tb ON ts.source_booking_id = tb.id;
```

## Components and Interfaces

### Database Migration Strategy

#### Migration 027: Remove Redundant Columns
```sql
-- Step 1: Create backup of existing data
CREATE TABLE swaps_backup AS SELECT * FROM swaps;
CREATE TABLE swap_targets_backup AS SELECT * FROM swap_targets;

-- Step 2: Drop redundant columns from swaps table
ALTER TABLE swaps DROP COLUMN IF EXISTS target_booking_id;
ALTER TABLE swaps DROP COLUMN IF EXISTS proposer_id;
ALTER TABLE swaps DROP COLUMN IF EXISTS owner_id;

-- Step 3: Drop redundant columns from swap_targets table  
ALTER TABLE swap_targets DROP COLUMN IF EXISTS proposal_id;

-- Step 4: Drop related indexes
DROP INDEX IF EXISTS idx_swaps_target_booking_id;
DROP INDEX IF EXISTS idx_swaps_proposer_id;
DROP INDEX IF EXISTS idx_swaps_owner_id;
DROP INDEX IF EXISTS idx_swap_targets_proposal;

-- Step 5: Remove constraints that reference dropped columns
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_different_bookings;
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_different_users;

-- Step 6: Update existing constraints
ALTER TABLE swaps ADD CONSTRAINT check_expires_future CHECK (expires_at > NOW());
```

### Updated Query Patterns

#### User's Swaps Query (Simplified)
```sql
-- Before: Complex query with redundant joins
SELECT s.*, u.display_name as owner_name
FROM swaps s
LEFT JOIN users u ON s.owner_id = u.id
WHERE s.owner_id = $1;

-- After: Simple query with derived ownership
SELECT s.*, b.user_id as proposer_id, u.display_name as proposer_name
FROM swaps s
JOIN bookings b ON s.source_booking_id = b.id
JOIN users u ON b.user_id = u.id
WHERE b.user_id = $1;
```

#### Swap Targeting Query (Simplified)
```sql
-- Before: Complex query with redundant proposal_id
SELECT st.*, ps.proposer_id
FROM swap_targets st
JOIN swaps ps ON st.source_swap_id = ps.id
JOIN users u ON ps.proposer_id = u.id;

-- After: Simple query with derived relationships
SELECT 
    st.*,
    sb.user_id as source_proposer_id,
    tb.user_id as target_owner_id
FROM swap_targets st
JOIN swaps ss ON st.source_swap_id = ss.id
JOIN bookings sb ON ss.source_booking_id = sb.id
JOIN swaps ts ON st.target_swap_id = ts.id
JOIN bookings tb ON ts.source_booking_id = tb.id;
```

### Repository Layer Updates

#### SwapRepository Interface
```typescript
interface SwapRepository {
  // Updated methods that work with simplified schema
  findByUserId(userId: string): Promise<SwapWithDetails[]>;
  findTargetingRelationships(userId: string): Promise<TargetingRelationship[]>;
  createSwap(swapData: CreateSwapData): Promise<Swap>;
  updateSwapStatus(swapId: string, status: SwapStatus): Promise<void>;
}

interface SwapWithDetails {
  id: string;
  sourceBookingId: string;
  status: SwapStatus;
  // Derived fields
  proposerId: string;
  proposerName: string;
  targetBookingId?: string;
  targetOwnerId?: string;
  targetOwnerName?: string;
}
```

#### SwapTargetRepository Interface
```typescript
interface SwapTargetRepository {
  // Simplified methods without redundant proposal_id
  createTargeting(sourceSwapId: string, targetSwapId: string): Promise<SwapTarget>;
  findBySourceSwap(sourceSwapId: string): Promise<SwapTarget | null>;
  findByTargetSwap(targetSwapId: string): Promise<SwapTarget[]>;
  removeTargeting(sourceSwapId: string): Promise<void>;
}
```

## Data Models

### Core Entities

#### Simplified Swap Entity
```typescript
interface Swap {
  id: string;
  sourceBookingId: string;
  status: SwapStatus;
  additionalPayment?: number;
  conditions: string[];
  expiresAt: Date;
  blockchainProposalTransactionId: string;
  blockchainExecutionTransactionId?: string;
  blockchainEscrowContractId?: string;
  proposedAt: Date;
  respondedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Enhanced fields
  paymentTypes: PaymentTypes;
  acceptanceStrategy: AcceptanceStrategy;
  cashDetails?: CashDetails;
  isTargeted: boolean;
  targetCount: number;
  lastTargetedAt?: Date;
}
```

#### Simplified SwapTarget Entity
```typescript
interface SwapTarget {
  id: string;
  sourceSwapId: string;
  targetSwapId: string;
  status: TargetingStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Derived Data Transfer Objects
```typescript
interface SwapWithRelationships {
  // Core swap data
  id: string;
  sourceBookingId: string;
  status: SwapStatus;
  
  // Derived proposer information
  proposerId: string;
  proposerName: string;
  proposerBooking: BookingDetails;
  
  // Derived target information (if targeting)
  targetBookingId?: string;
  targetOwnerId?: string;
  targetOwnerName?: string;
  targetBooking?: BookingDetails;
  
  // Targeting metadata
  isTargeting: boolean;
  isTargeted: boolean;
  targetingCreatedAt?: Date;
}
```

## Error Handling

### Migration Error Handling
```sql
-- Rollback strategy for failed migration
CREATE OR REPLACE FUNCTION rollback_schema_simplification()
RETURNS void AS $$
BEGIN
    -- Restore from backup tables
    DROP TABLE IF EXISTS swaps;
    DROP TABLE IF EXISTS swap_targets;
    
    ALTER TABLE swaps_backup RENAME TO swaps;
    ALTER TABLE swap_targets_backup RENAME TO swap_targets;
    
    -- Recreate original indexes
    CREATE INDEX idx_swaps_target_booking_id ON swaps(target_booking_id);
    CREATE INDEX idx_swaps_proposer_id ON swaps(proposer_id);
    CREATE INDEX idx_swaps_owner_id ON swaps(owner_id);
    CREATE INDEX idx_swap_targets_proposal ON swap_targets(proposal_id);
    
    RAISE NOTICE 'Schema simplification rolled back successfully';
END;
$$ LANGUAGE plpgsql;
```

### Application Error Handling
```typescript
class SwapService {
  async getUserSwaps(userId: string): Promise<SwapWithRelationships[]> {
    try {
      const swaps = await this.swapRepository.findByUserId(userId);
      return swaps.map(swap => this.enrichSwapWithRelationships(swap));
    } catch (error) {
      if (error.code === 'MISSING_COLUMN') {
        throw new SchemaError('Database schema migration incomplete');
      }
      throw new SwapServiceError('Failed to retrieve user swaps', error);
    }
  }
  
  private enrichSwapWithRelationships(swap: Swap): SwapWithRelationships {
    // Handle cases where derived data might be missing
    if (!swap.proposerId) {
      throw new DataIntegrityError('Cannot derive proposer from booking relationship');
    }
    
    return {
      ...swap,
      isTargeting: !!swap.targetBookingId,
      // ... other derived fields
    };
  }
}
```

## Testing Strategy

### Migration Testing
```sql
-- Test data integrity after migration
CREATE OR REPLACE FUNCTION test_migration_integrity()
RETURNS TABLE(test_name text, passed boolean, details text) AS $$
BEGIN
    -- Test 1: All swaps have valid proposer derivation
    RETURN QUERY
    SELECT 
        'proposer_derivation'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swaps without valid proposer') 
    FROM swaps s
    LEFT JOIN bookings b ON s.source_booking_id = b.id
    WHERE b.user_id IS NULL;
    
    -- Test 2: All targeting relationships are valid
    RETURN QUERY
    SELECT 
        'targeting_relationships'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' invalid targeting relationships')
    FROM swap_targets st
    LEFT JOIN swaps ss ON st.source_swap_id = ss.id
    LEFT JOIN swaps ts ON st.target_swap_id = ts.id
    WHERE ss.id IS NULL OR ts.id IS NULL;
    
    -- Test 3: No orphaned records
    RETURN QUERY
    SELECT 
        'orphaned_records'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' orphaned swap records')
    FROM swaps s
    LEFT JOIN bookings b ON s.source_booking_id = b.id
    WHERE b.id IS NULL;
END;
$$ LANGUAGE plpgsql;
```

### Application Testing
```typescript
describe('Simplified Schema Integration', () => {
  it('should derive proposer information correctly', async () => {
    const userId = 'test-user-id';
    const swaps = await swapService.getUserSwaps(userId);
    
    swaps.forEach(swap => {
      expect(swap.proposerId).toBeDefined();
      expect(swap.proposerName).toBeDefined();
      expect(swap.proposerBooking).toBeDefined();
    });
  });
  
  it('should handle targeting relationships without proposal_id', async () => {
    const sourceSwapId = 'source-swap-id';
    const targetSwapId = 'target-swap-id';
    
    await swapTargetService.createTargeting(sourceSwapId, targetSwapId);
    
    const targeting = await swapTargetService.findBySourceSwap(sourceSwapId);
    expect(targeting).toBeDefined();
    expect(targeting.targetSwapId).toBe(targetSwapId);
    // Should not have proposal_id field
    expect(targeting).not.toHaveProperty('proposalId');
  });
});
```

## Performance Considerations

### Optimized Indexes for Simplified Schema
```sql
-- Core indexes for simplified schema
CREATE INDEX idx_swaps_source_booking_user ON swaps(source_booking_id);
CREATE INDEX idx_swaps_status_created ON swaps(status, created_at DESC);

-- Composite indexes for common derived queries
CREATE INDEX idx_bookings_user_swap_lookup ON bookings(user_id, id);
CREATE INDEX idx_swap_targets_relationships ON swap_targets(source_swap_id, target_swap_id, status);

-- Partial indexes for active relationships
CREATE INDEX idx_swap_targets_active ON swap_targets(target_swap_id) WHERE status = 'active';
CREATE INDEX idx_swaps_targeted ON swaps(is_targeted, target_count) WHERE is_targeted = true;
```

### Query Performance Analysis
```sql
-- Analyze query performance for common patterns
EXPLAIN ANALYZE
SELECT 
    s.id,
    s.status,
    b.user_id as proposer_id,
    u.display_name as proposer_name,
    ts.source_booking_id as target_booking_id
FROM swaps s
JOIN bookings b ON s.source_booking_id = b.id
JOIN users u ON b.user_id = u.id
LEFT JOIN swap_targets st ON s.id = st.source_swap_id
LEFT JOIN swaps ts ON st.target_swap_id = ts.id
WHERE b.user_id = $1
ORDER BY s.created_at DESC;
```

This simplified schema reduces complexity, improves query clarity, and maintains all existing functionality while eliminating redundant data storage and the associated risks of data inconsistency.