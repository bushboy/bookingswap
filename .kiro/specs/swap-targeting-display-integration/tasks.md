# Implementation Plan

- [x] 1. Extend shared types for enhanced swap card data with targeting information





  - Create EnhancedSwapCardData interface extending existing SwapCardData
  - Add IncomingTargetInfo and OutgoingTargetInfo interfaces
  - Define TargetingRestriction and TargetingCapabilities types
  - Update existing SwapCardData to maintain backward compatibility
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 1.1 Create enhanced swap card data types


  - Add EnhancedSwapCardData interface with targeting property
  - Define IncomingTargetInfo interface for swaps targeting user's swaps
  - Create OutgoingTargetInfo interface for user's swaps targeting others
  - Add TargetingRestriction interface for targeting limitations
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 1.2 Define targeting capability and status types


  - Create TargetingCapabilities interface for targeting permissions
  - Add SwapTargetingRestrictions type for various restriction scenarios
  - Define TargetingDisplayData interface for service layer data transformation
  - Ensure all types support auction mode and one-for-one mode distinctions
  - _Requirements: 3.4, 4.1, 4.2, 4.3, 4.4_

- [ ]* 1.3 Write unit tests for new type definitions
  - Test type compatibility and backward compatibility
  - Verify interface completeness for all targeting scenarios
  - Test type safety with TypeScript compiler
  - Validate type definitions against existing codebase
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Enhance SwapRepository with targeting data queries





  - Create optimized database query to fetch swap cards with targeting data
  - Add methods to retrieve incoming and outgoing targeting relationships
  - Implement targeting restrictions query for authorization checks
  - Add database indexes for optimal targeting query performance
  - _Requirements: 3.1, 3.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 2.1 Create enhanced swap cards database query


  - Write complex SQL query joining swaps, swap_targets, bookings, and users tables
  - Optimize query to fetch all targeting data in single database round trip
  - Include both incoming targets (others targeting user's swaps) and outgoing targets (user targeting others)
  - Add proper LEFT JOINs to handle swaps without targeting relationships
  - _Requirements: 3.1, 3.2, 7.1, 7.2_

- [x] 2.2 Implement targeting data repository methods


  - Add getTargetingDataForUserSwaps method to SwapTargetingRepository
  - Create getIncomingTargetsForSwaps method for incoming targeting relationships
  - Implement getOutgoingTargetsForSwaps method for outgoing targeting relationships
  - Add getTargetingRestrictionsForSwaps method for authorization and capability checks
  - _Requirements: 3.1, 3.2, 3.3, 7.3, 7.4_

- [x] 2.3 Add database indexes for targeting query performance


  - Create composite indexes on swap_targets table for efficient targeting queries
  - Add indexes on swaps table for owner-based queries with status filtering
  - Create indexes on swap_proposals table for efficient proposal lookups
  - Implement partial indexes for active targeting relationships only
  - _Requirements: 7.1, 7.2, 7.5, 7.6_

- [ ]* 2.4 Write repository tests for targeting queries
  - Test targeting data retrieval accuracy with various user scenarios
  - Verify query performance with large datasets
  - Test database constraint enforcement and data integrity
  - Validate proper handling of missing or invalid targeting data
  - _Requirements: 3.1, 3.2, 7.1, 7.2, 7.3, 7.4_

- [x] 3. Enhance SwapProposalService to include targeting data





  - Modify getUserSwapsWithProposals to include targeting information
  - Create data transformation methods to merge targeting data with swap cards
  - Implement targeting capability assessment for each swap
  - Add error handling and fallback mechanisms for targeting data failures
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [x] 3.1 Create getUserSwapsWithTargeting method


  - Extend existing getUserSwapsWithProposals to include targeting data
  - Fetch targeting relationships using enhanced repository methods
  - Merge targeting data with existing swap card structure
  - Maintain backward compatibility with existing SwapCardData consumers
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2_

- [x] 3.2 Implement targeting data transformation logic


  - Create mergeTargetingWithSwapCards method to combine data sources
  - Transform database rows to IncomingTargetInfo and OutgoingTargetInfo objects
  - Implement targeting capability assessment based on swap status and auction mode
  - Add targeting restriction evaluation for each swap
  - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 4.1, 4.2_

- [x] 3.3 Add targeting error handling and fallback mechanisms


  - Implement graceful degradation when targeting data is unavailable
  - Add retry logic for transient targeting query failures
  - Create fallback to basic SwapCardData when targeting enhancement fails
  - Log targeting data issues for monitoring and debugging
  - _Requirements: 3.4, 3.5, 7.1, 7.2_

- [ ]* 3.4 Write service tests for targeting data integration
  - Test targeting data merging with various swap and targeting scenarios
  - Verify error handling and fallback mechanisms
  - Test performance with large numbers of swaps and targeting relationships
  - Validate data transformation accuracy and completeness
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [x] 4. Update SwapController to serve enhanced swap card data





  - Modify getUserSwaps endpoint to use enhanced targeting data
  - Add backward compatibility support for existing API consumers
  - Implement proper error handling for targeting data failures
  - Add performance monitoring for enhanced swap card queries
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 7.1, 7.2_

- [x] 4.1 Update getUserSwaps endpoint implementation


  - Replace getUserSwapsWithProposals call with getUserSwapsWithTargeting
  - Ensure response format maintains backward compatibility
  - Add conditional targeting data inclusion based on client capabilities
  - Implement proper HTTP status codes for targeting data issues
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2_

- [x] 4.2 Add targeting-specific error handling to controller


  - Handle TargetingDisplayError exceptions with appropriate HTTP responses
  - Implement fallback responses when targeting data is partially available
  - Add detailed error logging for targeting data issues
  - Create user-friendly error messages for targeting failures
  - _Requirements: 3.4, 3.5, 7.1, 7.2_

- [x] 4.3 Implement performance monitoring for enhanced endpoint


  - Add timing metrics for targeting data queries
  - Monitor targeting data payload sizes and response times
  - Track targeting data availability and error rates
  - Create alerts for targeting performance degradation
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ]* 4.4 Write controller tests for enhanced swap cards endpoint
  - Test endpoint response format with and without targeting data
  - Verify backward compatibility with existing API consumers
  - Test error handling scenarios for targeting data failures
  - Validate performance monitoring and metrics collection
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 7.1, 7.2_

