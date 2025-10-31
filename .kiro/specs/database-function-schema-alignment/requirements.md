# Requirements Document

## Introduction

This feature involves updating database functions that still reference removed columns from the schema simplification. The `find_eligible_swaps_optimized` function and related database functions are still trying to access `owner_id`, `proposer_id`, and `target_booking_id` columns that were removed during the database schema simplification, causing runtime errors in the swap matching functionality.

## Glossary

- **Database Function**: A stored procedure in PostgreSQL that performs complex queries
- **Schema Simplification**: The previous migration that removed redundant columns from the swaps table
- **Swap Matching System**: The system that finds eligible swaps for users to propose exchanges
- **Derived Relationship**: Information obtained by joining tables rather than storing redundant foreign keys

## Requirements

### Requirement 1

**User Story:** As a developer, I want database functions updated to work with the simplified schema, so that swap matching functionality works without column reference errors.

#### Acceptance Criteria

1. WHEN the find_eligible_swaps_optimized function is called, THE System SHALL derive owner information from booking relationships instead of using removed owner_id column
2. WHEN querying for eligible swaps, THE System SHALL use source_booking_id to join with bookings table to get user_id
3. WHEN the function executes, THE System SHALL return the same data structure as before but using derived relationships
4. WHEN checking swap eligibility, THE System SHALL maintain the same business logic without referencing removed columns

### Requirement 2

**User Story:** As a developer, I want all database functions updated consistently, so that no functions reference removed schema columns.

#### Acceptance Criteria

1. WHEN any database function executes, THE System SHALL NOT reference owner_id, proposer_id, or target_booking_id columns
2. WHEN functions need user information, THE System SHALL derive it from the bookings table relationship
3. WHEN functions need target booking information, THE System SHALL derive it from swap targeting relationships
4. WHEN updating functions, THE System SHALL maintain backward compatibility in return types and parameters

### Requirement 3

**User Story:** As a user, I want swap matching to work correctly, so that I can find and propose swaps without system errors.

#### Acceptance Criteria

1. WHEN I request eligible swaps, THE System SHALL return a list of available swaps without database errors
2. WHEN the system checks for existing proposals, THE System SHALL use the simplified schema relationships
3. WHEN I view swap details, THE System SHALL show correct proposer and owner information derived from bookings
4. WHEN swap matching runs, THE System SHALL perform efficiently with the updated database functions

### Requirement 4

**User Story:** As a system administrator, I want database functions to be performant with the simplified schema, so that the system remains responsive.

#### Acceptance Criteria

1. WHEN database functions execute, THE System SHALL use appropriate indexes for the simplified schema
2. WHEN querying large datasets, THE System SHALL maintain or improve performance compared to the old schema
3. WHEN functions are updated, THE System SHALL include proper query optimization for derived relationships
4. WHEN monitoring performance, THE System SHALL show improved or equivalent query execution times