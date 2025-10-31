import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { ErrorFallbackProps } from './ComponentErrorBoundary';

/**
 * MainContentFallback - Fallback component for main content area errors
 * Provides essential functionality when the main content area fails to render
 */
export const MainContentFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    componentName = 'Main Content'
}) => {

    const containerStyles = {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: tokens.spacing[8],
        backgroundColor: tokens.colors.error[50],
        borderRadius: tokens.borderRadius.lg,
        border: `2px solid ${tokens.colors.error[200]}`,
        margin: tokens.spacing[4],
    };

    const iconStyles = {
        fontSize: '64px',
        marginBottom: tokens.spacing[4],
    };

    const titleStyles = {
        fontSize: tokens.typography.fontSize['2xl'],
        fontWeight: tokens.typography.fontWeight.bold,
        color: tokens.colors.error[800],
        marginBottom: tokens.spacing[2],
        textAlign: 'center' as const,
    };

    const messageStyles = {
        fontSize: tokens.typography.fontSize.lg,
        color: tokens.colors.error[700],
        marginBottom: tokens.spacing[6],
        textAlign: 'center' as const,
        maxWidth: '500px',
    };

    const actionsStyles = {
        display: 'flex',
        gap: tokens.spacing[4],
        flexWrap: 'wrap' as const,
        justifyContent: 'center',
    };

    const quickLinksStyles = {
        marginTop: tokens.spacing[8],
        padding: tokens.spacing[6],
        backgroundColor: 'white',
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${tokens.colors.neutral[200]}`,
        width: '100%',
        maxWidth: '600px',
    };

    const quickLinksHeaderStyles = {
        fontSize: tokens.typography.fontSize.lg,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: tokens.colors.neutral[800],
        marginBottom: tokens.spacing[4],
        textAlign: 'center' as const,
    };

    const linksGridStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: tokens.spacing[3],
    };

    const linkCardStyles = {
        display: 'block',
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.neutral[50],
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${tokens.colors.neutral[200]}`,
        textDecoration: 'none',
        color: tokens.colors.neutral[700],
        transition: 'all 0.2s ease',
    };

    const linkTitleStyles = {
        fontSize: tokens.typography.fontSize.base,
        fontWeight: tokens.typography.fontWeight.semibold,
        marginBottom: tokens.spacing[1],
    };

    const linkDescStyles = {
        fontSize: tokens.typography.fontSize.sm,
        color: tokens.colors.neutral[600],
    };

    return (
        <div style={containerStyles} role="alert">
            <div style={iconStyles}>🚫</div>

            <h1 style={titleStyles}>Content Unavailable</h1>

            <p style={messageStyles}>
                The page content encountered an error and couldn't be displayed.
                You can try refreshing or navigate to another section.
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
                    onClick={() => window.location.reload()}
                >
                    🔃 Refresh Page
                </Button>
            </div>

            {/* Quick navigation links */}
            <div style={quickLinksStyles}>
                <h2 style={quickLinksHeaderStyles}>Quick Navigation</h2>

                <div style={linksGridStyles}>
                    <Link
                        to="/browse"
                        style={linkCardStyles}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.primary[50];
                            e.currentTarget.style.borderColor = tokens.colors.primary[200];
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[50];
                            e.currentTarget.style.borderColor = tokens.colors.neutral[200];
                        }}
                    >
                        <div style={linkTitleStyles}>📋 Browse Swaps</div>
                        <div style={linkDescStyles}>Find available accommodation swaps</div>
                    </Link>

                    <Link
                        to="/bookings"
                        style={linkCardStyles}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.primary[50];
                            e.currentTarget.style.borderColor = tokens.colors.primary[200];
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[50];
                            e.currentTarget.style.borderColor = tokens.colors.neutral[200];
                        }}
                    >
                        <div style={linkTitleStyles}>📅 My Bookings</div>
                        <div style={linkDescStyles}>Manage your accommodation bookings</div>
                    </Link>

                    <Link
                        to="/swaps"
                        style={linkCardStyles}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.primary[50];
                            e.currentTarget.style.borderColor = tokens.colors.primary[200];
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[50];
                            e.currentTarget.style.borderColor = tokens.colors.neutral[200];
                        }}
                    >
                        <div style={linkTitleStyles}>🔄 My Swaps</div>
                        <div style={linkDescStyles}>View your swap proposals and history</div>
                    </Link>

                    <Link
                        to="/profile"
                        style={linkCardStyles}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.primary[50];
                            e.currentTarget.style.borderColor = tokens.colors.primary[200];
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[50];
                            e.currentTarget.style.borderColor = tokens.colors.neutral[200];
                        }}
                    >
                        <div style={linkTitleStyles}>👤 Profile</div>
                        <div style={linkDescStyles}>Update your account settings</div>
                    </Link>
                </div>
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && (
                <details
                    style={{
                        marginTop: tokens.spacing[6],
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.error[100],
                        borderRadius: tokens.borderRadius.md,
                        width: '100%',
                        maxWidth: '600px',
                    }}
                >
                    <summary
                        style={{
                            cursor: 'pointer',
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.error[800],
                            marginBottom: tokens.spacing[2],
                        }}
                    >
                        {componentName} Error Details (Development)
                    </summary>
                    <pre
                        style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.error[700],
                            backgroundColor: 'white',
                            padding: tokens.spacing[3],
                            borderRadius: tokens.borderRadius.sm,
                            overflow: 'auto',
                            maxHeight: '200px',
                        }}
                    >
                        {error.message}
                        {error.stack && `\n\n${error.stack}`}
                    </pre>
                </details>
            )}
        </div>
    );
};