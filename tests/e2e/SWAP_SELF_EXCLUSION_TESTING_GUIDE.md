# Swap Self-Exclusion Fix - Testing Guide

## Overview

This guide provides comprehensive instructions for testing the swap self-exclusion fix across different browsers and devices. The fix ensures that users never see their own swaps appearing as proposals from themselves on swap cards.

## Test Coverage

### End-to-End Tests (`swap-self-exclusion-fix.spec.ts`)

**Requirements Covered:** 1.1, 1.2, 1.3, 2.1, 2.3

1. **Display Validation**
   - Verifies user swap appears on left side of cards
   - Ensures only genuine proposals from others appear on right side
   - Validates proper card structure and data flow

2. **Self-Proposal Exclusion**
   - Confirms no self-proposals appear in any scenario
   - Tests with multiple users and complex data scenarios
   - Validates proposer identification logic

3. **Multiple Proposals Handling**
   - Tests cards with multiple proposals from different users
   - Verifies proper proposal count and display
   - Ensures all proposals are from other users only

4. **Empty State Handling**
   - Tests swaps with no valid proposals from others
   - Verifies appropriate empty state messaging
   - Ensures clean UI when no proposals exist

5. **Data Consistency**
   - Tests data persistence across page refreshes
   - Validates API response structure
   - Ensures database-level filtering works correctly

6. **Error Handling**
   - Tests graceful handling of API errors
   - Verifies no self-proposals appear during error states
   - Validates proper error messaging

7. **Proposal Actions**
   - Tests accept/reject functionality
   - Ensures actions only work on valid proposals from others
   - Validates user interaction flows

8. **Database Integration**
   - Verifies API response structure matches expected format
   - Tests database-level filtering effectiveness
   - Validates data integrity at all levels

### Cross-Browser Tests (`swap-self-exclusion-cross-browser.spec.ts`)

**Requirements Covered:** 1.1, 2.3

**Browser Coverage:**
- Desktop Chrome
- Desktop Firefox  
- Desktop Safari
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)
- Tablet (iPad Pro)

**Test Categories:**

1. **Display Consistency**
   - Verifies swap cards display correctly across all browsers
   - Tests responsive layout behavior
   - Validates self-exclusion works on all platforms

2. **Responsive Design**
   - Tests mobile vs desktop layout differences
   - Verifies proper stacking/side-by-side arrangement
   - Ensures multiple proposals display correctly on small screens

3. **Touch Targets & Accessibility**
   - Validates touch target sizes on mobile devices (44px minimum)
   - Tests keyboard navigation across browsers
   - Ensures accessibility compliance

4. **Viewport & Orientation**
   - Tests portrait vs landscape orientation changes
   - Verifies layout adaptation to different screen sizes
   - Ensures functionality persists across orientation changes

5. **Performance**
   - Measures page load times across browsers
   - Tests scrolling performance with multiple cards
   - Validates efficient rendering

6. **Network Conditions**
   - Tests behavior under slow network conditions
   - Verifies graceful degradation
   - Ensures self-exclusion works regardless of network speed

7. **Browser-Specific Features**
   - Chrome: DevTools integration and console error checking
   - Safari: Touch event handling and WebKit-specific behaviors
   - Firefox: Keyboard navigation and focus management

## Prerequisites

### 1. Install Playwright Browsers
```bash
npx playwright install
```

### 2. Start Development Servers
```bash
# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Start frontend  
npm run dev:frontend

# Or start both together
npm run dev
```

### 3. Verify Test Environment
```bash
# Validate test structure
node tests/e2e/validate-swap-self-exclusion-tests.js
```

## Running Tests

### End-to-End Tests
```bash
# Run all E2E tests
npm run test:e2e -- tests/e2e/swap-self-exclusion-fix.spec.ts

# Run with UI mode for debugging
npm run test:e2e:ui -- tests/e2e/swap-self-exclusion-fix.spec.ts

# Run in headed mode to see browser
npm run test:e2e:headed -- tests/e2e/swap-self-exclusion-fix.spec.ts
```

### Cross-Browser Tests
```bash
# Run all cross-browser tests
npm run test:e2e -- tests/e2e/swap-self-exclusion-cross-browser.spec.ts

# Run specific browser only
npm run test:e2e -- tests/e2e/swap-self-exclusion-cross-browser.spec.ts --project=chromium

# Run mobile tests only
npm run test:e2e -- tests/e2e/swap-self-exclusion-cross-browser.spec.ts --project="Mobile Chrome"
```

