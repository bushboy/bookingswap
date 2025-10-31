import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { tokens } from '@/design-system/tokens';
import { ErrorFallbackProps } from './ComponentErrorBoundary';

/**
 * SidebarFallback - Fallback component for Sidebar errors
 * Provides essential navigation functionality when the main Sidebar component fails
 */
export const SidebarFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    componentName = 'Sidebar'
}) => {
    const location = useLocation();

    const sidebarStyles = {
        position: 'fixed' as const,
        left: 0,
        top: 0,
        bottom: 0,
        width: '256px',
        backgroundColor: tokens.colors.error[50],
        borderRight: `2px solid ${tokens.colors.error[200]}`,
        padding: tokens.spacing[4],
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: tokens.spacing[4],
    };

    const errorHeaderStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        padding: tokens.spacing[3],
        backgroundColor: tokens.colors.error[100],
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${tokens.colors.error[200]}`,
    };

    const errorMessageStyles = {
        color: tokens.colors.error[700],
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.medium,
    };

    const retryButtonStyles = {
        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
        backgroundColor: tokens.colors.error[600],
        color: 'white',
        border: 'none',
        borderRadius: tokens.borderRadius.sm,
        fontSize: tokens.typography.fontSize.xs,
        cursor: 'pointer',
        fontWeight: tokens.typography.fontWeight.medium,
    };

    const navStyles = {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: tokens.spacing[2],
    };

    const navLinkStyles = {
        display: 'block',
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        color: tokens.colors.neutral[700],
        textDecoration: 'none',
        borderRadius: tokens.borderRadius.md,
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.medium,
        backgroundColor: tokens.colors.neutral[100],
        border: `1px solid ${tokens.colors.neutral[300]}`,
        transition: 'all 0.2s ease',
    };

    const getActiveLinkStyles = (path: string) => ({
        ...navLinkStyles,
        backgroundColor: location.pathname === path ? tokens.colors.primary[100] : tokens.colors.neutral[100],
        borderColor: location.pathname === path ? tokens.colors.primary[300] : tokens.colors.neutral[300],
        color: location.pathname === path ? tokens.colors.primary[700] : tokens.colors.neutral[700],
    });

    return (
        <aside style={sidebarStyles} role="navigation">
            {/* Error notification */}
            <div style={errorHeaderStyles}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                    <div style={errorMessageStyles}>Navigation Error</div>
                    <button
                        style={retryButtonStyles}
                        onClick={resetError}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.error[700];
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = tokens.colors.error[600];
                        }}
                    >
                        Retry
                    </button>
                </div>
            </div>

            {/* Basic navigation fallback */}
            <nav style={navStyles}>
                <Link
                    to="/browse"
                    style={getActiveLinkStyles('/browse')}
                    onMouseEnter={e => {
                        if (location.pathname !== '/browse') {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[200];
                        }
                    }}
                    onMouseLeave={e => {
                        if (location.pathname !== '/browse') {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
                        }
                    }}
                >
                    📋 Browse Swaps
                </Link>

                <Link
                    to="/bookings"
                    style={getActiveLinkStyles('/bookings')}
                    onMouseEnter={e => {
                        if (location.pathname !== '/bookings') {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[200];
                        }
                    }}
                    onMouseLeave={e => {
                        if (location.pathname !== '/bookings') {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
                        }
                    }}
                >
                    📅 My Bookings
                </Link>

                <Link
                    to="/swaps"
                    style={getActiveLinkStyles('/swaps')}
                    onMouseEnter={e => {
                        if (location.pathname !== '/swaps') {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[200];
                        }
                    }}
                    onMouseLeave={e => {
                        if (location.pathname !== '/swaps') {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
                        }
                    }}
                >
                    🔄 My Swaps
                </Link>

                <Link
                    to="/profile"
                    style={getActiveLinkStyles('/profile')}
                    onMouseEnter={e => {
                        if (location.pathname !== '/profile') {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[200];
                        }
                    }}
                    onMouseLeave={e => {
                        if (location.pathname !== '/profile') {
                            e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
                        }
                    }}
                >
                    👤 Profile
                </Link>
            </nav>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && (
                <div
                    style={{
                        marginTop: 'auto',
                        padding: tokens.spacing[2],
                        backgroundColor: tokens.colors.error[100],
                        borderRadius: tokens.borderRadius.md,
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.error[800],
                    }}
                >
                    <details>
                        <summary style={{ cursor: 'pointer', fontWeight: tokens.typography.fontWeight.medium }}>
                            {componentName} Error (Dev)
                        </summary>
                        <pre style={{ marginTop: tokens.spacing[1], fontSize: tokens.typography.fontSize.xs }}>
                            {error.message}
                        </pre>
                    </details>
                </div>
            )}
        </aside>
    );
};