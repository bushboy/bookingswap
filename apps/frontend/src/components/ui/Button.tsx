import React, { forwardRef, ReactNode } from 'react';
import { tokens } from '@/design-system/tokens';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
    size?: 'small' | 'medium' | 'large' | 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    icon?: ReactNode;
    iconOnly?: boolean;
    as?: 'button' | 'a';
    href?: string;
    children?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'medium',
            loading = false,
            disabled = false,
            fullWidth = false,
            icon,
            iconOnly = false,
            as = 'button',
            href,
            className = '',
            children,
            onClick,
            ...props
        },
        ref
    ) => {
        // Normalize size prop to handle both formats
        const normalizeSize = (size: string): 'small' | 'medium' | 'large' => {
            switch (size) {
                case 'sm': return 'small';
                case 'md': return 'medium';
                case 'lg': return 'large';
                default: return size as 'small' | 'medium' | 'large';
            }
        };

        const normalizedSize = normalizeSize(size);

        const baseStyles = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: tokens.spacing[2],
            fontFamily: tokens.typography.fontFamily.sans.join(', '),
            fontWeight: tokens.typography.fontWeight.medium,
            borderRadius: tokens.borderRadius.md,
            border: 'none',
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease-in-out',
            textDecoration: 'none',
            outline: 'none',
            position: 'relative' as const,
            opacity: disabled || loading ? 0.6 : 1,
            width: fullWidth ? '100%' : 'auto',
        };

        const sizeStyles = {
            small: {
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                fontSize: tokens.typography.fontSize.sm,
                minHeight: '32px',
            },
            medium: {
                padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                fontSize: tokens.typography.fontSize.base,
                minHeight: '40px',
            },
            large: {
                padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
                fontSize: tokens.typography.fontSize.lg,
                minHeight: '48px',
            },
        };

        const variantStyles = {
            primary: {
                backgroundColor: tokens.colors.primary[600],
                color: tokens.colors.white,
                boxShadow: tokens.shadows.sm,
                ':hover': {
                    backgroundColor: tokens.colors.primary[700],
                },
                ':focus': {
                    boxShadow: `0 0 0 3px ${tokens.colors.primary[200]}`,
                },
            },
            secondary: {
                backgroundColor: tokens.colors.neutral[100],
                color: tokens.colors.neutral[900],
                boxShadow: tokens.shadows.sm,
                ':hover': {
                    backgroundColor: tokens.colors.neutral[200],
                },
                ':focus': {
                    boxShadow: `0 0 0 3px ${tokens.colors.neutral[300]}`,
                },
            },
            danger: {
                backgroundColor: tokens.colors.error[600],
                color: tokens.colors.white,
                boxShadow: tokens.shadows.sm,
                ':hover': {
                    backgroundColor: tokens.colors.error[700],
                },
                ':focus': {
                    boxShadow: `0 0 0 3px ${tokens.colors.error[200]}`,
                },
            },
            ghost: {
                backgroundColor: 'transparent',
                color: tokens.colors.neutral[700],
                ':hover': {
                    backgroundColor: tokens.colors.neutral[100],
                },
                ':focus': {
                    boxShadow: `0 0 0 3px ${tokens.colors.neutral[200]}`,
                },
            },
            outline: {
                backgroundColor: 'transparent',
                color: tokens.colors.primary[600],
                border: `1px solid ${tokens.colors.primary[300]}`,
                ':hover': {
                    backgroundColor: tokens.colors.primary[50],
                    borderColor: tokens.colors.primary[400],
                },
                ':focus': {
                    boxShadow: `0 0 0 3px ${tokens.colors.primary[200]}`,
                },
            },
        };

        const combinedStyles = {
            ...baseStyles,
            ...sizeStyles[normalizedSize],
            ...variantStyles[variant],
        };

        const classNames = [
            `btn-${variant}`,
            `btn-${normalizedSize}`,
            fullWidth && 'btn-full-width',
            iconOnly && 'btn-icon-only',
            className,
        ]
            .filter(Boolean)
            .join(' ');

        const handleClick = (e: React.MouseEvent) => {
            if (disabled || loading) {
                e.preventDefault();
                return;
            }
            onClick?.(e as any);
        };

        const LoadingSpinner = () => (
            <div
                data-testid="loading-spinner"
                style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid currentColor',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }}
            />
        );

        const content = (
            <>
                {loading && <LoadingSpinner />}
                {!loading && icon && <span className="btn-icon">{icon}</span>}
                {!iconOnly && children && <span className="btn-text">{children}</span>}
                <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
            </>
        );

        if (as === 'a') {
            return (
                <a
                    ref={ref as React.Ref<HTMLAnchorElement>}
                    href={href}
                    className={classNames}
                    style={combinedStyles}
                    onClick={handleClick}
                    aria-busy={loading}
                    {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
                >
                    {content}
                </a>
            );
        }

        return (
            <button
                ref={ref as React.Ref<HTMLButtonElement>}
                type="button"
                className={classNames}
                style={combinedStyles}
                disabled={disabled || loading}
                onClick={handleClick}
                aria-busy={loading}
                {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            >
                {content}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };