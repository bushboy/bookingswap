# Implementation Plan

- [x] 1. Create enhanced data models and types





  - Define UnifiedBookingData interface with integrated swap preferences
  - Create BookingWithSwapInfo interface for listings with swap information
  - Implement InlineProposalData interface for proposal forms
  - Add EnhancedBookingFilters interface with swap-specific filters
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Implement SwapPreferencesSection component





  - Create collapsible section component for swap settings within booking form
  - Implement PaymentTypeSelector for choosing booking/cash options
  - Add CashAmountInput with validation for minimum amounts
  - Create AcceptanceStrategySelector with auction/first-match options
  - Implement AuctionEndDatePicker with one-week-before-event validation
  - Add SwapConditionsInput for additional swap terms
  - _Requirements: 1.1, 1.5_

- [x] 3. Create UnifiedBookingForm component





  - Replace existing BookingForm with integrated booking and swap creation
  - Implement toggle functionality for enabling/disabling swap preferences
  - Add real-time validation for both booking and swap fields
  - Create form submission handler that processes both booking and swap data
  - Implement progressive disclosure for swap settings
  - _Requirements: 1.1, 1.5_

- [x] 4. Enhance BookingCard component with swap integration







  - Add SwapStatusBadge to display swap availability indicators
  - Create SwapInfoPanel for displaying swap terms and status
  - Implement role-based action buttons (owner/browser/proposer)
  - Add visual indicators for payment types and auction status
  - Create compact view for swap information in listings
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2_

- [x] 5. Implement InlineProposalForm component





  - Create inline form that appears within booking listings
  - Implement ProposalTypeSelector for booking vs cash proposals
  - Add BookingSelector for choosing user's available bookings
  - Create CashOfferInput with min/max validation
  - Implement MessageInput for optional proposal messages
  - Add form validation and submission handling
  - _Requirements: 2.2, 4.1, 4.2, 4.3, 4.4_

- [x] 6. Create IntegratedFilterPanel component





  - Enhance existing FilterPanel with swap-specific filters
  - Add SwapAvailabilityToggle for filtering swappable bookings
  - Implement CashAcceptanceToggle for cash-accepting bookings
  - Create AuctionModeToggle for active auction filtering
  - Add FilterSummary component to show active filters
  - Implement filter reset functionality
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. Implement UnifiedBookingService





  - Extend existing BookingService with integrated swap operations
  - Create createBookingWithSwap method for unified creation
  - Implement updateBookingWithSwap for editing with swap preferences
  - Add getBookingsWithSwapInfo method for enhanced listings
  - Create makeInlineProposal method for direct proposal submission
  - Implement applyBrowsingRestrictions for filtering user's own bookings
  - _Requirements: 1.1, 2.2, 3.1, 4.1_

- [x] 8. Enhance Redux store for integrated state management





  - Update bookings slice to include swap information
  - Add ui slice fields for inline proposal states
  - Create enhanced filters state for swap-specific options
  - Implement thunks for unified booking-swap operations
  - Add selectors for filtered booking listings with swap info
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [x] 9. Create validation utilities for unified forms





  - Implement validateUnifiedBookingData function
  - Add validateSwapPreferences for swap-specific validation
  - Create real-time validation hooks for form fields
  - Implement cross-field validation (e.g., auction date vs event date)
  - Add validation error display components
  - _Requirements: 1.1, 1.7, 5.1, 5.2_

- [x] 10. Implement enhanced booking listings page





  - Update BookingsPage to use UnifiedBookingForm
  - Integrate IntegratedFilterPanel for enhanced filtering
  - Replace BookingCard with EnhancedBookingCard
  - Add support for inline proposal forms in listings
  - Implement real-time updates for swap status changes
  - _Requirements: 2.1, 2.2, 3.1, 4.1_

- [x] 11. Create mobile-optimized components








  - Implement MobileProposalForm with BottomSheet layout
  - Create responsive SwapPreferencesSection for small screens
  - Add touch-friendly interactions for booking cards
  - Implement swipe gestures for revealing actions
  - Create mobile-specific filter interface
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 12. Add accessibility enhancements





  - Implement proper ARIA labels for swap-related controls
  - Add keyboard navigation support for inline forms
  - Create screen reader announcements for swap status changes
  - Implement focus management for modal and inline interactions
  - Add high contrast support for swap indicators
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 13. Implement error handling and recovery














  - Create UISimplificationError classes for specific error types
  - Add FormValidationError handling with field-level display
  - Implement InlineProposalError recovery with retry mechanisms
  - Create graceful degradation for filter application failures
  - Add optimistic updates with rollback for network errors
  - _Requirements: 1.8, 4.5, 5.3_

- [x] 14. Create comprehensive test suite








  - Write unit tests for UnifiedBookingForm component
  - Add tests for InlineProposalForm validation and submission
  - Create integration tests for booking-swap workflow
  - Implement E2E tests for complete user journeys
  - Add performance tests for large booking lists with swap info
  - Write accessibility tests for keyboard navigation and screen readers
  - _Requirements: 1.1, 2.2, 4.1, 5.1_

- [x] 15. Update API integration and data fetching





  - Modify booking API calls to include swap information
  - Update proposal creation endpoints for inline submissions
  - Implement real-time updates for swap status changes
  - Add caching strategies for booking-swap data
  - Create optimized queries for filtered listings
  - _Requirements: 2.1, 3.1, 4.1, 5.1_

- [x] 16. Integrate with existing pages and routing





  - Update BrowsePage to use enhanced booking listings
  - Modify DashboardPage to show unified booking-swap information
  - Update navigation to reflect simplified workflow
  - Ensure backward compatibility with existing bookings
  - Add migration support for existing swap data
  - _Requirements: 1.1, 2.1, 3.1, 6.1_