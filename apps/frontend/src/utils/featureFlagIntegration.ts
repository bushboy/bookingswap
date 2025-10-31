/**
 * Feature Flag Integration Utilities
 * 
 * This module provides integration utilities that combine error boundaries
 * with backend compatibility safeguards. It offers easy-to-use wrappers
 * for components and API calls that need feature flag awareness.
 * 
 * Requirements satisfied:
 * - 4.5: Feature flag error boundaries handle mismatches gracefully
 * - 3.1, 3.2, 3.4: Backend compatibility safeguards maintain API contracts
 */

import React from 'react';
import { FeatureFlagErrorBoundary, withFeatureFlagErrorBoundary } from '@/components/error/FeatureFlagErrorBoundary';
import { getFeatureFlagService, withFeatureFlagCompatibility } from '@/services/featureFlagService';
import { FEATURE_FLAGS } from '@/config/featureFlags';
import { Component } from 'lucide-react';
import { Component } from 'lucide-react';

// ============================================================================
// Component Integration Utilities
// ============================================================================

/**
 * Props for feature-aware components
 */
export interface FeatureAwareComponentProps {
    /** Feature context for error reporting */
    featureContext?: string;
    /** Whether to show detailed error information */
    showErrorDetails?: boolean;
    /** Custom fallback component for feature flag errors */
    errorFallback?: React.ComponentType<any>;
}

/**
 * Higher-order component that adds both error boundary and feature flag awareness
 * Combines FeatureFlagErrorBoundary with automatic data sanitization
 */
export function withFeatureFlagIntegration<P extends object>(
    Component: React.ComponentType<P>,
    options: {
        featureContext?: string;
        errorFallback?: React.ComponentType<any>;
        sanitizeProps?: boolean;
    } = {}
) {
    const { featureContext, errorFallback, sanitizeProps = true } = options;

    const IntegratedComponent = React.forwardRef<any, P & FeatureAwareComponentProps>((props, ref) => {
        const service = getFeatureFlagService();

        // Sanitize props if enabled
        const sanitizedProps = sanitizeProps
            ? service.sanitizeData(props, (data) => data)
            : props;

        return (
            <FeatureFlagErrorBoundary
                featureContext= { featureContext || Component.displayName || Component.name
    }
                fallback = { errorFallback }
                showDetails = { props.showErrorDetails }
        >
        <Component { ...sanitizedProps } ref = { ref } />
        </FeatureFlagErrorBoundary>
    );
});

IntegratedComponent.displayName = `withFeatureFlagIntegration(${Component.displayName || Component.name})`;

return IntegratedComponent;
}

/**
 * Hook for feature-aware components to handle errors and data sanitization
 */
export function useFeatureFlagIntegration(featureContext?: string) {
    const service = getFeatureFlagService();
    const [error, setError] = React.useState<Error | null>(null);

    const handleError = React.useCallback((error: Error) => {
        console.warn(`Feature flag error in ${featureContext}:`, error);
        setError(error);
    }, [featureContext]);

    const clearError = React.useCallback(() => {
        setError(null);
    }, []);

    const sanitizeData = React.useCallback(<T>(data: T, sanitizeFn: (data: T) => T): T => {
        return service.sanitizeData(data, sanitizeFn);
    }, [service]);

    const isFeatureEnabled = React.useCallback((feature: keyof typeof FEATURE_FLAGS): boolean => {
        return service.isFeatureEnabled(feature);
    }, [service]);

    return {
        error,
        hasError: error !== null,
        handleError,
        clearError,
        sanitizeData,
        isFeatureEnabled,
        featureFlags: service.getFeatureFlags(),
    };
}

// ============================================================================
// API Integration Utilities
// ============================================================================

/**
 * Creates a feature-flag aware API client with error boundaries
 * Combines backend compatibility with error handling
 */
export function createFeatureAwareApiClient<T extends Record<string, any>>(
    originalClient: T,
    options: {
        enableErrorBoundary?: boolean;
        enableCompatibilityLayer?: boolean;
        onError?: (error: Error, method: string) => void;
    } = {}
): T {
    const {
        enableErrorBoundary = true,
        enableCompatibilityLayer = true,
        onError
    } = options;

    const service = getFeatureFlagService();
    let client = originalClient;

    // Apply compatibility layer if enabled
    if (enableCompatibilityLayer) {
        client = service.createApiClient(client);
    }

    // Add error boundary if enabled
    if (enableErrorBoundary) {
        const boundaryClient = { ...client };

        for (const [key, value] of Object.entries(client)) {
            if (typeof value === 'function') {
                boundaryClient[key] = async (...args: any[]) => {
                    try {
                        return await value.apply(client, args);
                    } catch (error) {
                        const enhancedError = new Error(
                            `API error in ${key}: ${(error as Error).message}`,
                            { cause: error }
                        );

                        if (onError) {
                            onError(enhancedError, key);
                        }

                        throw enhancedError;
                    }
                };
            }
        }

        client = boundaryClient;
    }

    return client;
}

/**
 * Hook for making feature-aware API calls
 */
export function useFeatureAwareApi() {
    const service = getFeatureFlagService();

    const makeRequest = React.useCallback(async (
        url: string,
        options: RequestInit = {}
    ) => {
        return service.makeApiRequest(url, options);
    }, [service]);

    const sanitizeResponse = React.useCallback((data: any) => {
        return service.sanitizeResponse(data);
    }, [service]);

    return {
        makeRequest,
        sanitizeResponse,
        isCompatible: (data: any) => service.isDataCompatible(data),
    };
}

