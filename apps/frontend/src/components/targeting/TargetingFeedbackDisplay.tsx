/**
 * Targeting Feedback Display Component
 * 
 * This component provides a consistent way to display targeting-specific
 * authentication feedback messages with appropriate styling and actions.
 * 
 * Requirements satisfied:
 * - 4.1: Clear error messages for targeting-specific authentication problems
 * - 4.2: User feedback that explains targeting issues without suggesting logout
 * - 4.3: Retry options for targeting operations that don't affect main session
 * - 4.4: Detailed error information for authentication failures
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { TargetingFeedbackMessage } from '@/services/targetingFeedbackService';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TargetingFeedbackDisplayProps {
    feedback: TargetingFeedbackMessage;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
    style?: React.CSSProperties;
    showTechnicalDetails?: boolean;
    compact?: boolean;
}

// ============================================================================
// Component Implementation
// ============================================================================

export const TargetingFeedbackDisplay: React.FC<TargetingFeedbackDisplayProps> = ({
    feedback,
    onRetry,
    onDismiss,
    className,
    style,
    showTechnicalDetails = false,
    compact = false
}) => {
    // Get colors based on feedback type
    const getColors = () => {
        switch (feedback.type) {
            case 'error':
                return {
                    background: tokens.colors.error[50],
                    border: tokens.colors.error[500],
                    text: tokens.colors.error[800],
                    lightText: tokens.colors.error[700]
                };
            case 'warning':
                return {
                    background: tokens.colors.warning[50],
                    border: tokens.colors.warning[500],
                    text: tokens.colors.warning[800],
                    lightText: tokens.colors.warning[700]
                };
            case 'success':
                return {
                    background: tokens.colors.success[50],
                    border: tokens.colors.success[500],
                    text: tokens.colors.success[800],
                    lightText: tokens.colors.success[700]
                };
            case 'info':
            default:
                return {
                    background: tokens.colors.primary[50],
                    border: tokens.colors.primary[500],
                    text: tokens.colors.primary[800],
                    lightText: tokens.colors.primary[700]
                };
        }
    };

    const colors = getColors();

    return (
        <Card
            variant="outlined"
            className={className}
            style={{
                marginBottom: compact ? tokens.spacing[2] : tokens.spacing[4],
                ...style
            }}
        >
            <CardContent style={{
                padding: compact ? tokens.spacing[3] : tokens.spacing[4],
                backgroundColor: colors.background,
                borderLeft: `4px solid ${colors.border}`
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: compact ? tokens.spacing[2] : tokens.spacing[3]
                }}>
                    {/* Icon */}
                    <span style={{
                        fontSize: compact ? tokens.typography.fontSize.base : tokens.typography.fontSize.lg,
                        marginTop: tokens.spacing[1],
                        flexShrink: 0
                    }}>
                        {feedback.icon}
                    </span>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title */}
                        <h4 style={{
                            margin: 0,
                            fontSize: compact ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: colors.text,
                            lineHeight: tokens.typography.lineHeight.tight
                        }}>
                            {feedback.title}
                        </h4>

                        {/* Main Message */}
                        <p style={{
                            margin: `${tokens.spacing[1]} 0 0 0`,
                            fontSize: compact ? tokens.typography.fontSize.xs : tokens.typography.fontSize.sm,
                            color: colors.lightText,
                            lineHeight: tokens.typography.lineHeight.relaxed
                        }}>
                            {feedback.message}
                        </p>

                        {/* Preservation Notice */}
                        {feedback.preservesMainAuth && !compact && (
                            <p style={{
                                margin: `${tokens.spacing[1]} 0 0 0`,
                                fontSize: tokens.typography.fontSize.xs,
                                color: colors.lightText,
                                fontStyle: 'italic',
                                opacity: 0.8
                            }}>
                                ✓ Your main session and swaps remain secure and accessible
                            </p>
                        )}

                        {/* Action Recommendations */}
                        {feedback.actionRecommendations && feedback.actionRecommendations.length > 0 && !compact && (
                            <div style={{ marginTop: tokens.spacing[2] }}>
                                <ul style={{
                                    margin: 0,
                                    paddingLeft: tokens.spacing[4],
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: colors.lightText,
                                    lineHeight: tokens.typography.lineHeight.relaxed
                                }}>
                                    {feedback.actionRecommendations.map((recommendation, index) => (
                                        <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                            {recommendation}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Technical Details */}
                        {showTechnicalDetails && feedback.technicalDetails && !compact && (
                            <details style={{ marginTop: tokens.spacing[2] }}>
                                <summary style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: colors.lightText,
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}>
                                    Technical Details
                                </summary>
                                <pre style={{
                                    marginTop: tokens.spacing[1],
                                    padding: tokens.spacing[2],
                                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                    borderRadius: tokens.borderRadius.sm,
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: colors.lightText,
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    overflow: 'auto'
                                }}>
                                    {feedback.technicalDetails}
                                </pre>
                            </details>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{
                        display: 'flex',
                        gap: compact ? tokens.spacing[1] : tokens.spacing[2],
                        flexShrink: 0
                    }}>
                        {/* Retry Button */}
                        {feedback.showRetryOption && onRetry && (
                            <Button
                                variant="outline"
                                size={compact ? "xs" : "sm"}
                                onClick={onRetry}
                                style={{
                                    fontSize: compact ? tokens.typography.fontSize.xs : tokens.typography.fontSize.sm,
                                    borderColor: colors.border,
                                    color: colors.text,
                                    backgroundColor: 'transparent'
                                }}
                            >
                                {feedback.retryButtonText || 'Retry'}
                            </Button>
                        )}

                        {/* Dismiss Button */}
                        {feedback.dismissible && onDismiss && (
                            <Button
                                variant="ghost"
                                size={compact ? "xs" : "sm"}
                                onClick={onDismiss}
                                style={{
                                    fontSize: compact ? tokens.typography.fontSize.xs : tokens.typography.fontSize.sm,
                                    color: colors.lightText,
                                    minWidth: 'auto',
                                    padding: compact ? `${tokens.spacing[1]} ${tokens.spacing[2]}` : undefined
                                }}
                                aria-label="Dismiss feedback"
                            >
                                ✕
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ============================================================================
// Compact Variant
// ============================================================================

export const CompactTargetingFeedback: React.FC<Omit<TargetingFeedbackDisplayProps, 'compact'>> = (props) => {
    return <TargetingFeedbackDisplay {...props} compact={true} />;
};

// ============================================================================
// Inline Variant (for use in forms or smaller spaces)
// ============================================================================

export interface InlineTargetingFeedbackProps {
    feedback: TargetingFeedbackMessage;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
    style?: React.CSSProperties;
}

export const InlineTargetingFeedback: React.FC<InlineTargetingFeedbackProps> = ({
    feedback,
    onRetry,
    onDismiss,
    className,
    style
}) => {
    const getColors = () => {
        switch (feedback.type) {
            case 'error':
                return { text: tokens.colors.error[700], icon: tokens.colors.error[500] };
            case 'warning':
                return { text: tokens.colors.warning[700], icon: tokens.colors.warning[500] };
            case 'success':
                return { text: tokens.colors.success[700], icon: tokens.colors.success[500] };
            case 'info':
            default:
                return { text: tokens.colors.primary[700], icon: tokens.colors.primary[500] };
        }
    };

    const colors = getColors();

    return (
        <div
            className={className}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                padding: tokens.spacing[2],
                fontSize: tokens.typography.fontSize.sm,
                color: colors.text,
                ...style
            }}
        >
            <span style={{ color: colors.icon, flexShrink: 0 }}>
                {feedback.icon}
            </span>

            <span style={{ flex: 1, minWidth: 0 }}>
                {feedback.message}
            </span>

            {feedback.showRetryOption && onRetry && (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={onRetry}
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: colors.text,
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        height: 'auto',
                        minHeight: 'auto'
                    }}
                >
                    {feedback.retryButtonText || 'Retry'}
                </Button>
            )}

            {feedback.dismissible && onDismiss && (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={onDismiss}
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: colors.text,
                        padding: tokens.spacing[1],
                        height: 'auto',
                        minHeight: 'auto',
                        minWidth: 'auto'
                    }}
                    aria-label="Dismiss"
                >
                    ✕
                </Button>
            )}
        </div>
    );
};

export default TargetingFeedbackDisplay;