- [x] 5. Create frontend targeting display components





  - Build TargetingIndicator component for visual targeting status
  - Create IncomingTargetsDisplay component for showing targeting proposals
  - Implement OutgoingTargetDisplay component for current targeting status
  - Add TargetingActions component for targeting management actions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 5.1 Build TargetingIndicator component


  - Create visual indicators for incoming and outgoing targeting status
  - Implement different indicator styles for auction mode vs one-for-one mode
  - Add targeting count badges and status icons
  - Support responsive design for mobile and desktop displays
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.1, 9.2, 9.3, 9.4_

- [x] 5.2 Create IncomingTargetsDisplay component


  - Display list of swaps targeting the current user's swap
  - Show targeting user information and swap details
  - Implement accept/reject actions for targeting proposals
  - Add auction countdown timers for auction mode swaps
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3, 5.4_

- [x] 5.3 Implement OutgoingTargetDisplay component


  - Show current targeting status for user's swaps
  - Display target swap details and owner information
  - Provide retargeting and cancel targeting action buttons
  - Add targeting proposal status indicators and timestamps
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1, 5.2_

- [x] 5.4 Add TargetingActions component


  - Implement targeting action buttons (target, retarget, cancel)
  - Add confirmation dialogs for targeting actions
  - Create targeting browsing interface for finding target swaps
  - Implement proper authorization checks for targeting actions
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ]* 5.5 Write component tests for targeting display
  - Test targeting indicator rendering with various targeting states
  - Verify targeting action functionality and user interactions
  - Test responsive design and mobile compatibility
  - Validate accessibility features for targeting components
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 9.1, 9.2, 9.3, 9.4_

- [x] 6. Integrate targeting display with existing swap cards UI





  - Update SwapCard component to display targeting information
  - Modify swap list components to show targeting indicators
  - Integrate targeting actions with existing swap management UI
  - Ensure targeting display works with existing filtering and sorting
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 10.1, 10.2, 10.3, 10.4_

