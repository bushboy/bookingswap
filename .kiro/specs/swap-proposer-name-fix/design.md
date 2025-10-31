# Design Document

## Overview

The issue with "unknown" proposer names stems from a complex JOIN chain in the `findSwapCardsWithProposals` query that can fail at multiple points. The current implementation uses a series of LEFT JOINs that create a fragile dependency chain: swap_targets → swaps → bookings → users. When any link in this chain fails, the proposer_name becomes NULL, which gets converted to "Unknown User" in the transformation layer.

## Architecture

### Current Data Flow
1. `SwapRepository.findSwapCardsWithProposals()` executes complex JOIN query
2. Query results include `proposer_name` field from users table
3. `SwapProposalService.transformRowToSwapProposal()` maps `row.proposer_name || 'Unknown User'`
4. Frontend displays the transformed proposer name

### Problem Analysis
The JOIN chain in the current query:
```sql
LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
LEFT JOIN swaps ts ON st.source_swap_id = ts.id
LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
LEFT JOIN users u ON tb.user_id = u.id
```

This chain can fail if:
- `swap_targets` record is missing or has wrong status
- Proposer's swap (`ts`) is deleted or corrupted
- Proposer's booking (`tb`) is missing or has wrong relationship
- User record (`u`) is missing or has NULL display_name

## Components and Interfaces

### Enhanced Query Strategy
Instead of relying on the fragile JOIN chain, we'll implement a more robust approach:

1. **Primary Query**: Get user's swaps and basic proposal information
2. **Secondary Enrichment**: Fetch user details separately for each unique proposer_id
3. **Fallback Mechanism**: If user lookup fails, attempt alternative user identification methods

### SwapRepository Changes
- Modify `findSwapCardsWithProposals()` to use a more reliable JOIN strategy
- Add `getProposerDetails()` method for separate user lookup
- Implement query result validation to detect JOIN failures early

### SwapProposalService Changes
- Update `transformRowToSwapProposal()` to handle enriched data
- Add proposer data validation before transformation
- Implement fallback user lookup if primary data is missing

## Data Models

### Enhanced Query Result Structure
```typescript
interface EnhancedSwapCardRow {
  // Existing swap data
  swap_id: string;
  proposer_id: string;
  
  // Enhanced user data (with fallback support)
  proposer_name: string | null;
  proposer_email: string | null;
  proposer_lookup_method: 'primary_join' | 'secondary_lookup' | 'fallback';
  
  // Validation metadata
  join_chain_complete: boolean;
  missing_relationships: string[];
}
```

### Proposer Details Interface
```typescript
interface ProposerDetails {
  userId: string;
  displayName: string | null;
  email: string | null;
  lookupMethod: 'direct' | 'booking_derived' | 'fallback';
  isValid: boolean;
}
```

## Error Handling

### JOIN Chain Validation
- Detect incomplete JOIN chains by checking for NULL values in expected fields
- Log specific failure points (which table/relationship failed)
- Provide diagnostic information for database integrity issues

### User Lookup Fallbacks
1. **Primary**: Direct user lookup by proposer_id (if available in swap record)
2. **Secondary**: Derive user from booking relationship
3. **Tertiary**: Use cached user data if available
4. **Final Fallback**: "Unknown User" with detailed logging

### Logging Strategy
- Log JOIN chain failures with specific table and relationship details
- Track proposer lookup success/failure rates
- Monitor for patterns in missing user data
- Provide actionable diagnostic information for administrators

## Testing Strategy

### Unit Tests
- Test JOIN chain validation logic
- Test proposer lookup fallback mechanisms
- Test data transformation with various NULL/missing scenarios
- Test error logging and diagnostic information

### Integration Tests
- Test complete data flow from database to frontend
- Test with real database scenarios (missing users, corrupted relationships)
- Verify that "Unknown User" only appears when truly no user data exists
- Test performance impact of enhanced lookup strategy

### Database Tests
- Verify JOIN query performance with large datasets
- Test query behavior with missing/corrupted relationship data
- Validate that all expected user data is properly accessible