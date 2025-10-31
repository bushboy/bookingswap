# Requirements Document

## Introduction

The swap targeting functionality is failing due to a critical database query error where the system attempts to reference a non-existent column `p.source_swap_id` in the `findCompleteSwapDataWithTargeting` method. This error prevents users from viewing their swaps with targeting information, causing the application to fail when loading swap data. The issue stems from incorrect table relationships and column references in the database query that retrieves complete swap data with targeting information.

## Requirements

### Requirement 1: Fix Database Schema References in Swap Targeting Query

**User Story:** As a user, I want to view my swaps with targeting information without encountering database errors so that I can see all my swap proposals and targeting data.

#### Acceptance Criteria

1. WHEN the system queries for user swaps with targeting THEN it SHALL use correct column references that exist in the database schema
2. WHEN joining swap tables THEN the system SHALL use the proper foreign key relationships between swaps and targeting tables
3. WHEN the query executes THEN it SHALL NOT reference non-existent columns like `p.source_swap_id`
4. WHEN database errors occur THEN the system SHALL provide clear error messages and fallback behavior

### Requirement 2: Correct Swap-to-Targeting Relationship Mapping

**User Story:** As a developer, I want the database queries to correctly map the relationships between swaps and targeting proposals so that the data retrieval works as intended.

#### Acceptance Criteria

1. WHEN retrieving incoming proposals THEN the system SHALL correctly identify which swaps are targeting the user's swaps
2. WHEN retrieving outgoing targets THEN the system SHALL correctly identify which swaps the user is targeting
3. WHEN joining tables THEN the system SHALL use the correct foreign key columns that exist in the actual database schema
4. WHEN proposal data is needed THEN the system SHALL retrieve it through the proper table relationships

### Requirement 3: Validate Database Schema Consistency

**User Story:** As a system administrator, I want to ensure that all database queries match the actual schema so that the application functions reliably.

#### Acceptance Criteria

1. WHEN database queries are written THEN they SHALL reference only columns that exist in the target tables
2. WHEN table aliases are used THEN they SHALL be consistent and refer to the correct tables throughout the query
3. WHEN foreign key relationships are used THEN they SHALL match the actual database constraints
4. WHEN schema changes occur THEN all related queries SHALL be updated to maintain consistency

### Requirement 4: Implement Proper Error Handling for Database Operations

**User Story:** As a user, I want the application to handle database errors gracefully so that I receive meaningful feedback when something goes wrong.

#### Acceptance Criteria

1. WHEN database queries fail THEN the system SHALL log detailed error information for debugging
2. WHEN column reference errors occur THEN the system SHALL provide specific error messages about the missing columns
3. WHEN query execution fails THEN the system SHALL return appropriate fallback data or error responses
4. WHEN database connectivity issues arise THEN the system SHALL retry operations and provide user-friendly error messages