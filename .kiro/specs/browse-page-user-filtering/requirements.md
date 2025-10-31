# Requirements Document

## Introduction

This specification defines the requirements for enhancing the browse page to provide a better user experience by filtering out irrelevant bookings and managing proposal interactions based on user authentication status and existing proposals. The system should prevent users from seeing their own bookings and handle proposal attempts intelligently.

## Glossary

- **Browse Page**: The public page displaying available swap opportunities that users can view and propose on
- **Booking Owner**: The user who created a booking and is seeking swap proposals
- **Proposer**: A user who submits a proposal for a booking swap
- **Active Proposal**: A proposal that has been submitted and is in pending status (not rejected or accepted)
- **Rejected Proposal**: A proposal that has been declined by the booking owner
- **Authentication System**: The system component that manages user login state and identity
- **Proposal System**: The system component that manages swap proposals and their statuses

## Requirements

### Requirement 1

**User Story:** As a logged-in user browsing available swaps, I want to see only bookings from other users, so that I don't waste time viewing my own bookings that I cannot propose on.

#### Acceptance Criteria

1. WHEN a logged-in user views the Browse Page, THE Browse Page SHALL exclude all bookings where the current user is the booking owner
2. WHEN an unauthenticated user views the Browse Page, THE Browse Page SHALL display all available bookings without filtering
3. THE Browse Page SHALL maintain all other existing filtering and sorting functionality while applying user-based filtering
4. WHEN the user's authentication status changes, THE Browse Page SHALL refresh the booking list with appropriate filtering

### Requirement 2

**User Story:** As a logged-in user, I want the system to prevent me from attempting to propose on my own bookings, so that I receive immediate feedback instead of encountering errors.

#### Acceptance Criteria

1. WHEN a logged-in user attempts to propose on their own booking, THE Proposal System SHALL refresh the Browse Page without showing a proposal modal
2. WHEN a logged-in user attempts to propose on their own booking, THE Proposal System SHALL display a brief informational message explaining the action
3. THE Proposal System SHALL detect booking ownership before displaying any proposal interface
4. THE Browse Page SHALL update the display to reflect the current user's bookings are filtered out

### Requirement 3

**User Story:** As a user who has already submitted a proposal for a booking, I want the system to prevent duplicate proposals and provide clear feedback, so that I understand my proposal status.

#### Acceptance Criteria

1. WHEN a logged-in user attempts to propose on a booking where they have an active proposal, THE Proposal System SHALL refresh the Browse Page without showing a proposal modal
2. WHEN a logged-in user attempts to propose on a booking where they have an active proposal, THE Proposal System SHALL display a message indicating they already have a pending proposal
3. THE Proposal System SHALL check for existing active proposals before displaying the proposal interface
4. THE Browse Page SHALL reflect the user's proposal status in the booking display

### Requirement 4

**User Story:** As a user viewing available swaps, I want to see appropriate action buttons based on my proposal history, so that I understand what actions are available to me.

#### Acceptance Criteria

1. WHEN a logged-in user views a booking where they have an active proposal, THE Browse Page SHALL hide the propose button for that booking
2. WHEN a logged-in user views a booking where they have a rejected proposal, THE Browse Page SHALL show the propose button to allow re-proposing
3. WHEN a logged-in user views a booking where they have no previous proposals, THE Browse Page SHALL show the propose button
4. WHEN an unauthenticated user views any booking, THE Browse Page SHALL show propose buttons that prompt for authentication

### Requirement 5

**User Story:** As a user with a rejected proposal, I want to be able to submit a new proposal for the same booking, so that I can try again with different terms.

#### Acceptance Criteria

1. WHEN a user's proposal is rejected, THE Proposal System SHALL update the proposal status to allow new proposals
2. WHEN a logged-in user views a booking where their previous proposal was rejected, THE Browse Page SHALL display the propose button as available
3. THE Proposal System SHALL treat rejected proposals as non-blocking for new proposal submissions
4. THE Browse Page SHALL not display any indication of previous rejected proposals in the booking card