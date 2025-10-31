# Implementation Plan

- [x] 1. Add SwapExpirationService factory method





  - Create factory function in existing swap services factory file
  - Add configuration parameter handling for check interval
  - Include environment variable support for configuration
  - _Requirements: 1.4, 3.1, 3.2, 3.5_

- [x] 2. Integrate SwapExpirationService into application startup





  - [x] 2.1 Add service initialization in index.ts after SwapProposalService


    - Import SwapExpirationService and factory method
    - Initialize service with proper dependencies
    - Add startup logging for service initialization
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Start the service with appropriate timing


    - Add service start call after all dependencies are ready
    - Include startup delay to ensure stability
    - Handle startup errors gracefully with logging
    - _Requirements: 1.1, 1.2, 1.5_
-

- [x] 3. Add health check monitoring for SwapExpirationService




  - Register health check in existing health monitoring system
  - Include service status details in health check response
  - Add service-specific health metrics
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Implement graceful shutdown for SwapExpirationService






  - [x] 4.1 Add service stop call to graceful shutdown handler

    - Include SwapExpirationService in shutdown sequence
    - Add proper error handling for shutdown failures
    - Log shutdown success/failure appropriately
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 4.2 Handle shutdown timeout and cleanup


    - Implement timeout handling for service shutdown
    - Ensure resources are cleaned up even on timeout
    - Add shutdown phase tracking for monitoring
    - _Requirements: 2.2, 2.4, 2.5_

- [x] 5. Add configuration support and validation





  - Define environment variables for service configuration
  - Add configuration validation with safe defaults
  - Include feature flag for enabling/disabling service
  - _Requirements: 3.2, 3.3, 3.5, 5.5_

- [ ]* 6. Add comprehensive logging and monitoring
  - Add structured logging for service lifecycle events
  - Include performance metrics for service operations
  - Add error tracking and alerting capabilities
  - _Requirements: 4.3, 4.4_

- [ ]* 7. Write integration tests for service startup
  - Test service starts correctly during application startup
  - Test service stops correctly during graceful shutdown
  - Test health check integration and status reporting
  - _Requirements: 1.1, 2.1, 4.1_

- [ ]* 8. Add error recovery and retry logic
  - Implement retry mechanism for service startup failures
  - Add exponential backoff for failed startup attempts
  - Include fallback behavior when service cannot start
  - _Requirements: 1.5, 5.5_

- [x] 9. Fix database schema mismatch in expired proposals query
  - Update findExpiredProposals query to use correct column structure (expires_at instead of terms->>'expiresAt')
  - Ensure query matches actual database schema with individual columns
  - Test the corrected query to verify it works with existing data
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 10. Fix database constraint violation when cancelling expired swaps
  - Investigate and resolve the "check_expires_future" constraint violation
  - Ensure expired swaps can be properly updated to 'cancelled' status
  - Handle constraint violations gracefully in the expiration process
  - _Requirements: 5.1, 5.2_