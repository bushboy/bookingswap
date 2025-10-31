# Implementation Plan

- [x] 1. Extend shared types and interfaces for enhanced swap functionality





  - Create enhanced swap data models with payment type preferences and auction settings
  - Define auction-specific interfaces and types for proposals and timing validation
  - Add payment-related types for cash offers, escrow accounts, and transaction processing
  - _Requirements: 1.1, 1.2, 1.7, 2.1, 2.2_

- [x] 2. Implement backend data layer enhancements





- [x] 2.1 Create database migrations for enhanced swap tables


  - Add payment_types column to swaps table with JSON structure for preferences
  - Add acceptance_strategy column to track first-match vs auction mode
  - Create swap_auctions table with auction settings and status tracking
  - Create auction_proposals table for storing auction bids and offers
  - Create payment_transactions table for cash payment tracking
  - _Requirements: 1.1, 1.7, 2.1, 2.2, 6.1, 6.2_

- [x] 2.2 Enhance swap repository with auction and payment support


  - Add methods to create and query enhanced swaps with payment preferences
  - Implement auction-specific repository methods for proposal management
  - Add payment transaction repository methods for escrow and payment tracking
  - Create timing validation queries for auction end date enforcement
  - _Requirements: 1.1, 1.7, 2.1, 2.2, 3.1, 3.2, 3.3_

- [x] 3. Implement auction management service





- [x] 3.1 Create core auction service with lifecycle management


  - Implement auction creation with timing validation logic
  - Add auction end date validation to ensure one week before event minimum
  - Create auction status management (active, ended, cancelled)
  - Implement automatic auction ending with timer integration
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.8_

- [x] 3.2 Implement auction proposal management


  - Create proposal submission handling for both booking and cash offers
  - Add proposal validation logic for auction requirements
  - Implement proposal comparison and ranking functionality
  - Create winner selection logic with automatic fallback after timeout
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 3.3 Add auction timing and restriction enforcement


  - Implement last-minute booking detection (less than one week to event)
  - Create auction end date validation to enforce one-week-before-event rule
  - Add automatic auction conversion for approaching deadlines
  - Implement auction timeout handling with auto-selection
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 4. Implement payment processing service





- [x] 4.1 Create cash payment validation and processing


  - Implement payment method validation for cash offers
  - Add minimum cash amount validation against swap requirements
  - Create escrow account creation and management functionality
  - Implement payment transaction processing with platform fees
  - _Requirements: 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4.2 Integrate payment security and error handling


  - Add payment method verification and tokenization
  - Implement fraud detection for suspicious cash offers
  - Create secure escrow release mechanisms with multi-party validation
  - Add comprehensive payment error handling with retry logic
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 5. Enhance existing swap services





- [x] 5.1 Extend SwapProposalService for enhanced functionality


  - Modify createSwapProposal to support payment type preferences
  - Add auction mode detection and routing logic
  - Implement cash proposal creation and validation
  - Enhance proposal validation to check payment type compatibility
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_


- [x] 5.2 Enhance SwapResponseService for auction support

  - Modify proposal acceptance to handle auction vs first-match modes
  - Add auction proposal submission for both booking and cash offers
  - Implement auction winner selection and notification logic
  - Create auction proposal rejection handling for non-winners
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 6. Implement enhanced swap controller endpoints





- [x] 6.1 Add enhanced swap creation endpoints


  - Create POST /api/swaps/enhanced endpoint for new swap creation with payment options
  - Add validation for payment type preferences and auction settings
  - Implement auction timing validation in swap creation flow
  - Add error handling for last-minute booking restrictions
  - _Requirements: 1.1, 1.2, 1.7, 2.1, 2.2, 5.1, 5.2, 5.5_

- [x] 6.2 Create auction management endpoints


  - Add GET /api/auctions/:id endpoint for auction details and proposals
  - Create POST /api/auctions/:id/proposals for submitting auction proposals
  - Add PUT /api/auctions/:id/select-winner for auction winner selection
  - Implement GET /api/auctions/user/:userId for user's auction management
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 6.3 Add payment processing endpoints


  - Create POST /api/payments/cash-offer for cash proposal submission
  - Add GET /api/payments/methods for user payment method management
  - Implement POST /api/payments/escrow for escrow account creation
  - Add PUT /api/payments/escrow/:id/release for escrow fund release
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 7. Enhance notification system for auction and payment events










