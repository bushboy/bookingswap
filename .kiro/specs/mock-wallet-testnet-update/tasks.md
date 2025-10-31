# Implementation Plan

- [x] 1. Create centralized wallet configuration





  - Create `tests/fixtures/wallet-config.ts` with testnet wallet address 0.0.6199687 and DER private key
  - Define helper functions for creating mock wallet responses and account info
  - Add wallet address validation utilities
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 2. Update mock services infrastructure




  - [x] 2.1 Update `tests/e2e/fixtures/mock-services.ts` to use centralized wallet config


    - Import wallet configuration from centralized location
    - Update `mockWalletConnection()` method to use new wallet address
    - Replace hardcoded wallet addresses with config references
    - _Requirements: 1.3, 2.3_

- [x] 3. Update E2E wallet test files





  - [x] 3.1 Update `tests/e2e/wallet-integration.spec.ts`


    - Replace hardcoded wallet addresses with centralized config imports
    - Update HashPack and Blade wallet mock configurations
    - Ensure test assertions work with new wallet address
    - _Requirements: 1.1, 1.3_

  - [x] 3.2 Update `tests/e2e/wallet-session-management.spec.ts`


    - Replace all instances of 0.0.123456 with 0.0.6199687
    - Update session data and account ID references
    - Maintain test logic while using new wallet address
    - _Requirements: 1.1, 1.3_

  - [x] 3.3 Update `tests/e2e/wallet-provider-switching.spec.ts`


    - Update primary and secondary wallet addresses in mock configurations
    - Replace hardcoded account IDs with centralized config
    - Verify multi-wallet scenarios work with new addresses
    - _Requirements: 1.1, 1.3_

  - [x] 3.4 Update `tests/e2e/wallet-error-scenarios.spec.ts`


    - Update wallet addresses in error scenario mocks
    - Maintain error handling test logic with new wallet address
    - _Requirements: 1.1, 1.3_
- [x] 4. Update backend integration tests




- [ ] 4. Update backend integration tests

  - [x] 4.1 Update `apps/backend/src/__tests__/auth-integration.test.ts`


    - Update WalletService mock to use new wallet address
    - Replace hardcoded wallet addresses in test data
    - _Requirements: 1.1, 1.3_

  - [x] 4.2 Update `apps/backend/src/__tests__/server-startup.integration.test.ts`


    - Update wallet service mock configuration
    - Replace placeholder wallet addresses with 0.0.6199687
    - _Requirements: 1.1, 1.3_


  - [x] 4.3 Update other backend integration tests

    - Update `swap-proposal-endpoint.integration.test.ts`
    - Update `password-recovery*.test.ts` files
    - Replace WalletService mock configurations
    - _Requirements: 1.1, 1.3_
-

- [x] 5. Update database test scripts and load tests




  - [x] 5.1 Update `test-accepted-target-filter.js`


    - Replace blockchain_topic_id values with 0.0.6199687
    - Update blockchain_proposal_transaction_id prefixes
    - Maintain test logic while using new wallet address
    - _Requirements: 1.4_

  - [x] 5.2 Update `tests/load/load-test.js`


    - Replace test user wallet addresses with 0.0.6199687
    - Update load test data to use centralized configuration
    - _Requirements: 1.4_

  - [x] 5.3 Update other standalone test scripts


    - Update `test-wallet-service-integration.js`
    - Replace hardcoded wallet addresses in all test-*.js files
    - _Requirements: 1.4_

- [ ]* 6. Add configuration validation tests
  - Write unit tests for wallet configuration validation
  - Test helper functions for creating mock responses
  - Verify centralized configuration exports correct values
  - _Requirements: 2.4, 2.5_

- [ ]* 7. Update test documentation
  - Update `tests/e2e/README.md` with new wallet configuration approach
  - Document centralized wallet configuration usage
  - Add examples of using wallet config in new tests
  - _Requirements: 2.5_

- [ ] 8. Verify and validate implementation
  - [ ] 8.1 Run E2E test suite to verify wallet functionality
    - Execute wallet integration tests
    - Verify no test regressions with new wallet address
    - Check that wallet connection flows work correctly
    - _Requirements: 1.5_

  - [ ] 8.2 Run backend integration tests
    - Execute auth and wallet service integration tests
    - Verify mock configurations work with new wallet address
    - _Requirements: 1.5_

  - [ ] 8.3 Run database and load tests
    - Execute updated database test scripts
    - Run load tests with new wallet configuration
    - Verify blockchain-related test data uses correct wallet address
    - _Requirements: 1.5_