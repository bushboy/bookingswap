# Requirements Document

## Introduction

This feature fixes the current swap proposal system where users end up with multiple swaps when making proposals. Instead of creating new swaps for each proposal, the system should allow users to update their existing swap to target other swaps directly. This ensures users maintain a single swap that can be redirected to target different opportunities, rather than accumulating multiple separate swaps.

## Requirements

### Requirement 1: Single Swap Per User Management

**User Story:** As a user with an existing swap, I want to redirect my swap to target other swaps instead of creating new ones so that I maintain a single, manageable swap proposal.

#### Acceptance Criteria

1. WHEN a user has an existing active swap THEN the system SHALL prevent creating additional swaps for the same booking
2. WHEN a user wants to make a proposal against another swap THEN the system SHALL update their existing swap to target the new swap instead of creating a duplicate
3. WHEN a user's swap is updated to target a different swap THEN the system SHALL maintain the original swap ID and booking details
4. WHEN a swap target is updated THEN the system SHALL cancel any previous pending proposals from that swap
5. IF a user tries to create a new swap while having an active one THEN the system SHALL offer to update the existing swap instead
6. WHEN a swap is retargeted THEN the system SHALL preserve the original swap creation date and metadata
7. WHEN a swap target changes THEN the system SHALL notify relevant parties about the change

### Requirement 2: Swap-to-Swap Targeting System

**User Story:** As a user browsing available swaps, I want to target my existing swap directly at other swaps so that I can propose swap-for-swap exchanges efficiently.

#### Acceptance Criteria

1. WHEN a user views another user's swap THEN the system SHALL display an option to "Target My Swap" if they have an active swap
2. WHEN "Target My Swap" is selected THEN the system SHALL update the user's existing swap to target the viewed swap
3. WHEN targeting a swap THEN the system SHALL validate that both swaps are compatible and available
4. WHEN a swap is targeted at another swap THEN the system SHALL create a proposal relationship between the two swaps
5. IF the target swap becomes unavailable THEN the system SHALL revert the user's swap to general availability
6. WHEN a swap-to-swap targeting occurs THEN the system SHALL update both swaps' status to reflect the proposal relationship
7. WHEN targeting is successful THEN the system SHALL notify both swap owners about the new proposal

### Requirement 3: Swap Retargeting and Flexibility

**User Story:** As a user with an active swap, I want to easily retarget my swap to different opportunities so that I can maximize my chances of finding a good match.

#### Acceptance Criteria

1. WHEN a user wants to change their swap target THEN the system SHALL allow retargeting to a different swap or back to general availability
2. WHEN retargeting occurs THEN the system SHALL cancel the previous proposal and create a new one
3. WHEN a swap is retargeted multiple times THEN the system SHALL maintain a history of targeting attempts
4. WHEN retargeting THEN the system SHALL validate that the new target is still available and compatible
5. IF a retargeting attempt fails THEN the system SHALL maintain the previous targeting state
6. WHEN a user retargets their swap THEN the system SHALL update the swap's last modified timestamp
7. WHEN retargeting occurs THEN the system SHALL send appropriate notifications to all affected parties

### Requirement 4: Auction Mode vs One-for-One Proposal Management

**User Story:** As a swap owner, I want different proposal rules for auction mode vs one-for-one swaps so that I can control how many proposals I receive based on my preferred deal acceptance strategy.

#### Acceptance Criteria

1. WHEN a swap is in "first match acceptance" mode THEN the system SHALL only allow one active proposal at a time
2. WHEN a swap is in "auction mode" THEN the system SHALL allow multiple simultaneous proposals until the auction ends
3. WHEN a user tries to target a one-for-one swap that already has a pending proposal THEN the system SHALL prevent the targeting and display an appropriate message
4. WHEN a user tries to target an auction mode swap THEN the system SHALL allow the targeting regardless of existing proposals
5. IF an existing proposal on a one-for-one swap is rejected THEN the system SHALL allow new proposals to be made
6. WHEN an auction ends THEN the system SHALL prevent any new proposals from being made on that swap
7. WHEN a proposal is accepted on any swap THEN the system SHALL prevent further proposals and end any active auction immediately
8. WHEN displaying targeting options THEN the system SHALL indicate whether the target swap accepts multiple proposals or requires waiting for current proposal resolution

