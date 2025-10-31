# Wallet Integration E2E Tests

This directory contains comprehensive end-to-end tests for the Hedera wallet integration feature. The tests cover all aspects of wallet connectivity, error handling, session management, and user interactions.

## Test Files Overview

### 1. wallet-integration.spec.ts
**Main wallet integration test suite covering:**
- Wallet connection user journey (HashPack & Blade)
- Provider selection and connection process
- Error scenarios and user guidance
- Wallet disconnection and session management
- Wallet status and network validation
- Integration with application features
- Cross-browser compatibility
- Performance and load testing

**Key Test Areas:**
- ✅ Successful wallet connections
- ✅ Loading states during connection
- ✅ Wallet info display with copy functionality
- ✅ Provider availability detection
- ✅ Installation guidance for unavailable providers
- ✅ Terms and privacy policy notices
- ✅ Session persistence across navigation
- ✅ Connection restoration on page reload
- ✅ Network status indicators
- ✅ Integration with booking/swap creation
- ✅ Wallet requirement enforcement

### 2. wallet-session-management.spec.ts
**Dedicated session management tests covering:**
- Session persistence across browser sessions
- Session security and integrity validation
- Auto-reconnection functionality
- Session cleanup on disconnect
- Concurrent session conflict handling
- Session timeout enforcement

**Key Test Areas:**
- ✅ Session data storage and retrieval
- ✅ Expired session handling
- ✅ Cross-tab session conflicts
- ✅ Auto-reconnection preferences
- ✅ Session cleanup on window close
- ✅ Partial cleanup failure handling

### 3. wallet-error-scenarios.spec.ts
**Comprehensive error handling tests covering:**
- Provider installation and availability errors
- Connection and authentication errors
- Network and connectivity errors
- Transaction and operation errors
- Error recovery and user guidance

**Key Test Areas:**
- ✅ No wallet providers installed
- ✅ Partial provider availability
- ✅ Provider detection failures
- ✅ User rejection of connection
- ✅ Wallet locked errors
- ✅ Authentication timeouts
- ✅ Network connectivity issues
- ✅ Wrong network errors
- ✅ Hedera network outages
- ✅ Insufficient balance errors
- ✅ Transaction signing errors
- ✅ Transaction broadcast failures
- ✅ Error recovery flows
- ✅ Error resolution progress tracking

### 4. wallet-provider-switching.spec.ts
**Multi-provider support tests covering:**
- Provider switching functionality
- Provider-specific features
- Provider error handling
- Last used provider preferences

**Key Test Areas:**
- ✅ Switching between different wallet providers
- ✅ Provider switching cancellation
- ✅ Last used provider memory
- ✅ Provider availability changes during switching
- ✅ HashPack-specific features
- ✅ Blade-specific features
- ✅ Unsupported feature handling
- ✅ Provider-specific connection errors
- ✅ Provider disconnection during operation
- ✅ Provider update/reload scenarios

## Requirements Coverage

The E2E tests comprehensively cover all requirements from the specification:

### Requirement 1 (1.1-1.5) - Wallet Connection
- ✅ Connect wallet button display
- ✅ Wallet provider selection
- ✅ Connection process initiation
- ✅ Successful connection display
- ✅ Connection failure error handling

### Requirement 2 (2.1-2.5) - Wallet Information Display
- ✅ Truncated address display
- ✅ HBAR balance display
- ✅ Network display (mainnet/testnet)
- ✅ Full address tooltip on hover
- ✅ Copy address to clipboard functionality

### Requirement 3 (3.1-3.4) - Wallet Disconnection
- ✅ Disconnect option availability
- ✅ Session data clearing on disconnect
- ✅ Return to connect state after disconnect
- ✅ Cached information clearing

### Requirement 4 (4.1-4.5) - Error Handling
- ✅ Wallet extension not installed guidance
- ✅ Wallet locked prompts
- ✅ Connection rejection handling
- ✅ Wrong network prompts
- ✅ Network connectivity error handling

### Requirement 5 (5.1-5.5) - Session Persistence
- ✅ Connection preference storage
- ✅ Connection restoration on return
- ✅ Invalid connection fallback
- ✅ Browser data clearing handling
- ✅ Connection restoration failure handling

### Requirement 6 (6.1-6.5) - Multi-Provider Support
- ✅ HashPack wallet integration
- ✅ Blade wallet integration
- ✅ Extensible architecture
- ✅ Automatic provider inclusion
- ✅ Unavailable provider hiding

## Test Data and Mocking

The tests use comprehensive mocking strategies:

### Wallet Provider Mocking
- Mock HashPack wallet with realistic API responses
- Mock Blade wallet with appropriate method signatures
- Simulate provider availability/unavailability
- Mock network switching capabilities
- Simulate various error conditions

### API Mocking
- Authentication endpoints
- Booking creation endpoints
- Swap creation endpoints
- Hedera network status endpoints
- Transaction submission endpoints

### Browser Environment Mocking
- Local storage manipulation
- Session storage handling
- Clipboard API simulation
- Network connectivity simulation
- Cross-tab communication

## Running the Tests

### Run All Wallet Tests
```bash
npx playwright test tests/e2e/wallet-*.spec.ts
```

### Run Specific Test Suites
```bash
# Main integration tests
npx playwright test tests/e2e/wallet-integration.spec.ts

# Session management tests
npx playwright test tests/e2e/wallet-session-management.spec.ts

# Error scenario tests
npx playwright test tests/e2e/wallet-error-scenarios.spec.ts

# Provider switching tests
npx playwright test tests/e2e/wallet-provider-switching.spec.ts
```

### Run with Specific Browser
```bash
npx playwright test tests/e2e/wallet-integration.spec.ts --project=chromium
npx playwright test tests/e2e/wallet-integration.spec.ts --project=firefox
npx playwright test tests/e2e/wallet-integration.spec.ts --project=webkit
```

### Run with Debug Mode
```bash
npx playwright test tests/e2e/wallet-integration.spec.ts --debug
```

### Generate Test Report
```bash
npx playwright test tests/e2e/wallet-*.spec.ts --reporter=html
```

## Test Coverage Summary

- **Total Tests**: 76 wallet-specific E2E tests
- **Browser Coverage**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Feature Coverage**: 100% of specified requirements
- **Error Scenarios**: 25+ different error conditions tested
- **User Journeys**: Complete end-to-end user flows
- **Cross-Platform**: Desktop and mobile viewport testing

## Maintenance Notes

### Adding New Tests
1. Follow the existing test structure and naming conventions
2. Use appropriate test data-testid attributes for element selection
3. Include proper mocking for wallet providers and APIs
4. Add tests to the appropriate test file based on functionality
5. Update this README when adding new test categories

### Updating Tests
1. Keep tests in sync with UI changes
2. Update mocking when API contracts change
3. Ensure cross-browser compatibility
4. Maintain test isolation and independence

### Performance Considerations
1. Tests use realistic delays for user interactions
2. Network simulation includes appropriate timeouts
3. Large dataset handling is tested for performance
4. Memory cleanup is verified in session tests