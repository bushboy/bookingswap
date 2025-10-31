# Implementation Plan

- [x] 1. Investigate current database schema and identify problematic queries
  - Connect to the database and examine the actual structure of swaps, proposals, bookings, and swap_targets tables
  - Document current column names and foreign key relationships
  - Locate the specific query causing the PostgreSQL 42703 error at position 517
  - Identify which columns are being referenced that no longer exist
  - _Requirements: 1.1, 1.4, 2.2_

- [x] 2. Update proposal repository query methods to use existing schema
  - [x] 2.1 Fix getProposalById method to use correct column references
    - Update the SQL query to reference only existing columns in the proposals table
    - Add proper JOIN operations to derive user information from booking relationships
    - Test the updated query with the failing proposal ID from the error log
    - _Requirements: 1.1, 1.3, 2.1_
  
  - [x] 2.2 Update proposal retrieval queries to use derived relationships
    - Modify queries that need owner information to JOIN through bookings table
    - Update queries that need proposer information to derive from source_swap -> booking -> user
    - Replace any direct foreign key references with proper JOIN operations
    - _Requirements: 1.5, 2.3, 2.4_
  
  - [x] 2.3 Fix proposal filtering and search methods
    - Update getProposalsBySwapId to work with current schema
    - Fix getProposalsByUserId to derive user proposals through booking relationships
    - Ensure all WHERE clauses reference existing columns
    - _Requirements: 2.1, 2.2, 3.1_

- [x] 3. Implement proper error handling and validation
  - [x] 3.1 Add database column validation utilities
    - Create helper functions to validate column existence before query execution
    - Add error handling for PostgreSQL 42703 errors with meaningful messages
    - Implement query performance logging for complex JOIN operations
    - _Requirements: 4.3, 5.5_

  - [x] 3.2 Update repository error handling
    - Catch and handle column reference errors gracefully
    - Provide fallback strategies for missing relationship data
    - Add comprehensive logging for debugging future schema issues
    - _Requirements: 4.3, 2.4, 3.3_

- [x] 4. Test and validate the repository fixes
  - [x] 4.1 Create unit tests for updated repository methods
    - Test proposal retrieval by ID with the previously failing proposal
    - Test all repository methods with various proposal scenarios
    - Verify that derived user information is correctly retrieved
    - _Requirements: 3.1, 3.2, 4.1_
  
  - [x] 4.2 Run integration tests for proposal operations
    - Test complete proposal creation and retrieval workflows
    - Verify proposal acceptance and rejection processes work correctly
    - Test multi-user proposal scenarios to ensure proper data derivation
    - _Requirements: 3.3, 3.4, 4.2_

- [ ]* 4.3 Performance testing for updated queries
  - Measure query execution time for proposal retrieval operations
  - Test database connection pool impact with new JOIN operations
  - Verify that query performance meets acceptable thresholds
  - _Requirements: 4.1, 4.2_

- [ ] 5. Update related code and documentation

  - [x] 5.1 Update ProposalAcceptanceService to use EnhancedProposalRepository



    - Replace direct database queries in ProposalAcceptanceService with EnhancedProposalRepository calls
    - Update getProposal method to use the new repository's error handling
    - Ensure all proposal-related services use the updated repository patterns
    - _Requirements: 1.1, 2.1, 4.3_
  
  - [ ] 5.2 Document the corrected repository patterns
    - Update code comments to reflect current schema relationships
    - Document the proper way to derive user information from proposals
    - Create examples of correct proposal repository usage for future development
    - _Requirements: 5.4, 5.5_