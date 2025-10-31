
# Implementation Plan

- [x] 1. Create database migration for schema simplification





  - Create migration file 027_simplify_swap_schema.sql to remove redundant columns
  - Add backup table creation for rollback safety
  - Remove target_booking_id, proposer_id, owner_id from swaps table
  - Remove proposal_id from swap_targets table
  - Drop related indexes and constraints for removed columns
  - Add data integrity validation functions
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Update SwapRepository with simplified schema queries





  - [x] 2.1 Modify findByUserId method to derive proposer from booking relationship


    - Replace direct owner_id lookup with JOIN on bookings table
    - Update query to get proposer_id and proposer_name from booking.user_id
    - Ensure proper error handling for missing booking relationships
    - _Requirements: 1.1, 1.2, 4.1_

  - [x] 2.2 Update swap targeting queries to remove proposal_id references


    - Modify targeting relationship queries to use source_swap_id directly
    - Remove proposal_id from INSERT and SELECT statements
    - Update targeting status queries to work with simplified schema
    - _Requirements: 2.1, 2.2, 2.3, 4.2_

  - [x] 2.3 Implement derived relationship methods


    - Add getSwapWithRelationships method that derives all relationships
    - Create helper methods for getting target booking and owner information
    - Implement efficient queries that JOIN through booking relationships
    - _Requirements: 1.2, 4.1, 4.3_

- [x] 3. Update SwapTargetRepository for simplified targeting





  - [x] 3.1 Remove proposal_id from targeting creation methods


    - Update createTargeting method to only use source_swap_id and target_swap_id
    - Remove proposal_id parameter from all targeting methods
    - Update targeting validation to work without proposal_id
    - _Requirements: 2.1, 2.2, 4.2_

  - [x] 3.2 Simplify targeting relationship queries


    - Update findBySourceSwap to work without proposal_id
    - Modify findByTargetSwap to use simplified schema
    - Update targeting status queries to derive relationships correctly
    - _Requirements: 2.2, 2.3, 4.2_

- [x] 4. Update SwapService layer for derived relationships





  - [x] 4.1 Modify getUserSwaps to work with simplified schema


    - Update method to call new repository methods with derived relationships
    - Add proper error handling for missing derived data
    - Ensure backward compatibility with existing API responses
    - _Requirements: 1.1, 1.2, 4.1, 4.3_

  - [x] 4.2 Update swap creation logic


    - Remove setting of redundant fields during swap creation
    - Update validation logic to work with simplified schema
    - Ensure proper relationship derivation during creation
    - _Requirements: 1.1, 4.2_

  - [x] 4.3 Update targeting service methods


    - Modify targeting creation to work without proposal_id
    - Update targeting queries to derive relationships correctly
    - Add proper validation for targeting relationships
    - _Requirements: 2.1, 2.2, 2.3, 4.2_

- [x] 5. Update TypeScript interfaces and types





  - [x] 5.1 Update Swap interface to remove redundant fields


    - Remove targetBookingId, proposerId, ownerId from Swap interface
    - Create SwapWithRelationships interface for derived data
    - Update all type definitions to use simplified schema
    - _Requirements: 1.1, 4.1, 4.4_

  - [x] 5.2 Update SwapTarget interface


    - Remove proposalId from SwapTarget interface
    - Update targeting-related type definitions
    - Create derived types for targeting relationships
    - _Requirements: 2.1, 2.2, 4.2, 4.4_

  - [x] 5.3 Create derived data transfer objects


    - Add SwapWithRelationships DTO for API responses
    - Create TargetingRelationship DTO for targeting data
    - Update API response types to use derived relationships
    - _Requirements: 4.1, 4.3, 4.4_

- [x] 6. Update API endpoints and controllers





  - [x] 6.1 Update swap listing endpoints


    - Modify GET /api/swaps endpoint to return derived relationships
    - Update response serialization to include proposer and target information
    - Ensure proper error handling for missing relationships
    - _Requirements: 1.2, 4.1, 4.3_

  - [x] 6.2 Update swap creation endpoints


    - Remove redundant field validation from POST /api/swaps
    - Update request validation to work with simplified schema
    - Ensure proper relationship derivation in responses
    - _Requirements: 1.1, 4.2_

  - [x] 6.3 Update targeting endpoints


    - Modify targeting endpoints to work without proposal_id
    - Update targeting creation and status endpoints
    - Ensure proper relationship derivation in targeting responses
    - _Requirements: 2.1, 2.2, 2.3, 4.2_

- [x] 7. Run database migration and validate data integrity





  - [x] 7.1 Execute migration with data validation


    - Run migration 027_simplify_swap_schema.sql
    - Execute data integrity validation functions
    - Verify all existing swaps have valid derived relationships
    - _Requirements: 3.1, 3.2, 3.3, 3.4_


  - [x] 7.2 Validate application functionality

    - Test all swap-related API endpoints with simplified schema
    - Verify targeting functionality works correctly
    - Ensure no data loss or corruption occurred
    - _Requirements: 3.3, 4.1, 4.2, 4.3_

- [ ]* 8. Create comprehensive tests for simplified schema
  - [ ]* 8.1 Write unit tests for repository methods
    - Test SwapRepository methods with simplified schema
    - Test SwapTargetRepository methods without proposal_id
    - Test error handling for missing relationships
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [ ]* 8.2 Write integration tests for service layer
    - Test SwapService methods with derived relationships
    - Test targeting service functionality
    - Test API endpoint responses with simplified schema
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 8.3 Write migration validation tests
    - Test data integrity after migration
    - Test rollback functionality
    - Test performance of simplified queries
    - _Requirements: 3.1, 3.2, 3.3_