# Booking-Swap Separation Testing Guide

This guide covers the comprehensive testing suite for the separated booking edit and swap specification functionality.

## Overview

The separated functionality testing ensures that:
- Booking edit interface focuses solely on booking-related fields and validation
- Swap specification interface provides dedicated swap configuration
- Navigation between interfaces preserves state and handles errors gracefully
- User workflows (edit-only, edit-then-swap) work seamlessly
- Error handling and recovery mechanisms function properly

## Test Structure

### 1. Unit Tests

#### BookingEditForm.separated.test.tsx
**Purpose**: Tests the focused booking edit interface

**Key Test Areas**:
- **Booking-Only Validation**: Ensures only booking fields are validated
- **Pure Booking Data Interface**: Verifies no swap-related fields are included
- **Enable Swapping Navigation**: Tests navigation to swap specification
- **Focused Booking Interface**: Validates booking-themed UI and context
- **Unsaved Changes Handling**: Tests state preservation and user prompts
- **Error Handling**: Validates booking-specific error display
- **Accessibility**: Ensures proper ARIA labels and keyboard navigation
- **State Preservation**: Tests form state management during navigation

**Coverage Requirements**:
- All booking validation scenarios
- Form submission with booking-only data
- Navigation to swap specification with/without unsaved changes
- Error recovery and user feedback
- Accessibility compliance

#### BookingSwapSpecificationPage.test.tsx
**Purpose**: Tests the dedicated swap specification interface

**Key Test Areas**:
- **Swap-Specific Interface**: Validates swap-focused UI and theming
- **Swap Preferences Management**: Tests swap configuration functionality
- **Wallet Integration**: Validates wallet connection and requirements
- **Navigation and Breadcrumbs**: Tests navigation back to bookings
- **Unified Swap Enablement Integration**: Tests guided setup modal
- **Error Handling**: Validates swap-specific error scenarios
- **Unsaved Changes Handling**: Tests swap preference state preservation
- **Loading States**: Tests various loading and error states

**Coverage Requirements**:
- All swap preference validation scenarios
- Wallet connection states and error handling
- Navigation with/without unsaved changes
- Access control and permission validation
- Real-time validation and feedback

### 2. Integration Tests

#### BookingSwapSeparation.integration.test.tsx
**Purpose**: Tests navigation and data flow between separated interfaces

**Key Test Areas**:
- **Navigation Between Interfaces**: Tests seamless transitions
- **State Preservation During Navigation**: Validates data consistency
- **Error Handling During Navigation**: Tests error recovery
- **Data Consistency Between Interfaces**: Ensures booking data integrity
- **User Experience Flow**: Tests complete workflows
- **Accessibility During Navigation**: Validates focus management

**Coverage Requirements**:
- Complete edit-then-swap workflow
- Edit-only workflow without swap creation
- Error scenarios during navigation
- State preservation across interface transitions
- Accessibility compliance during navigation

### 3. Error Handling Tests

#### BookingSwapSeparationErrors.test.tsx
**Purpose**: Comprehensive error handling and edge case testing

**Key Test Areas**:
- **BookingEditForm Error Handling**: Validation, submission, and navigation errors
- **BookingSwapSpecificationPage Error Handling**: Loading, access, and submission errors
- **Navigation Error Recovery**: Error recovery during interface transitions
- **State Preservation Error Handling**: Graceful handling of state failures
- **Component Error Boundaries**: Error isolation and fallback UI
- **Concurrent Error Handling**: Multiple simultaneous error scenarios

**Coverage Requirements**:
- All error scenarios with proper user feedback
- Graceful degradation and recovery options
- Error logging and debugging information
- User-friendly error messages and actions

### 4. End-to-End Tests

#### booking-swap-separation.spec.ts
**Purpose**: Complete user workflow testing in browser environment

**Key Test Areas**:
- **Edit-Only Workflow**: Complete booking editing without swap creation
- **Edit-Then-Swap Workflow**: Full workflow from booking edit to swap enablement
- **Swap Specification Interface**: Dedicated swap configuration testing
- **Navigation and Breadcrumbs**: Browser navigation and URL handling
- **Error Handling**: Network errors, access denied, and recovery
- **Mobile Responsiveness**: Touch interactions and mobile layouts
- **Accessibility**: Keyboard navigation and screen reader support

**Coverage Requirements**:
- All user workflows in realistic browser environment
- Cross-browser compatibility
- Mobile and desktop responsive behavior
- Real network conditions and error scenarios

## Running Tests

### Individual Test Suites

