# Requirements Document

## Introduction

The /swaps endpoint is returning a 401 Unauthorized error even when users have valid authentication tokens after login. This issue prevents authenticated users from accessing their swap data, breaking the core functionality of the swap management system. The problem appears to be related to authentication middleware configuration or token validation in the swaps routes.

## Requirements

### Requirement 1: Fix Authentication for Swaps Endpoint

**User Story:** As an authenticated user, I want to access the /swaps endpoint with my valid token, so that I can view and manage my swaps without getting unauthorized errors.

#### Acceptance Criteria

1. WHEN a user makes a GET request to /swaps with a valid authentication token THEN the system SHALL return the user's swaps data with a 200 status code
2. WHEN a user makes a GET request to /swaps without an authentication token THEN the system SHALL return a 401 Unauthorized error
3. WHEN a user makes a GET request to /swaps with an invalid or expired token THEN the system SHALL return a 401 Unauthorized error with appropriate error message
4. WHEN the authentication middleware processes a valid token THEN the system SHALL extract and attach user information to the request object
5. WHEN the getUserSwaps controller method is called THEN the system SHALL have access to authenticated user data from the request

### Requirement 2: Verify Token Validation Logic

**User Story:** As a developer, I want to ensure the authentication middleware correctly validates tokens, so that legitimate users can access protected endpoints.

#### Acceptance Criteria

1. WHEN the auth middleware receives a Bearer token THEN the system SHALL properly extract and validate the token format
2. WHEN the token validation process runs THEN the system SHALL verify the token signature and expiration
3. WHEN token validation succeeds THEN the system SHALL attach user data to the request object for downstream controllers
4. WHEN token validation fails THEN the system SHALL return appropriate error responses without exposing sensitive information

### Requirement 3: Debug and Log Authentication Flow

**User Story:** As a developer, I want detailed logging of the authentication process, so that I can identify where the 401 error is occurring.

#### Acceptance Criteria

1. WHEN authentication middleware processes a request THEN the system SHALL log token presence and validation steps
2. WHEN authentication fails THEN the system SHALL log the specific reason for failure without exposing sensitive data
3. WHEN the getUserSwaps method is called THEN the system SHALL log whether user data is properly attached to the request
4. WHEN debugging is enabled THEN the system SHALL provide detailed authentication flow information for troubleshooting