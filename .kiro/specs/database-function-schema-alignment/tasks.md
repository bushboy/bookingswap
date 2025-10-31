# Implementation Plan

- [x] 1. Create database migration to update functions for simplified schema





  - Create migration file 028_update_database_functions_for_simplified_schema.sql
  - Drop existing functions that reference removed columns (owner_id, proposer_id, target_booking_id)
  - Update find_eligible_swaps_optimized function to use booking relationships instead of owner_id
  - Update has_existing_proposal_optimized function to use swap_targets table
  - Add comprehensive error handling and rollback capabilities
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

- [x] 2. Update database indexes for simplified schema functions





  - [x] 2.1 Remove obsolete indexes that reference removed columns


    - Drop idx_swaps_owner_status_active, idx_swaps_proposer_status_active indexes
    - Drop idx_swaps_user_active_excluding, idx_swaps_booking_pair_status indexes
    - Drop idx_swaps_user_involvement, idx_swaps_browse_active indexes
    - _Requirements: 2.1, 2.2, 4.1_

  - [x] 2.2 Create new optimized indexes for derived relationships


    - Create idx_swaps_status_pending for status-based queries
    - Create idx_swaps_source_booking_status for booking relationship queries
    - Create idx_bookings_user_swap_lookup for user-booking joins
    - Create idx_swap_targets_source_target_status for targeting relationships
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Update find_eligible_swaps_optimized function implementation





  - [x] 3.1 Modify function to use booking relationships instead of owner_id


    - Replace WHERE s.owner_id = p_user_id with WHERE b.user_id = p_user_id
    - Add proper JOIN with bookings table to derive user information
    - Update status filter from 'active' to 'pending' to match current schema
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [x] 3.2 Update proposal existence check logic


    - Replace target_booking_id references with swap_targets table queries
    - Update NOT EXISTS clause to use swap_targets relationships
    - Ensure proper bidirectional proposal checking
    - _Requirements: 1.3, 1.4, 2.3_

- [x] 4. Update has_existing_proposal_optimized function





  - [x] 4.1 Replace booking pair logic with swap_targets table queries


    - Remove source_booking_id and target_booking_id comparison logic
    - Use swap_targets table to check for existing targeting relationships
    - Update to check both directions of targeting relationships
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.2 Maintain backward compatibility in function signature


    - Keep same parameter types and return type
    - Ensure function behavior matches original business logic
    - Add proper error handling for edge cases
    - _Requirements: 2.4, 3.2_

- [x] 5. Create helper function for derived relationships





  - [x] 5.1 Implement get_swap_with_derived_relationships function


    - Create function to get swap with all derived proposer and target information
    - Include JOINs with bookings and users tables for complete relationship data
    - Handle cases where targeting relationships may not exist
    - _Requirements: 1.2, 2.2, 3.3_

  - [x] 5.2 Add comprehensive relationship derivation logic


    - Derive proposer_id and proposer_name from source booking
    - Derive target_booking_id and target_owner information from swap_targets
    - Include proper NULL handling for optional relationships
    - _Requirements: 1.2, 2.2, 3.3_

- [x] 6. Execute migration and validate function updates





  - [x] 6.1 Run database migration with validation


    - Execute migration 028_update_database_functions_for_simplified_schema.sql
    - Run validation queries to ensure functions work without column errors
    - Verify all functions return expected data structures
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 6.2 Test updated functions with real data


    - Test find_eligible_swaps_optimized with existing user data
    - Test has_existing_proposal_optimized with existing swap relationships
    - Verify performance is maintained or improved
    - _Requirements: 3.1, 3.2, 3.3, 4.2, 4.3_

- [x] 7. Update application code to handle any function signature changes





  - [x] 7.1 Verify SwapRepository calls work with updated functions


    - Test findEligibleSwapsWithBookingDetails method calls updated database function
    - Ensure proper error handling for any remaining schema issues
    - Verify return data matches expected TypeScript interfaces
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.2 Update error handling for schema-related issues


    - Add specific error handling for column reference errors (42703)
    - Provide clear error messages for schema migration issues
    - Ensure graceful degradation if functions are not yet updated
    - _Requirements: 3.1, 3.2_

- [ ]* 8. Create comprehensive tests for updated database functions
  - [ ]* 8.1 Write database function unit tests
    - Create test suite for find_eligible_swaps_optimized function
    - Create test suite for has_existing_proposal_optimized function
    - Test edge cases and error conditions
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [ ]* 8.2 Write performance benchmark tests
    - Create performance comparison tests for updated functions
    - Benchmark query execution times with simplified schema
    - Verify index usage and query optimization
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 8.3 Write integration tests for swap matching functionality
    - Test end-to-end swap matching with updated functions
    - Verify getUserEligibleSwaps service method works correctly
    - Test error handling and edge cases in application layer
    - _Requirements: 3.1, 3.2, 3.3_