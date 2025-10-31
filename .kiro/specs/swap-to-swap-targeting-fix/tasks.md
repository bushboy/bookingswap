        # Implementation Plan

- [x] 1. Create database schema and repository layer for swap targeting





  - Create swap_targets and swap_targeting_history database tables
  - Implement SwapTargetingRepository with CRUD operations and validation queries
  - Add targeting-related columns to existing swaps table
  - Create database indexes for efficient targeting queries
  - _Requirements: 5.1, 5.2, 5.3, 8.1, 8.6, 8.7_

- [x] 1.1 Create database migration for swap targeting tables


  - Write migration script to create swap_targets table with proper constraints
  - Add swap_targeting_history table for audit trail
  - Create indexes for optimal query performance
  - Add targeting-related columns to existing swaps table
  - _Requirements: 5.1, 5.2, 8.6, 8.7_

- [x] 1.2 Implement SwapTargetingRepository class


  - Create repository class with CRUD operations for swap targets
  - Implement validation queries for circular targeting prevention
  - Add methods for targeting history management
  - Create efficient queries for finding active targets and target counts
  - _Requirements: 5.1, 5.2, 5.3, 8.1, 8.6_

- [ ]* 1.3 Write unit tests for SwapTargetingRepository
  - Test CRUD operations with various scenarios
  - Verify constraint enforcement and validation logic
  - Test query performance with mock data
  - Validate transaction rollback scenarios
  - _Requirements: 5.1, 5.2, 5.3, 8.6, 8.7_

- [x] 2. Implement core SwapTargetingService with auction mode integration





  - Create SwapTargetingService class with targeting and retargeting methods
  - Implement auction mode vs one-for-one proposal validation logic
  - Add targeting eligibility checks and validation
  - Create targeting history tracking and audit trail
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.4, 5.8_

- [x] 2.1 Create SwapTargetingService class with core targeting operations


  - Implement targetSwap method with validation and proposal creation
  - Add retargetSwap method that cancels previous targets and creates new ones
  - Create removeTarget method for clearing targeting relationships
  - Implement targeting validation logic with auction mode awareness
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 5.4_

- [x] 2.2 Implement auction mode and one-for-one proposal validation


  - Add logic to check if target swap is in auction mode or one-for-one mode
  - Implement validation that prevents targeting one-for-one swaps with pending proposals
  - Allow multiple targeting for auction mode swaps until auction ends
  - Add auction end date validation and proposal prevention after auction ends
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 2.3 Add targeting eligibility and validation methods



  - Implement canTargetSwap method with comprehensive eligibility checks
  - Add validateTargeting method that checks for circular targeting and other restrictions
  - Create methods to check auction eligibility and one-for-one rules
  - Implement concurrent targeting protection with database locks
  - _Requirements: 1.4, 4.3, 4.4, 5.7, 8.1, 8.2, 8.3_

- [ ]* 2.4 Write unit tests for SwapTargetingService
  - Test targeting operations with various swap modes and states
  - Verify auction mode and one-for-one validation logic
  - Test error handling and edge cases
  - Validate concurrent targeting scenarios
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.4, 5.7_

- [x] 3. Enhance existing SwapProposalService for targeting integration





  - Modify SwapProposalService to work with targeting system
  - Add methods for creating proposals from targeting requests
  - Implement proposal cancellation when retargeting occurs
  - Update proposal validation to respect auction mode and targeting rules
  - _Requirements: 1.4, 4.4, 4.5, 5.1, 5.2, 5.3, 5.9_

- [x] 3.1 Extend SwapProposalService with targeting-aware methods


  - Add createProposalFromTargeting method that creates proposals from targeting requests
  - Implement cancelProposalFromRetargeting method for handling retargeting scenarios
  - Update existing proposal creation to check for targeting relationships
  - Add validation methods for auction mode and one-for-one proposal rules
  - _Requirements: 1.4, 4.4, 4.5, 5.1, 5.2, 5.3_