### Requirement 5: Proposal State Management

**User Story:** As a system user, I want swap proposals to be properly managed when targeting changes so that the system maintains data integrity across different swap modes.

#### Acceptance Criteria

1. WHEN a swap is retargeted THEN the system SHALL update the proposal status from the previous target to "cancelled"
2. WHEN a new targeting occurs THEN the system SHALL create a new proposal record with "pending" status
3. WHEN a targeted swap is accepted or rejected THEN the system SHALL update both swaps' statuses appropriately
4. WHEN a proposal is cancelled due to retargeting THEN the system SHALL notify the previously targeted swap owner
5. IF a swap owner accepts a proposal THEN the system SHALL prevent further retargeting of both swaps and end any active auctions
6. WHEN proposal states change THEN the system SHALL maintain an audit trail of all status transitions
7. WHEN concurrent targeting attempts occur THEN the system SHALL handle them with proper locking mechanisms
8. WHEN an auction mode swap receives its first proposal THEN the system SHALL start the auction countdown timer
9. WHEN an auction timer expires THEN the system SHALL notify the swap owner to select from received proposals

### Requirement 6: User Interface Integration

**User Story:** As a user, I want the swap targeting interface to be intuitive and clearly show my current swap status and auction mode restrictions so that I can easily manage my swap proposals.

#### Acceptance Criteria

1. WHEN a user has an active swap THEN the system SHALL display the current target status prominently
2. WHEN browsing other swaps THEN the system SHALL show "Target My Swap" instead of "Create New Swap" for users with existing swaps
3. WHEN a swap is currently targeting another swap THEN the system SHALL display the target swap details
4. WHEN a user wants to retarget THEN the system SHALL provide a clear interface to change or remove the current target
5. IF a user's swap receives a counter-proposal THEN the system SHALL display this prominently in their swap management interface
6. WHEN displaying swap status THEN the system SHALL use clear visual indicators for targeted, pending, and available states
7. WHEN targeting actions are performed THEN the system SHALL provide immediate feedback about success or failure
8. WHEN viewing a one-for-one swap with an existing proposal THEN the system SHALL display "Proposal Pending - Cannot Target" message
9. WHEN viewing an auction mode swap THEN the system SHALL display auction end time and current proposal count
10. WHEN an auction has ended THEN the system SHALL disable targeting options and display "Auction Ended" status

### Requirement 7: Notification and Communication Enhancement

**User Story:** As a user involved in swap targeting, I want to receive clear notifications about targeting activities so that I can respond appropriately to proposals and changes.

#### Acceptance Criteria

1. WHEN a swap targets my swap THEN the system SHALL notify me immediately with details about the proposing swap
2. WHEN someone retargets away from my swap THEN the system SHALL notify me that the proposal has been withdrawn
3. WHEN I retarget my swap THEN the system SHALL confirm the action and notify the previously targeted user
4. WHEN a targeted swap becomes unavailable THEN the system SHALL notify me and revert my swap to general availability
5. IF multiple users target my swap THEN the system SHALL notify me about each new targeting attempt
6. WHEN notifications are sent THEN the system SHALL include relevant swap details and available actions
7. WHEN targeting-related events occur THEN the system SHALL use appropriate notification channels based on user preferences

### Requirement 8: Data Consistency and Validation

**User Story:** As a platform administrator, I want the swap targeting system to maintain data integrity so that all swap relationships are valid and consistent.

#### Acceptance Criteria

1. WHEN a swap is targeted THEN the system SHALL validate that both swaps exist and are in valid states
2. WHEN targeting occurs THEN the system SHALL prevent circular targeting relationships
3. WHEN a swap is deleted or cancelled THEN the system SHALL clean up any targeting relationships involving that swap
4. WHEN validating targeting THEN the system SHALL ensure users cannot target their own swaps
5. IF data inconsistencies are detected THEN the system SHALL log errors and attempt automatic resolution
6. WHEN targeting relationships are modified THEN the system SHALL update all related database records atomically
7. WHEN system maintenance occurs THEN the system SHALL validate and repair any orphaned targeting relationships