- [x] 7.1 Add auction-specific notifications


  - Create auction creation notifications for interested users based on preferences
  - Implement auction ending reminders for swap owners and active bidders
  - Add auction completion notifications with winner announcement
  - Create automatic selection notifications when owners don't respond in time
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7_

- [x] 7.2 Implement payment and timing notifications


  - Add payment processing status notifications for cash transactions
  - Create last-minute booking restriction notifications during swap creation
  - Implement auction unavailability explanations for timing restrictions
  - Add escalating reminder notifications for auction winner selection
  - _Requirements: 7.5, 7.6, 7.7_

- [x] 8. Create enhanced frontend components





- [x] 8.1 Build enhanced swap creation form


  - Create payment type selection UI with booking-only vs cash-enabled options
  - Add auction mode selection with first-match vs auction toggle
  - Implement auction end date picker with validation against event date
  - Add minimum cash amount input for cash-enabled swaps
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 2.1, 2.2_

- [x] 8.2 Develop auction management dashboard


  - Create auction overview component showing active auctions and proposals
  - Build proposal comparison interface for booking vs cash offers
  - Implement auction timer display with countdown to end date
  - Add winner selection interface with proposal ranking
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 8.3 Build enhanced proposal creation forms


  - Create cash offer form with amount input and payment method selection
  - Add booking proposal form with enhanced swap compatibility checking
  - Implement proposal type selection (booking vs cash) based on swap preferences
  - Add proposal message and conditions input for auction submissions
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 9. Implement frontend state management for enhanced features





- [x] 9.1 Create auction-related Redux slices


  - Add auctionSlice for managing auction state and proposals
  - Create auction thunks for API interactions and real-time updates
  - Implement auction selectors for proposal filtering and sorting
  - Add auction WebSocket integration for real-time proposal updates
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 9.2 Enhance swap state management


  - Extend swapSlice to handle enhanced swap data with payment preferences
  - Add payment-related state management for cash offers and transactions
  - Create enhanced swap selectors for filtering by payment type and auction status
  - Implement optimistic updates for auction proposal submissions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 10. Add comprehensive validation and error handling







- [x] 10.1 Implement frontend validation


  - Create auction timing validation with real-time feedback
  - Add payment amount validation against minimum requirements
  - Implement payment method verification before proposal submission
  - Add comprehensive form validation for enhanced swap creation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4_

- [x] 10.2 Enhance error handling and user feedback



  - Create specific error messages for auction timing restrictions
  - Add payment processing error handling with retry mechanisms
  - Implement graceful degradation for auction features on last-minute bookings
  - Add user-friendly explanations for auction and payment limitations
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 11. Integrate with blockchain for auction and payment events





- [x] 11.1 Extend Hedera integration for auction events


  - Add blockchain recording for auction creation and configuration
  - Implement auction proposal submission recording on blockchain
  - Create auction completion and winner selection blockchain transactions
  - Add auction cancellation and timeout event recording
  - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 11.2 Implement payment transaction blockchain integration


  - Create blockchain recording for cash offer submissions
  - Add escrow account creation and management on blockchain
  - Implement payment completion and fund release blockchain transactions
  - Create refund and dispute resolution blockchain event recording
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 12. Create comprehensive test suite









- [x] 12.1 Write unit tests for enhanced services






  - Test auction timing validation logic with various event date scenarios
  - Create payment processing tests with mock payment gateways
  - Test auction proposal management with multiple bidder scenarios
  - Add comprehensive validation testing for all new business rules


  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 3.1, 3.2, 3.3_

- [x] 12.2 Implement integration tests for auction workflows





  - Create end-to-end auction creation and completion tests
  - Test payment processing integration with escrow management

  - Add multi-user auction scenarios with concurrent proposal submissions
  - Test auction timeout and automatic winner selection scenarios
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 12.3 Add frontend component and integration tests






  - Test enhanced swap creation form with all payment and auction options
  - Create auction dashboard tests with proposal management scenarios
  - Test payment form integration with validation and error handling
  - Add accessibility tests for all new auction and payment interfaces
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_