```bash
# Unit test for BookingEditForm
npm run test:booking-edit-form:separated

# Unit test for BookingSwapSpecificationPage
npm run test:swap-specification-page

# Integration tests
npm run test:separation:integration

# Error handling tests
npm run test:separation:error-handling

# E2E tests
npm run test:e2e:separation
```

### Comprehensive Test Runner

```bash
# Run all separated functionality tests
npm run test:booking-swap:separated

# Run with verbose output
npm run test:booking-swap:separated:verbose
```

### Test Runner Features

The comprehensive test runner (`runSeparatedTests.ts`) provides:
- **Sequential Execution**: Runs all test suites in logical order
- **Coverage Reporting**: Aggregates coverage across all test types
- **Error Aggregation**: Collects and reports all failures
- **Performance Metrics**: Tracks test execution times
- **Recommendations**: Provides actionable feedback for improvements

## Test Data and Mocks

### Mock Booking Data
```typescript
const mockBooking = createMockBooking({
  id: 'test-booking-1',
  title: 'Test Hotel Booking',
  description: 'A nice hotel in Paris',
  type: 'hotel',
  location: { city: 'Paris', country: 'France' },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF456',
  },
});
```

### Mock Services
- **bookingService**: Handles booking CRUD operations
- **unifiedBookingService**: Manages booking-swap integration
- **Navigation hooks**: Handle URL parameters and routing
- **Wallet hooks**: Manage wallet connection state
- **Validation utilities**: Provide field-level validation

### Mock UI Components
All UI components are mocked to focus on logic testing while maintaining realistic interfaces for integration tests.

## Coverage Requirements

### Minimum Coverage Thresholds
- **Unit Tests**: 90% line coverage, 85% branch coverage
- **Integration Tests**: 85% line coverage, 80% branch coverage
- **Error Handling Tests**: 95% line coverage, 90% branch coverage

### Critical Path Coverage
- All user workflows must have 100% coverage
- All error scenarios must have dedicated test cases
- All accessibility features must be tested
- All state preservation mechanisms must be validated

## Test Maintenance

### Adding New Tests
1. Follow existing test patterns and naming conventions
2. Include both positive and negative test cases
3. Add accessibility tests for new UI components
4. Update the comprehensive test runner if needed

### Updating Existing Tests
1. Maintain backward compatibility with existing test data
2. Update mock services to reflect API changes
3. Ensure coverage thresholds are maintained
4. Update documentation for any breaking changes

### Performance Considerations
- Keep unit tests under 30 seconds total execution time
- Limit integration tests to essential user workflows
- Use appropriate timeouts for async operations
- Mock external dependencies to improve test reliability

## Debugging Tests

### Common Issues
1. **Mock Service Failures**: Ensure all required services are properly mocked
2. **State Preservation Issues**: Verify hook mocks return expected values
3. **Navigation Errors**: Check URL parameter validation and routing mocks
4. **Timing Issues**: Use proper async/await patterns and waitFor utilities

### Debug Tools
- Use `--verbose` flag for detailed test output
- Enable console logging in test environment
- Use React Testing Library debug utilities
- Leverage browser dev tools for E2E test debugging

## Continuous Integration

### Pre-commit Hooks
- Run unit tests for changed files
- Validate test coverage thresholds
- Check for test file naming conventions

### CI Pipeline
1. Run all unit and integration tests
2. Generate coverage reports
3. Run E2E tests in multiple browsers
4. Validate accessibility compliance
5. Performance regression testing

### Quality Gates
- All tests must pass before merge
- Coverage thresholds must be maintained
- No accessibility violations allowed
- Performance budgets must be respected

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names that explain the scenario
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests focused on single responsibilities

### Mock Strategy
- Mock external dependencies at the boundary
- Use realistic mock data that reflects production scenarios
- Avoid over-mocking that hides integration issues
- Maintain mock data consistency across test suites

### Assertion Strategy
- Use specific assertions that validate exact behavior
- Include both positive and negative assertions
- Validate user-visible behavior over implementation details
- Test error messages and user feedback

### Maintenance
- Regularly review and update test data
- Remove obsolete tests when features change
- Keep test documentation current
- Monitor test execution times and optimize slow tests

## Troubleshooting

### Test Failures
1. Check mock service configurations
2. Verify test data matches expected formats
3. Ensure async operations are properly awaited
4. Validate component prop interfaces

### Coverage Issues
1. Identify uncovered code paths
2. Add tests for edge cases and error scenarios
3. Ensure all user interactions are tested
4. Validate conditional logic branches

### Performance Issues
1. Profile slow tests and optimize
2. Reduce unnecessary DOM operations
3. Use efficient query selectors
4. Minimize test data complexity

This comprehensive testing suite ensures the separated booking edit and swap specification functionality meets all requirements and provides a robust, user-friendly experience.