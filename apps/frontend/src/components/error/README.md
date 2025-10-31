# Error Handling Components

This directory contains comprehensive error handling components and utilities for the application.

## Components

### ComponentErrorBoundary
A React error boundary that catches JavaScript errors anywhere in the child component tree, logs those errors, and displays a fallback UI.

**Features:**
- Comprehensive error catching and logging
- Customizable fallback UI components
- Error recovery mechanisms
- Error metrics collection
- Development-friendly error details

**Usage:**
```tsx
import { ComponentErrorBoundary } from '@/components/error';

<ComponentErrorBoundary
  componentName="MyComponent"
  fallback={CustomErrorFallback}
  onError={(error, errorInfo) => console.log('Error caught:', error)}
>
  <MyComponent />
</ComponentErrorBoundary>
```

### Error Fallback Components

#### ErrorFallback
Generic error fallback component for general component errors with enhanced recovery options.

#### BadgeFallback
Specialized fallback for Badge component errors with text-based alternatives.

#### ConnectionStatusFallback
Fallback for connection status indicators with text-based status display.

#### HeaderFallback
Minimal header fallback that maintains essential navigation functionality.

#### MainContentFallback
Fallback for main content areas with user-friendly error messages.

#### SidebarFallback
Simplified sidebar fallback that preserves basic navigation.

### ErrorRecoveryPanel
User-facing error recovery panel with multiple recovery strategies and options.

**Features:**
- Component-specific recovery strategies
- Risk-level indicators for recovery options
- Recovery history tracking
- Success rate monitoring
- Advanced debugging options

### ErrorMonitoringDashboard
Real-time error monitoring dashboard for development and production use.

**Features:**
- Live error metrics and statistics
- Error breakdown by component, type, and severity
- Recent error history with detailed information
- Interactive error details modal
- Configurable refresh intervals

## Services

### Error Logging Service
Comprehensive error logging and metrics collection service.

**Features:**
- Detailed error information capture
- Error categorization and severity assessment
- User action tracking for context
- Recovery attempt tracking
- Session-based error storage

### Error Analytics Service
Advanced error analytics and trend monitoring service.

**Features:**
- Error trend analysis
- Pattern detection
- Anomaly identification
- Comprehensive reporting
- Alert generation

### Error Recovery Service
User-facing error recovery strategies and options.

**Features:**
- Component-specific recovery strategies
- Automated recovery attempts
- User-guided recovery options
- Recovery success tracking
- Fallback mechanisms

## Development Tools

### Error Simulator
Development tool for testing error boundaries and recovery mechanisms.

**Features:**
- Predefined error scenarios
- Custom error simulation
- Component-specific targeting
- Error type and severity control

### Error Development Dashboard
Comprehensive development dashboard for error debugging and monitoring.

**Features:**
- Real-time error monitoring
- Debug session management
- Error analytics visualization
- Recovery testing tools
- Export and reporting capabilities

### Error Debugger Utility
Advanced debugging utility for error investigation.

**Features:**
- Debug session tracking
- Detailed error context capture
- Performance metrics collection
- Network request monitoring
- Console message tracking

## Usage Examples

### Basic Error Boundary Setup
```tsx
import { ComponentErrorBoundary, ErrorFallback } from '@/components/error';

function App() {
  return (
    <ComponentErrorBoundary
      componentName="App"
      fallback={ErrorFallback}
    >
      <Header />
      <MainContent />
      <Footer />
    </ComponentErrorBoundary>
  );
}
```

### Component-Specific Error Handling
```tsx
import { ComponentErrorBoundary, BadgeFallback } from '@/components/error';

function StatusIndicator({ status }) {
  return (
    <ComponentErrorBoundary
      componentName="StatusIndicator"
      fallback={BadgeFallback}
      resetOnPropsChange={true}
    >
      <Badge variant={status.variant}>
        {status.label}
      </Badge>
    </ComponentErrorBoundary>
  );
}
```

### Development Debugging
```tsx
import { ErrorDevelopmentDashboard, errorDebugger } from '@/components/error';

function DevApp() {
  useEffect(() => {
    // Start debug session
    errorDebugger.startDebugSession('feature-testing');
    
    return () => {
      // End debug session on cleanup
      errorDebugger.endDebugSession();
    };
  }, []);

  return (
    <>
      <App />
      {process.env.NODE_ENV === 'development' && (
        <ErrorDevelopmentDashboard />
      )}
    </>
  );
}
```

