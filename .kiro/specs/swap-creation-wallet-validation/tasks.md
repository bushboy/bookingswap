# Implementation Plan

- [x] 1. Create wallet validation service infrastructure





  - Create WalletValidationService class with validation orchestration methods
  - Implement wallet connection validation logic
  - Add balance requirement calculation utilities
  - _Requirements: 1.1, 1.3, 3.1, 3.2_

- [x] 1.1 Implement WalletValidationService core methods


  - Write validateSwapCreation method that orchestrates all validation checks
  - Implement validateWalletConnection method for connection status checking
  - Create calculateBalanceRequirements method for fee calculations
  - _Requirements: 1.1, 3.1, 3.2_

- [x] 1.2 Create balance calculation utilities


  - Implement BalanceCalculator class in shared package
  - Write methods for transaction fee, platform fee, and total requirement calculations
  - Add support for different swap types (booking exchange vs cash payment)
  - _Requirements: 3.2, 3.3, 4.2, 4.3_

- [ ]* 1.3 Write unit tests for validation service
  - Create tests for WalletValidationService methods with various wallet states
  - Test BalanceCalculator with different swap configurations
  - Add edge case testing for validation scenarios
  - _Requirements: 1.1, 3.1, 3.2_

- [x] 2. Enhance frontend swap creation modal with validation





  - Integrate WalletValidationService into EnhancedSwapCreationModal
  - Add pre-submission validation hooks
  - Implement real-time wallet status checking
  - _Requirements: 1.1, 1.4, 2.1, 2.3_

- [x] 2.1 Add wallet validation to form submission


  - Implement validation check before allowing form submission
  - Add wallet connection verification in handleSubmit method
  - Prevent form submission when validation fails
  - _Requirements: 1.1, 1.4, 2.1_

- [x] 2.2 Implement comprehensive error display


  - Create detailed error messages for wallet connection failures
  - Add balance requirement breakdown display
  - Implement user-friendly error formatting with actionable guidance
  - _Requirements: 2.1, 2.2, 3.4_

- [x] 2.3 Add real-time wallet status monitoring


  - Implement wallet connection status indicator in the modal
  - Add automatic re-validation when wallet state changes
  - Update UI immediately when wallet connects or disconnects
  - _Requirements: 2.3, 2.5_

- [ ]* 2.4 Write integration tests for modal validation
  - Test modal behavior with different wallet states
  - Verify error display and user interaction flows
  - Test real-time validation updates
  - _Requirements: 1.1, 2.1, 2.3_

- [x] 3. Implement backend wallet validation





  - Enhance SwapController with server-side wallet validation
  - Add wallet address and balance verification
  - Implement comprehensive error responses
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 3.1 Create HederaBalanceService for blockchain validation


  - Implement getAccountBalance method using Hedera SDK
  - Add validateSufficientBalance method with requirement checking
  - Implement balance caching with appropriate TTL
  - _Requirements: 3.1, 5.2, 5.3_

- [x] 3.2 Enhance SwapController validation logic


  - Add wallet validation middleware to createEnhancedSwap endpoint
  - Implement server-side balance verification
  - Add comprehensive error responses with detailed validation results
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 3.3 Implement validation error handling


  - Create structured error responses for different validation failures
  - Add appropriate HTTP status codes for validation errors
  - Implement audit logging for validation failures
  - _Requirements: 5.3, 5.4, 5.5_

- [ ]* 3.4 Write backend validation tests
  - Test SwapController validation with various wallet scenarios
  - Test HederaBalanceService with mocked blockchain responses
  - Add error handling and edge case testing
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Integrate validation across all swap types




  - Ensure consistent validation for booking exchange swaps
  - Add specific validation for cash-enabled swaps
  - Implement appropriate error messages for each swap type
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4.1 Implement swap type specific validation


  - Add validation logic for booking-only swaps (transaction fees only)
  - Implement cash-enabled swap validation (escrow + fees)
  - Create appropriate balance requirement calculations for each type
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 4.2 Add consistent error messaging


  - Implement swap type specific error messages
  - Ensure consistent validation behavior across all creation flows
  - Add appropriate guidance based on swap configuration
  - _Requirements: 4.4, 2.1, 2.2_

- [ ]* 4.3 Write comprehensive validation tests
  - Test validation across different swap types
  - Verify consistent behavior for all swap configurations
  - Add end-to-end validation flow testing
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Implement wallet connection guidance and recovery





  - Add wallet connection prompts and instructions
  - Implement automatic retry after wallet connection
  - Add wallet connection status indicators
  - _Requirements: 2.2, 2.3, 2.5_

- [x] 5.1 Create wallet connection guidance UI


  - Add "Connect Wallet" button and instructions when validation fails
  - Implement clear messaging about wallet requirements
  - Create step-by-step connection guidance
  - _Requirements: 2.1, 2.2_

- [x] 5.2 Implement validation recovery flow


  - Add automatic re-validation after wallet connection
  - Implement seamless transition from error state to valid state
  - Ensure form data persistence during validation recovery
  - _Requirements: 2.3, 2.5_

- [ ]* 5.3 Write user experience tests
  - Test wallet connection guidance and recovery flows
  - Verify error message clarity and actionability
  - Test validation state transitions
  - _Requirements: 2.1, 2.2, 2.3_