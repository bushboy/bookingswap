# Requirements Document

## Introduction

This feature addresses a critical database error occurring in the proposal repository where queries are attempting to access non-existent columns, causing PostgreSQL error 42703 ("column does not exist"). The error occurs when trying to retrieve proposals by ID, indicating that the proposal repository queries have not been updated to work with the current database schema after previous schema simplifications.

## Glossary

- **Proposal Repository**: The data access layer responsible for proposal database operations
- **PostgreSQL Error 42703**: Database error indicating a referenced column does not exist in the table
- **Schema Alignment**: Ensuring database queries match the current table structure
- **Proposal System**: The system that manages swap proposals between users

## Requirements

### Requirement 1

**User Story:** As a system, I want proposal repository queries to reference only existing database columns, so that proposal retrieval operations complete successfully without database errors.

#### Acceptance Criteria

1. WHEN the proposal repository queries for a proposal by ID, THE System SHALL only reference columns that exist in the current database schema
2. WHEN executing proposal queries, THE System SHALL NOT reference any columns that were removed during schema simplifications
3. WHEN a proposal query executes, THE System SHALL return the expected proposal data without throwing column reference errors
4. WHEN the repository is called, THE System SHALL use the correct column names as they exist in the current database structure
5. WHEN querying proposals, THE System SHALL derive any needed information from existing relationships rather than removed columns

### Requirement 2

**User Story:** As a developer, I want all proposal repository methods to work with the current database schema, so that proposal operations are reliable across the application.

#### Acceptance Criteria

1. WHEN any proposal repository method is called, THE System SHALL execute without database column errors
2. WHEN retrieving proposals, THE System SHALL use proper JOIN operations to get related data from other tables
3. WHEN the repository needs user information, THE System SHALL derive it from booking relationships instead of removed foreign keys
4. WHEN updating proposal queries, THE System SHALL maintain the same return data structure expected by calling code
5. WHEN proposal operations execute, THE System SHALL provide the same functionality as before the schema changes

### Requirement 3

**User Story:** As a user, I want proposal-related features to work correctly, so that I can view, create, and manage swap proposals without encountering system errors.

#### Acceptance Criteria

1. WHEN I view proposal details, THE System SHALL retrieve and display the proposal information successfully
2. WHEN the system loads proposals, THE System SHALL not encounter database errors that prevent the operation
3. WHEN I interact with proposals, THE System SHALL provide consistent functionality without backend failures
4. WHEN proposals are displayed, THE System SHALL show all relevant information including proposer and target details
5. WHEN proposal operations are performed, THE System SHALL complete successfully and provide appropriate feedback

### Requirement 4

**User Story:** As a system administrator, I want proposal database operations to be performant and error-free, so that the application remains stable and responsive.

#### Acceptance Criteria

1. WHEN proposal queries execute, THE System SHALL complete within acceptable performance thresholds
2. WHEN database operations are performed, THE System SHALL use efficient query patterns with proper indexing
3. WHEN errors occur, THE System SHALL provide clear logging information for debugging purposes
4. WHEN the repository is updated, THE System SHALL maintain or improve query performance
5. WHEN monitoring database operations, THE System SHALL show successful proposal query execution without column errors

### Requirement 5

**User Story:** As a developer, I want the proposal repository to be aligned with the current database schema documentation, so that future development is consistent and reliable.

#### Acceptance Criteria

1. WHEN reviewing proposal repository code, THE System SHALL reflect the current database table structure
2. WHEN new proposal features are developed, THE System SHALL use the correct column references from the start
3. WHEN database schema changes occur, THE System SHALL have clear processes for updating repository queries
4. WHEN documenting the proposal system, THE System SHALL accurately reflect the current schema relationships
5. WHEN onboarding new developers, THE System SHALL provide clear examples of correct proposal repository usage