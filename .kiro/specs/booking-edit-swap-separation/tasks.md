# Implementation Plan

- [x] 1. Create BookingEditForm component for focused booking editing





  - Extract booking-only fields from UnifiedBookingForm component
  - Implement pure booking data validation without swap-related logic
  - Add "Enable Swapping" button that navigates to swap specification page
  - Create BookingEditData interface excluding swap preferences
  - Write unit tests for booking-only validation and form submission
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Create BookingSwapSpecificationPage component for dedicated swap interface





  - Build new page component that loads booking context from URL parameters
  - Integrate existing SwapPreferencesSection and UnifiedSwapEnablement components
  - Implement read-only booking information display for context
  - Add navigation breadcrumbs back to booking management
  - Handle both new swap creation and existing swap management scenarios
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 3. Update BookingCard component with separated action buttons





  - Modify existing BookingCard to have distinct "Edit" and "Enable Swapping" buttons
  - Update onEdit handler to navigate to BookingEditForm modal
  - Add onEnableSwapping handler to navigate to BookingSwapSpecificationPage
  - Ensure proper booking context is passed to both navigation targets
  - Update component props interface to support separated actions
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Implement new routing configuration for separated interfaces





  - Add new route `/bookings/:bookingId/swap-specification` for swap interface
  - Update existing BookingsPage routing to support BookingEditForm modal
  - Implement URL parameter handling for booking context in swap specification
  - Add navigation guards to validate booking ownership and access permissions
  - Create route-based navigation helpers for clean transitions between interfaces
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 5. Separate data models and interfaces for booking vs swap operations





  - Create BookingEditData interface with only booking-related fields
  - Define SwapSpecificationData interface for swap-only operations
  - Update API service methods to handle separated data models
  - Implement BookingWithSwapUpdate interface for combined operations when needed
  - Add TypeScript validation for data model separation
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 6. Update Redux state management for separated concerns





  - Split booking and swap state into separate slices
  - Remove swap-related state from booking slice
  - Create new swap specification state management
  - Update existing thunks to handle separated data operations
  - Implement state preservation during navigation between interfaces
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 7. Implement navigation state preservation and unsaved changes handling





  - Add unsaved changes detection for BookingEditForm
  - Implement user prompts when navigating away with unsaved booking changes
  - Create state preservation mechanism when moving from edit to swap specification
  - Handle browser back/forward navigation appropriately for both interfaces
  - Add URL query parameters for return navigation context
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 8. Create separated validation and error handling systems





  - Implement BookingEditErrors interface for booking-only validation
  - Create SwapSpecificationErrors interface for swap-only validation
  - Update validation utilities to handle separated data models
  - Add error boundary components for each interface type
  - Implement graceful error recovery with clear user guidance
  - _Requirements: 1.7, 1.8, 2.7, 2.8, 3.7, 3.8, 5.5, 5.6, 5.7, 5.8_

- [x] 9. Update BookingsPage integration with separated components





  - Replace UnifiedBookingForm usage with BookingEditForm in BookingsPage
  - Update booking card action handlers to use separated navigation
  - Implement proper modal management for focused booking editing
  - Add integration with new swap specification page navigation
  - Ensure backward compatibility with existing booking management workflows
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 10. Implement visual distinction and UI improvements for separated interfaces





  - Create distinct visual styling for BookingEditForm (booking-focused theme)
  - Design separate visual identity for BookingSwapSpecificationPage (swap-focused theme)
  - Add clear page titles and context indicators for each interface
  - Implement breadcrumb navigation with proper context
  - Create contextual help content specific to each interface type
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 11. Add comprehensive testing suite for separated functionality





  - Write unit tests for BookingEditForm component with booking-only validation
  - Create unit tests for BookingSwapSpecificationPage with swap-specific logic
  - Implement integration tests for navigation between separated interfaces
  - Add E2E tests for complete user workflows (edit-only, edit-then-swap)
  - Create tests for error handling and state preservation during navigation
  - _Requirements: All requirements (comprehensive testing coverage)_

- [x] 12. Implement mobile optimization for separated interfaces





  - Optimize BookingEditForm for mobile touch interactions and screen space
  - Create mobile-responsive layout for BookingSwapSpecificationPage
  - Implement mobile-friendly navigation between separated interfaces
  - Add touch gestures and mobile-specific UI patterns where appropriate
  - Test and optimize performance on mobile devices for both interfaces
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 13. Add accessibility enhancements for separated interfaces





  - Implement proper ARIA labels and roles for BookingEditForm
  - Add keyboard navigation support for BookingSwapSpecificationPage
  - Create screen reader announcements for interface transitions
  - Implement focus management when navigating between separated interfaces
  - Add high contrast support and accessibility compliance for both interfaces
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 14. Create migration strategy and backward compatibility







  - Implement feature flags to control rollout of separated interfaces
  - Create migration path from UnifiedBookingForm to separated components
  - Add backward compatibility support for existing URLs and deep links
  - Implement gradual rollout strategy with monitoring and rollback capability
  - Document migration process and provide user guidance for interface changes
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 15. Update API services and data handling for separated operations





  - Modify booking service methods to handle pure booking data updates
  - Update swap service methods to work with separated swap specification data
  - Implement combined update operations when both booking and swap data change
  - Add proper error handling for partial update failures
  - Create API documentation for separated data model operations
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 16. Implement performance optimizations for separated components





  - Add code splitting for BookingSwapSpecificationPage to reduce initial bundle size
  - Implement lazy loading for swap-related components when not needed
  - Optimize state management to reduce unnecessary re-renders in separated interfaces
  - Add caching strategies for booking data when navigating to swap specification
  - Monitor and optimize loading times for both separated interfaces
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_