### Run All Tests
```bash
# Run both test suites
npm run test:e2e -- tests/e2e/swap-self-exclusion*.spec.ts
```

## Test Data Requirements

### Required Test Data Attributes

The tests expect the following `data-testid` attributes in the frontend components:

```typescript
// Swap card structure
'swap-card'              // Main swap card container
'user-swap-section'      // Left side - user's own swap
'proposals-section'      // Right side - proposals from others

// Booking information
'booking-title'          // Booking title/name
'booking-location'       // City, country information
'booking-dates'          // Check-in/check-out or event dates

// Proposal information
'proposal-card'          // Individual proposal container
'proposer-name'          // Name of person making proposal
'proposer-info'          // Additional proposer information
'proposal-count'         // Number of proposals indicator

// Empty states
'no-proposals-message'   // Message when no proposals exist

// Actions
'accept-proposal-button' // Accept proposal action
'reject-proposal-button' // Reject proposal action

// User interface
'user-menu'              // User menu for authentication
'user-email'             // Current user email display
'error-message'          // Error state messaging
```

### Test User Setup

Tests expect a test user with credentials:
- Email: `testuser@example.com`
- Password: `testpassword123`

Ensure this user exists in your test database with appropriate swap and proposal data.

## Expected Test Results

### Success Criteria

1. **No Self-Proposals**: Tests should never find proposals where the proposer is the current user
2. **Proper Layout**: User swaps appear on left, proposals from others on right
3. **Cross-Browser Consistency**: All tests pass across Chrome, Firefox, Safari, and mobile browsers
4. **Responsive Design**: Layout adapts properly to different screen sizes
5. **Data Integrity**: API responses contain properly filtered data
6. **Error Handling**: Graceful degradation when errors occur

### Common Issues & Solutions

1. **Browser Not Found Error**
   ```bash
   # Solution: Install Playwright browsers
   npx playwright install
   ```

2. **Server Connection Issues**
   ```bash
   # Solution: Ensure dev servers are running
   npm run dev
   ```

3. **Test Data Missing**
   - Verify test user exists in database
   - Ensure swap and proposal test data is available
   - Check that self-proposals exist in database for filtering tests

4. **Timeout Issues**
   - Increase timeout values in test configuration
   - Ensure development servers are fully started
   - Check network connectivity

## Debugging Tests

### Visual Debugging
```bash
# Run with UI mode to see test execution
npm run test:e2e:ui -- tests/e2e/swap-self-exclusion-fix.spec.ts

# Run in headed mode to see browser
npm run test:e2e:headed -- tests/e2e/swap-self-exclusion-fix.spec.ts
```

### Screenshots and Videos
Tests are configured to capture:
- Screenshots on failure
- Videos on failure (retained)
- Traces on first retry

Files are saved to `test-results/` directory.

### Console Logging
Tests include console logging for:
- Self-proposal detection
- Data validation results
- API response verification
- User interaction tracking

## Continuous Integration

### GitHub Actions Configuration
```yaml
- name: Install Playwright Browsers
  run: npx playwright install

- name: Start Development Servers
  run: |
    npm run dev:backend &
    npm run dev:frontend &
    sleep 30  # Wait for servers to start

- name: Run Swap Self-Exclusion Tests
  run: |
    npm run test:e2e -- tests/e2e/swap-self-exclusion-fix.spec.ts
    npm run test:e2e -- tests/e2e/swap-self-exclusion-cross-browser.spec.ts
```

## Test Maintenance

### Adding New Test Cases
1. Follow existing test patterns in the spec files
2. Include proper `data-testid` attributes
3. Add self-proposal validation logic
4. Update this guide with new test descriptions

### Updating Browser Support
1. Modify `browserConfigs` array in cross-browser tests
2. Update Playwright configuration
3. Test new browser configurations thoroughly

### Performance Monitoring
- Monitor test execution times
- Update timeout values as needed
- Optimize test data setup for faster execution

## Reporting

Test results are saved to:
- `test-results/e2e-results.json` - JSON format
- `test-results/e2e-results.xml` - JUnit format  
- `playwright-report/index.html` - HTML report
- `test-results/swap-self-exclusion-test-validation.json` - Validation report

## Support

For issues with these tests:
1. Check the validation script output
2. Review test data setup
3. Verify development server status
4. Check browser installation
5. Review console logs and error messages