- [x] 3.2 Update proposal validation logic for targeting system


  - Modify proposal validation to check targeting eligibility
  - Add auction mode validation that allows multiple proposals
  - Implement one-for-one validation that prevents multiple proposals
  - Update proposal status management when targeting changes occur
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3_

- [ ]* 3.3 Write integration tests for enhanced SwapProposalService
  - Test proposal creation from targeting with various scenarios
  - Verify auction mode and one-for-one proposal handling
  - Test proposal cancellation during retargeting
  - Validate proposal state consistency with targeting changes
  - _Requirements: 1.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3_

- [x] 4. Create backend API endpoints for swap targeting




  - Add REST endpoints for targeting operations (target, retarget, remove)
  - Create endpoints for targeting validation and eligibility checks
  - Implement endpoints for querying targeting status and history
  - Add proper error handling and response formatting for targeting operations
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 6.1, 6.2, 6.3, 6.4_

- [x] 4.1 Create SwapTargetingController with targeting endpoints


  - Implement POST /api/swaps/:id/target endpoint for targeting swaps
  - Add PUT /api/swaps/:id/retarget endpoint for changing targets
  - Create DELETE /api/swaps/:id/target endpoint for removing targets
  - Implement GET /api/swaps/:id/targeting-status endpoint for current targeting info
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3_

- [x] 4.2 Add targeting validation and query endpoints


  - Create GET /api/swaps/:id/can-target endpoint for eligibility checks
  - Implement GET /api/swaps/:id/targeting-history endpoint for audit trail
  - Add GET /api/users/:id/targeting-activity endpoint for user's targeting activity
  - Create GET /api/swaps/:id/targeted-by endpoint for swaps targeting current swap
  - _Requirements: 3.1, 3.2, 3.3, 6.4, 6.5_

- [x] 4.3 Implement error handling and response formatting


  - Add comprehensive error handling for all targeting operations
  - Create standardized response formats for targeting endpoints
  - Implement validation error responses with clear messages
  - Add rate limiting and security measures for targeting endpoints
  - _Requirements: 6.6, 6.7, 8.1, 8.2, 8.3_

- [ ]* 4.4 Write API endpoint tests
  - Test all targeting endpoints with various scenarios
  - Verify error handling and validation responses
  - Test authentication and authorization for targeting operations
  - Validate response formats and status codes
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 6.1, 6.2, 6.3, 6.4_

- [x] 5. Create frontend targeting service and state management





  - Implement frontend SwapTargetingService for API integration
  - Create Redux slices for targeting state management
  - Add async thunks for targeting operations
  - Implement real-time updates for targeting status changes
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

- [x] 5.1 Create frontend SwapTargetingService class


  - Implement API integration methods for targeting operations
  - Add methods for targeting validation and eligibility checks
  - Create error handling and retry logic for targeting requests
  - Implement caching for targeting status and history data
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3_

- [x] 5.2 Implement Redux state management for targeting


  - Create targetingSlice for managing targeting state
  - Add async thunks for targeting operations (target, retarget, remove)
  - Implement state updates for targeting status and history
  - Create selectors for targeting-related data
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

- [x] 5.3 Add real-time updates for targeting changes


  - Integrate WebSocket updates for targeting status changes
  - Implement real-time notifications for targeting events
  - Add automatic state updates when targeting changes occur
  - Create connection management for targeting-related WebSocket events
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ]* 5.4 Write unit tests for frontend targeting service
  - Test API integration methods with mock responses
  - Verify Redux state management and async thunks
  - Test error handling and retry logic
  - Validate WebSocket integration for real-time updates
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3, 7.1, 7.2_

- [x] 6. Create TargetManager component for swap targeting UI





  - Build TargetManager component for managing current swap targets
  - Implement targeting controls with validation and feedback
  - Add targeting history display and management
  - Create responsive design for mobile and desktop
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 6.1 Build TargetManager component with targeting controls


  - Create component layout with current target display
  - Implement targeting and retargeting action buttons
  - Add target removal functionality with confirmation
  - Create loading states and error handling for targeting operations
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7_