### Error Analytics Integration
```tsx
import { errorAnalyticsService } from '@/components/error';

function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const report = errorAnalyticsService.generateReport(24); // Last 24 hours
    setAnalytics(report);
  }, []);

  return (
    <div>
      <h2>Error Analytics</h2>
      {analytics && (
        <div>
          <p>Total Errors: {analytics.summary.totalErrors}</p>
          <p>Recovery Rate: {(analytics.summary.recoveryRate * 100).toFixed(1)}%</p>
          {/* Display other analytics data */}
        </div>
      )}
    </div>
  );
}
```

## Configuration

### Error Boundary Configuration
```tsx
export const errorBoundaryConfig = {
  enableErrorBoundaries: true,
  logErrors: true,
  showErrorDetails: process.env.NODE_ENV === 'development',
  maxRecoveryAttempts: 3,
  fallbackComponents: {
    Badge: BadgeFallback,
    ConnectionStatus: ConnectionStatusFallback,
    Header: HeaderFallback,
  },
};
```

### Recovery Strategy Registration
```tsx
import { errorRecoveryService } from '@/components/error';

// Register custom recovery strategies
errorRecoveryService.registerComponentStrategies({
  componentName: 'CustomComponent',
  strategies: [
    {
      name: 'refresh_data',
      userFriendlyName: 'Refresh Data',
      description: 'Reload component data from server',
      riskLevel: 'low',
      action: async () => {
        // Custom recovery logic
        return true;
      },
    },
  ],
  fallbackMessage: 'The custom component failed. Try these recovery options:',
});
```

## Best Practices

1. **Wrap Critical Components**: Always wrap critical UI components with error boundaries
2. **Provide Meaningful Fallbacks**: Create component-specific fallback UIs that maintain functionality
3. **Log Errors Appropriately**: Use the error logging service to capture detailed error information
4. **Test Error Scenarios**: Use the error simulator to test different error conditions
5. **Monitor Error Trends**: Regularly review error analytics to identify patterns and issues
6. **Implement Recovery Strategies**: Provide users with meaningful recovery options
7. **Use Development Tools**: Leverage the development dashboard for debugging and testing

## File Structure

```
src/components/error/
├── ComponentErrorBoundary.tsx     # Main error boundary component
├── ErrorFallback.tsx             # Generic error fallback
├── BadgeFallback.tsx             # Badge-specific fallback
├── ConnectionStatusFallback.tsx   # Connection status fallback
├── HeaderFallback.tsx            # Header fallback
├── MainContentFallback.tsx       # Main content fallback
├── SidebarFallback.tsx           # Sidebar fallback
├── ErrorRecoveryPanel.tsx        # User recovery options
├── ErrorMonitoringDashboard.tsx  # Real-time monitoring
├── ErrorSimulator.tsx            # Development testing tool
├── ErrorDevelopmentDashboard.tsx # Comprehensive dev dashboard
├── ErrorBoundary.css             # Error boundary styles
├── ErrorRecovery.css             # Recovery panel styles
├── ErrorMonitoring.css           # Monitoring dashboard styles
├── ErrorSimulator.css            # Simulator styles
├── ErrorDevelopmentDashboard.css # Dev dashboard styles
├── README.md                     # This documentation
└── index.ts                      # Component exports

src/services/
├── errorLoggingService.ts        # Error logging and metrics
├── errorAnalyticsService.ts      # Analytics and trend analysis
└── errorRecoveryService.ts       # Recovery strategies

src/utils/
└── errorDebugger.ts              # Development debugging utility
```

## Contributing

When adding new error handling features:

1. Follow the established patterns for error boundaries and fallbacks
2. Add appropriate TypeScript types and interfaces
3. Include comprehensive error logging and metrics
4. Provide user-friendly recovery options
5. Add development tools for testing and debugging
6. Update this documentation with new features
7. Add unit tests for error handling logic

## Testing

The error handling system includes comprehensive testing tools:

- **Error Simulator**: Test different error scenarios in development
- **Debug Sessions**: Track and analyze error patterns
- **Recovery Testing**: Verify recovery strategies work correctly
- **Analytics Validation**: Ensure error metrics are accurate

Use these tools during development to ensure robust error handling throughout the application.