# Implementation Plan

- [x] 1. Add compatibility endpoint route





  - Add GET route `/api/swaps/:sourceSwapId/compatibility/:targetSwapId` to swaps router
  - Ensure route is placed before generic `/:id` routes to avoid conflicts
  - Apply authentication middleware to the route
  - _Requirements: 1.1, 1.4_

- [x] 2. Implement controller method for compatibility analysis





  - [x] 2.1 Create `getSwapCompatibility` method in SwapController


    - Extract and validate sourceSwapId and targetSwapId from route parameters
    - Validate UUID format for both swap IDs
    - Ensure sourceSwapId !== targetSwapId to prevent same-swap analysis
    - _Requirements: 1.1, 4.5_
  
  - [x] 2.2 Add authentication and authorization checks


    - Verify user is authenticated via existing middleware
    - Check user has permission to view both swaps (owns source swap or both are public)
    - Return appropriate 401/403 errors for unauthorized access
    - _Requirements: 1.4, 7.1, 7.2_
  
  - [x] 2.3 Integrate with SwapMatchingService


    - Call existing `SwapMatchingService.getSwapCompatibility()` method
    - Handle service errors and convert to appropriate HTTP responses
    - Return CompatibilityResponse in expected format
    - _Requirements: 1.2, 1.6, 5.1_
  
  - [x] 2.4 Add comprehensive error handling


    - Handle invalid UUID format (400 Bad Request)
    - Handle non-existent swaps (404 Not Found)
    - Handle same swap comparison (400 Bad Request)
    - Handle service failures (500 Internal Server Error)
    - Use existing error handling patterns and utilities
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

- [x] 3. Add route registration to swaps router





  - Register the new route in `createSwapRoutes` function
  - Ensure proper middleware order (auth before route handler)
  - Add route documentation comments
  - _Requirements: 1.1, 1.4_

- [-] 4. Create comprehensive unit tests



  - [x] 4.1 Test successful compatibility analysis


    - Mock SwapMatchingService to return valid CompatibilityResponse
    - Verify correct response format and status code
    - Test with different compatibility scores and recommendations
    - _Requirements: 1.2, 1.6_
  
  - [x] 4.2 Test input validation scenarios


    - Test invalid UUID format for sourceSwapId
    - Test invalid UUID format for targetSwapId
    - Test same swap ID for both parameters
    - Verify appropriate 400 error responses
    - _Requirements: 4.5, 4.1_
  
  - [x] 4.3 Test authentication and authorization


    - Test unauthenticated request returns 401
    - Test user without permission returns 403
    - Test successful authorization for swap owner
    - _Requirements: 7.1, 7.2, 4.2, 4.3_
  
  - [x] 4.4 Test error handling scenarios






    - Test non-existent source swap returns 404
    - Test non-existent target swap returns 404
    - Test service failure returns 500
    - Verify error response format consistency
    - _Requirements: 4.1, 4.2, 4.6_

- [ ]* 5. Create integration tests
  - [ ]* 5.1 Test end-to-end compatibility analysis flow
    - Create test swaps with known booking details
    - Call endpoint and verify full analysis pipeline
    - Test caching behavior and performance
    - _Requirements: 1.1, 1.2, 3.1_
  
  - [ ]* 5.2 Test middleware integration
    - Verify authentication middleware properly applied
    - Test route parameter extraction
    - Test error middleware handling
    - _Requirements: 1.4, 4.1_

- [ ] 6. Update API documentation
  - Add endpoint documentation to existing API docs
  - Include request/response examples
  - Document error codes and scenarios
  - _Requirements: 1.6, 4.1_

- [ ] 7. Verify frontend integration
  - Test that existing MakeProposalModal works with new endpoint
  - Verify compatibility scores display correctly
  - Confirm error handling works as expected
  - _Requirements: 1.1, 1.2, 5.4_