- [x] 6.2 Add targeting validation and user feedback


  - Implement real-time validation for targeting eligibility
  - Add visual indicators for targeting restrictions and warnings
  - Create user-friendly error messages for targeting failures
  - Implement success feedback and confirmation messages
  - _Requirements: 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

- [x] 6.3 Create targeting history and status display


  - Build targeting history timeline component
  - Add current targeting status with target swap details
  - Implement targeting activity feed with timestamps
  - Create expandable details for targeting events
  - _Requirements: 6.3, 6.4, 6.5_

- [ ]* 6.4 Write component tests for TargetManager
  - Test targeting controls and user interactions
  - Verify validation feedback and error handling
  - Test responsive design and accessibility features
  - Validate targeting history display and updates
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 7. Enhance SwapCard component with targeting functionality





  - Update SwapCard to show targeting options and restrictions
  - Add "Target My Swap" button with eligibility checking
  - Implement auction mode and one-for-one visual indicators
  - Create targeting status display for targeted swaps
  - _Requirements: 4.8, 6.1, 6.2, 6.8, 6.9, 6.10_

- [x] 7.1 Update SwapCard with targeting action buttons


  - Add "Target My Swap" button for users with active swaps
  - Implement button state management (enabled/disabled/loading)
  - Create targeting restriction messages and tooltips
  - Add visual indicators for auction mode and proposal status
  - _Requirements: 6.1, 6.2, 6.8, 6.9, 6.10_

- [x] 7.2 Implement auction mode and targeting status indicators


  - Add auction countdown timer and proposal count display
  - Create visual indicators for one-for-one swaps with pending proposals
  - Implement targeting status badges (targeted, available, restricted)
  - Add hover states and tooltips for targeting information
  - _Requirements: 4.8, 6.8, 6.9, 6.10_

- [x] 7.3 Add targeting confirmation and feedback modals


  - Create targeting confirmation modal with swap comparison
  - Implement success and error feedback for targeting actions
  - Add retargeting confirmation with previous target information
  - Create targeting removal confirmation with impact warnings
  - _Requirements: 6.6, 6.7, 7.1, 7.2, 7.3_

- [ ]* 7.4 Write component tests for enhanced SwapCard
  - Test targeting button states and interactions
  - Verify auction mode and restriction indicators
  - Test modal workflows and user feedback
  - Validate accessibility and responsive design
  - _Requirements: 4.8, 6.1, 6.2, 6.8, 6.9, 6.10_

- [x] 8. Update SwapBrowser component with targeting integration









  - Modify SwapBrowser to show targeting options for users with active swaps
  - Add filtering options for targetable swaps
  - Implement targeting workflow from browse view
  - Update swap display to show targeting eligibility and restrictions
  - _Requirements: 6.1, 6.2, 6.8, 6.9, 6.10_

- [x] 8.1 Enhance SwapBrowser with targeting awareness




  - Update component to detect user's active swap and show targeting options
  - Modify swap filtering to highlight targetable swaps
  - Add targeting mode toggle for focused targeting experience
  - Implement targeting workflow integration with existing browse functionality
  - _Requirements: 6.1, 6.2, 6.8_

- [x] 8.2 Add targeting filters and search enhancements


  - Create targeting-specific filters (auction only, one-for-one only, available)
  - Add search functionality for finding targetable swaps
  - Implement sorting options prioritizing targetable swaps
  - Create saved targeting preferences for repeat users
  - _Requirements: 6.8, 6.9, 6.10_

- [x] 8.3 Update swap display with targeting information

  - Show targeting eligibility status on each swap card
  - Add auction information and proposal counts
  - Implement targeting restriction explanations
  - Create targeting success rate and compatibility indicators
  - _Requirements: 6.8, 6.9, 6.10_

- [ ]* 8.4 Write integration tests for SwapBrowser targeting
  - Test targeting workflow from browse to completion
  - Verify filtering and search functionality with targeting
  - Test user experience with various swap states and restrictions
  - Validate performance with large numbers of swaps
  - _Requirements: 6.1, 6.2, 6.8, 6.9, 6.10_

