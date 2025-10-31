# Implementation Plan

- [x] 1. Analyze and prepare for SwapTargetingRepository cleanup





  - Examine both implementations of `getPaginatedTargetingData` to identify key differences
  - Examine both implementations of `getTargetingCounts` to identify which has better features
  - Document the line numbers and exact locations of duplicate methods
  - _Requirements: 1.1, 1.2_

- [x] 2. Fix getPaginatedTargetingData duplicate method in SwapTargetingRepository






  - Remove the first implementation at line 453 (simple page/limit version)
  - Keep the second implementation at line 786 (advanced options-based version)
  - Ensure the remaining method handles all use cases from both implementations
  - _Requirements: 1.1, 1.3, 2.1_

- [x] 3. Fix getTargetingCounts duplicate method in SwapTargetingRepository









  - Remove the second implementation at line 917 (simpler version without caching)
  - Keep the first implementation at line 680 (includes caching and better error handling)
  - Verify the remaining method includes all necessary features
  - _Requirements: 1.1, 1.3, 2.1_

- [x] 4. Analyze and prepare for SwapTargetingService cleanup





  - Examine both implementations of `getTargetingHistory` to understand differences
  - Identify which implementation provides more comprehensive functionality
  - Plan method consolidation strategy to preserve all use cases
  - _Requirements: 1.1, 1.2_

- [x] 5. Fix getTargetingHistory duplicate method in SwapTargetingService





  - Remove the first implementation at line 286 (simple delegation version)
  - Keep the second implementation at line 945 (advanced version with filtering/pagination)
  - Add method overload or parameter handling to support simple use case
  - _Requirements: 1.1, 1.3, 2.1_

- [x] 6. Validate TypeScript compilation and functionality





  - Compile TypeScript to verify all duplicate method errors are resolved
  - Check that no new compilation errors were introduced
  - Verify that the consolidated methods maintain expected functionality
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 7. Fix createEnhancedSwap duplicate method in SwapRepository



  - Remove the first implementation at line 341 (basic version with minimal error handling)
  - Keep the second implementation at line 3570 (enhanced version with comprehensive logging and validation)
  - Verify the remaining method includes all necessary features and error handling
  - _Requirements: 1.1, 1.3, 2.1_

- [ ] 8. Final validation of all duplicate method fixes
  - Compile TypeScript to verify all duplicate method errors are resolved across all repositories
  - Check that no new compilation errors were introduced
  - Verify that all consolidated methods maintain expected functionality
  - _Requirements: 1.1, 2.1, 2.2_

- [ ]* 9. Run comprehensive tests to ensure no breaking changes
  - Execute existing test suite to verify functionality preservation
  - Test specific methods that were consolidated to ensure they work correctly
  - Validate that all method callers continue to work with consolidated signatures
  - _Requirements: 2.2, 2.3_