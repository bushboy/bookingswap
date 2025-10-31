# Requirements Document

## Introduction

This feature addresses the issue where the `/swaps` view does not properly utilize the swap_targets table to display targeting relationships. Currently, when users view their swaps, they cannot see that their swap is being targeted by other users' proposals, nor can they see when their own swap is targeting another user's swap. The system has a comprehensive swap targeting infrastructure in place, but the user-facing `/swaps` endpoint doesn't leverage this data to provide users with complete visibility into their swap targeting relationships.

## Requirements

### Requirement 1: Display Incoming Targeting Proposals

**User Story:** As a user viewing my swaps on the /swaps page, I want to see when other users have targeted their swaps at mine so that I can review and respond to these targeting proposals.

#### Acceptance Criteria

1. WHEN a user views their swaps THEN the system SHALL display all swaps that are currently targeting each of their swaps
2. WHEN displaying targeting proposals THEN the system SHALL show the targeting user's swap details including booking information, dates, and location
3. WHEN a swap has multiple targeting proposals THEN the system SHALL display all targeting relationships with clear visual separation
4. WHEN a targeting proposal exists THEN the system SHALL show the proposal creation date and current status
5. WHEN displaying targeting information THEN the system SHALL include the targeting user's profile information for context
6. WHEN a user's swap is in auction mode THEN the system SHALL display all targeting proposals with auction countdown information
7. WHEN a user's swap is in one-for-one mode THEN the system SHALL display the single targeting proposal with appropriate status indicators

### Requirement 2: Display Outgoing Targeting Status

**User Story:** As a user viewing my swaps on the /swaps page, I want to see which other user's swap my swap is currently targeting so that I can track my targeting activity and manage my proposals.

#### Acceptance Criteria

1. WHEN a user's swap is targeting another swap THEN the system SHALL display the target swap details prominently
2. WHEN displaying target swap information THEN the system SHALL show the target booking details, location, dates, and owner information
3. WHEN a targeting relationship exists THEN the system SHALL display the targeting date and current proposal status
4. WHEN the target swap is in auction mode THEN the system SHALL show auction end date and current proposal count
5. WHEN the target swap is in one-for-one mode THEN the system SHALL indicate if the proposal is pending review
6. WHEN a targeting proposal has been accepted or rejected THEN the system SHALL display the outcome with timestamp
7. WHEN a user wants to retarget THEN the system SHALL provide clear options to change or remove the current target

### Requirement 3: Enhanced Swap Card Data Integration

**User Story:** As a developer, I want the swap card data to include comprehensive targeting information so that the frontend can display complete targeting relationships without additional API calls.

#### Acceptance Criteria

1. WHEN retrieving user swap cards THEN the system SHALL include targeting relationship data in the response
2. WHEN a swap has incoming targets THEN the system SHALL include the targeting swaps' details and user information
3. WHEN a swap is targeting another swap THEN the system SHALL include the target swap's details and status
4. WHEN targeting data is included THEN the system SHALL maintain backward compatibility with existing swap card structure
5. WHEN targeting information is unavailable THEN the system SHALL gracefully handle missing data without breaking the response
6. WHEN multiple targeting relationships exist THEN the system SHALL organize the data efficiently to minimize response size
7. WHEN targeting status changes THEN the system SHALL ensure the swap card data reflects the current state

### Requirement 4: Targeting Status Visual Indicators

**User Story:** As a user, I want clear visual indicators on my swap cards that show targeting status so that I can quickly understand the state of my swap proposals.

#### Acceptance Criteria

1. WHEN a swap is being targeted by others THEN the system SHALL display a visual indicator with the count of targeting proposals
2. WHEN a swap is targeting another swap THEN the system SHALL display a visual indicator showing the targeting status
3. WHEN targeting proposals are pending THEN the system SHALL use appropriate colors and icons to indicate pending status
4. WHEN targeting proposals have been responded to THEN the system SHALL use different visual indicators for accepted/rejected status
5. WHEN a swap has both incoming and outgoing targeting THEN the system SHALL clearly distinguish between the two types
6. WHEN auction mode is active THEN the system SHALL display auction-specific indicators with countdown timers
7. WHEN targeting restrictions apply THEN the system SHALL show appropriate warning or information indicators

### Requirement 5: Targeting Action Integration

**User Story:** As a user viewing my swaps, I want to be able to take targeting-related actions directly from the swap cards so that I can efficiently manage my targeting relationships.

#### Acceptance Criteria

