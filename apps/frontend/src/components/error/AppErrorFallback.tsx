import React from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { ErrorFallbackProps } from './ComponentErrorBoundary';

/**
 * AppErrorFallback - Application-level error fallback component
 * Provides a complete fallback UI when the entire application encounters critical errors
 */
export const AppErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    componentName = 'Application'
}) => {
    const containerStyles = {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.colors.error[50],
        padding: tokens.spacing[8],
        fontFamily: tokens.typography.fontFamily.sans,
    };

    const cardStyles = {
        backgroundColor: 'white',
        borderRadius: tokens.borderRadius.xl,
        padding: tokens.spacing[8],
        boxShadow: tokens.shadows.xl,
        border: `2px solid ${tokens.colors.error[200]}`,
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center' as const,
    };

    const iconStyles = {
        fontSize: '80px',
        marginBottom: tokens.spacing[6],
        display: 'block',
    };

    const titleStyles = {
        fontSize: tokens.typography.fontSize['3xl'],
        fontWeight: tokens.typography.fontWeight.bold,
        color: tokens.colors.error[800],
        marginBottom: tokens.spacing[4],
    };

    const messageStyles = {
        fontSize: tokens.typography.fontSize.lg,
        color: tokens.colors.error[700],
        marginBottom: tokens.spacing[2],
        lineHeight: tokens.typography.lineHeight.relaxed,
    };

    const submessageStyles = {
        fontSize: tokens.typography.fontSize.base,
        color: tokens.colors.neutral[600],
        marginBottom: tokens.spacing[8],
        lineHeight: tokens.typography.lineHeight.relaxed,
    };

    const actionsStyles = {
        display: 'flex',
        gap: tokens.spacing[4],
        justifyContent: 'center',
        flexWrap: 'wrap' as const,
        marginBottom: tokens.spacing[8],
    };

    const supportInfoStyles = {
        backgroundColor: tokens.colors.neutral[50],
        borderRadius: tokens.borderRadius.lg,
        padding: tokens.spacing[6],
        border: `1px solid ${tokens.colors.neutral[200]}`,
        marginTop: tokens.spacing[6],
    };

    const supportTitleStyles = {
        fontSize: tokens.typography.fontSize.lg,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: tokens.colors.neutral[800],
        marginBottom: tokens.spacing[3],
    };

    const supportTextStyles = {
        fontSize: tokens.typography.fontSize.sm,
        color: tokens.colors.neutral[600],
        lineHeight: tokens.typography.lineHeight.relaxed,
        marginBottom: tokens.spacing[3],
    };

    const errorIdStyles = {
        fontSize: tokens.typography.fontSize.xs,
        color: tokens.colors.neutral[500],
        fontFamily: tokens.typography.fontFamily.mono,
        backgroundColor: tokens.colors.neutral[100],
        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
        borderRadius: tokens.borderRadius.sm,
        display: 'inline-block',
    };

    const handleReload = () => {
        window.location.reload();
    };

    const handleGoHome = () => {
        window.location.href = '/';
    };

    const errorId = `app_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div style={containerStyles} role="alert">
            <div style={cardStyles}>
                <span style={iconStyles}>💥</span>

                <h1 style={titleStyles}>Application Error</h1>

                <p style={messageStyles}>
                    Something went wrong and the application couldn't continue running.
                </p>

                <p style={submessageStyles}>
                    This is usually a temporary issue. Try refreshing the page or restarting the application.
                </p>

                <div style={actionsStyles}>
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={resetError}
                    >
                        🔄 Try Again
                    </Button>

                    <Button
                        variant="outline"
                        size="lg"
                        onClick={handleReload}
                    >
                        🔃 Reload Page
                    </Button>

                    <Button
                        variant="secondary"
                        size="lg"
                        onClick={handleGoHome}
                    >
                        🏠 Go Home
                    </Button>
                </div>

                {/* Support information */}
                <div style={supportInfoStyles}>
                    <h2 style={supportTitleStyles}>Need Help?</h2>
                    <p style={supportTextStyles}>
                        If this problem persists, please contact support with the error ID below.
                        Our team can help diagnose and resolve the issue.
                    </p>
                    <div style={errorIdStyles}>
                        Error ID: {errorId}
                    </div>
                </div>

                {/* Development error details */}
                {process.env.NODE_ENV === 'development' && (
                    <details
                        style={{
                            marginTop: tokens.spacing[6],
                            textAlign: 'left' as const,
                            backgroundColor: tokens.colors.error[100],
                            borderRadius: tokens.borderRadius.md,
                            padding: tokens.spacing[4],
                        }}
                    >
                        <summary
                            style={{
                                cursor: 'pointer',
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.error[800],
                                marginBottom: tokens.spacing[3],
                            }}
                        >
                            {componentName} Error Details (Development)
                        </summary>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.error[700],
                            }}
                        >
                            <strong>Error Message:</strong>
                            <pre
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    backgroundColor: 'white',
                                    padding: tokens.spacing[2],
                                    borderRadius: tokens.borderRadius.sm,
                                    marginTop: tokens.spacing[1],
                                    marginBottom: tokens.spacing[3],
                                    overflow: 'auto',
                                    maxHeight: '150px',
                                }}
                            >
                                {error.message}
                            </pre>

                            {error.stack && (
                                <>
                                    <strong>Stack Trace:</strong>
                                    <pre
                                        style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            backgroundColor: 'white',
                                            padding: tokens.spacing[2],
                                            borderRadius: tokens.borderRadius.sm,
                                            marginTop: tokens.spacing[1],
                                            overflow: 'auto',
                                            maxHeight: '200px',
                                        }}
                                    >
                                        {error.stack}
                                    </pre>
                                </>
                            )}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
};