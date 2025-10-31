# Requirements Document

## Introduction

This feature involves simplifying the current database schema for swaps by removing redundant foreign key relationships and inferring ownership through existing booking relationships. The current schema has unnecessary complexity with multiple ID references that can be derived from the core booking-user relationship, making queries more complex than needed.

## Requirements

### Requirement 1

**User Story:** As a developer, I want a simplified swap database schema, so that queries are more intuitive and the data model is cleaner.

#### Acceptance Criteria

1. WHEN a swap is created THEN the system SHALL NOT store redundant target_booking_id, proposer_id, or owner_id fields
2. WHEN querying swaps THEN the system SHALL infer ownership through the booking-user relationship
3. WHEN a swap is stored THEN the system SHALL maintain data integrity without redundant foreign keys
4. WHEN accessing swap data THEN the system SHALL provide the same functionality as before with simplified queries

### Requirement 2

**User Story:** As a developer, I want swap_target records without proposal_id references, so that the relationship is simplified through the source_swap_id.

#### Acceptance Criteria

1. WHEN a swap_target is created THEN the system SHALL NOT store a separate proposal_id field
2. WHEN querying swap targets THEN the system SHALL use source_swap_id as the primary relationship
3. WHEN accessing swap target data THEN the system SHALL maintain referential integrity through source_swap_id
4. IF a swap target needs proposal information THEN the system SHALL derive it through the source_swap_id relationship

### Requirement 3

**User Story:** As a developer, I want database migrations to safely transform the existing schema, so that no data is lost during the simplification process.

#### Acceptance Criteria

1. WHEN running database migrations THEN the system SHALL preserve all existing swap and swap_target data
2. WHEN migrating the schema THEN the system SHALL remove redundant columns safely
3. WHEN the migration completes THEN the system SHALL verify data integrity
4. IF migration fails THEN the system SHALL provide rollback capabilities
5. WHEN migration is complete THEN the system SHALL update all related queries and services

### Requirement 4

**User Story:** As a developer, I want updated application code that works with the simplified schema, so that all swap functionality continues to work correctly.

#### Acceptance Criteria

1. WHEN swap queries are executed THEN the system SHALL use the simplified schema relationships
2. WHEN creating swaps THEN the system SHALL not attempt to set removed fields
3. WHEN updating swaps THEN the system SHALL work with the new schema structure
4. WHEN deleting swaps THEN the system SHALL maintain proper cascade behavior
5. IF existing code references removed fields THEN the system SHALL be updated to use derived relationships