- [x] 9. Implement notification system for targeting events





  - Add targeting-specific notification types and templates
  - Implement real-time notifications for targeting activities
  - Create email notifications for important targeting events
  - Add notification preferences for targeting communications
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 9.1 Create targeting notification types and templates


  - Add notification templates for targeting, retargeting, and target removal
  - Create notifications for auction mode targeting and proposal updates
  - Implement notification templates for targeting restrictions and failures
  - Add rich notification content with swap details and action buttons
  - _Requirements: 7.1, 7.2, 7.3, 7.6, 7.7_

- [x] 9.2 Implement real-time targeting notifications


  - Integrate targeting events with WebSocket notification system
  - Add immediate notifications for targeting status changes
  - Create notification queuing and delivery management
  - Implement notification acknowledgment and read status tracking
  - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.7_

- [x] 9.3 Add email notifications for targeting events


  - Create email templates for targeting activities
  - Implement email delivery for important targeting events
  - Add email preferences and opt-out management for targeting
  - Create email notification batching to prevent spam
  - _Requirements: 7.1, 7.2, 7.3, 7.7_

- [ ]* 9.4 Write tests for targeting notification system
  - Test notification creation and delivery for various targeting events
  - Verify email and real-time notification integration
  - Test notification preferences and user controls
  - Validate notification content and formatting
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 10. Add blockchain integration for targeting audit trail







  - Implement blockchain recording for targeting events
  - Add targeting transaction verification and authenticity checks
  - Create immutable audit trail for targeting history
  - Implement dispute resolution support with blockchain evidence
  - _Requirements: 5.4, 5.5, 5.6, 5.7, 8.4, 8.5_

- [x] 10.1 Implement blockchain recording for targeting events



  - Add Hedera integration for recording targeting transactions
  - Create blockchain transaction types for targeting operations
  - Implement targeting metadata storage on blockchain
  - Add transaction verification and confirmation tracking
  - _Requirements: 5.4, 5.5, 5.6, 8.4_

- [x] 10.2 Create targeting verification and audit system


  - Implement targeting transaction verification methods
  - Add tamper detection for targeting data integrity
  - Create audit trail queries with blockchain verification
  - Implement dispute resolution data collection and storage
  - _Requirements: 5.5, 5.6, 5.7, 8.5_

- [ ]* 10.3 Write blockchain integration tests
  - Test targeting transaction recording and verification
  - Verify audit trail integrity and tamper detection
  - Test dispute resolution data collection
  - Validate blockchain integration performance and reliability
  - _Requirements: 5.4, 5.5, 5.6, 5.7, 8.4, 8.5_

- [x] 11. Create comprehensive test suite and documentation





  - Write end-to-end tests for complete targeting workflows
  - Create performance tests for targeting operations at scale
  - Add accessibility tests for targeting UI components
  - Create user documentation and help guides for targeting features
  - _Requirements: All requirements (comprehensive testing and documentation)_

- [x] 11.1 Write end-to-end targeting workflow tests


  - Create tests for complete targeting process from browse to completion
  - Test auction mode and one-for-one targeting scenarios
  - Verify targeting with concurrent users and edge cases
  - Test error recovery and rollback scenarios
  - _Requirements: All requirements (end-to-end validation)_

- [x] 11.2 Implement performance and load testing


  - Create performance tests for targeting operations with large datasets
  - Test concurrent targeting scenarios with multiple users
  - Verify database performance with complex targeting queries
  - Test WebSocket and notification performance under load
  - _Requirements: All requirements (performance validation)_

- [ ]* 11.3 Add accessibility and usability testing
  - Test targeting UI components with screen readers and keyboard navigation
  - Verify color contrast and visual accessibility for targeting indicators
  - Test mobile responsiveness and touch interactions
  - Create usability tests for targeting workflow complexity
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

- [x] 11.4 Create user documentation and help system


  - Write user guides for targeting features and workflows
  - Create help documentation for auction mode vs one-for-one targeting
  - Add troubleshooting guides for common targeting issues
  - Create video tutorials and interactive help for targeting features
  - _Requirements: All requirements (user education and support)_