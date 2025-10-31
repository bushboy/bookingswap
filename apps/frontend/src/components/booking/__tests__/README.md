# Booking Swap UI Simplification - Comprehensive Test Suite

This directory contains a comprehensive test suite for the booking swap UI simplification feature, covering all aspects of testing from unit tests to end-to-end user journeys.

## Test Structure

### 1. Unit Tests

#### UnifiedBookingForm.comprehensive.test.tsx
- **Purpose**: Tests the unified booking form component with integrated swap preferences
- **Coverage**: 
  - Form validation and submission
  - Swap preference toggling and configuration
  - Real-time validation
  - Accessibility compliance
  - Error handling and recovery
  - Progressive disclosure
  - Performance optimization
- **Key Test Areas**:
  - Basic form functionality
  - Swap integration scenarios
  - Edge cases and validation
  - Keyboard navigation
  - Screen reader support

#### InlineProposalForm.comprehensive.test.tsx
- **Purpose**: Tests the inline proposal form for making swap proposals directly from listings
- **Coverage**:
  - Proposal type selection (booking vs cash)
  - Form validation and submission
  - User booking selection
  - Cash amount validation
  - Message input handling
  - Accessibility features
  - Mobile responsiveness
- **Key Test Areas**:
  - Proposal workflow validation
  - Real-time form updates
  - Error handling
  - Performance with large datasets

### 2. Integration Tests

#### BookingSwapWorkflow.integration.test.tsx
- **Purpose**: Tests the complete integration between booking creation, listing, and proposal workflows
- **Coverage**:
  - End-to-end booking creation with swap
  - Booking discovery and filtering
  - Inline proposal submission
  - Real-time updates
  - Error recovery
  - State management integration
- **Key Test Areas**:
  - Cross-component communication
  - API integration
  - State synchronization
  - Error propagation and recovery

### 3. Performance Tests

#### BookingListPerformance.test.tsx
- **Purpose**: Tests performance characteristics with large datasets and complex interactions
- **Coverage**:
  - Large dataset rendering (100, 500, 1000+ bookings)
  - Filtering performance
  - Scroll performance and virtualization
  - Memory usage and cleanup
  - Concurrent user interactions
  - Network performance simulation
- **Key Test Areas**:
  - Render performance benchmarks
  - Memory leak detection
  - Event listener cleanup
  - Throttling and debouncing

### 4. Accessibility Tests

#### BookingSwapAccessibility.test.tsx
- **Purpose**: Ensures full accessibility compliance and usability for users with disabilities
- **Coverage**:
  - WCAG 2.1 AA compliance
  - Keyboard navigation
  - Screen reader support
  - Focus management
  - High contrast mode
  - Reduced motion preferences
  - Mobile accessibility
- **Key Test Areas**:
  - ARIA labels and descriptions
  - Live region announcements
  - Focus trap management
  - Color contrast validation
  - Touch accessibility

### 5. End-to-End Tests

#### booking-swap-ui-simplification.spec.ts (Playwright)
- **Purpose**: Tests complete user journeys in a real browser environment
- **Coverage**:
  - Complete booking creation workflow
  - Booking discovery and filtering
  - Proposal submission and management
  - Error handling and recovery
  - Mobile responsiveness
  - Performance under load
- **Key Test Areas**:
  - User interaction flows
  - Cross-browser compatibility
  - Real network conditions
  - Visual regression testing

## Running Tests

### Individual Test Suites

```bash
# Run all booking swap tests
npm run test:booking-swap

# Run specific test categories
npm run test:booking-swap:unit
npm run test:booking-swap:integration
npm run test:booking-swap:performance
npm run test:booking-swap:accessibility

# Run E2E tests
npm run test:e2e:booking-swap
```

### Comprehensive Test Runner

```bash
# Run all tests with comprehensive reporting
npm run test:comprehensive
```

This will execute all test suites and generate:
- Detailed test results report (JSON and HTML)
- Coverage analysis
- Performance benchmarks
- Accessibility compliance report

### Watch Mode for Development

```bash
# Watch unit tests during development
npm run test:watch -- src/components/booking/__tests__/

# Watch specific test file
npm run test:watch -- src/components/booking/__tests__/UnifiedBookingForm.comprehensive.test.tsx
```

## Test Configuration

### Vitest Configuration
- **Timeout**: 10 seconds default, extended for performance tests (120s)
- **Coverage**: V8 provider with comprehensive thresholds
- **Environment**: jsdom for DOM testing
- **Reporters**: Verbose, JSON, and HTML reports

