// Error Boundary Components
export { ComponentErrorBoundary } from './ComponentErrorBoundary';
export type { ComponentErrorBoundaryProps, ErrorFallbackProps } from './ComponentErrorBoundary';

// Error Fallback Components
export { ErrorFallback } from './ErrorFallback';
export { BadgeFallback } from './BadgeFallback';
export { ConnectionStatusFallback } from './ConnectionStatusFallback';
export { HeaderFallback } from './HeaderFallback';
export { MainContentFallback } from './MainContentFallback';
export { SidebarFallback } from './SidebarFallback';

// Error Recovery Components
export { default as ErrorRecoveryPanel } from './ErrorRecoveryPanel';

// Error Monitoring Components
export { default as ErrorMonitoringDashboard } from './ErrorMonitoringDashboard';

// Development Tools (only available in development)
export { default as ErrorSimulator } from './ErrorSimulator';
export { default as ErrorDevelopmentDashboard } from './ErrorDevelopmentDashboard';

// Services
export { errorLoggingService } from '@/services/errorLoggingService';
export { errorAnalyticsService } from '@/services/errorAnalyticsService';
export { errorRecoveryService } from '@/services/errorRecoveryService';
export { errorDebugger } from '@/utils/errorDebugger';

// Types
export type {
    ErrorDetails,
    ErrorType,
    ErrorSeverity,
    ErrorMetrics,
    UserAction,
} from '@/services/errorLoggingService';

export type {
    ErrorAnalyticsReport,
    ErrorTrend,
} from '@/services/errorAnalyticsService';

export type {
    RecoveryStrategy,
    ComponentRecoveryOptions,
    RecoveryResult,
} from '@/services/errorRecoveryService';

export type {
    ErrorDebugInfo,
    DebugSession,
} from '@/utils/errorDebugger';