# Requirements Document

## Introduction

This feature addresses a critical missing API endpoint that is causing 404 errors when users try to make proposals. The frontend's MakeProposalModal component is already calling `GET /api/swaps/{sourceSwapId}/compatibility/{targetSwapId}` to fetch compatibility analysis and display compatibility scores for each eligible swap in the proposal modal. However, this endpoint doesn't exist in the backend, causing the compatibility analysis to fail and preventing users from seeing compatibility scores when making proposals. The solution is to implement the missing compatibility analysis endpoint that the frontend is already expecting and calling.

## Requirements

### Requirement 1: Implement Missing Compatibility Analysis Endpoint

**User Story:** As a frontend application, I want to call `GET /api/swaps/{sourceSwapId}/compatibility/{targetSwapId}` to analyze swap compatibility so that users can see compatibility scores before making proposals.

#### Acceptance Criteria

1. WHEN the frontend makes a GET request to `/api/swaps/{sourceSwapId}/compatibility/{targetSwapId}` THEN the system SHALL route it to a valid controller method
2. WHEN the endpoint receives a valid compatibility request THEN the system SHALL analyze compatibility between the two swaps
3. WHEN the endpoint processes the request THEN the system SHALL return a compatibility analysis with scores and factors
4. WHEN the endpoint is called THEN the system SHALL require authentication to prevent unauthorized access
5. WHEN the endpoint validates the request THEN the system SHALL ensure both swap IDs exist and are accessible to the user
6. WHEN the analysis is complete THEN the system SHALL return the response in the format expected by the frontend
7. WHEN the endpoint encounters errors THEN the system SHALL return appropriate HTTP status codes and error messages

### Requirement 2: Comprehensive Compatibility Analysis

**User Story:** As a user making a proposal, I want to see detailed compatibility analysis between swaps so that I can make informed decisions about which proposals to submit.

#### Acceptance Criteria

1. WHEN analyzing compatibility THEN the system SHALL calculate location compatibility based on geographic proximity
2. WHEN analyzing compatibility THEN the system SHALL calculate date compatibility based on booking date overlap and flexibility
3. WHEN analyzing compatibility THEN the system SHALL calculate value compatibility based on booking prices and perceived value
4. WHEN analyzing compatibility THEN the system SHALL calculate accommodation compatibility based on property types and amenities
5. WHEN analyzing compatibility THEN the system SHALL calculate guest compatibility based on group sizes and requirements
6. WHEN calculating scores THEN the system SHALL provide individual factor scores from 0-100 with appropriate weights
7. WHEN generating analysis THEN the system SHALL provide an overall compatibility score from 0-100
8. WHEN compatibility is low THEN the system SHALL provide specific recommendations for improvement

### Requirement 3: Performance and Caching Optimization

**User Story:** As a system administrator, I want compatibility analysis to be fast and efficient so that users don't experience delays when browsing and making proposals.

#### Acceptance Criteria

1. WHEN the same compatibility analysis is requested multiple times THEN the system SHALL cache results for a reasonable duration
2. WHEN caching compatibility results THEN the system SHALL use a cache key that includes both swap IDs
3. WHEN swap data is updated THEN the system SHALL invalidate related compatibility cache entries
4. WHEN the analysis takes too long THEN the system SHALL timeout gracefully and return a partial analysis
5. WHEN multiple compatibility requests are made THEN the system SHALL handle them efficiently without blocking
6. WHEN the cache is full THEN the system SHALL use appropriate eviction policies to maintain performance
7. WHEN returning cached results THEN the system SHALL include cache metadata in response headers

### Requirement 4: Error Handling and Validation

**User Story:** As a user, I want to receive clear error messages when compatibility analysis fails so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN either swap ID doesn't exist THEN the system SHALL return a 404 Not Found error with specific details
2. WHEN the user lacks permission to view a swap THEN the system SHALL return a 403 Forbidden error
3. WHEN the user is not authenticated THEN the system SHALL return a 401 Unauthorized error
4. WHEN swap IDs are invalid format THEN the system SHALL return a 400 Bad Request error with validation details
5. WHEN the same swap ID is used for both parameters THEN the system SHALL return a 400 Bad Request error
6. WHEN a server error occurs during analysis THEN the system SHALL return a 500 Internal Server Error with appropriate logging
7. WHEN analysis partially fails THEN the system SHALL return available results with warnings about missing data

### Requirement 5: Integration with Existing Proposal System

**User Story:** As a developer, I want the compatibility endpoint to integrate seamlessly with existing proposal functionality so that the user experience is consistent.

#### Acceptance Criteria

1. WHEN compatibility analysis is performed THEN the system SHALL use the same business logic as proposal validation
2. WHEN compatibility factors are calculated THEN the system SHALL use the same algorithms as the proposal system
3. WHEN returning compatibility data THEN the system SHALL use the same data types and interfaces as other API endpoints
4. WHEN the endpoint is added THEN the system SHALL maintain compatibility with existing proposal endpoints
5. WHEN users make proposals THEN the system SHALL optionally use cached compatibility data to speed up validation
6. WHEN proposal rules change THEN the system SHALL ensure compatibility analysis reflects the same rules
7. WHEN the endpoint is called THEN the system SHALL log analytics data consistent with other proposal-related endpoints

### Requirement 6: Response Format and Data Structure

**User Story:** As a frontend developer, I want the compatibility endpoint to return data in the expected format so that existing frontend code works without modifications.

#### Acceptance Criteria

1. WHEN returning compatibility analysis THEN the system SHALL include an overall compatibility score (0-100)
2. WHEN returning analysis THEN the system SHALL include individual factor scores for location, date, value, accommodation, and guest compatibility
3. WHEN returning analysis THEN the system SHALL include factor weights that explain how the overall score is calculated
4. WHEN returning analysis THEN the system SHALL include specific recommendations as an array of strings
5. WHEN returning analysis THEN the system SHALL include a recommendation level (highly_recommended, recommended, possible, not_recommended)
6. WHEN returning analysis THEN the system SHALL include metadata about when the analysis was performed and cache status
7. WHEN returning analysis THEN the system SHALL follow the same JSON structure as defined in the frontend types

### Requirement 7: Security and Access Control

**User Story:** As a security administrator, I want the compatibility endpoint to enforce proper access controls so that users can only analyze swaps they have permission to view.

#### Acceptance Criteria

1. WHEN a user requests compatibility analysis THEN the system SHALL verify the user is authenticated
2. WHEN checking swap access THEN the system SHALL ensure the user can view both swaps involved in the analysis
3. WHEN a swap is private or restricted THEN the system SHALL deny access to unauthorized users
4. WHEN rate limiting is enabled THEN the system SHALL apply appropriate limits to prevent abuse
5. WHEN logging requests THEN the system SHALL include user ID and swap IDs for audit purposes
6. WHEN handling sensitive data THEN the system SHALL not expose private information in compatibility analysis
7. WHEN the user owns one of the swaps THEN the system SHALL allow analysis regardless of the other swap's privacy settings