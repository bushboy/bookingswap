import React, { forwardRef, ReactNode } from 'react';
import { tokens } from '@/design-system/tokens';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
    size?: 'small' | 'medium' | 'large' | 'sm' | 'md' | 'lg';
    children?: ReactNode;
    fallbackVariant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// Prop validation function
const validateProps = (props: BadgeProps): ValidationResult => {
    const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
    };

    const validVariants = ['default', 'primary', 'secondary', 'success', 'warning', 'error', 'info'];
    const validSizes = ['small', 'medium', 'large', 'sm', 'md', 'lg'];

    // Validate variant
    if (props.variant && !validVariants.includes(props.variant)) {
        result.isValid = false;
        result.errors.push(`Invalid variant "${props.variant}". Valid variants are: ${validVariants.join(', ')}`);
    }

    // Validate size
    if (props.size && !validSizes.includes(props.size)) {
        result.isValid = false;
        result.errors.push(`Invalid size "${props.size}". Valid sizes are: ${validSizes.join(', ')}`);
    }

    // Validate fallbackVariant
    if (props.fallbackVariant && !validVariants.includes(props.fallbackVariant)) {
        result.warnings.push(`Invalid fallbackVariant "${props.fallbackVariant}". Valid variants are: ${validVariants.join(', ')}`);
    }

    // Validate children
    if (props.children === null || props.children === undefined) {
        result.warnings.push('Badge has no content. Consider providing children or text content.');
    }

    return result;
};

