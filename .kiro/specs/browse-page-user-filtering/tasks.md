# Implementation Plan

- [x] 1. Enhance proposal service with user proposal status methods





  - Add getUserProposals method to fetch all proposals for a specific user
  - Add getProposalStatus method to check proposal status for a specific booking and user
  - Update existing createProposal method to return proper proposal status
  - Add proper error handling for 404 cases when no proposals exist
  - _Requirements: 3.3, 4.1, 4.2, 4.3_

- [x] 2. Enhance booking service with user-aware filtering





  - Add getBookingsExcludingUser method to filter out user's own bookings
  - Add getBrowseBookings method that conditionally applies user filtering
  - Maintain backward compatibility with existing getAllBookings method
  - Add proper error handling and response validation
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Create useBrowseData custom hook for data management





  - Implement hook that fetches bookings and user proposals in parallel for authenticated users
  - Add filtering logic to exclude user's own bookings when authenticated
  - Map proposal status to booking objects (pending, rejected, accepted, none)
  - Calculate canPropose flag based on proposal status (false for pending, true for others)
  - Add loading, error, and refresh functionality
  - _Requirements: 1.1, 1.2, 1.4, 3.3, 4.1, 4.2, 4.3_

- [x] 4. Create BookingWithProposalStatus interface and types





  - Define BookingWithProposalStatus interface extending base Booking
  - Add userProposalStatus, canPropose, and isOwnBooking properties
  - Create ProposalInteractionResult interface for handling user actions
  - Add proper TypeScript types for all proposal status values
  - _Requirements: 3.3, 4.1, 4.2, 4.3, 5.1, 5.2_

- [x] 5. Update BookingCard component with proposal status display





  - Add conditional rendering for propose buttons based on proposal status
  - Implement getActionButton method that shows appropriate button text and state
  - Add proposal status indicator for pending, accepted, and rejected proposals
  - Handle disabled states for pending and accepted proposals
  - Show "Propose Again" for rejected proposals and regular "Propose" for no proposals
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_

- [x] 6. Enhance BrowsePage with intelligent proposal handling





  - Replace existing data fetching with useBrowseData hook
  - Implement handleProposalAttempt method with ownership and duplicate proposal checks
  - Add message display for blocked proposal attempts (own booking, existing proposal)
  - Implement automatic page refresh after blocked attempts
  - Add proper authentication redirect handling for unauthenticated users
  - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [x] 7. Add MessageBanner component for user feedback





  - Create reusable MessageBanner component for displaying temporary messages
  - Add support for different message types (info, warning, error, success)
  - Implement auto-dismiss functionality with configurable timeout
  - Add manual dismiss option with close button
  - Style component to be visually distinct and accessible
  - _Requirements: 2.2, 2.4, 3.2_

- [x] 8. Update proposal creation flow to refresh browse data





  - Modify ProposalModal success handler to trigger browse data refresh
  - Ensure proposal status is immediately updated in the UI after successful creation
  - Add error handling for proposal creation failures
  - Update booking card display to reflect new proposal status without page reload
  - _Requirements: 3.3, 4.1_

- [ ]* 9. Add comprehensive error handling and recovery
  - Implement error boundaries for proposal-related operations
  - Add retry mechanisms for network failures during data fetching
  - Create fallback UI states for when proposal status cannot be determined
  - Add logging for debugging proposal status issues
  - _Requirements: 1.4, 2.4, 3.3_

- [ ]* 10. Write unit tests for proposal status logic
  - Test useBrowseData hook with various authentication and proposal scenarios
  - Test BookingCard component rendering with different proposal statuses
  - Test proposal interaction logic for own bookings and duplicate proposals
  - Test error handling and loading states in data fetching
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [ ]* 11. Add integration tests for browse page filtering
  - Test complete flow from unauthenticated to authenticated browsing
  - Test proposal attempt blocking and message display
  - Test data refresh after authentication status changes
  - Test proposal status updates after successful proposal creation
  - _Requirements: 1.2, 1.4, 2.3, 3.2_