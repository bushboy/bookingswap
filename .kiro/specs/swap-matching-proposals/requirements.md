# Requirements Document

## Introduction

This feature enables users to propose their own swaps as matches when browsing other users' swap listings. When a user finds an interesting swap on the browse page, they can click "Make proposal" to offer one of their own available swaps as a potential match. The system will facilitate the proposal creation, validation, and storage, allowing the original swap creator to review and respond to the proposal.

## Requirements

### Requirement 1: Swap Proposal Creation from Browse Page

**User Story:** As a user browsing available swaps, I want to propose one of my own swaps as a match so that I can initiate a potential swap exchange.

#### Acceptance Criteria

1. WHEN a user views a swap listing on the browse page THEN the system SHALL display a "Make proposal" button if the user has eligible swaps
2. WHEN a user clicks "Make proposal" THEN the system SHALL open a proposal creation interface
3. WHEN the proposal interface opens THEN the system SHALL display the user's available swaps that are eligible for proposing
4. WHEN displaying eligible swaps THEN the system SHALL exclude swaps that are already involved in active proposals or completed swaps
5. WHEN a user selects one of their swaps THEN the system SHALL allow them to add an optional message explaining the proposal
6. WHEN a user submits a proposal THEN the system SHALL validate the proposal and save it to the database
7. WHEN a proposal is successfully created THEN the system SHALL notify the original swap creator and confirm to the proposer

### Requirement 2: Swap Eligibility Validation

**User Story:** As a user making a proposal, I want the system to only show me swaps that are valid for proposing so that I don't waste time on incompatible matches.

#### Acceptance Criteria

1. WHEN determining eligible swaps THEN the system SHALL exclude swaps that belong to the current user
2. WHEN determining eligible swaps THEN the system SHALL exclude swaps that are not in "active" status
3. WHEN determining eligible swaps THEN the system SHALL exclude swaps that already have pending proposals from the current user
4. WHEN determining eligible swaps THEN the system SHALL exclude swaps that are involved in completed transactions
5. WHEN a user has no eligible swaps THEN the system SHALL display an appropriate message and disable the "Make proposal" button
6. WHEN displaying eligible swaps THEN the system SHALL show relevant booking details to help users make informed decisions
7. WHEN validating a proposal THEN the system SHALL ensure the proposed swap is still available and eligible

### Requirement 3: Proposal Data Management

**User Story:** As a system administrator, I want proposals to be properly stored and tracked so that users can manage their swap interactions effectively.

#### Acceptance Criteria

1. WHEN a proposal is created THEN the system SHALL store the proposal with source swap ID, target swap ID, proposer ID, and timestamp
2. WHEN a proposal is created THEN the system SHALL store any optional message provided by the proposer
3. WHEN a proposal is created THEN the system SHALL set the initial status to "pending"
4. WHEN storing a proposal THEN the system SHALL generate a unique proposal ID for tracking
5. WHEN a proposal is saved THEN the system SHALL update the source swap's proposal count
6. WHEN retrieving proposals THEN the system SHALL include all relevant swap and user details
7. WHEN a proposal exists THEN the system SHALL prevent duplicate proposals between the same two swaps

### Requirement 4: User Interface Integration

**User Story:** As a user, I want the proposal creation process to be intuitive and integrated with the existing browse interface so that I can easily make proposals.

#### Acceptance Criteria

1. WHEN viewing a swap card on the browse page THEN the system SHALL display the "Make proposal" button prominently
2. WHEN the "Make proposal" button is clicked THEN the system SHALL open a modal or dedicated page for proposal creation
3. WHEN in the proposal interface THEN the system SHALL display the target swap details for reference
4. WHEN selecting a swap to propose THEN the system SHALL show a preview of both swaps side by side
5. WHEN the proposal form is displayed THEN the system SHALL include fields for swap selection and optional message
6. WHEN submitting a proposal THEN the system SHALL provide clear feedback about the submission status
7. WHEN a proposal is submitted THEN the system SHALL return the user to the browse page with a success confirmation

### Requirement 5: Proposal Status Tracking

**User Story:** As a user who has made proposals, I want to track the status of my proposals so that I know when they are accepted, rejected, or require action.

#### Acceptance Criteria

1. WHEN a proposal is created THEN the system SHALL set the status to "pending"
2. WHEN a proposal is accepted THEN the system SHALL update the status to "accepted" and initiate the swap process
3. WHEN a proposal is rejected THEN the system SHALL update the status to "rejected" and notify the proposer
4. WHEN a proposal expires THEN the system SHALL update the status to "expired" after a defined period
5. WHEN a proposal status changes THEN the system SHALL send appropriate notifications to relevant users
6. WHEN displaying proposals THEN the system SHALL show the current status with appropriate visual indicators
7. WHEN a swap is completed through a proposal THEN the system SHALL update the status to "completed"

### Requirement 6: Notification and Communication

**User Story:** As a user involved in swap proposals, I want to receive timely notifications about proposal activities so that I can respond appropriately.

#### Acceptance Criteria

1. WHEN a proposal is received THEN the system SHALL notify the target swap owner immediately
2. WHEN a proposal is accepted or rejected THEN the system SHALL notify the proposer immediately
3. WHEN sending notifications THEN the system SHALL include relevant details about the proposal and involved swaps
4. WHEN a proposal is pending for more than 48 hours THEN the system SHALL send a reminder to the target swap owner
5. WHEN multiple proposals exist for a swap THEN the system SHALL notify the owner about the total count
6. WHEN a proposal expires THEN the system SHALL notify both parties about the expiration
7. WHEN notifications are sent THEN the system SHALL use the user's preferred notification methods (email, in-app, etc.)