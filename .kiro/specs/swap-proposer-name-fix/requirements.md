# Requirements Document

## Introduction

Users are seeing "unknown" instead of actual user names for swap proposers on the /swaps page. The issue occurs in the right-hand side display of swap proposals where the user linked to incoming proposals or targeted proposals shows as "unknown". Investigation shows that the database contains the correct user information, but it's being lost during the data transformation process in SwapRepository.mapRowToSwapWithBookingDetails and SwapProposalService.transformFromEnhancedSwapData methods.

## Glossary

- **Swap_Proposal_Service**: The backend service responsible for transforming swap data from database queries into frontend-consumable formats
- **Swap_Repository**: The database repository class that handles swap data queries and row-to-entity mapping
- **Proposer_Name**: The display name of the user who created a swap proposal, derived from the users table
- **Swap_Targets_Table**: The database table that tracks targeting relationships between swaps

## Requirements

### Requirement 1

**User Story:** As a user viewing swap proposals on the /swaps page, I want to see the actual names of users who made proposals instead of "unknown" so that I can identify who is interested in my swap.

#### Acceptance Criteria

1. WHEN viewing swap proposals on the /swaps page, THE Swap_Proposal_Service SHALL display actual user names from the database
2. WHEN a proposer has a valid display_name in the users table, THE Swap_Proposal_Service SHALL show that name in the proposal display
3. WHEN proposer information is retrieved from the database, THE Swap_Repository SHALL properly join user data through the booking relationships
4. WHERE user data exists in the database, THE Swap_Proposal_Service SHALL NOT display "unknown" as a fallback value

### Requirement 2

**User Story:** As a developer debugging swap proposal data, I want the database queries to properly join user information so that proposer names are available in the result set.

#### Acceptance Criteria

1. WHEN executing the findSwapCardsWithProposals query, THE Swap_Repository SHALL properly join through the swap_targets → swaps → bookings → users chain
2. WHEN the JOIN chain fails at any point, THE Swap_Repository SHALL log the specific failure point for debugging
3. WHEN user data is missing from the JOIN result, THE Swap_Repository SHALL investigate and report which table relationship is broken
4. WHERE the JOIN chain is successful, THE Swap_Repository SHALL include proposer_name in the result set

### Requirement 3

**User Story:** As a system administrator, I want proper error handling and logging when user data cannot be retrieved so that I can identify and fix data integrity issues.

#### Acceptance Criteria

1. WHEN proposer_name is NULL in the query result, THE Swap_Repository SHALL log the specific swap_id and proposer_id for investigation
2. WHEN the users table JOIN fails, THE Swap_Repository SHALL log the missing user_id and booking relationship details
3. WHEN data transformation encounters missing user information, THE Swap_Proposal_Service SHALL log the transformation failure with context
4. WHERE user data is consistently missing, THE Swap_Repository SHALL provide diagnostic information about the database relationships