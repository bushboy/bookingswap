import { Provider } from 'react-redux';
import { store } from '@/store';
import { AppRouter } from '@/router';
import { WalletModal } from '@/components/wallet';
import { WalletContextProvider } from '@/contexts/WalletContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { WalletAuthIntegration } from '@/components/auth';
import { PerformanceMonitorWrapper } from '@/components/debug/PerformanceMonitor';
import { ComponentErrorBoundary } from '@/components/error/ComponentErrorBoundary';
import { AppErrorFallback } from '@/components/error/AppErrorFallback';
import { enablePerformanceDevTools } from '@/utils/performanceOptimizations';
import '@/utils/resetThrottling'; // Import throttling reset utilities for debugging

function App() {
  // Enable performance dev tools in development
  if (process.env.NODE_ENV === 'development') {
    enablePerformanceDevTools();
  }

  return (
    <ComponentErrorBoundary
      fallback={AppErrorFallback}
      componentName="Application"
      onError={(error, errorInfo) => {
        // Log critical application errors
        console.error('Critical application error:', error, errorInfo);

        // In production, you might want to send this to an error reporting service
        if (process.env.NODE_ENV === 'production') {
          // Example: errorReportingService.reportCriticalError(error, errorInfo);
        }
      }}
    >
      <Provider store={store}>
        <AuthProvider>
          <WalletContextProvider>
            <WalletAuthIntegration />
            <AppRouter />
            <WalletModal />
            <PerformanceMonitorWrapper />
          </WalletContextProvider>
        </AuthProvider>
      </Provider>
    </ComponentErrorBoundary>
  );
}

export default App;
