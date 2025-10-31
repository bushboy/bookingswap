import React, { forwardRef, ReactNode } from 'react';
import { tokens } from '@/design-system/tokens';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: 'none' | 'small' | 'medium' | 'large';
    children?: ReactNode;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children?: ReactNode;
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children?: ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
    (
        {
            variant = 'default',
            padding = 'medium',
            className = '',
            children,
            style,
            ...props
        },
        ref
    ) => {
        const baseStyles = {
            backgroundColor: tokens.colors.white,
            borderRadius: tokens.borderRadius.lg,
            border: `1px solid ${tokens.colors.neutral[200]}`,
            overflow: 'hidden' as const,
        };

        const variantStyles = {
            default: {
                boxShadow: tokens.shadows.sm,
            },
            elevated: {
                boxShadow: tokens.shadows.lg,
                transform: 'translateY(-1px)',
            },
            outlined: {
                boxShadow: 'none',
                borderWidth: '2px',
                borderColor: tokens.colors.neutral[300],
            },
        };

        const paddingStyles = {
            none: { padding: '0' },
            small: { padding: tokens.spacing[4] },
            medium: { padding: tokens.spacing[6] },
            large: { padding: tokens.spacing[8] },
        };

        const combinedStyles = {
            ...baseStyles,
            ...variantStyles[variant],
            ...paddingStyles[padding],
            ...style,
        };

        const classNames = [
            'card',
            `card-${variant}`,
            `card-padding-${padding}`,
            className,
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <div
                ref={ref}
                className={classNames}
                style={combinedStyles}
                {...props}
            >
                {children}
            </div>
        );
    }
);

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className = '', children, style, ...props }, ref) => {
        const headerStyles = {
            padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
            borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
            backgroundColor: tokens.colors.neutral[50],
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            ...style,
        };

        const classNames = ['card-header', className].filter(Boolean).join(' ');

        return (
            <div
                ref={ref}
                className={classNames}
                style={headerStyles}
                {...props}
            >
                {children}
            </div>
        );
    }
);

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
    ({ className = '', children, style, ...props }, ref) => {
        const contentStyles = {
            padding: tokens.spacing[6],
            color: tokens.colors.neutral[700],
            lineHeight: tokens.typography.lineHeight.normal,
            ...style,
        };

        const classNames = ['card-content', className].filter(Boolean).join(' ');

        return (
            <div
                ref={ref}
                className={classNames}
                style={contentStyles}
                {...props}
            >
                {children}
            </div>
        );
    }
);

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
    ({ className = '', children, style, ...props }, ref) => {
        const footerStyles = {
            padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
            backgroundColor: tokens.colors.neutral[50],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: tokens.spacing[3],
            ...style,
        };

        const classNames = ['card-footer', className].filter(Boolean).join(' ');

        return (
            <div
                ref={ref}
                className={classNames}
                style={footerStyles}
                {...props}
            >
                {children}
            </div>
        );
    }
);

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ className = '', children, style, ...props }, ref) => {
        const titleStyles = {
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
            ...style,
        };

        const classNames = ['card-title', className].filter(Boolean).join(' ');

        return (
            <h3
                ref={ref}
                className={classNames}
                style={titleStyles}
                {...props}
            >
                {children}
            </h3>
        );
    }
);

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
    ({ className = '', children, style, ...props }, ref) => {
        const descriptionStyles = {
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
            margin: 0,
            lineHeight: tokens.typography.lineHeight.normal,
            ...style,
        };

        const classNames = ['card-description', className].filter(Boolean).join(' ');

        return (
            <p
                ref={ref}
                className={classNames}
                style={descriptionStyles}
                {...props}
            >
                {children}
            </p>
        );
    }
);

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';
CardTitle.displayName = 'CardTitle';
CardDescription.displayName = 'CardDescription';

export { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription };