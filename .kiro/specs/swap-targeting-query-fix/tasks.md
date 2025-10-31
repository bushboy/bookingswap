# Implementation Plan

- [ ] 1. Analyze and document the current database schema structure
  - Examine the actual swaps table schema to confirm column structure
  - Document the swap_targets table relationships and foreign keys
  - Create a schema reference document for the targeting system
  - Identify all incorrect column references in existing queries
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 2. Fix the findCompleteSwapDataWithTargeting query structure
  - Replace the incorrect p.source_swap_id reference with proper swap_targets joins
  - Rewrite the incoming_proposals CTE to use swap_targets table correctly
  - Rewrite the outgoing_targets CTE to use proper table relationships
  - Update all table aliases to be clear and consistent throughout the query
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [ ] 3. Implement proper error handling and validation for database queries
  - Add schema validation checks before executing queries
  - Implement graceful fallback when targeting queries fail
  - Add detailed error logging for database column reference errors
  - Create retry logic for transient database connection issues
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 4. Update the SwapRepository method with corrected query logic
  - Replace the existing findCompleteSwapDataWithTargeting implementation
  - Ensure proper parameter binding and SQL injection prevention
  - Add query performance optimizations using existing indexes
  - Update method documentation to reflect correct schema usage
  - _Requirements: 1.1, 2.1, 2.2, 2.3_

- [ ] 5. Add comprehensive testing for the corrected database queries
  - Create unit tests for the corrected query with sample data
  - Test edge cases like no proposals, no targets, and multiple relationships
  - Add integration tests to verify the complete data flow works correctly
  - Test error handling scenarios with invalid data or missing tables
  - _Requirements: 1.4, 2.4, 3.4, 4.4_

- [ ]* 6. Create database schema validation utilities
  - Implement runtime schema validation to prevent similar issues
  - Add startup checks to verify all required tables and columns exist
  - Create migration validation tools to catch schema inconsistencies
  - Add automated tests that run against the actual database schema
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Update related service methods that depend on the corrected data structure
  - Update SwapProposalService.getUserSwapsWithTargeting to handle corrected data
  - Ensure all calling methods can handle the corrected response format
  - Update any caching mechanisms that might store the old data structure
  - Verify that the frontend can properly consume the corrected data format
  - _Requirements: 2.1, 2.2, 4.3_

- [ ]* 8. Add monitoring and alerting for database query failures
  - Implement query performance monitoring for the corrected queries
  - Add alerts for database schema inconsistencies
  - Create dashboards to track targeting query success rates
  - Set up automated notifications for critical database errors
  - _Requirements: 4.1, 4.2, 4.4_