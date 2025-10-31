# Implementation Plan

- [x] 1. Fix bidirectional targeting query in SwapTargetingRepository





  - Modify the `getTargetingDataForUserSwaps` method to use the enhanced SQL query that properly captures both incoming and outgoing relationships
  - Add DISTINCT clauses to prevent duplicate relationships in the union queries
  - Ensure the query returns clear direction indicators ('incoming' vs 'outgoing')
  - Add proper error handling for query failures
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2_

- [x] 2. Implement data transformation logic for bidirectional relationships





  - Create `TargetingDataTransformer` class with methods to process query results into display format
  - Implement `transformBidirectionalData` method that groups results by swap ID and direction
  - Add `generateTargetingIndicators` method to create visual indicators based on targeting counts
  - Ensure proper handling of both swap_targets table data and regular proposal data
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 4.5_

- [x] 3. Update SwapProposalService to use fixed targeting data





  - Modify `getUserSwapsWithTargeting` method to use the new transformer logic
  - Ensure the service properly merges targeting data with existing swap card data
  - Add validation to check for data consistency issues
  - Implement fallback handling when targeting data is unavailable
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Create enhanced targeting display components





  - Build `TargetingIndicators` component to show visual badges for targeting status
  - Implement `TargetingDetails` component for expanded targeting information
  - Create `IncomingTargetDisplay` and `OutgoingTargetDisplay` sub-components
  - Add proper styling and icons to distinguish between targeting directions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Implement targeting validation and error handling





  - Create `TargetingDisplayErrorHandler` class for graceful error recovery
  - Add `validateTargetingConsistency` method to check for data issues
  - Implement `handlePartialTargetingData` for cases with missing information
  - Add user-friendly error messages and fallback displays
  - _Requirements: 3.5, 3.6_

- [x] 6. Add performance optimizations for targeting queries









  - Create database indexes for bidirectional targeting lookups
  - Implement caching strategy for frequently accessed targeting data
  - Add query result pagination for users with many targeting relationships
  - Optimize frontend re-rendering with React.memo and proper dependencies
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 7. Write comprehensive tests for targeting display fixes
  - Create unit tests for `TargetingDataTransformer` methods
  - Add integration tests for bidirectional relationship display
  - Test error handling scenarios with missing or invalid data
  - Verify performance with large datasets and concurrent users
  - _Requirements: All requirements validation_

- [x] 8. Update SwapCard component to display targeting information





  - Integrate `TargetingIndicators` component into the swap card layout
  - Add conditional rendering for targeting details based on user interaction
  - Implement proper state management for expanded/collapsed targeting views
  - Ensure mobile-responsive design for targeting information display
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 9.3, 9.4_

- [x] 9. Implement real-time updates for targeting relationships





  - Add WebSocket event handlers for targeting status changes
  - Update targeting display when new proposals are received or status changes
  - Implement optimistic updates for targeting actions
  - Add proper error handling and retry logic for failed updates
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 10. Add targeting action integration to swap cards





  - Implement action buttons for accepting/rejecting incoming targets
  - Add retargeting and cancel targeting options for outgoing targets
  - Create confirmation dialogs for targeting actions
  - Integrate with existing SwapTargetingService for action processing
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_