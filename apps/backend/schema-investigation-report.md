# Database Schema Investigation Report

## Task 1: Investigate current database schema and identify problematic queries

### Executive Summary

The investigation has identified the root cause of the PostgreSQL 42703 error ("column does not exist") occurring in the proposal repository. The error is caused by queries in the `ProposalAcceptanceService.getProposal()` method that reference non-existent columns in the `swaps` table.

### Current Database Schema

#### SWAPS Table Structure
```sql
-- Current columns (after schema simplification migration 027)
id: uuid NOT NULL DEFAULT gen_random_uuid()
source_booking_id: uuid NOT NULL
status: character varying NOT NULL DEFAULT 'pending'
additional_payment: numeric NULL
conditions: ARRAY NOT NULL DEFAULT '{}'
expires_at: timestamp with time zone NOT NULL
blockchain_proposal_transaction_id: character varying NOT NULL
blockchain_execution_transaction_id: character varying NULL
blockchain_escrow_contract_id: character varying NULL
proposed_at: timestamp with time zone NOT NULL DEFAULT now()
responded_at: timestamp with time zone NULL
completed_at: timestamp with time zone NULL
created_at: timestamp with time zone NOT NULL DEFAULT now()
updated_at: timestamp with time zone NOT NULL DEFAULT now()
payment_types: jsonb NOT NULL DEFAULT '{"cashPayment": false, "bookingExchange": true}'
acceptance_strategy: jsonb NOT NULL DEFAULT '{"type": "first_match"}'
cash_details: jsonb NULL
is_targeted: boolean NULL DEFAULT false
target_count: integer NULL DEFAULT 0
last_targeted_at: timestamp with time zone NULL
```

#### SWAP_TARGETS Table Structure
```sql
id: uuid NOT NULL DEFAULT gen_random_uuid()
source_swap_id: uuid NOT NULL
target_swap_id: uuid NOT NULL
status: character varying NOT NULL DEFAULT 'active'
created_at: timestamp with time zone NOT NULL DEFAULT now()
updated_at: timestamp with time zone NOT NULL DEFAULT now()
```

#### SWAP_PROPOSALS Table Structure
```sql
id: uuid NOT NULL DEFAULT gen_random_uuid()
source_swap_id: uuid NOT NULL
target_swap_id: uuid NULL
proposer_id: uuid NOT NULL
target_user_id: uuid NOT NULL
proposal_type: character varying NOT NULL
status: character varying NOT NULL DEFAULT 'pending'
cash_offer_amount: numeric NULL
cash_offer_currency: character varying NULL DEFAULT 'USD'
escrow_account_id: character varying NULL
payment_method_id: character varying NULL
responded_at: timestamp with time zone NULL
responded_by: uuid NULL
rejection_reason: text NULL
blockchain_proposal_transaction_id: character varying NULL
blockchain_response_transaction_id: character varying NULL
message: text NULL
conditions: ARRAY NULL DEFAULT '{}'
expires_at: timestamp with time zone NOT NULL
created_at: timestamp with time zone NOT NULL DEFAULT now()
updated_at: timestamp with time zone NOT NULL DEFAULT now()
```

#### SWAP_PROPOSAL_METADATA Table Structure
```sql
id: uuid NOT NULL DEFAULT gen_random_uuid()
proposal_id: uuid NOT NULL
source_swap_id: uuid NOT NULL
target_swap_id: uuid NOT NULL
proposer_id: uuid NOT NULL
target_owner_id: uuid NOT NULL
message: text NULL
compatibility_score: numeric NULL
created_from_browse: boolean NOT NULL DEFAULT true
proposal_source: character varying NOT NULL DEFAULT 'browse'
blockchain_transaction_id: character varying NOT NULL
created_at: timestamp with time zone NOT NULL DEFAULT now()
updated_at: timestamp with time zone NOT NULL DEFAULT now()
```

### Problematic Queries Identified

#### Location: `apps/backend/src/services/swap/ProposalAcceptanceService.ts`
#### Method: `getProposal()` (around line 1700)

