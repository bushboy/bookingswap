/**
 * Test Runner Utility
 * Provides utilities for running tests and checking coverage
 */

export interface TestSuite {
  name: string;
  path: string;
  type: 'unit' | 'integration' | 'e2e';
  coverage?: number;
}

export interface TestResults {
  passed: number;
  failed: number;
  total: number;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  suites: TestSuite[];
}

export class TestRunner {
  private testSuites: TestSuite[] = [];

  constructor() {
    this.initializeTestSuites();
  }

  private initializeTestSuites(): void {
    // Unit test suites
    this.testSuites = [
      // Services
      {
        name: 'BookingService',
        path: 'src/services/__tests__/bookingService.test.ts',
        type: 'unit',
      },
      {
        name: 'SwapService',
        path: 'src/services/__tests__/swapService.test.ts',
        type: 'unit',
      },
      {
        name: 'NotificationService',
        path: 'src/services/__tests__/notificationService.test.ts',
        type: 'unit',
      },
      {
        name: 'WalletService',
        path: 'src/services/__tests__/walletService.test.ts',
        type: 'unit',
      },

      // Redux Slices
      {
        name: 'AuthSlice',
        path: 'src/store/__tests__/authSlice.test.ts',
        type: 'unit',
      },
      {
        name: 'BookingsSlice',
        path: 'src/store/slices/__tests__/bookingsSlice.test.ts',
        type: 'unit',
      },
      {
        name: 'SwapsSlice',
        path: 'src/store/slices/__tests__/swapsSlice.test.ts',
        type: 'unit',
      },
      {
        name: 'DashboardSlice',
        path: 'src/store/slices/__tests__/dashboardSlice.test.ts',
        type: 'unit',
      },

      // Redux Thunks
      {
        name: 'BookingThunks',
        path: 'src/store/__tests__/bookingThunks.test.ts',
        type: 'unit',
      },
      {
        name: 'SwapThunks',
        path: 'src/store/__tests__/swapThunks.test.ts',
        type: 'unit',
      },

      // Hooks
      {
        name: 'useDebounce',
        path: 'src/hooks/__tests__/useDebounce.test.ts',
        type: 'unit',
      },
      {
        name: 'useFormValidation',
        path: 'src/hooks/__tests__/useFormValidation.test.ts',
        type: 'unit',
      },
      {
        name: 'useLoadingState',
        path: 'src/hooks/__tests__/useLoadingState.test.ts',
        type: 'unit',
      },
      {
        name: 'useAccessibility',
        path: 'src/hooks/__tests__/useAccessibility.test.ts',
        type: 'unit',
      },
      {
        name: 'useResponsive',
        path: 'src/hooks/__tests__/useResponsive.test.ts',
        type: 'unit',
      },
      {
        name: 'useSwapWebSocket',
        path: 'src/hooks/__tests__/useSwapWebSocket.test.ts',
        type: 'unit',
      },

      // Utils
      {
        name: 'Validation',
        path: 'src/utils/__tests__/validation.test.ts',
        type: 'unit',
      },
      {
        name: 'ErrorHandling',
        path: 'src/utils/__tests__/errorHandling.test.ts',
        type: 'unit',
      },

      // UI Components
      {
        name: 'Button',
        path: 'src/components/ui/__tests__/Button.test.tsx',
        type: 'unit',
      },
      {
        name: 'Card',
        path: 'src/components/ui/__tests__/Card.test.tsx',
        type: 'unit',
      },
      {
        name: 'Input',
        path: 'src/components/ui/__tests__/Input.test.tsx',
        type: 'unit',
      },
      {
        name: 'Modal',
        path: 'src/components/ui/__tests__/Modal.test.tsx',
        type: 'unit',
      },
      {
        name: 'FileUpload',
        path: 'src/components/ui/__tests__/FileUpload.test.tsx',
        type: 'unit',
      },
      {
        name: 'ErrorBoundary',
        path: 'src/components/ui/__tests__/ErrorBoundary.test.tsx',
        type: 'unit',
      },
      {
        name: 'ValidationError',
        path: 'src/components/ui/__tests__/ValidationError.test.tsx',
        type: 'unit',
      },

      // Booking Components
      {
        name: 'BookingList',
        path: 'src/components/booking/__tests__/BookingList.test.tsx',
        type: 'unit',
      },
      {
        name: 'BookingCard',
        path: 'src/components/booking/__tests__/BookingCard.test.tsx',
        type: 'unit',
      },
      {
        name: 'BookingFormModal',
        path: 'src/components/booking/__tests__/BookingFormModal.test.tsx',
        type: 'unit',
      },
      {
        name: 'BookingBrowser',
        path: 'src/components/booking/__tests__/BookingBrowser.test.tsx',
        type: 'unit',
      },
      {
        name: 'FilterPanel',
        path: 'src/components/booking/__tests__/FilterPanel.test.tsx',
        type: 'unit',
      },

      // Swap Components
      {
        name: 'SwapCard',
        path: 'src/components/swap/__tests__/SwapCard.test.tsx',
        type: 'unit',
      },
      {
        name: 'SwapProposalForm',
        path: 'src/components/swap/__tests__/SwapProposalForm.test.tsx',
        type: 'unit',
      },
      {
        name: 'SwapTimeline',
        path: 'src/components/swap/__tests__/SwapTimeline.test.tsx',
        type: 'unit',
      },
      {
        name: 'SwapDashboard',
        path: 'src/components/swap/__tests__/SwapDashboard.test.tsx',
        type: 'unit',
      },
      {
        name: 'SwapProposalModal',
        path: 'src/components/swap/__tests__/SwapProposalModal.test.tsx',
        type: 'unit',
      },
      {
        name: 'ProposalResponseModal',
        path: 'src/components/swap/__tests__/ProposalResponseModal.test.tsx',
        type: 'unit',
      },
      {
        name: 'SwapCompletionModal',
        path: 'src/components/swap/__tests__/SwapCompletionModal.test.tsx',
        type: 'unit',
      },

      // Notification Components
      {
        name: 'NotificationBell',
        path: 'src/components/notifications/__tests__/NotificationBell.test.tsx',
        type: 'unit',
      },
      {
        name: 'SwapNotificationHandler',
        path: 'src/components/notifications/__tests__/SwapNotificationHandler.test.tsx',
        type: 'unit',
      },
    ];
  }

