# Requirements Document

## Introduction

The booking cards across the platform currently display a "Swap Details" section that often shows empty or minimal information, creating a poor user experience. Users need to see meaningful and comprehensive swap information wherever swaps are displayed - in My Bookings, Browse pages, and any other location where booking cards with swap information appear. This enhancement will improve the clarity and usefulness of swap information display throughout the platform.

## Requirements

### Requirement 1: Enhanced Swap Details Display

**User Story:** As a platform user, I want to see meaningful swap information in all booking cards that have swaps so that I can quickly understand the status and activity of swap proposals wherever I encounter them.

#### Acceptance Criteria

1. WHEN a booking has an active swap THEN the system SHALL display comprehensive swap details including proposal count, payment types accepted, minimum cash amounts, and time remaining for auctions
2. WHEN a booking has received proposals THEN the system SHALL show proposal summaries with offer types, amounts, and status indicators
3. WHEN a booking has no swap activity but swap is enabled THEN the system SHALL show clear swap terms and availability status
4. WHEN swap details are displayed THEN the system SHALL include current swap status, acceptance strategy, and any special conditions
5. IF a swap has expired or completed THEN the system SHALL clearly indicate the final status and outcome
6. WHEN multiple proposals exist THEN the system SHALL show total count and highlight the best or most recent proposals
7. WHEN swap terms include cash minimums THEN the system SHALL display these amounts prominently with currency formatting
8. IF swap information is loading THEN the system SHALL show appropriate loading indicators in the swap details section
9. WHEN auction mode is active THEN the system SHALL display countdown timers and current bid/proposal status
10. IF no swap exists for a booking THEN the system SHALL either hide the swap details section entirely or show a clear "Swap not enabled" message