# Implementation Plan

- [x] 1. Set up core data models and database schema





  - Create database migration for proposal response tracking
  - Add new columns to existing swap_proposals table for acceptance/rejection data
  - Create ProposalResponse model interface in shared package
  - Update SwapProposal interface with response tracking fields
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Implement ProposalTransactionManager for atomic operations









  - Create ProposalTransactionManager class with database transaction handling
  - Implement executeAcceptanceTransaction method with rollback capability
  - Implement executeRejectionTransaction method
  - Add database connection pooling and transaction isolation
  - _Requirements: 4.1, 4.2, 6.1, 6.2_

- [x] 3. Create ProposalAcceptanceService orchestration layer









  - Create ProposalAcceptanceService class with core workflow methods
  - Implement acceptProposal method with validation and coordination
  - Implement rejectProposal method with reason tracking
  - Add proposal validation and authorization checks
  - Integrate with existing SwapRepository for proposal lookup
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 4. Implement financial proposal fund transfer integration





  - Add processFinancialTransfer method to ProposalAcceptanceService
  - Integrate with existing PaymentProcessingService for escrow transfers
  - Implement escrow account identification and validation
  - Add fund transfer amount calculation from proposal terms
  - Handle payment processing failures with proper rollback
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Integrate blockchain transaction recording





  - Add recordBlockchainTransaction method to ProposalAcceptanceService
  - Integrate with existing HederaService for transaction submission
  - Implement proposal acceptance/rejection transaction types
  - Add blockchain transaction retry logic with exponential backoff
  - Store blockchain transaction hashes in database for reference
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Enhance SwapResponseService with proposal handling





  - Add processProposalAcceptance method to existing SwapResponseService
  - Add processProposalRejection method to existing SwapResponseService
  - Implement handleFinancialProposal method for cash proposals
  - Update existing auction winner selection to use new acceptance flow
  - Maintain backward compatibility with existing swap response methods
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1_

- [x] 7. Implement comprehensive error handling and rollback





  - Create ProposalAcceptanceError class with specific error codes
  - Implement ProposalRollbackManager for failure recovery
  - Add rollbackAcceptance method for partial failure scenarios
  - Add rollbackRejection method for rejection failures
  - Implement error logging and monitoring integration
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. Create REST API endpoints for proposal actions





  - Add POST /api/proposals/{proposalId}/accept endpoint
  - Add POST /api/proposals/{proposalId}/reject endpoint
  - Add GET /api/proposals/{proposalId}/status endpoint
  - Add GET /api/users/{userId}/proposal-responses endpoint
  - Implement request validation and authentication middleware
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 7.1_

- [x] 9. Integrate notification system for proposal responses








  - Update existing NotificationService with proposal response templates
  - Send acceptance notifications to both proposer and booking holder
  - Send rejection notifications with optional reason
  - Send payment completion notifications for financial proposals
  - Implement real-time WebSocket events for proposal status updates
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 10. Write comprehensive test suite
- [ ]* 10.1 Create unit tests for ProposalAcceptanceService
  - Test acceptance workflow for booking proposals
  - Test acceptance workflow for financial proposals with escrow transfers
  - Test rejection workflow with reason tracking
  - Test error handling and rollback scenarios
  - _Requirements: 1.1, 2.1, 3.1, 6.1_

- [ ]* 10.2 Create integration tests for end-to-end flows
  - Test complete acceptance flow: proposal → accept → database + blockchain + payment
  - Test complete rejection flow: proposal → reject → database + blockchain + notifications
  - Test concurrent proposal processing scenarios
  - Test system recovery after partial failures
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [ ]* 10.3 Create performance tests for high-load scenarios
  - Test concurrent proposal acceptance/rejection by multiple users
  - Test payment processing under high volume
  - Test database transaction isolation and locking
  - Test blockchain transaction batching and retry mechanisms
  - _Requirements: 4.1, 5.1, 6.1_

- [x] 11. Create frontend proposal acceptance UI components





- [x] 11.1 Create ProposalActionButtons component


  - Build Accept and Reject buttons with confirmation dialogs
  - Add loading states during proposal processing
  - Implement error handling and user feedback
  - Add accessibility features for screen readers
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 11.2 Create ProposalAcceptanceModal component


  - Build confirmation modal for acceptance with proposal details
  - Add rejection modal with optional reason input
  - Display financial proposal details and payment information
  - Implement form validation and submission handling
  - _Requirements: 1.2, 2.2, 3.1, 3.2_

