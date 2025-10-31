# Requirements Document

## Introduction

This feature addresses the issue where users viewing their own swaps on the /swaps page cannot see important booking details like location, dates, and amounts. Currently, the user swaps endpoint only returns basic swap information with booking IDs, but the frontend needs the actual booking details to display meaningful information to users. This creates a poor user experience where users see incomplete information about their own swaps, while the browse swaps page (for viewing other users' swaps) correctly displays all booking details.

## Requirements

### Requirement 1

**User Story:** As a user viewing my swaps on the /swaps page, I want to see the complete booking details (location, dates, and amounts) for both my booking and the other party's booking, so that I can make informed decisions about my swap proposals.

#### Acceptance Criteria

1. WHEN a user accesses the /swaps endpoint THEN the system SHALL return swap data enriched with complete booking details for both source and target bookings
2. WHEN displaying swap information THEN the system SHALL include location (city, country), date range (check-in and check-out dates), and monetary amounts (original price, swap value) for each booking
3. WHEN a booking is referenced in a swap THEN the system SHALL fetch and include the booking's title, location details, date range, and pricing information
4. WHEN the booking details cannot be retrieved THEN the system SHALL gracefully handle the error and display appropriate fallback information

### Requirement 2

**User Story:** As a user, I want the /swaps page to display booking information consistently with how it appears on the browse swaps page, so that I have a uniform experience across the application.

#### Acceptance Criteria

1. WHEN viewing my swaps THEN the booking details format SHALL match the format used in the browse swaps functionality
2. WHEN booking location is displayed THEN it SHALL show as "City, Country" format consistently
3. WHEN date ranges are displayed THEN they SHALL show as "MM/DD/YYYY - MM/DD/YYYY" format consistently
4. WHEN monetary amounts are displayed THEN they SHALL be formatted with proper currency symbols and thousand separators

### Requirement 3

**User Story:** As a developer, I want the user swaps endpoint to efficiently retrieve booking details without causing performance issues, so that the application remains responsive.

#### Acceptance Criteria

1. WHEN fetching user swaps with booking details THEN the system SHALL use optimized database queries to minimize the number of database calls
2. WHEN multiple swaps reference the same booking THEN the system SHALL avoid duplicate booking data retrieval
3. WHEN booking details are unavailable THEN the system SHALL not fail the entire request but provide partial data with appropriate indicators
4. WHEN the enhanced endpoint is called THEN the response time SHALL not exceed 2 seconds for up to 100 swaps