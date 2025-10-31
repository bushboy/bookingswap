import React from 'react';
import { tokens } from '@/design-system/tokens';
import { Button } from './Button';

export interface CallToActionBannerProps {
    message: string;
    primaryAction: {
        label: string;
        path: string;
    };
    secondaryAction?: {
        label: string;
        path: string;
    };
    onDismiss?: () => void;
    dismissible?: boolean;
}

export const CallToActionBanner: React.FC<CallToActionBannerProps> = ({
    message,
    primaryAction,
    secondaryAction,
    onDismiss,
    dismissible = false,
}) => {
    return (
        <div
            style={{
                backgroundColor: tokens.colors.primary[50],
                border: `1px solid ${tokens.colors.primary[200]}`,
                borderRadius: tokens.borderRadius.lg,
                padding: tokens.spacing[6],
                marginBottom: tokens.spacing[6],
                position: 'relative',
            }}
        >
            {dismissible && onDismiss && (
                <button
                    onClick={onDismiss}
                    style={{
                        position: 'absolute',
                        top: tokens.spacing[3],
                        right: tokens.spacing[3],
                        background: 'none',
                        border: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                        color: tokens.colors.primary[600],
                        padding: tokens.spacing[1],
                        borderRadius: tokens.borderRadius.sm,
                        transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = tokens.colors.primary[100];
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    aria-label="Dismiss banner"
                >
                    ×
                </button>
            )}

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[4],
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[3],
                            marginBottom: tokens.spacing[2],
                        }}
                    >
                        <span style={{ fontSize: '24px' }}>🚀</span>
                        <h3
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.primary[800],
                                margin: 0,
                            }}
                        >
                            Join the Community
                        </h3>
                    </div>
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.primary[700],
                            margin: 0,
                            lineHeight: tokens.typography.lineHeight.relaxed,
                        }}
                    >
                        {message}
                    </p>
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: tokens.spacing[3],
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <Button
                        as="a"
                        href={primaryAction.path}
                        variant="primary"
                        size="medium"
                    >
                        {primaryAction.label}
                    </Button>

                    {secondaryAction && (
                        <Button
                            as="a"
                            href={secondaryAction.path}
                            variant="outline"
                            size="medium"
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};