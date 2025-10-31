# Implementation Plan

- [x] 1. Register missing from-browse route in swaps router
  - Add the missing route registration for `POST /:id/proposals/from-browse` in the swaps router
  - Ensure the route is placed in correct order to avoid conflicts with other routes
  - Verify the route connects to the existing `createProposalFromBrowse` method
  - _Requirements: 2.1, 2.2, 5.1, 5.2, 5.5_

- [x] 2. Implement new createProposal method in SwapController
  - Create the `createProposal` method that handles `POST /:id/proposals` requests
  - Extract targetSwapId from route parameters and request data from body
  - Implement parameter validation and user authentication checks
  - Add proper error handling with consistent error response format
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 4.4_

- [x] 3. Add request delegation to existing browse proposal logic
  - Transform the incoming request to match the browse proposal format
  - Call the existing `swapMatchingService.createProposalFromBrowse` method
  - Handle the response transformation to match expected frontend format
  - Ensure all business logic and validation from browse proposals is reused
  - _Requirements: 1.2, 2.4, 4.1, 4.2_

- [x] 4. Register new proposal endpoint in swaps router
  - Add route registration for `POST /:id/proposals` in the swaps router
  - Place the route after more specific routes to maintain proper precedence
  - Ensure authentication middleware is applied to the new route
  - Verify the route connects to the new `createProposal` method
  - _Requirements: 1.1, 5.1, 5.2, 5.3, 5.4_

- [x] 5. Add comprehensive error handling for the new endpoint
  - Implement specific error handling for validation failures
  - Add proper HTTP status codes for different error scenarios
  - Create user-friendly error messages that match existing API patterns
  - Add error logging for debugging and monitoring purposes
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6. Create unit tests for the new createProposal method
  - Write tests for successful proposal creation with valid data
  - Add tests for validation errors with invalid source/target swaps
  - Test authentication and authorization error scenarios
  - Verify error response formats match API standards
  - _Requirements: 1.3, 3.1, 3.2, 3.3, 4.3_

- [x] 7. Add integration tests for the new API endpoint

  - Create end-to-end tests that call the new endpoint via HTTP
  - Test the complete flow from request to database storage
  - Verify the endpoint works with authentication middleware
  - Test error scenarios including network and database failures
  - _Requirements: 1.1, 1.4, 2.1, 2.2, 5.2, 5.3_

- [x] 8. Verify frontend compatibility with the new endpoint
  - Test that existing frontend code works with the new endpoint
  - Verify the MakeProposalModal can successfully create proposals
  - Check that error handling in the frontend works with new error responses
  - Ensure no breaking changes to existing frontend functionality
  - _Requirements: 4.1, 4.2, 4.3, 4.4_