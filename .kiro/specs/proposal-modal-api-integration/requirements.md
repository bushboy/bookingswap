# Requirements Document

## Introduction

This feature focuses on integrating the MakeProposalModal component with real API endpoints to fetch eligible swaps and submit proposals, replacing the current mock data implementation. The modal currently works with hardcoded data and needs to connect to the backend services to provide real-time swap matching and proposal creation functionality.

## Requirements

### Requirement 1

**User Story:** As a user creating a swap proposal, I want to see my actual eligible swaps that are compatible with the target swap, so that I can make informed decisions about which swap to propose.

#### Acceptance Criteria

1. WHEN the MakeProposalModal opens THEN the system SHALL fetch the user's eligible swaps from the API endpoint `/api/users/{userId}/swaps/eligible`
2. WHEN fetching eligible swaps THEN the system SHALL include the target swap ID as a query parameter to get compatibility-filtered results
3. WHEN the API call is in progress THEN the system SHALL display a loading state with appropriate accessibility announcements
4. WHEN the API call fails THEN the system SHALL display an error message and provide a retry option
5. WHEN no eligible swaps are returned THEN the system SHALL display a helpful message explaining why no swaps are available

### Requirement 2

**User Story:** As a user, I want to see real compatibility scores and eligibility reasons for my swaps, so that I can understand why certain swaps are better matches than others.

#### Acceptance Criteria

1. WHEN displaying eligible swaps THEN the system SHALL show the actual compatibility score calculated by the backend
2. WHEN displaying eligible swaps THEN the system SHALL show specific eligibility reasons provided by the API
3. WHEN compatibility score is above 80% THEN the system SHALL display it as "excellent match" with green styling
4. WHEN compatibility score is 60-79% THEN the system SHALL display it as "good match" with yellow styling
5. WHEN compatibility score is below 60% THEN the system SHALL display it as "fair match" with orange styling

### Requirement 3

**User Story:** As a user, I want my proposal to be submitted to the actual backend system, so that the swap owner can receive and respond to my proposal.

#### Acceptance Criteria

1. WHEN the user submits a proposal THEN the system SHALL send a POST request to `/api/swaps/{targetSwapId}/proposals`
2. WHEN submitting a proposal THEN the system SHALL include all form data: sourceSwapId, message, conditions, and terms agreement
3. WHEN the proposal submission is in progress THEN the system SHALL show loading state and disable the submit button
4. WHEN the proposal is successfully submitted THEN the system SHALL close the modal and show a success notification
5. WHEN the proposal submission fails THEN the system SHALL display the error message and allow retry

### Requirement 4

**User Story:** As a user, I want the system to handle authentication and authorization properly, so that I can only see and propose swaps that I'm authorized to access.

#### Acceptance Criteria

1. WHEN making API calls THEN the system SHALL include the user's authentication token in the Authorization header
2. WHEN the user is not authenticated THEN the system SHALL redirect to login before opening the modal
3. WHEN the user lacks permission for a swap THEN the system SHALL display an appropriate error message
4. WHEN the authentication token expires THEN the system SHALL handle token refresh or redirect to login

### Requirement 5

**User Story:** As a user, I want the modal to provide real-time feedback and error handling, so that I understand what's happening and can recover from any issues.

#### Acceptance Criteria

1. WHEN any API call fails with a network error THEN the system SHALL display a user-friendly error message
2. WHEN the API returns validation errors THEN the system SHALL display field-specific error messages
3. WHEN the API is slow to respond THEN the system SHALL show appropriate loading indicators
4. WHEN an error occurs THEN the system SHALL provide actionable options like "Retry" or "Cancel"
5. WHEN errors are displayed THEN the system SHALL announce them to screen readers for accessibility