**Problematic Query:**
```sql
SELECT 
  st.id as target_id,
  st.source_swap_id,
  st.target_swap_id,
  st.status,
  st.created_at as target_created_at,
  st.updated_at as target_updated_at,
  ss.id as source_swap_id_full,
  ss.source_booking_id as source_booking_id,
  ss.status as source_swap_status,
  ss.terms as source_terms,                    -- ❌ COLUMN DOES NOT EXIST
  ss.blockchain as source_blockchain,          -- ❌ COLUMN DOES NOT EXIST
  ss.timeline as source_timeline,              -- ❌ COLUMN DOES NOT EXIST
  ss.created_at as source_created_at,
  ss.updated_at as source_updated_at,
  sb.user_id as proposer_id,
  ts.source_booking_id as target_booking_id,
  tb.user_id as target_user_id,
  'swap_targets' as source_table
FROM swap_targets st
INNER JOIN swaps ss ON st.source_swap_id = ss.id
LEFT JOIN bookings sb ON ss.source_booking_id = sb.id
LEFT JOIN swaps ts ON st.target_swap_id = ts.id
LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
WHERE st.id = $1
```

### Root Cause Analysis

The schema simplification migration (027_simplify_swap_schema.sql) removed redundant columns and restructured the data model, but the application code was not updated to reflect these changes:

1. **Removed Columns from SWAPS table:**
   - `terms` (JSONB) → Replaced with individual columns: `additional_payment`, `conditions`, `expires_at`
   - `blockchain` (JSONB) → Replaced with individual columns: `blockchain_proposal_transaction_id`, `blockchain_execution_transaction_id`, `blockchain_escrow_contract_id`
   - `timeline` (JSONB) → Replaced with individual columns: `proposed_at`, `responded_at`, `completed_at`

2. **Columns that were properly removed:**
   - `proposer_id` (now derived from `source_booking_id` → `bookings.user_id`)
   - `owner_id` (now derived from target relationships)
   - `target_booking_id` (now derived through `swap_targets` relationships)

### Schema Alignment Issues

The `swap_proposal_metadata` table still contains some columns that reference the old schema:
- `proposal_id` references `swaps.id` but should reference `swap_proposals.id`
- `proposer_id` and `target_owner_id` exist but should be derived from relationships

### Foreign Key Relationships

Current valid relationships:
```
bookings.user_id -> users.id
swap_proposal_metadata.proposal_id -> swaps.id  (⚠️ Should be swap_proposals.id)
swap_proposal_metadata.proposer_id -> users.id
swap_proposal_metadata.source_swap_id -> swaps.id
swap_proposal_metadata.target_owner_id -> users.id
swap_proposal_metadata.target_swap_id -> swaps.id
swap_proposals.proposer_id -> users.id
swap_proposals.responded_by -> users.id
swap_proposals.source_swap_id -> swaps.id
swap_proposals.target_swap_id -> swaps.id
swap_proposals.target_user_id -> users.id
swap_targets.source_swap_id -> swaps.id
swap_targets.target_swap_id -> swaps.id
swaps.source_booking_id -> bookings.id
```

### Impact Assessment

1. **Critical Error:** PostgreSQL 42703 errors prevent proposal acceptance/rejection operations
2. **Affected Operations:**
   - Proposal acceptance workflow
   - Proposal rejection workflow
   - Proposal status updates
   - Proposal retrieval by ID

3. **Data Integrity:** No data loss, but operations fail due to schema misalignment

### Recommended Fixes

1. **Update ProposalAcceptanceService.getProposal() method** to use correct column references
2. **Replace JSONB column references** with individual column references
3. **Update any other queries** that reference the removed columns
4. **Add validation** to ensure queries match current schema
5. **Update proposal metadata relationships** if needed

### Next Steps

1. Fix the problematic queries in `ProposalAcceptanceService`
2. Update repository methods to use current schema
3. Add error handling for column reference errors
4. Test all proposal operations
5. Document the corrected repository patterns

### Files Requiring Updates

- `apps/backend/src/services/swap/ProposalAcceptanceService.ts` (Primary fix needed)
- Any other services that might reference the old column structure
- Repository methods that query proposals

### Test Data

- Total proposals in swap_proposal_metadata: 0 (no test data available)
- Schema validation: Passed for current structure
- Column validation: Failed for removed columns (`terms`, `blockchain`, `timeline`)