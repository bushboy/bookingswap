# Requirements Document

## Introduction

This feature addresses a critical routing issue where the frontend is calling `POST /api/swaps/{swapId}/proposals` to create swap proposals, but the backend only has the endpoint `POST /api/swaps/{targetSwapId}/proposals/from-browse` implemented. This mismatch is causing 404 errors when users try to create proposals through the MakeProposalModal component. The solution is to add the missing endpoint that the frontend expects while maintaining compatibility with existing functionality.

## Requirements

### Requirement 1: Add Missing Proposal Creation Endpoint

**User Story:** As a frontend application, I want to call `POST /api/swaps/{swapId}/proposals` to create swap proposals so that users can successfully submit proposals without getting 404 errors.

#### Acceptance Criteria

1. WHEN the frontend makes a POST request to `/api/swaps/{swapId}/proposals` THEN the system SHALL route it to a valid controller method
2. WHEN the endpoint receives a valid proposal request THEN the system SHALL create the proposal using existing business logic
3. WHEN the endpoint is called THEN the system SHALL return the same response format as other proposal endpoints
4. WHEN the endpoint is registered THEN the system SHALL require authentication like other proposal endpoints
5. WHEN the endpoint processes requests THEN the system SHALL use the same validation and error handling as existing proposal methods

### Requirement 2: Maintain Compatibility with Existing Functionality

**User Story:** As a system administrator, I want the new endpoint to work alongside existing proposal endpoints so that all current functionality continues to work without breaking changes.

#### Acceptance Criteria

1. WHEN the new endpoint is added THEN the existing `/api/swaps/{targetSwapId}/proposals/from-browse` endpoint SHALL continue to work
2. WHEN the new endpoint is added THEN the existing `/api/swaps/{id}/proposals/enhanced` endpoint SHALL continue to work
3. WHEN both endpoints are available THEN the system SHALL handle requests to either endpoint correctly
4. WHEN the new endpoint is implemented THEN the system SHALL reuse existing business logic for proposal creation
5. WHEN the new endpoint processes requests THEN the system SHALL maintain the same security and validation standards

### Requirement 3: Proper Error Handling and Validation

**User Story:** As a user creating proposals, I want to receive clear error messages when something goes wrong so that I can understand and fix any issues.

#### Acceptance Criteria

1. WHEN the request has invalid data THEN the system SHALL return appropriate validation error messages
2. WHEN the user is not authenticated THEN the system SHALL return a 401 Unauthorized error
3. WHEN the user lacks permission THEN the system SHALL return a 403 Forbidden error
4. WHEN the target swap doesn't exist THEN the system SHALL return a 404 Not Found error
5. WHEN a server error occurs THEN the system SHALL return a 500 Internal Server Error with appropriate logging
6. WHEN validation fails THEN the system SHALL return field-specific error details
7. WHEN the request is successful THEN the system SHALL return a 201 Created status with the proposal details

### Requirement 4: Consistent Request and Response Format

**User Story:** As a frontend developer, I want the new endpoint to use the same request and response format as documented so that existing frontend code works without modifications.

#### Acceptance Criteria

1. WHEN the endpoint receives a request THEN the system SHALL accept the same request format as defined in the frontend types
2. WHEN the endpoint returns a response THEN the system SHALL use the same response format as other proposal endpoints
3. WHEN the endpoint handles errors THEN the system SHALL return errors in the same format as other API endpoints
4. WHEN the endpoint processes the request THEN the system SHALL validate the request body against the expected schema
5. WHEN the endpoint returns success THEN the system SHALL include all necessary proposal details in the response

### Requirement 5: Route Registration and Middleware Integration

**User Story:** As a system, I want the new endpoint to be properly registered with all necessary middleware so that it integrates seamlessly with the existing API infrastructure.

#### Acceptance Criteria

1. WHEN the endpoint is registered THEN the system SHALL include it in the swaps router configuration
2. WHEN the endpoint is accessed THEN the system SHALL apply authentication middleware
3. WHEN the endpoint is accessed THEN the system SHALL apply error handling middleware
4. WHEN the endpoint is accessed THEN the system SHALL apply request logging middleware
5. WHEN the endpoint is registered THEN the system SHALL maintain the correct route precedence to avoid conflicts