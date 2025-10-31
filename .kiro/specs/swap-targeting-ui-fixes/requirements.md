# Requirements Document

## Introduction

This feature addresses critical display issues in the swap targeting functionality where swap relationships are not being shown correctly in the user interface. Despite the swap_targets table being populated correctly in the backend, users are experiencing problems with:
- Only one side of swap relationships being displayed
- Missing indication of whether a swap is targeted or targeting another swap
- Swaps and targets not showing correctly despite proper backend implementation

The goal is to fix the UI display logic to properly show bidirectional swap targeting relationships and provide clear visual indicators of targeting status.

## Requirements

### Requirement 1

**User Story:** As a user viewing swaps, I want to see all targeting relationships for each swap, so that I can understand the complete targeting context.

#### Acceptance Criteria

1. WHEN a user views a swap that targets other swaps THEN the system SHALL display all targeted swaps in the UI
2. WHEN a user views a swap that is targeted by other swaps THEN the system SHALL display all swaps that target it
3. WHEN a swap has both incoming and outgoing targeting relationships THEN the system SHALL display both types of relationships clearly

### Requirement 2

**User Story:** As a user, I want to clearly distinguish between swaps I'm targeting and swaps targeting me, so that I can understand the direction of targeting relationships.

#### Acceptance Criteria

1. WHEN displaying targeting relationships THEN the system SHALL provide visual indicators to distinguish between "targeting" and "targeted by" relationships
2. WHEN a swap targets another swap THEN the system SHALL show an outgoing targeting indicator
3. WHEN a swap is targeted by another swap THEN the system SHALL show an incoming targeting indicator
4. IF a swap has no targeting relationships THEN the system SHALL display an appropriate empty state

### Requirement 3

**User Story:** As a user, I want the swap targeting display to be consistent across all views, so that I have a reliable understanding of targeting relationships.

#### Acceptance Criteria

1. WHEN viewing swaps in different UI contexts THEN the system SHALL display targeting relationships consistently
2. WHEN targeting data changes in the backend THEN the system SHALL update the UI display immediately
3. WHEN the UI queries targeting data THEN the system SHALL retrieve both directions of targeting relationships
4. IF there are errors loading targeting data THEN the system SHALL display appropriate error states without breaking the UI

### Requirement 4

**User Story:** As a developer, I want the targeting display logic to properly handle bidirectional relationships, so that no targeting connections are missed in the UI.

#### Acceptance Criteria

1. WHEN querying targeting relationships THEN the system SHALL fetch both where the swap is the source and where it is the target
2. WHEN processing targeting data THEN the system SHALL merge and deduplicate relationships from both directions
3. WHEN displaying targeting counts THEN the system SHALL accurately reflect the total number of unique targeting relationships
4. IF targeting data is inconsistent THEN the system SHALL handle gracefully without displaying duplicate or incorrect relationships