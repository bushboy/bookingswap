import React from 'react';
import { ErrorFallbackProps } from './ComponentErrorBoundary';
import './ErrorBoundary.css';

/**
 * Specialized error fallback component for Badge component errors
 */
export const BadgeFallback: React.FC<ErrorFallbackProps & {
    variant?: string;
    size?: string;
    children?: React.ReactNode;
}> = ({
    error,
    resetError,
    componentName = 'Badge',
    variant = 'default',
    size = 'medium',
    children,
}) => {
        // Simple fallback badge styles without design tokens
        const getFallbackStyles = () => {
            const baseStyles = {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                borderRadius: '9999px',
                border: 'none',
                textAlign: 'center' as const,
                whiteSpace: 'nowrap' as const,
            };

            const sizeStyles = {
                small: { padding: '2px 8px', fontSize: '12px', minHeight: '20px' },
                medium: { padding: '4px 12px', fontSize: '14px', minHeight: '24px' },
                large: { padding: '6px 16px', fontSize: '16px', minHeight: '32px' },
            };

            const variantStyles = {
                default: { backgroundColor: '#f3f4f6', color: '#1f2937' },
                primary: { backgroundColor: '#dbeafe', color: '#1e40af' },
                secondary: { backgroundColor: '#e5e7eb', color: '#374151' },
                success: { backgroundColor: '#dcfce7', color: '#166534' },
                warning: { backgroundColor: '#fef3c7', color: '#92400e' },
                error: { backgroundColor: '#fee2e2', color: '#dc2626' },
                info: { backgroundColor: '#dbeafe', color: '#1e40af' },
            };

            const normalizedSize = size === 'sm' ? 'small' : size === 'md' ? 'medium' : size === 'lg' ? 'large' : size;

            return {
                ...baseStyles,
                ...sizeStyles[normalizedSize as keyof typeof sizeStyles] || sizeStyles.medium,
                ...variantStyles[variant as keyof typeof variantStyles] || variantStyles.default,
            };
        };

        const handleRetry = () => {
            resetError();
        };

        // If it's a minor error, try to render a simple fallback badge
        if (error.message.includes('token') || error.message.includes('style')) {
            return (
                <span
                    style={getFallbackStyles()}
                    className="badge-fallback"
                    title={`Badge fallback (${error.message})`}
                >
                    {children || 'Badge'}
                </span>
            );
        }

        // For more serious errors, show a full error UI
        return (
            <div className="error-boundary-fallback badge-error-fallback" role="alert">
                <div className="error-boundary-content">
                    <div className="error-icon">🏷️</div>
                    <h3>Badge Error</h3>
                    <p>
                        The badge component couldn't render properly.
                    </p>

                    {/* Show a simple text fallback */}
                    <div className="badge-text-fallback">
                        <strong>Fallback:</strong> {children || 'Badge Content'}
                    </div>

                    <div className="error-actions">
                        <button
                            onClick={handleRetry}
                            className="error-boundary-retry-button"
                            type="button"
                        >
                            Retry Badge
                        </button>
                    </div>

                    {process.env.NODE_ENV === 'development' && (
                        <details className="error-details">
                            <summary>Badge Error Details</summary>
                            <div className="error-info">
                                <p><strong>Component:</strong> {componentName}</p>
                                <p><strong>Variant:</strong> {variant}</p>
                                <p><strong>Size:</strong> {size}</p>
                                <p><strong>Children:</strong> {String(children)}</p>
                                <p><strong>Error:</strong> {error.message}</p>
                            </div>
                        </details>
                    )}
                </div>
            </div>
        );
    };

export default BadgeFallback;