- [x] 6.1 Update SwapCard component with targeting display


  - Add targeting information section to existing swap card layout
  - Integrate TargetingIndicator component into swap card header
  - Include IncomingTargetsDisplay and OutgoingTargetDisplay in card body
  - Maintain existing swap card functionality and styling
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 10.1, 10.2_

- [x] 6.2 Integrate targeting actions with swap management UI


  - Add targeting action buttons to swap card action areas
  - Integrate TargetingActions component with existing action menus
  - Ensure targeting actions work with existing swap status management
  - Add targeting-specific navigation and routing
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 10.3, 10.4_

- [x] 6.3 Update swap filtering and sorting for targeting data


  - Add targeting-based filter options (has incoming targets, is targeting others)
  - Include targeting status in swap sorting options
  - Ensure targeting data is included in search functionality
  - Update pagination to work with enhanced swap card data
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 10.5, 10.6, 10.7_

- [ ]* 6.4 Write integration tests for targeting UI components
  - Test complete targeting workflow from display to action execution
  - Verify targeting data updates in real-time
  - Test targeting UI with various user roles and permissions
  - Validate targeting display performance with large datasets
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4_

- [x] 7. Implement real-time targeting updates





  - Add WebSocket event handlers for targeting status changes
  - Create real-time UI updates when targeting relationships change
  - Implement optimistic updates for targeting actions
  - Add connection management for targeting-related events
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 7.1 Add WebSocket event handlers for targeting events


  - Create event handlers for targeting proposal creation and updates
  - Implement handlers for targeting acceptance and rejection events
  - Add handlers for targeting retargeting and cancellation events
  - Create auction countdown update handlers for auction mode swaps
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 7.2 Implement real-time UI updates for targeting changes


  - Update targeting indicators when targeting status changes
  - Refresh targeting displays when new proposals are received
  - Update targeting action availability based on real-time status
  - Implement smooth UI transitions for targeting state changes
  - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6_

- [x] 7.3 Add optimistic updates for targeting actions


  - Implement immediate UI feedback for targeting actions
  - Add rollback mechanisms for failed targeting operations
  - Create loading states and progress indicators for targeting actions
  - Implement error recovery and retry mechanisms for targeting updates
  - _Requirements: 6.5, 6.6, 6.7_

- [ ]* 7.4 Write tests for real-time targeting updates
  - Test WebSocket event handling for various targeting scenarios
  - Verify real-time UI updates and state synchronization
  - Test optimistic updates and error recovery mechanisms
  - Validate connection management and reconnection handling
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 8. Add targeting history and audit trail display





  - Create TargetingHistory component for displaying targeting timeline
  - Implement targeting event filtering and search functionality
  - Add targeting history modal or dedicated page
  - Integrate targeting history with existing swap history features
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 8.1 Create TargetingHistory component


  - Build timeline component for displaying targeting events chronologically
  - Show targeting actions, status changes, and user interactions
  - Include contextual information about targeting decisions
  - Add expandable details for complex targeting events
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8.2 Implement targeting history data retrieval


  - Add API endpoint for fetching targeting history for specific swaps
  - Create service methods for targeting history data transformation
  - Implement pagination for extensive targeting history
  - Add filtering options for targeting history (date range, event type, users)
  - _Requirements: 8.1, 8.2, 8.5, 8.6_

- [x] 8.3 Integrate targeting history with swap management UI


  - Add targeting history access from swap cards and detail views
  - Create targeting history modal or dedicated history page
  - Integrate with existing swap history and audit features
  - Ensure proper authorization for targeting history access
  - _Requirements: 8.1, 8.2, 8.7, 10.1, 10.2_

- [ ]* 8.4 Write tests for targeting history functionality
  - Test targeting history data accuracy and completeness
  - Verify targeting history filtering and search functionality
  - Test targeting history authorization and privacy controls
  - Validate targeting history performance with large datasets
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 9. Implement mobile-responsive targeting display





  - Adapt targeting components for mobile screen sizes
  - Create mobile-friendly targeting action interfaces
  - Implement touch-friendly targeting controls and gestures
  - Add mobile-specific targeting notifications and feedback
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 9.1 Create mobile-responsive targeting layouts


  - Adapt targeting indicators for smaller screens
  - Create collapsible targeting information sections
  - Implement mobile-friendly targeting proposal displays
  - Add responsive navigation for targeting features
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 9.2 Implement mobile-friendly targeting actions


  - Create touch-friendly targeting action buttons
  - Add swipe gestures for targeting proposal management
  - Implement mobile-appropriate confirmation dialogs
  - Create mobile-optimized targeting browsing interface
  - _Requirements: 9.3, 9.4, 9.7_