// ============================================================================
// Form Integration Utilities
// ============================================================================

/**
 * Hook for feature-aware form handling
 * Automatically sanitizes form data based on feature flags
 */
export function useFeatureAwareForm<T extends Record<string, any>>(
    initialData: T,
    options: {
        sanitizeOnChange?: boolean;
        validateCompliance?: boolean;
        onComplianceError?: (errors: string[]) => void;
    } = {}
) {
    const { sanitizeOnChange = true, validateCompliance = true, onComplianceError } = options;
    const service = getFeatureFlagService();

    const [formData, setFormData] = React.useState<T>(initialData);
    const [errors, setErrors] = React.useState<string[]>([]);

    const updateFormData = React.useCallback((updates: Partial<T>) => {
        setFormData(prev => {
            const newData = { ...prev, ...updates };

            if (sanitizeOnChange) {
                return service.sanitizeData(newData, (data) => data);
            }

            return newData;
        });
    }, [service, sanitizeOnChange]);

    const validateForm = React.useCallback(() => {
        if (!validateCompliance) return true;

        const compatibility = service.isDataCompatible(formData);

        if (!compatibility.compatible) {
            setErrors(compatibility.issues);
            if (onComplianceError) {
                onComplianceError(compatibility.issues);
            }
            return false;
        }

        setErrors([]);
        return true;
    }, [service, formData, validateCompliance, onComplianceError]);

    const sanitizeFormData = React.useCallback(() => {
        return service.sanitizeData(formData, (data) => data);
    }, [service, formData]);

    return {
        formData,
        updateFormData,
        validateForm,
        sanitizeFormData,
        errors,
        hasErrors: errors.length > 0,
        isValid: errors.length === 0,
    };
}

// ============================================================================
// Conditional Rendering Utilities
// ============================================================================

/**
 * Component for conditional rendering based on feature flags
 */
export interface ConditionalFeatureProps {
    /** Feature flag to check */
    feature: keyof typeof FEATURE_FLAGS;
    /** Content to render when feature is enabled */
    children: React.ReactNode;
    /** Content to render when feature is disabled */
    fallback?: React.ReactNode;
    /** Whether to render nothing when disabled (default: true) */
    hideWhenDisabled?: boolean;
}

export const ConditionalFeature: React.FC<ConditionalFeatureProps> = ({
    feature,
    children,
    fallback,
    hideWhenDisabled = true,
}) => {
    const service = getFeatureFlagService();
    const isEnabled = service.isFeatureEnabled(feature);

    if (isEnabled) {
        return <>{ children } </>;
    }

    if (fallback) {
        return <>{ fallback } </>;
    }

    return hideWhenDisabled ? null : <>{ children } </>;
};

/**
 * Hook for conditional rendering logic
 */
export function useConditionalFeature(feature: keyof typeof FEATURE_FLAGS) {
    const service = getFeatureFlagService();
    return {
        isEnabled: service.isFeatureEnabled(feature),
        render: (content: React.ReactNode, fallback?: React.ReactNode) => {
            return service.isFeatureEnabled(feature) ? content : (fallback || null);
        },
    };
}

// ============================================================================
// Development Utilities
// ============================================================================

/**
 * Development component for debugging feature flags
 * Only renders in development mode
 */
export const FeatureFlagDebugger: React.FC<{
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> = ({ position = 'bottom-right' }) => {
    const service = getFeatureFlagService();
    const [isOpen, setIsOpen] = React.useState(false);

    if (!import.meta.env.DEV) {
        return null;
    }

    const summary = service.getFeatureFlagSummary();

    const positionStyles = {
        'top-left': { top: 10, left: 10 },
        'top-right': { top: 10, right: 10 },
        'bottom-left': { bottom: 10, left: 10 },
        'bottom-right': { bottom: 10, right: 10 },
    };

    return (
        <div
            style= {{
        position: 'fixed',
                ...positionStyles[position],
    zIndex: 9999,
        backgroundColor: '#1f2937',
            color: '#f9fafb',
                padding: '8px',
                    borderRadius: '6px',
                        fontSize: '12px',
                            fontFamily: 'monospace',
                                border: '1px solid #374151',
                                    maxWidth: '300px',
            }}
        >
    <button
                onClick={ () => setIsOpen(!isOpen) }
style = {{
    background: 'none',
        border: 'none',
            color: '#f9fafb',
                cursor: 'pointer',
                    fontSize: '12px',
                        fontFamily: 'monospace',
                }}
            >
                🚩 Feature Flags({ summary.enabled.length } / { summary.total })
    </button>

{
    isOpen && (
        <div style={ { marginTop: '8px' } }>
            <div><strong>Enabled: </strong></div >
            {
                summary.enabled.map(feature => (
                    <div key= { feature } style = {{ color: '#10b981', marginLeft: '8px' }} >
                            ✓ { feature }
    </div>
                    ))
}

<div style={ { marginTop: '8px' } }> <strong>Disabled: </strong></div >
{
    summary.disabled.map(feature => (
        <div key= { feature } style = {{ color: '#ef4444', marginLeft: '8px' }} >
                            ✗ { feature }
</div>
                    ))}

<div style={ { marginTop: '8px', fontSize: '10px', opacity: 0.7 } }>
    Compatibility: { summary.compatibilityValidated ? '✓' : '?' }
</div>
    </div>
            )}
</div>
    );
};

// ============================================================================
// Export all utilities
// ============================================================================

export {
    FeatureFlagErrorBoundary,
    withFeatureFlagErrorBoundary,
    getFeatureFlagService,
    withFeatureFlagCompatibility,
};