- [x] 11.3 Create ProposalStatusIndicator component


  - Display current proposal status with visual indicators
  - Show processing states during acceptance/rejection
  - Add success/error feedback with appropriate messaging
  - Implement real-time status updates via WebSocket
  - _Requirements: 1.5, 2.5, 7.1, 7.2_

- [x] 12. Integrate proposal actions into existing swap views












- [x] 12.1 Update ReceivedProposals component


  - Add ProposalActionButtons to each proposal item
  - Integrate with existing proposal display logic
  - Update proposal list state after actions
  - Handle proposal filtering and sorting with new statuses
  - _Requirements: 1.1, 2.1, 7.1_


- [x] 12.2 Update SwapProposalCard component



  - Add action buttons for pending proposals
  - Display proposal status and response information
  - Show financial proposal details and payment status
  - Implement responsive design for mobile devices
  - _Requirements: 1.1, 2.1, 3.1, 7.3_

- [x] 12.3 Update ProposalDetailsView component



  - Add detailed acceptance/rejection interface
  - Display complete proposal information and terms
  - Show transaction history and blockchain records
  - Add export functionality for proposal records
  - _Requirements: 1.1, 2.1, 5.1, 5.2_

- [x] 13. Implement frontend API integration





- [x] 13.1 Create ProposalAcceptanceAPI service


  - Implement acceptProposal API call with error handling
  - Implement rejectProposal API call with reason support
  - Add getProposalStatus API call for real-time updates
  - Implement retry logic for failed API requests
  - _Requirements: 1.3, 1.4, 2.3, 2.4_

- [x] 13.2 Create ProposalWebSocketService


  - Implement WebSocket connection for real-time proposal updates
  - Handle proposal status change events
  - Update UI components when proposal states change
  - Implement connection recovery and error handling
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 13.3 Update existing API services


  - Extend SwapAPI service with new proposal endpoints
  - Update UserAPI service for proposal response history
  - Add error handling for proposal-specific error codes
  - Implement request caching for proposal status queries
  - _Requirements: 1.1, 2.1, 6.1, 6.4_

- [x] 14. Implement frontend state management




- [x] 14.1 Create proposal acceptance Redux slice


  - Add actions for accept/reject proposal operations
  - Implement reducers for proposal state updates
  - Add selectors for proposal status and loading states
  - Handle optimistic updates and error rollback
  - _Requirements: 1.1, 2.1, 6.1, 6.2_

- [x] 14.2 Update existing proposal state management


  - Extend proposal reducers with acceptance/rejection states
  - Update proposal selectors for new status filtering
  - Add middleware for WebSocket event handling
  - Implement state persistence for offline support
  - _Requirements: 1.5, 2.5, 7.1, 7.5_

- [-] 15. Add user notifications and feedback


- [x] 15.1 Implement toast notifications for proposal actions


  - Show success messages for accepted/rejected proposals
  - Display error messages with actionable guidance
  - Add progress indicators for long-running operations
  - Implement notification persistence and history
  - _Requirements: 7.1, 7.2, 7.4, 6.1_

- [x] 15.2 Create email notification templates












  - Design acceptance notification email template
  - Design rejection notification email template
  - Add payment completion notification template
  - Implement notification preference management
  - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [ ]* 16. Create frontend test suite
- [ ]* 16.1 Create component unit tests
  - Test ProposalActionButtons component behavior
  - Test ProposalAcceptanceModal form validation
  - Test ProposalStatusIndicator state changes
  - Test error handling and loading states
  - _Requirements: 1.1, 2.1, 6.1_

- [ ]* 16.2 Create integration tests for proposal flows
  - Test complete acceptance flow from UI to API
  - Test complete rejection flow with reason input
  - Test real-time status updates via WebSocket
  - Test error recovery and retry mechanisms
  - _Requirements: 1.1, 2.1, 7.1, 6.1_

- [ ]* 16.3 Create end-to-end tests
  - Test proposal acceptance with financial transfers
  - Test proposal rejection with notifications
  - Test concurrent proposal processing scenarios
  - Test mobile responsive behavior
  - _Requirements: 1.1, 2.1, 3.1, 7.1_