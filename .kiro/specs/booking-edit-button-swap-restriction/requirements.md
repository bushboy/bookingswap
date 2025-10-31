# Requirements Document

## Introduction

This feature addresses the booking card UI behavior when a swap is already defined for a booking. Currently, when a booking has an active swap, the "Create Swap" button is correctly disabled, but the "Edit" button remains available, which can lead to confusion and potential data inconsistency. The system should prevent editing of bookings that have active swaps and instead provide a "View" button that displays additional booking details without allowing modifications.

## Glossary

- **BookingCard**: The UI component that displays booking information and action buttons
- **ActiveSwap**: A swap proposal that is currently configured and available for the booking
- **EditButton**: The button that allows users to modify booking details
- **ViewButton**: A read-only button that displays detailed booking information
- **SwapInfo**: Data structure containing swap configuration and status information

## Requirements

### Requirement 1: Edit Button Restriction with Active Swaps

**User Story:** As a booking owner, I want the Edit button to be disabled when my booking has an active swap so that I cannot accidentally modify booking details that could affect existing swap proposals.

#### Acceptance Criteria

1. WHEN a booking has an active swap defined, THE BookingCard SHALL disable the Edit button
2. WHEN the Edit button is disabled due to active swap, THE BookingCard SHALL display a tooltip explaining "Cannot edit booking with active swap"
3. WHEN a booking has no active swap, THE BookingCard SHALL enable the Edit button normally
4. WHEN a swap is cancelled or completed, THE BookingCard SHALL re-enable the Edit button
5. WHEN the Edit button is disabled, THE BookingCard SHALL apply visual styling to indicate the disabled state

### Requirement 2: View Button Implementation

**User Story:** As a booking owner, I want a View button available when my booking has an active swap so that I can see detailed booking information without being able to modify it.

#### Acceptance Criteria

1. WHEN a booking has an active swap defined, THE BookingCard SHALL display a View button instead of or alongside the disabled Edit button
2. WHEN the View button is clicked, THE BookingCard SHALL trigger the onViewDetails callback with booking data
3. WHEN the View button is displayed, THE BookingCard SHALL use appropriate styling to indicate read-only access
4. WHEN no onViewDetails callback is provided, THE BookingCard SHALL not display the View button
5. WHEN the View button is available, THE BookingCard SHALL include a tooltip explaining "View booking details (read-only)"

### Requirement 3: Conditional View Button Display

**User Story:** As a platform user, I want the View button to only appear when there is additional booking detail functionality available so that the interface remains clean and purposeful.

#### Acceptance Criteria

1. WHEN the onViewDetails callback is provided and booking has active swap, THE BookingCard SHALL display the View button
2. WHEN the onViewDetails callback is not provided, THE BookingCard SHALL not display the View button regardless of swap status
3. WHEN a booking has no active swap, THE BookingCard SHALL prioritize the Edit button over the View button
4. WHEN both Edit and View functionality are available (no active swap), THE BookingCard SHALL display only the Edit button
5. WHEN the View button is displayed, THE BookingCard SHALL position it appropriately within the action button layout

### Requirement 4: Active Swap Detection Logic

**User Story:** As a system administrator, I want accurate detection of active swaps so that the UI correctly reflects the booking's swap status and applies appropriate restrictions.

#### Acceptance Criteria

1. WHEN SwapInfo exists and has configured payment types, THE BookingCard SHALL consider the swap as active
2. WHEN SwapInfo exists and has an acceptance strategy defined, THE BookingCard SHALL consider the swap as active
3. WHEN SwapInfo exists but lacks essential configuration, THE BookingCard SHALL not consider the swap as active
4. WHEN SwapInfo indicates active proposals exist, THE BookingCard SHALL consider the swap as active
5. WHEN SwapInfo is undefined or null, THE BookingCard SHALL consider no active swap exists

### Requirement 5: Consistent Button State Management

**User Story:** As a booking owner, I want consistent button behavior across all booking cards so that I have predictable interactions regardless of where I encounter my bookings.

#### Acceptance Criteria

1. WHEN multiple BookingCard instances display the same booking, THE BookingCard SHALL show consistent button states across all instances
2. WHEN swap status changes, THE BookingCard SHALL update button states immediately without requiring page refresh
3. WHEN button states change, THE BookingCard SHALL maintain accessibility attributes appropriately
4. WHEN using keyboard navigation, THE BookingCard SHALL ensure disabled buttons are properly skipped in tab order
5. WHEN screen readers are used, THE BookingCard SHALL announce button state changes appropriately

### Requirement 6: Visual Feedback and User Communication

**User Story:** As a booking owner, I want clear visual feedback about why the Edit button is disabled so that I understand the system's behavior and know what actions are available.

#### Acceptance Criteria

1. WHEN the Edit button is disabled due to active swap, THE BookingCard SHALL apply distinct visual styling to indicate the disabled state
2. WHEN hovering over a disabled Edit button, THE BookingCard SHALL display a tooltip explaining the restriction
3. WHEN the View button is available, THE BookingCard SHALL use styling that clearly indicates read-only functionality
4. WHEN button states change, THE BookingCard SHALL provide smooth visual transitions to avoid jarring user experience
5. WHEN multiple action buttons are present, THE BookingCard SHALL maintain consistent visual hierarchy and spacing

### Requirement 7: Backward Compatibility and Integration

**User Story:** As a platform developer, I want the button restriction changes to integrate seamlessly with existing booking management workflows so that no existing functionality is broken.

#### Acceptance Criteria

1. WHEN existing onEdit callbacks are provided, THE BookingCard SHALL continue to support them for bookings without active swaps
2. WHEN existing onViewDetails callbacks are provided, THE BookingCard SHALL utilize them appropriately for the View button
3. WHEN the BookingCard is used in different contexts (lists, grids, modals), THE BookingCard SHALL maintain consistent button behavior
4. WHEN other booking actions are available (delete, manage swap), THE BookingCard SHALL coordinate button states appropriately
5. WHEN the component receives prop updates, THE BookingCard SHALL re-evaluate button states and update the UI accordingly

### Requirement 8: Error Handling and Edge Cases

**User Story:** As a platform user, I want the booking card to handle edge cases gracefully so that I always have a functional interface even when data is incomplete or inconsistent.

#### Acceptance Criteria

1. WHEN SwapInfo data is malformed or incomplete, THE BookingCard SHALL default to allowing edit functionality
2. WHEN callback functions are undefined or throw errors, THE BookingCard SHALL handle these gracefully without breaking the UI
3. WHEN booking data is missing required fields, THE BookingCard SHALL still apply appropriate button restrictions based on available swap information
4. WHEN network issues prevent swap status updates, THE BookingCard SHALL maintain the last known valid state
5. WHEN rapid state changes occur, THE BookingCard SHALL debounce updates to prevent UI flickering