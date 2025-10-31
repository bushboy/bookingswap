/**
 * Enhanced error display component for booking operations
 * Shows detailed error information including accepted booking types
 */

import React from 'react';
import { tokens } from '@/design-system/tokens';
import { Button } from './Button';
import { EnhancedBookingError } from '@/utils/bookingErrorHandler';

interface BookingErrorDisplayProps {
    error: EnhancedBookingError;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
}

export const BookingErrorDisplay: React.FC<BookingErrorDisplayProps> = ({
    error,
    onRetry,
    onDismiss,
    className = ''
}) => {
    const getErrorIcon = (type: EnhancedBookingError['type']): string => {
        switch (type) {
            case 'booking_type':
                return '🏨';
            case 'validation':
                return '⚠️';
            case 'network':
                return '🌐';
            case 'server':
                return '🔧';
            default:
                return '❌';
        }
    };

    const getErrorColor = (type: EnhancedBookingError['type']) => {
        switch (type) {
            case 'booking_type':
                return {
                    background: tokens.colors.warning[50],
                    border: tokens.colors.warning[300],
                    text: tokens.colors.warning[800],
                    textSecondary: tokens.colors.warning[700]
                };
            case 'validation':
                return {
                    background: tokens.colors.error[50],
                    border: tokens.colors.error[300],
                    text: tokens.colors.error[800],
                    textSecondary: tokens.colors.error[700]
                };
            case 'network':
                return {
                    background: tokens.colors.blue[50],
                    border: tokens.colors.blue[300],
                    text: tokens.colors.blue[800],
                    textSecondary: tokens.colors.blue[700]
                };
            default:
                return {
                    background: tokens.colors.error[50],
                    border: tokens.colors.error[300],
                    text: tokens.colors.error[800],
                    textSecondary: tokens.colors.error[700]
                };
        }
    };

    const colors = getErrorColor(error.type);

    return (
        <div
            className={className}
            style={{
                padding: tokens.spacing[4],
                backgroundColor: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: tokens.borderRadius.md,
                marginBottom: tokens.spacing[4]
            }}
            role="alert"
            aria-live="polite"
        >
            {/* Error Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: tokens.spacing[3],
                    marginBottom: tokens.spacing[3]
                }}
            >
                <span
                    style={{
                        fontSize: tokens.typography.fontSize.xl,
                        lineHeight: 1
                    }}
                    aria-hidden="true"
                >
                    {getErrorIcon(error.type)}
                </span>
                <div style={{ flex: 1 }}>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: colors.text,
                            marginBottom: tokens.spacing[1]
                        }}
                    >
                        {error.title}
                    </h3>
                    <p
                        style={{
                            margin: 0,
                            fontSize: tokens.typography.fontSize.base,
                            color: colors.textSecondary,
                            lineHeight: tokens.typography.lineHeight.relaxed
                        }}
                    >
                        {error.message}
                    </p>
                </div>
            </div>

            {/* Accepted Booking Types (for booking type errors) */}
            {error.acceptedBookingTypes && error.acceptedBookingTypes.length > 0 && (
                <div
                    style={{
                        marginBottom: tokens.spacing[3],
                        padding: tokens.spacing[3],
                        backgroundColor: 'rgba(255, 255, 255, 0.7)',
                        borderRadius: tokens.borderRadius.sm,
                        border: `1px solid ${colors.border}`
                    }}
                >
                    <h4
                        style={{
                            margin: 0,
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: colors.text,
                            marginBottom: tokens.spacing[2]
                        }}
                    >
                        Supported Booking Types:
                    </h4>
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: tokens.spacing[2]
                        }}
                    >
                        {error.acceptedBookingTypes.map((type) => (
                            <div
                                key={type.value}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: tokens.spacing[1],
                                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                    backgroundColor: 'white',
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: tokens.borderRadius.sm,
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: colors.textSecondary
                                }}
                            >
                                <span aria-hidden="true">{type.icon}</span>
                                <span>{type.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Details */}
            {error.details && error.details.length > 0 && (
                <div style={{ marginBottom: tokens.spacing[3] }}>
                    <h4
                        style={{
                            margin: 0,
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: colors.text,
                            marginBottom: tokens.spacing[2]
                        }}
                    >
                        Details:
                    </h4>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: tokens.spacing[4],
                            fontSize: tokens.typography.fontSize.sm,
                            color: colors.textSecondary
                        }}
                    >
                        {error.details.map((detail, index) => (
                            <li
                                key={index}
                                style={{ marginBottom: tokens.spacing[1] }}
                            >
                                {detail}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Suggested Actions */}
            {error.suggestedActions && error.suggestedActions.length > 0 && (
                <div style={{ marginBottom: tokens.spacing[3] }}>
                    <h4
                        style={{
                            margin: 0,
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: colors.text,
                            marginBottom: tokens.spacing[2]
                        }}
                    >
                        What you can do:
                    </h4>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: tokens.spacing[4],
                            fontSize: tokens.typography.fontSize.sm,
                            color: colors.textSecondary
                        }}
                    >
                        {error.suggestedActions.map((action, index) => (
                            <li
                                key={index}
                                style={{ marginBottom: tokens.spacing[1] }}
                            >
                                {action}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Action Buttons */}
            <div
                style={{
                    display: 'flex',
                    gap: tokens.spacing[2],
                    justifyContent: 'flex-end'
                }}
            >
                {onDismiss && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onDismiss}
                        style={{
                            borderColor: colors.border,
                            color: colors.textSecondary
                        }}
                    >
                        Dismiss
                    </Button>
                )}
                {onRetry && error.canRetry && (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={onRetry}
                    >
                        Try Again
                    </Button>
                )}
            </div>
        </div>
    );
};

export default BookingErrorDisplay;