1. WHEN viewing incoming targeting proposals THEN the system SHALL provide options to accept or reject each proposal
2. WHEN viewing outgoing targeting status THEN the system SHALL provide options to retarget or cancel targeting
3. WHEN a swap is not currently targeting anything THEN the system SHALL provide an option to browse and target available swaps
4. WHEN targeting actions are available THEN the system SHALL ensure proper authorization and validation
5. WHEN targeting actions are performed THEN the system SHALL provide immediate feedback and update the display
6. WHEN targeting actions fail THEN the system SHALL display clear error messages with suggested remediation
7. WHEN multiple targeting proposals exist THEN the system SHALL allow batch actions where appropriate

### Requirement 6: Real-time Targeting Updates

**User Story:** As a user with active swaps, I want to receive real-time updates when targeting relationships change so that I can respond promptly to new proposals or status changes.

#### Acceptance Criteria

1. WHEN a new targeting proposal is received THEN the system SHALL update the swap display in real-time
2. WHEN a targeting proposal is accepted or rejected THEN the system SHALL immediately reflect the status change
3. WHEN a user retargets their swap THEN the system SHALL update both the source and target swap displays
4. WHEN auction countdowns expire THEN the system SHALL update the display to reflect the new status
5. WHEN targeting relationships are removed THEN the system SHALL immediately update the affected swap displays
6. WHEN real-time updates occur THEN the system SHALL maintain smooth user experience without jarring interface changes
7. WHEN network connectivity issues occur THEN the system SHALL gracefully handle update failures and provide refresh options

### Requirement 7: Performance Optimization for Targeting Data

**User Story:** As a system user, I want the swap targeting display to load quickly and efficiently so that the enhanced targeting information doesn't impact application performance.

#### Acceptance Criteria

1. WHEN loading swap cards with targeting data THEN the system SHALL complete the request within 2 seconds for up to 100 swaps
2. WHEN targeting relationships are complex THEN the system SHALL use optimized database queries to minimize load time
3. WHEN targeting data is frequently accessed THEN the system SHALL implement appropriate caching strategies
4. WHEN targeting information changes THEN the system SHALL efficiently invalidate and update cached data
5. WHEN multiple users access targeting data simultaneously THEN the system SHALL handle concurrent requests without performance degradation
6. WHEN targeting queries are executed THEN the system SHALL use database indexes to optimize query performance
7. WHEN targeting data is large THEN the system SHALL implement pagination and lazy loading where appropriate

### Requirement 8: Targeting History and Audit Trail

**User Story:** As a user, I want to see the history of targeting activities on my swaps so that I can understand the evolution of proposals and make informed decisions.

#### Acceptance Criteria

1. WHEN viewing swap targeting information THEN the system SHALL provide access to targeting history
2. WHEN displaying targeting history THEN the system SHALL show chronological timeline of targeting events
3. WHEN targeting events occur THEN the system SHALL record timestamps, user actions, and status changes
4. WHEN viewing historical data THEN the system SHALL include context about why targeting relationships changed
5. WHEN targeting disputes arise THEN the system SHALL provide complete audit trail for resolution
6. WHEN targeting history is extensive THEN the system SHALL provide filtering and search capabilities
7. WHEN accessing targeting history THEN the system SHALL ensure proper privacy and authorization controls

### Requirement 9: Mobile-Responsive Targeting Display

**User Story:** As a mobile user, I want the targeting information to be clearly displayed and actionable on mobile devices so that I can manage my swap targeting on the go.

#### Acceptance Criteria

1. WHEN viewing targeting information on mobile THEN the system SHALL adapt the layout for smaller screens
2. WHEN displaying multiple targeting proposals THEN the system SHALL use mobile-friendly navigation patterns
3. WHEN targeting actions are available THEN the system SHALL ensure buttons and controls are touch-friendly
4. WHEN targeting details are extensive THEN the system SHALL use collapsible sections and progressive disclosure
5. WHEN targeting status changes THEN the system SHALL provide mobile-appropriate notifications and feedback
6. WHEN network conditions are poor THEN the system SHALL optimize targeting data loading for mobile connections
7. WHEN mobile users perform targeting actions THEN the system SHALL provide confirmation dialogs appropriate for touch interfaces

### Requirement 10: Integration with Existing Swap Features

**User Story:** As a user, I want the targeting display to work seamlessly with existing swap features like auction mode, payment preferences, and booking details so that I have a unified swap management experience.

#### Acceptance Criteria

1. WHEN auction mode is enabled THEN the targeting display SHALL integrate with auction countdown and bidding features
2. WHEN payment preferences are set THEN the targeting information SHALL include payment compatibility indicators
3. WHEN booking details are displayed THEN the targeting information SHALL complement rather than duplicate existing information
4. WHEN swap status changes THEN the targeting display SHALL update consistently with other swap status indicators
5. WHEN notifications are sent THEN the targeting events SHALL integrate with the existing notification system
6. WHEN search and filtering are used THEN the targeting information SHALL be included in search criteria and results
7. WHEN swap analytics are generated THEN the targeting data SHALL contribute to comprehensive swap performance metrics