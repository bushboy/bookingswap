# Implementation Plan

- [x] 1. Create simple targeting data transformer with comprehensive logging





  - Build SimpleTargetingTransformer class with linear transformation logic
  - Add extensive logging at each transformation step
  - Create data validation methods for incoming and outgoing targets
  - Implement error handling with detailed context logging
  - _Requirements: 1.1, 1.2_

- [x] 2. Simplify getUserSwapsWithTargeting method in SwapProposalService





  - Replace complex transformation logic with SimpleTargetingTransformer
  - Add step-by-step logging for debugging data flow issues
  - Implement graceful fallback to basic swap cards when targeting data fails
  - Add data consistency validation between repository and service layers
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Create debugging utilities for targeting data inspection





  - Add debug endpoint to inspect targeting data at each transformation step
  - Create data consistency validation tools
  - Implement logging that can be enabled in production for troubleshooting
  - Add utility to compare swap_targets table data with displayed results
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Update frontend SwapCard component to display simple targeting information





  - Modify SwapCard to show basic targeting indicators (incoming count, outgoing status)
  - Add simple visual indicators for targeting relationships
  - Ensure targeting display works with simplified data structure
  - Add error handling for missing or invalid targeting data
  - _Requirements: 1.2, 1.3_

- [x] 5. Test and validate targeting display with existing data









  - Verify that existing swap_targets table data appears in the UI
  - Test that both users in a targeting relationship can see the connection
  - Validate that targeting actions work with the simplified display
  - Ensure no data loss or corruption during the simplification
  - _Requirements: 1.1, 1.2, 1.3, 1.4_