// Fallback styles function for when design tokens are missing
const getFallbackStyles = (variant: string, size: string) => {
    const fallbackColors = {
        default: { bg: '#f3f4f6', color: '#1f2937' },
        primary: { bg: '#dbeafe', color: '#1e40af' },
        secondary: { bg: '#f1f5f9', color: '#1e293b' },
        success: { bg: '#dcfce7', color: '#166534' },
        warning: { bg: '#fef3c7', color: '#92400e' },
        error: { bg: '#fee2e2', color: '#991b1b' },
        info: { bg: '#dbeafe', color: '#1e40af' }
    };

    const fallbackSizes = {
        small: { padding: '0.25rem 0.5rem', fontSize: '0.75rem', minHeight: '20px' },
        medium: { padding: '0.25rem 0.75rem', fontSize: '0.875rem', minHeight: '24px' },
        large: { padding: '0.5rem 1rem', fontSize: '1rem', minHeight: '32px' }
    };

    const colorFallback = fallbackColors[variant as keyof typeof fallbackColors] || fallbackColors.default;
    const sizeFallback = fallbackSizes[size as keyof typeof fallbackSizes] || fallbackSizes.medium;

    return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: 500,
        borderRadius: '9999px',
        border: 'none',
        textAlign: 'center' as const,
        whiteSpace: 'nowrap' as const,
        backgroundColor: colorFallback.bg,
        color: colorFallback.color,
        ...sizeFallback
    };
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    (
        {
            variant = 'default',
            size = 'medium',
            className = '',
            children,
            style,
            fallbackVariant = 'default',
            ...props
        },
        ref
    ) => {
        // Validate props and handle errors gracefully
        const validation = validateProps({ variant, size, children, fallbackVariant, ...props });

        // Log validation errors and warnings in development
        if (process.env.NODE_ENV === 'development') {
            if (validation.errors.length > 0) {
                console.error('Badge component validation errors:', validation.errors);
            }
            if (validation.warnings.length > 0) {
                console.warn('Badge component validation warnings:', validation.warnings);
            }
        }

        // Use fallback values for invalid props
        const safeVariant = validation.isValid && variant ? variant : fallbackVariant;
        const safeSize = validation.isValid && size ? size : 'medium';

        // Normalize size prop to handle both formats
        const normalizeSize = (size: string): 'small' | 'medium' | 'large' => {
            switch (size) {
                case 'sm': return 'small';
                case 'md': return 'medium';
                case 'lg': return 'large';
                default: return size as 'small' | 'medium' | 'large';
            }
        };

        const normalizedSize = normalizeSize(safeSize);

        // Try to use design tokens, fall back to hardcoded styles if tokens are missing
        let combinedStyles: React.CSSProperties;

        try {
            // Check if required tokens are available
            const tokensAvailable = tokens &&
                tokens.colors &&
                tokens.typography &&
                tokens.spacing &&
                tokens.borderRadius;

            if (!tokensAvailable) {
                throw new Error('Design tokens not available');
            }

            // Validate specific token paths for the variant
            const variantColorPath = safeVariant === 'info' ? 'blue' : safeVariant;
            const hasVariantColors = tokens.validateToken(`colors.${variantColorPath}.100`) &&
                tokens.validateToken(`colors.${variantColorPath}.800`);

            if (!hasVariantColors) {
                // Use fallback color from tokens system
                const bgColor = tokens.getFallbackColor(safeVariant, 100);
                const textColor = tokens.getFallbackColor(safeVariant, 800);

                const baseStyles = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: tokens.typography.fontFamily.sans.join(', '),
                    fontWeight: tokens.typography.fontWeight.medium,
                    borderRadius: tokens.borderRadius.full,
                    border: 'none',
                    textAlign: 'center' as const,
                    whiteSpace: 'nowrap' as const,
                    backgroundColor: bgColor,
                    color: textColor,
                };

                const sizeStyles = {
                    small: {
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        fontSize: tokens.typography.fontSize.xs,
                        minHeight: '20px',
                    },
                    medium: {
                        padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                        fontSize: tokens.typography.fontSize.sm,
                        minHeight: '24px',
                    },
                    large: {
                        padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                        fontSize: tokens.typography.fontSize.base,
                        minHeight: '32px',
                    },
                };

                combinedStyles = {
                    ...baseStyles,
                    ...sizeStyles[normalizedSize],
                    ...style,
                };
            } else {
                // Use full design tokens
                const baseStyles = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: tokens.typography.fontFamily.sans.join(', '),
                    fontWeight: tokens.typography.fontWeight.medium,
                    borderRadius: tokens.borderRadius.full,
                    border: 'none',
                    textAlign: 'center' as const,
                    whiteSpace: 'nowrap' as const,
                };

                const sizeStyles = {
                    small: {
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        fontSize: tokens.typography.fontSize.xs,
                        minHeight: '20px',
                    },
                    medium: {
                        padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                        fontSize: tokens.typography.fontSize.sm,
                        minHeight: '24px',
                    },
                    large: {
                        padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                        fontSize: tokens.typography.fontSize.base,
                        minHeight: '32px',
                    },
                };

                const variantStyles = {
                    default: {
                        backgroundColor: tokens.colors.neutral[100],
                        color: tokens.colors.neutral[800],
                    },
                    primary: {
                        backgroundColor: tokens.colors.primary[100],
                        color: tokens.colors.primary[800],
                    },
                    secondary: {
                        backgroundColor: tokens.colors.secondary[100],
                        color: tokens.colors.secondary[800],
                    },
                    success: {
                        backgroundColor: tokens.colors.success[100],
                        color: tokens.colors.success[800],
                    },
                    warning: {
                        backgroundColor: tokens.colors.warning[100],
                        color: tokens.colors.warning[800],
                    },
                    error: {
                        backgroundColor: tokens.colors.error[100],
                        color: tokens.colors.error[800],
                    },
                    info: {
                        backgroundColor: tokens.colors.blue[100],
                        color: tokens.colors.blue[800],
                    },
                };

                combinedStyles = {
                    ...baseStyles,
                    ...sizeStyles[normalizedSize],
                    ...variantStyles[safeVariant],
                    ...style,
                };
            }
        } catch (error) {
            // Complete fallback when design tokens are unavailable
            if (process.env.NODE_ENV === 'development') {
                console.warn('Badge component: Design tokens unavailable, using fallback styles', error);
            }

            combinedStyles = {
                ...getFallbackStyles(safeVariant, normalizedSize),
                ...style,
            };
        }

        const classNames = [
            'badge',
            `badge-${safeVariant}`,
            `badge-${normalizedSize}`,
            className,
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <span
                ref={ref}
                className={classNames}
                style={combinedStyles}
                {...props}
            >
                {children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';

export { Badge };