- [x] 9.3 Add mobile targeting notifications and feedback


  - Implement mobile push notifications for targeting events
  - Create mobile-appropriate targeting status indicators
  - Add haptic feedback for targeting actions on supported devices
  - Implement mobile-optimized error messages and recovery options
  - _Requirements: 9.5, 9.6, 9.7_

- [ ]* 9.4 Write mobile targeting tests
  - Test targeting display on various mobile screen sizes
  - Verify touch interactions and gesture handling
  - Test mobile targeting performance and responsiveness
  - Validate mobile accessibility features for targeting
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 10. Create comprehensive testing suite and documentation





  - Write end-to-end tests for complete targeting display workflows
  - Create performance tests for targeting data queries and UI updates
  - Add accessibility tests for targeting components
  - Create user documentation and help guides for targeting features
  - _Requirements: All requirements (comprehensive testing and documentation)_

- [x] 10.1 Write end-to-end targeting display tests


  - Test complete targeting workflow from proposal creation to display
  - Verify targeting data consistency across multiple users and sessions
  - Test targeting display with various swap states and auction modes
  - Validate targeting action execution and real-time updates
  - _Requirements: All requirements (end-to-end validation)_

- [x] 10.2 Create performance tests for targeting functionality


  - Test targeting query performance with large numbers of swaps and targets
  - Verify targeting UI performance with complex targeting relationships
  - Test real-time update performance under high load
  - Validate targeting data caching and optimization effectiveness
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ]* 10.3 Add accessibility tests for targeting components
  - Test targeting components with screen readers and keyboard navigation
  - Verify color contrast and visual accessibility for targeting indicators
  - Test targeting action accessibility for users with disabilities
  - Validate targeting notification accessibility across different devices
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.1, 9.2, 9.3, 9.4_

- [x] 10.4 Create user documentation for targeting display features


  - Write user guides for understanding and using targeting information
  - Create help documentation for targeting actions and workflows
  - Add troubleshooting guides for common targeting display issues
  - Create video tutorials and interactive help for targeting features
  - _Requirements: All requirements (user education and support)_

- [-] 11. Debug and fix swap targeting data retrieval issues



  - Investigate disconnect between swaps table and swap_targets table
  - Fix targeting data queries to properly show existing swap proposals as targets
  - Update service layer to handle both regular proposals and targeting relationships
  - Ensure frontend displays existing swap data correctly
  - _Requirements: 3.1, 3.2, 7.1, 7.2_

- [x] 11.1 Analyze current data structure mismatch




  - Investigate why existing swaps in swaps table don't show as targets
  - Determine if swap_targets table should be populated from existing swaps
  - Identify the relationship between regular proposals and targeting system
  - Document the expected data flow for targeting display
  - _Requirements: 3.1, 3.2_

- [-] 11.2 Fix targeting data retrieval to include regular proposals






  - Modify getTargetingDataForUserSwaps to include regular swap proposals
  - Update queries to show incoming proposals from swaps table as incoming targets
  - Ensure outgoing proposals from swaps table show as outgoing targets
  - Maintain backward compatibility with existing targeting relationships
  - _Requirements: 3.1, 3.2, 7.1, 7.2_

- [ ] 11.3 Update service layer to merge proposal and targeting data




  - Modify SwapProposalService to combine regular proposals with targeting data
  - Ensure getUserSwapsWithTargeting shows both types of relationships
  - Update data transformation logic to handle mixed data sources
  - Add proper error handling for data inconsistencies
  - _Requirements: 1.1, 1.2, 3.1, 3.2_

- [ ] 11.4 Test and validate targeting display with existing data


  - Verify that existing swaps now show up as targeting relationships
  - Test that both users can see the targeting information correctly
  - Validate that all targeting actions work with existing proposal data
  - Ensure no data corruption or loss during the fix
  - _Requirements: All requirements (validation and testing)_