### Playwright Configuration
- **Browsers**: Chromium, Firefox, Safari
- **Timeout**: 30 seconds default, extended for E2E flows (300s)
- **Retries**: 2 retries on CI, 0 locally
- **Screenshots**: On failure
- **Video**: On first retry

## Coverage Thresholds

### Component-Level Thresholds
- **Lines**: 90%
- **Functions**: 95%
- **Branches**: 85%
- **Statements**: 90%

### Critical Path Thresholds
- **Booking Creation**: 95% all metrics
- **Proposal Submission**: 95% all metrics
- **Error Handling**: 90% all metrics

## Performance Benchmarks

### Rendering Performance
- **100 bookings**: < 2 seconds
- **500 bookings**: < 3 seconds (with virtualization)
- **1000+ bookings**: < 1 second initial render (virtualized)

### Interaction Performance
- **Form submission**: < 500ms
- **Filter application**: < 100ms
- **Proposal form**: < 200ms open/close

### Memory Usage
- **Large lists**: < 1MB memory increase after unmount
- **Event cleanup**: 100% cleanup verification
- **Timer cleanup**: 100% cleanup verification

## Accessibility Standards

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Readers**: Comprehensive ARIA support
- **Color Contrast**: 4.5:1 minimum ratio
- **Focus Management**: Proper focus trapping and restoration

### Mobile Accessibility
- **Touch Targets**: Minimum 44px touch targets
- **Input Types**: Appropriate input modes for mobile keyboards
- **Gestures**: Alternative interaction methods

## Test Data Management

### Mock Data Factories
- `createMockBooking()`: Generates realistic booking data
- `createMockSwap()`: Creates swap information
- `createMockUser()`: User profile data
- `createLargeBookingDataset()`: Performance test datasets

### Test Utilities
- `renderWithProviders()`: Renders components with Redux/Router context
- `TestPerformanceMonitor`: Performance measurement utilities
- `mockApiResponse()`: API response mocking
- `checkAccessibility()`: Accessibility validation helpers

## Continuous Integration

### GitHub Actions Integration
```yaml
- name: Run Comprehensive Tests
  run: |
    npm run test:comprehensive
    npm run test:e2e:booking-swap
```

### Test Reports
- **Artifacts**: Test results, coverage reports, screenshots
- **Notifications**: Slack/email on test failures
- **Trends**: Performance and coverage trend tracking

## Debugging Tests

### Debug Mode
```bash
# Run tests in debug mode
npm run test:booking-swap -- --inspect-brk

# Run specific test with debugging
npm run test:watch -- --inspect-brk src/components/booking/__tests__/UnifiedBookingForm.comprehensive.test.tsx
```

### Visual Debugging (Playwright)
```bash
# Run E2E tests with browser UI
npx playwright test --headed --debug tests/e2e/booking-swap-ui-simplification.spec.ts
```

### Test Isolation
Each test is fully isolated with:
- Clean Redux store state
- Fresh DOM environment
- Mocked API responses
- Reset timers and event listeners

## Contributing

### Adding New Tests
1. Follow the existing test structure and naming conventions
2. Include accessibility tests for new UI components
3. Add performance tests for components handling large datasets
4. Update this README with new test descriptions

### Test Quality Guidelines
- **Descriptive Names**: Test names should clearly describe the scenario
- **Arrange-Act-Assert**: Follow AAA pattern consistently
- **Single Responsibility**: Each test should verify one specific behavior
- **Realistic Data**: Use realistic test data that matches production scenarios
- **Error Scenarios**: Include both happy path and error scenarios

### Performance Considerations
- Use `vi.fn()` for mocks to avoid memory leaks
- Clean up event listeners and timers in test teardown
- Use virtualization for large dataset tests
- Monitor test execution time and optimize slow tests

## Troubleshooting

### Common Issues

#### Test Timeouts
- Increase timeout for performance tests
- Check for unresolved promises
- Verify mock implementations

#### Memory Leaks
- Ensure proper cleanup in `afterEach`
- Check for retained event listeners
- Monitor component unmounting

#### Flaky Tests
- Add proper `waitFor` assertions
- Mock time-dependent functionality
- Ensure test isolation

#### Accessibility Failures
- Check ARIA labels and roles
- Verify keyboard navigation paths
- Test with actual screen readers

### Getting Help
- Check test logs in `test-results/` directory
- Review coverage reports for missing test areas
- Use debug mode for step-by-step execution
- Consult team documentation for project-specific patterns