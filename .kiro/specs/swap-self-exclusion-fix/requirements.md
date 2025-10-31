# Requirements Document

## Introduction

This feature addresses a critical logical bug in the swap card display system where users are seeing their own swaps incorrectly displayed as proposals from other users. The /swaps page should show swap cards with the user's own swap on the left side and genuine proposals from other users on the right side. Currently, there's a bug where the user's own swap appears on both sides of the card, making it look like they've made a proposal to themselves, which is confusing and incorrect.

## Requirements

### Requirement 1

**User Story:** As a user viewing swap cards on the /swaps page, I want to see my own swap on the left side of each card and only genuine proposals from other users on the right side, so that I can clearly understand which swaps are mine and which are actual proposals I can consider.

#### Acceptance Criteria

1. WHEN a user views a swap card THEN the left side SHALL display the user's own swap booking details
2. WHEN displaying the right side of a swap card THEN the system SHALL only show proposals made by other users for the user's swap
3. WHEN a user's own swap appears on the right side as a proposal THEN the system SHALL exclude it as this represents invalid self-proposal data
4. WHEN filtering proposals for the right side of cards THEN the system SHALL ensure the proposer is not the same as the current user

### Requirement 2

**User Story:** As a user, I want to see only actionable proposals from other users on the right side of swap cards, including all valid proposals when multiple exist, so that I can review all genuine offers without seeing confusing self-proposals.

#### Acceptance Criteria

1. WHEN displaying proposals on the right side of swap cards THEN the system SHALL exclude any proposals where the proposer_id matches the current user's ID
2. WHEN a swap has no valid proposals from other users THEN the right side SHALL display appropriate messaging like "No proposals yet"
3. WHEN multiple proposals exist for a swap THEN the system SHALL display all proposals from other users, never from the swap owner
4. WHEN showing multiple proposals THEN each proposal SHALL be clearly distinguishable with proper user identification and booking details
5. WHEN the proposal data is filtered THEN the system SHALL maintain the correct relationship between the user's swap (left) and all valid proposals from others (right)

### Requirement 3

**User Story:** As a developer, I want the proposal filtering logic to correctly handle multiple proposals per swap while distinguishing between swap owners and proposers, so that the card display logic works correctly and users never see their own swaps as proposals.

#### Acceptance Criteria

1. WHEN querying proposals for a user's swap THEN the system SHALL filter out any proposals where the proposer_id equals the swap owner's user ID
2. WHEN building swap card data THEN the system SHALL ensure clear separation between the user's own swap data and all valid proposals from others
3. WHEN multiple proposals exist for a single swap THEN the system SHALL return all proposals from other users while excluding any self-proposals
4. WHEN a data inconsistency exists (user proposing to themselves) THEN the system SHALL handle it gracefully by excluding the invalid proposal while preserving other valid proposals
5. WHEN implementing the filtering logic THEN it SHALL be applied at the data retrieval level to prevent invalid proposals from reaching the frontend