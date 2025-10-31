# Implementation Plan

- [x] 1. Set up enhanced validation services and interfaces





  - Create SwapOfferWorkflowService interface with validation methods
  - Define ValidationResult, SwapOfferRequest, and SwapOfferResult types
  - Create OfferMode type and related enums
  - _Requirements: 1.9, 2.6, 2.10_

- [x] 2. Implement foreign key validation service





  - [x] 2.1 Create validateForeignKeyReferences method


    - Write validation logic for proposal_id, swap_id, and user references
    - Implement scenario-specific validation (auction vs first-match)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 2.2 Add validateSwapForOffer method


    - Validate swap exists and accepts the type of offer being submitted
    - Skip auction-specific validation unless user explicitly selects auction mode
    - _Requirements: 1.9, 2.6, 2.10_
  
  - [ ]* 2.3 Write unit tests for validation service
    - Test proposal_id validation for user-selected auction scenarios
    - Test null proposal_id acceptance for direct swap scenarios
    - Test invalid reference rejection
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Enhance payment transaction service with validation





  - [x] 3.1 Update createPaymentTransaction method


    - Add pre-flight validation before database insertion
    - Handle both auction and first-match scenarios
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 3.2 Implement validatePaymentTransactionRequest method


    - Validate all foreign key references before transaction creation
    - Return detailed validation results with specific error codes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 3.3 Write unit tests for enhanced payment service
    - Test successful validation and creation for both scenarios
    - Test validation failure handling
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Create swap offer workflow orchestration service





  - [x] 4.1 Implement submitSwapOffer workflow method


    - Orchestrate the complete swap offer submission process
    - Handle user-selected offer mode and appropriate service calls
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3_
  
  - [x] 4.2 Add determineOfferMode method


    - Use user-selected offer mode instead of inferring from swap configuration
    - Only create auction proposals when user explicitly selects auction mode
    - _Requirements: 1.9, 2.6, 2.10_
  
  - [ ]* 4.3 Write unit tests for workflow orchestration
    - Test complete workflow for user-selected auction scenarios
    - Test complete workflow for direct swap scenarios
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Implement transaction rollback mechanisms





  - [x] 5.1 Create rollbackSwapOfferSubmission method


    - Implement rollback logic for failed auction proposals
    - Handle rollback for failed payment transactions
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 5.2 Add transaction management with rollback steps


    - Track rollback steps during workflow execution
    - Execute rollback steps in reverse order on failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  
  - [ ]* 5.3 Write unit tests for rollback mechanisms
    - Test auction proposal rollback on payment failure
    - Test payment transaction rollback scenarios
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Enhance error handling and logging





  - [x] 6.1 Create SwapOfferErrorHandler class


    - Handle foreign key constraint violations with specific error messages
    - Map database constraint names to user-friendly errors
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [x] 6.2 Implement enhanced logging for constraint violations


    - Log specific constraint names and referenced tables
    - Include relevant context like user_id, swap_id, and timestamp
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [x] 6.3 Add critical error alerting for rollback failures


    - Send administrator alerts for rollback failures
    - Log critical errors with sufficient detail for debugging
    - _Requirements: 3.6, 4.6, 4.7_

- [x] 7. Update swap controller to use new workflow service





  - [x] 7.1 Modify swap offer endpoint to use SwapOfferWorkflowService


    - Replace direct payment service calls with workflow orchestration
    - Update request/response handling for new validation structure and user-selected offer mode
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 7.2 Add proper error response handling


    - Map SwapOfferError instances to appropriate HTTP responses
    - Provide user-friendly error messages without exposing internal details
    - _Requirements: 4.3, 6.5_
  
  - [ ]* 7.3 Write integration tests for updated controller
    - Test complete auction swap offer workflow
    - Test complete direct swap offer workflow
    - Test error scenarios and rollback behavior
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 8. Add data consistency monitoring and cleanup





  - [x] 8.1 Create DatabaseIntegrityMonitor class


    - Implement checkPaymentTransactionIntegrity method
    - Monitor for orphaned payment transactions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [x] 8.2 Add startup consistency checks


    - Perform basic foreign key consistency checks on application startup
    - Log warnings and send alerts for detected inconsistencies
    - _Requirements: 5.1, 5.2, 5.7_
  
  - [ ]* 8.3 Write unit tests for integrity monitoring
    - Test orphaned record detection
    - Test consistency check reporting
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 9. Optimize database queries for validation










  - [x] 9.1 Implement single-query validation method



    - Create validateAllReferencesInSingleQuery for performance
    - Combine all foreign key validations into one database query
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 9.2 Add database indexes for foreign key lookups



    - Ensure proper indexing on payment_transactions.proposal_id
    - Verify indexes on payment_transactions.swap_id and user references
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
- [x] 10. Update database schema and constraints




- [ ] 10. Update database schema and constraints

  - [x] 10.1 Review and update foreign key constraints


    - Ensure payment_transactions.proposal_id allows NULL values
    - Verify all foreign key constraints are properly defined
    - _Requirements: 1.4, 2.2, 2.3_
  
  - [x] 10.2 Add metadata columns to payment_transactions


    - Add offer_mode column to track auction vs direct
    - Add validation metadata for debugging and auditing
    - _Requirements: 1.8, 4.4, 4.6_