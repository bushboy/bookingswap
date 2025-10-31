import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/common';
import { tokens } from '@/design-system/tokens';
import { ErrorFallbackProps } from './ComponentErrorBoundary';

/**
 * HeaderFallback - Fallback component for Header errors
 * Provides essential navigation functionality when the main Header component fails
 */
export const HeaderFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    componentName = 'Header'
}) => {
    const headerStyles = {
        backgroundColor: tokens.colors.error[50],
        borderBottom: `2px solid ${tokens.colors.error[200]}`,
        padding: `${tokens.spacing[4]} 0`,
        position: 'sticky' as const,
        top: 0,
        zIndex: 1101,
    };

    const containerStyles = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: `0 ${tokens.spacing[4]}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    };

    const logoStyles = {
        textDecoration: 'none',
    };

    const errorMessageStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
        color: tokens.colors.error[700],
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.medium,
    };

    const navStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[4],
    };

    const basicLinkStyles = {
        color: tokens.colors.neutral[700],
        textDecoration: 'none',
        padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
        borderRadius: tokens.borderRadius.md,
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.medium,
        backgroundColor: tokens.colors.neutral[100],
        border: `1px solid ${tokens.colors.neutral[300]}`,
        transition: 'all 0.2s ease',
    };

    return (
        <header style={headerStyles} role="banner">
            <div style={containerStyles}>
                {/* Logo - always functional */}
                <Link to="/" style={logoStyles}>
                    <Logo variant="light" size="md" />
                </Link>

                {/* Error message and recovery */}
                <div style={errorMessageStyles}>
                    <span>⚠️ Navigation error occurred</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={resetError}
                        style={{
                            borderColor: tokens.colors.error[300],
                            color: tokens.colors.error[700],
                        }}
                    >
                        Retry
                    </Button>
                </div>

                {/* Basic navigation fallback */}
                <nav style={navStyles}>
                    <Link
                        to="/browse"
                        style={basicLinkStyles}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[200];
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
                        }}
                    >
                        Browse
                    </Link>
                    <Link
                        to="/bookings"
                        style={basicLinkStyles}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[200];
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
                        }}
                    >
                        Bookings
                    </Link>
                    <Link
                        to="/swaps"
                        style={basicLinkStyles}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[200];
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
                        }}
                    >
                        Swaps
                    </Link>
                </nav>
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && (
                <div
                    style={{
                        backgroundColor: tokens.colors.error[100],
                        borderTop: `1px solid ${tokens.colors.error[200]}`,
                        padding: tokens.spacing[2],
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.error[800],
                    }}
                >
                    <details>
                        <summary style={{ cursor: 'pointer', fontWeight: tokens.typography.fontWeight.medium }}>
                            {componentName} Error Details (Development)
                        </summary>
                        <pre style={{ marginTop: tokens.spacing[2], fontSize: tokens.typography.fontSize.xs }}>
                            {error.message}
                        </pre>
                    </details>
                </div>
            )}
        </header>
    );
};