# Requirements Document

## Introduction

This feature addresses comprehensive data display issues in the swap card interface where users are seeing incorrect, incomplete, or confusing information. The problems include unknown values in targeting displays, an unnecessary "Offline" label, a non-functional "proposals from others" section that always shows "No Proposals", $NaN values in swap details popups, and insufficient proposal details for users to make accept/reject decisions. All required data exists in the database but is not being properly retrieved, processed, or displayed.

## Requirements

### Requirement 1: Remove Offline Label and Fix Status Display

**User Story:** As a user viewing my swap cards, I want to see clear and relevant status information without confusing or unnecessary labels.

#### Acceptance Criteria

1. WHEN displaying swap cards THEN the system SHALL NOT show an "Offline" label
2. WHEN a swap has a status THEN the system SHALL display only meaningful status indicators
3. WHEN hover interactions are needed THEN they SHALL provide useful information about the swap state
4. WHEN status information is unavailable THEN the system SHALL show appropriate fallback content

### Requirement 2: Fix Targeting Display and Remove Unknown Values

**User Story:** As a user viewing targeting information, I want to see accurate data without "unknown" or placeholder values since all data exists in the database.

#### Acceptance Criteria

1. WHEN displaying targeting information THEN the system SHALL show actual values from the database
2. WHEN targeting relationships exist THEN the system SHALL display complete targeting details including user names and swap information
3. WHEN no targeting data exists THEN the system SHALL show clear "no targeting" states instead of "unknown"
4. WHEN data retrieval fails THEN the system SHALL retry and show appropriate error states

### Requirement 3: Replace Non-Functional Proposals Section

**User Story:** As a user, I want the "proposals from others" section to either work correctly or be replaced with functional targeting information.

#### Acceptance Criteria

1. WHEN the "proposals from others" section consistently shows "No Proposals" THEN the system SHALL remove or replace this section
2. WHEN targeting count information is available at the top THEN the system SHALL use this as the primary proposal indicator
3. WHEN proposal information is displayed THEN it SHALL accurately reflect the current database state
4. WHEN multiple targeting relationships exist THEN the system SHALL show the correct count and details

### Requirement 4: Fix Swap Details Popup Display Issues

**User Story:** As a user viewing swap details in the popup, I want to see accurate financial information without $NaN values so that I can understand the swap terms.

#### Acceptance Criteria

1. WHEN opening a swap details popup THEN the system SHALL display accurate monetary values without $NaN
2. WHEN financial calculations are performed THEN the system SHALL handle null, undefined, or invalid values gracefully
3. WHEN swap pricing information exists THEN it SHALL be formatted correctly with proper currency symbols
4. WHEN pricing data is unavailable THEN the system SHALL show "Price not available" instead of $NaN

### Requirement 5: Provide Complete Proposal Details for Decision Making

**User Story:** As a user receiving targeting proposals, I want to see all pertinent details about each proposal so that I can make informed accept/reject decisions.

#### Acceptance Criteria

1. WHEN viewing a targeting proposal THEN the system SHALL display the proposer's name, swap details, and proposed terms
2. WHEN multiple proposals exist THEN the system SHALL show each proposal with complete information
3. WHEN proposal details include pricing THEN the system SHALL show accurate financial information
4. WHEN viewing proposals THEN the system SHALL provide clear accept/reject action buttons with all necessary context
5. WHEN proposal information is incomplete THEN the system SHALL fetch missing details from the database

### Requirement 6: Ensure Data Consistency Across All Display Elements

**User Story:** As a user, I want all swap card information to be consistent and accurate across all display elements so that I can trust the information shown.

#### Acceptance Criteria

1. WHEN displaying swap information THEN all counts, names, and details SHALL derive from the same current database state
2. WHEN targeting relationships exist THEN all display elements SHALL show consistent information
3. WHEN data is refreshed THEN all display elements SHALL update simultaneously
4. WHEN there are data discrepancies THEN the system SHALL log the inconsistency and use the most recent database state