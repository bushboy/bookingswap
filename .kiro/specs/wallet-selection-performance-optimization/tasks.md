# Implementation Plan

- [x] 1. Remove availability detection from WalletService


  - Remove availability caching mechanisms and background polling
  - Simplify provider registration to be synchronous without checks
  - Remove getAvailableProviders and getProviderAvailabilityStatus methods
  - _Requirements: 1.5, 6.1, 6.2, 6.3_



- [ ] 2. Simplify WalletSelectionModal for immediate display
  - Remove provider availability state management and checking useEffect
  - Display all providers statically without availability indicators


  - Remove real-time availability updates and loading states for detection
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 3. Implement lazy wallet detection on connection attempt


  - Move wallet availability checking to connection attempt phase
  - Add connection loading state for individual providers during connection
  - Implement connection timeout handling within 5 seconds
  - _Requirements: 3.1, 3.2, 3.3, 3.5_



- [ ] 4. Optimize provider adapters for simplified detection
  - Remove complex availability caching and retry logic from KabilaAdapter
  - Remove health monitoring and background validation from all adapters




  - Simplify isAvailable methods to basic synchronous checks
  - _Requirements: 6.4, 6.5_

- [ ] 5. Implement connection-time error handling
  - Add specific error messages for provider not found, wallet locked, connection rejected
  - Provide install buttons with direct links for unavailable providers
  - Add retry mechanisms that don't require modal closure
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Ensure mock wallet immediate availability
  - Verify mock wallet bypasses all detection and connects instantly
  - Ensure mock wallet displays as first option in development with "Ready" status
  - Test mock wallet doesn't interfere with production builds
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 7. Add performance monitoring and testing
  - Measure modal display time to ensure under 100ms target
  - Add performance tests for connection attempt flows
  - Validate no blocking operations during modal initialization
  - _Requirements: 1.1, 6.1_

- [ ]* 8. Update documentation and error messages
  - Update wallet provider documentation with new simplified flow
  - Improve error messages with specific troubleshooting guidance
  - Add user-facing documentation for wallet connection process
  - _Requirements: 4.1, 4.4_