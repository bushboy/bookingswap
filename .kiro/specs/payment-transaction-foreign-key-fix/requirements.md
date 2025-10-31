# Requirements Document

## Introduction

This feature addresses a critical database integrity issue where swap offer submissions fail due to foreign key constraint violations in the payment_transactions table. The error "insert or update on table 'payment_transactions' violates foreign key constraint 'payment_transactions_proposal_id_fkey'" occurs when the system attempts to create payment transaction records with proposal_id values that don't exist in the auction_proposals table. This can happen for both cash offers and regular booking swap offers. The fix ensures that auction proposals are only created and referenced when users explicitly choose auction mode, and payment transactions handle both auction and direct swap scenarios correctly.

## Requirements

### Requirement 1: Fix Proposal Creation Order and Optional References

**User Story:** As a system user, I want swap offer submissions to handle both auction and direct swap scenarios correctly so that foreign key constraints are satisfied in all cases.

#### Acceptance Criteria

1. WHEN a user submits an offer and explicitly chooses auction mode THEN the system SHALL create the auction proposal record first
2. WHEN a user submits an offer for direct swap (non-auction) THEN the system SHALL create payment transactions without requiring auction proposals
3. WHEN auction proposals are created THEN the system SHALL use the proposal ID for any related payment transaction records
4. WHEN creating payment transactions for direct swaps THEN the system SHALL set proposal_id to NULL since no auction proposal exists
5. IF auction proposal creation fails THEN the system SHALL not attempt to create payment transaction records
6. WHEN creating payment transactions with proposal_id THEN the system SHALL validate that the proposal_id exists in auction_proposals table
7. IF proposal_id validation fails THEN the system SHALL return a clear error message indicating the data integrity issue
8. WHEN the offer process completes successfully THEN all related tables SHALL have consistent data regardless of auction vs direct swap mode
9. WHEN determining offer type THEN the system SHALL only check for auction requirements if the user explicitly selects auction mode

### Requirement 2: Validate Data Integrity for Both Auction and Direct Swap Scenarios

**User Story:** As a developer, I want comprehensive validation to prevent foreign key constraint violations so that the system maintains data consistency in both auction and direct swap scenarios.

#### Acceptance Criteria

1. WHEN creating payment transactions THEN the system SHALL validate all foreign key references before insertion
2. WHEN a proposal_id is provided (auction scenario) THEN the system SHALL verify it exists in the auction_proposals table
3. WHEN proposal_id is NULL (direct swap scenario) THEN the system SHALL skip auction proposal validation
4. WHEN a swap_id is provided THEN the system SHALL verify it exists in the swaps table
5. WHEN user IDs are provided THEN the system SHALL verify they exist in the users table
6. WHEN determining the scenario THEN the system SHALL only create auction proposals if the user explicitly chooses auction mode
7. IF any required foreign key validation fails THEN the system SHALL return specific error messages identifying the missing reference
8. WHEN validation passes THEN the system SHALL proceed with the transaction creation
9. WHEN validation fails THEN the system SHALL log the validation failure with sufficient detail for debugging
10. WHEN users submit offers THEN the system SHALL NOT assume auction mode based on swap configuration alone

### Requirement 3: Implement Transaction Rollback for Both Scenarios

**User Story:** As a system user, I want failed swap offer submissions to be properly rolled back so that no partial data remains in the database, regardless of whether it's an auction or direct swap.

#### Acceptance Criteria

1. WHEN a swap offer submission fails at any step THEN the system SHALL rollback all related database changes
2. WHEN auction proposal creation succeeds but payment transaction creation fails THEN the system SHALL remove the auction proposal
3. WHEN payment transaction creation fails for direct swaps THEN the system SHALL rollback any related swap status changes
4. WHEN blockchain recording fails THEN the system SHALL rollback auction proposals (if created) and payment transaction records
5. WHEN notification sending fails THEN the system SHALL NOT rollback the core transaction data
6. IF rollback operations fail THEN the system SHALL log critical errors and alert administrators
7. WHEN rollback completes successfully THEN the database SHALL be in the same state as before the failed operation
8. WHEN users retry after a failed submission THEN the system SHALL not encounter duplicate data conflicts

### Requirement 4: Enhance Error Handling and Logging

**User Story:** As a developer, I want detailed error messages and logging for foreign key violations so that I can quickly diagnose and fix data integrity issues.

#### Acceptance Criteria

1. WHEN foreign key constraint violations occur THEN the system SHALL log the specific constraint name and referenced table
2. WHEN proposal_id references fail THEN the system SHALL log the attempted proposal_id and confirm its absence in auction_proposals
3. WHEN database errors occur THEN the system SHALL provide user-friendly error messages without exposing internal details
4. WHEN logging constraint violations THEN the system SHALL include relevant context like user_id, swap_id, and timestamp
5. IF multiple constraint violations occur THEN the system SHALL log each violation separately with clear identification
6. WHEN errors are resolved THEN the system SHALL log successful operations for audit purposes
7. WHEN critical data integrity issues are detected THEN the system SHALL send alerts to administrators

### Requirement 5: Add Data Consistency Checks

**User Story:** As a system administrator, I want automated data consistency checks to prevent and detect foreign key constraint violations before they cause user-facing errors.

#### Acceptance Criteria

1. WHEN the system starts up THEN it SHALL perform basic foreign key consistency checks on critical tables
2. WHEN inconsistencies are detected THEN the system SHALL log warnings and optionally send administrator alerts
3. WHEN processing cash offers THEN the system SHALL perform pre-flight checks on all required foreign key references
4. WHEN auction proposals are deleted THEN the system SHALL ensure dependent payment_transactions are handled appropriately
5. IF orphaned payment_transactions are detected THEN the system SHALL provide tools to clean up or reassign them
6. WHEN data migration occurs THEN the system SHALL validate all foreign key relationships post-migration
7. WHEN consistency checks pass THEN the system SHALL log successful validation for audit purposes

### Requirement 6: Improve Swap Offer Workflow

**User Story:** As a user submitting swap offers, I want the submission process to be reliable and provide clear feedback so that I know whether my offer was successfully recorded.

#### Acceptance Criteria

1. WHEN submitting a swap offer THEN the system SHALL provide real-time feedback on the submission progress
2. WHEN the auction proposal is created (if auction mode selected) THEN the system SHALL confirm this step to the user
3. WHEN payment processing is initiated THEN the system SHALL show appropriate loading states
4. WHEN the submission completes successfully THEN the system SHALL display confirmation with offer details
5. IF submission fails THEN the system SHALL provide clear error messages and suggested next steps
6. WHEN retrying failed submissions THEN the system SHALL not create duplicate proposals or transactions
7. WHEN the offer is recorded THEN the system SHALL update the UI to reflect the new proposal status
8. WHEN users choose offer type THEN the system SHALL clearly distinguish between auction and direct swap options