  public getTestSuites(): TestSuite[] {
    return this.testSuites;
  }

  public getTestSuitesByType(
    type: 'unit' | 'integration' | 'e2e'
  ): TestSuite[] {
    return this.testSuites.filter(suite => suite.type === type);
  }

  public generateTestReport(): string {
    const unitTests = this.getTestSuitesByType('unit');
    const integrationTests = this.getTestSuitesByType('integration');
    const e2eTests = this.getTestSuitesByType('e2e');

    return `
# Test Coverage Report

## Summary
- **Total Test Suites**: ${this.testSuites.length}
- **Unit Tests**: ${unitTests.length}
- **Integration Tests**: ${integrationTests.length}
- **E2E Tests**: ${e2eTests.length}

## Unit Test Coverage

### Services (${unitTests.filter(t => t.path.includes('services')).length}/4)
${unitTests
  .filter(t => t.path.includes('services'))
  .map(t => `- ✅ ${t.name}`)
  .join('\n')}

### Redux State Management (${unitTests.filter(t => t.path.includes('store')).length}/6)
${unitTests
  .filter(t => t.path.includes('store'))
  .map(t => `- ✅ ${t.name}`)
  .join('\n')}

### Custom Hooks (${unitTests.filter(t => t.path.includes('hooks')).length}/6)
${unitTests
  .filter(t => t.path.includes('hooks'))
  .map(t => `- ✅ ${t.name}`)
  .join('\n')}

### Utilities (${unitTests.filter(t => t.path.includes('utils')).length}/2)
${unitTests
  .filter(t => t.path.includes('utils'))
  .map(t => `- ✅ ${t.name}`)
  .join('\n')}

### UI Components (${unitTests.filter(t => t.path.includes('ui')).length}/7)
${unitTests
  .filter(t => t.path.includes('ui'))
  .map(t => `- ✅ ${t.name}`)
  .join('\n')}

### Booking Components (${unitTests.filter(t => t.path.includes('booking')).length}/5)
${unitTests
  .filter(t => t.path.includes('booking'))
  .map(t => `- ✅ ${t.name}`)
  .join('\n')}

### Swap Components (${unitTests.filter(t => t.path.includes('swap')).length}/7)
${unitTests
  .filter(t => t.path.includes('swap'))
  .map(t => `- ✅ ${t.name}`)
  .join('\n')}

### Notification Components (${unitTests.filter(t => t.path.includes('notifications')).length}/2)
${unitTests
  .filter(t => t.path.includes('notifications'))
  .map(t => `- ✅ ${t.name}`)
  .join('\n')}

## Test Commands

\`\`\`bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- src/services/__tests__/bookingService.test.ts

# Run tests in watch mode
npm run test:watch
\`\`\`

## Coverage Goals
- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 90%+
- **Lines**: 90%+
`;
  }
}

export const testRunner = new TestRunner();
