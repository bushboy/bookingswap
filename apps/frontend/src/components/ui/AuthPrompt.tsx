import React from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '@/design-system/tokens';
import { Button } from './Button';

export interface AuthPromptProps {
    action: string;
    message?: string;
    returnPath?: string;
    context?: any;
    onLogin?: () => void;
    onRegister?: () => void;
    compact?: boolean;
}

export const AuthPrompt: React.FC<AuthPromptProps> = ({
    action,
    message,
    returnPath = '/browse',
    context,
    onLogin,
    onRegister,
    compact = false,
}) => {
    const defaultMessage = `Please sign in to ${action}`;
    const displayMessage = message || defaultMessage;

    const loginState = {
        from: returnPath,
        action,
        context,
    };

    if (compact) {
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: tokens.spacing[2],
                    backgroundColor: tokens.colors.neutral[50],
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.sm,
                }}
            >
                <span style={{ color: tokens.colors.neutral[600] }}>
                    {displayMessage}
                </span>
                <Link
                    to="/login"
                    state={loginState}
                    style={{
                        color: tokens.colors.primary[600],
                        textDecoration: 'none',
                        fontWeight: tokens.typography.fontWeight.medium,
                    }}
                    onClick={onLogin}
                >
                    Sign In
                </Link>
            </div>
        );
    }

    return (
        <div
            style={{
                textAlign: 'center',
                padding: tokens.spacing[8],
                backgroundColor: tokens.colors.neutral[50],
                border: `1px solid ${tokens.colors.neutral[200]}`,
                borderRadius: tokens.borderRadius.lg,
                margin: `${tokens.spacing[4]} 0`,
            }}
        >
            <div
                style={{
                    fontSize: '48px',
                    marginBottom: tokens.spacing[4],
                }}
            >
                🔐
            </div>

            <h3
                style={{
                    fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[800],
                    margin: `0 0 ${tokens.spacing[3]} 0`,
                }}
            >
                Authentication Required
            </h3>

            <p
                style={{
                    fontSize: tokens.typography.fontSize.base,
                    color: tokens.colors.neutral[600],
                    margin: `0 0 ${tokens.spacing[6]} 0`,
                    lineHeight: tokens.typography.lineHeight.relaxed,
                    maxWidth: '400px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                }}
            >
                {displayMessage}
            </p>

            <div
                style={{
                    display: 'flex',
                    gap: tokens.spacing[3],
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                }}
            >
                <Button
                    as="a"
                    href="/login"
                    variant="primary"
                    size="medium"
                    onClick={onLogin}
                >
                    Sign In
                </Button>

                <Button
                    as="a"
                    href="/register"
                    variant="outline"
                    size="medium"
                    onClick={onRegister}
                >
                    Create Account
                </Button>
            </div>

            <p
                style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[500],
                    margin: `${tokens.spacing[4]} 0 0 0`,
                }}
            >
                Don't have an account?{' '}
                <Link
                    to="/register"
                    state={loginState}
                    style={{
                        color: tokens.colors.primary[600],
                        textDecoration: 'none',
                        fontWeight: tokens.typography.fontWeight.medium,
                    }}
                    onClick={onRegister}
                >
                    Sign up for free
                </Link>
            </p>
        </div>
    );
};