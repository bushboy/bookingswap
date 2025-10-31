import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';

export interface ProposalConfirmationDialogProps {
    /** Whether the dialog is open */
    isOpen: boolean;

    /** Type of action being confirmed */
    actionType: 'accept' | 'reject';

    /** Proposal details for context */
    proposalDetails?: {
        proposalId: string;
        proposalType?: 'booking' | 'cash';
        targetTitle?: string;
        proposerName?: string;
    };

    /** Whether the action is currently processing */
    loading?: boolean;

    /** Callback when user confirms the action */
    onConfirm: (reason?: string) => Promise<void> | void;

    /** Callback when user cancels the action */
    onCancel: () => void;

    /** Initial rejection reason (for reject dialogs) */
    initialReason?: string;

    /** Whether to show the reason field (for reject dialogs) */
    showReasonField?: boolean;

    /** Custom confirmation message */
    customMessage?: string;

    /** Dialog customization options */
    options?: {
        /** Whether to show keyboard shortcuts */
        showKeyboardShortcuts?: boolean;
        /** Whether to auto-focus the confirm button */
        autoFocusConfirm?: boolean;
        /** Whether to show detailed proposal info */
        showProposalDetails?: boolean;
        /** Custom button text */
        confirmButtonText?: string;
        cancelButtonText?: string;
    };
}

/**
 * Enhanced confirmation dialog for proposal actions
 * Supports keyboard navigation, accessibility, and customization
 * Requirements: 4.1, 4.3
 */
export const ProposalConfirmationDialog: React.FC<ProposalConfirmationDialogProps> = ({
    isOpen,
    actionType,
    proposalDetails,
    loading = false,
    onConfirm,
    onCancel,
    initialReason = '',
    showReasonField = false,
    customMessage,
    options = {}
}) => {
    const {
        showKeyboardShortcuts = true,
        autoFocusConfirm = true,
        showProposalDetails = true,
        confirmButtonText,
        cancelButtonText = 'Cancel'
    } = options;

    const [rejectionReason, setRejectionReason] = useState(initialReason);
    const [isConfirming, setIsConfirming] = useState(false);
    const [reasonError, setReasonError] = useState<string | null>(null);
    const [reasonWarning, setReasonWarning] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false); // Track if user has made changes

    // Refs for keyboard navigation and focus management
    const dialogRef = useRef<HTMLDivElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const reasonTextareaRef = useRef<HTMLTextAreaElement>(null);
    const previousActiveElement = useRef<Element | null>(null);

    // Character limits for rejection reason
    const MAX_REASON_LENGTH = 500;
    const MIN_REASON_LENGTH = 0; // Optional field
    const RECOMMENDED_MIN_LENGTH = 10; // For helpful feedback
    const WARNING_LENGTH = 450; // Show warning when approaching limit

    // Store the previously focused element when dialog opens
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement;
        }
    }, [isOpen]);

    // Focus management and keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
                case 'Escape':
                    event.preventDefault();
                    if (!loading && !isConfirming) {
                        handleCancel();
                    }
                    break;

                case 'Enter':
                    // Only trigger confirm on Enter if not in textarea or if Ctrl+Enter
                    if (event.target !== reasonTextareaRef.current || event.ctrlKey) {
                        event.preventDefault();
                        if (!loading && !isConfirming) {
                            handleConfirm();
                        }
                    }
                    break;

                case 'Tab':
                    // Trap focus within dialog
                    const focusableElements = dialogRef.current?.querySelectorAll(
                        'button, textarea, input, [tabindex]:not([tabindex="-1"])'
                    );

                    if (focusableElements && focusableElements.length > 0) {
                        const firstElement = focusableElements[0] as HTMLElement;
                        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

                        if (event.shiftKey && event.target === firstElement) {
                            event.preventDefault();
                            lastElement.focus();
                        } else if (!event.shiftKey && event.target === lastElement) {
                            event.preventDefault();
                            firstElement.focus();
                        }
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Set initial focus
        const focusTarget = showReasonField && reasonTextareaRef.current
            ? reasonTextareaRef.current
            : autoFocusConfirm && confirmButtonRef.current
                ? confirmButtonRef.current
                : cancelButtonRef.current;

        if (focusTarget) {
            // Small delay to ensure dialog is rendered
            setTimeout(() => focusTarget.focus(), 100);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, loading, isConfirming, showReasonField, autoFocusConfirm]);

    // Restore focus when dialog closes
    useEffect(() => {
        if (!isOpen && previousActiveElement.current) {
            (previousActiveElement.current as HTMLElement).focus?.();
            previousActiveElement.current = null;
        }
    }, [isOpen]);

    // Reason persistence key for localStorage
    const reasonStorageKey = `proposal-rejection-reason-${proposalDetails?.proposalId || 'default'}`;

    // Load persisted reason when dialog opens
    useEffect(() => {
        if (isOpen && showReasonField && actionType === 'reject') {
            // Try to load persisted reason from localStorage
            try {
                const persistedReason = localStorage.getItem(reasonStorageKey);
                if (persistedReason && !initialReason) {
                    setRejectionReason(persistedReason);
                } else {
                    setRejectionReason(initialReason);
                }
            } catch (error) {
                console.warn('Failed to load persisted rejection reason:', error);
                setRejectionReason(initialReason);
            }
            setReasonError(null);
            setReasonWarning(null);
            setIsConfirming(false);
            setIsDirty(false);
        } else if (isOpen) {
            setRejectionReason(initialReason);
            setReasonError(null);
            setReasonWarning(null);
            setIsConfirming(false);
            setIsDirty(false);
        }
    }, [isOpen, initialReason, showReasonField, actionType, reasonStorageKey]);

    // Persist reason to localStorage as user types (with debouncing)
    useEffect(() => {
        if (showReasonField && actionType === 'reject' && isDirty) {
            const timeoutId = setTimeout(() => {
                try {
                    if (rejectionReason.trim()) {
                        localStorage.setItem(reasonStorageKey, rejectionReason);
                    } else {
                        localStorage.removeItem(reasonStorageKey);
                    }
                } catch (error) {
                    console.warn('Failed to persist rejection reason:', error);
                }
            }, 500); // Debounce for 500ms

            return () => clearTimeout(timeoutId);
        }
    }, [rejectionReason, showReasonField, actionType, reasonStorageKey, isDirty]);

    // Clear persisted reason when dialog closes successfully
    useEffect(() => {
        if (!isOpen && showReasonField && actionType === 'reject') {
            try {
                localStorage.removeItem(reasonStorageKey);
            } catch (error) {
                console.warn('Failed to clear persisted rejection reason:', error);
            }
        }
    }, [isOpen, showReasonField, actionType, reasonStorageKey]);

    // Validate rejection reason
    const validateReason = useCallback((reason: string): { error: string | null; warning: string | null } => {
        if (showReasonField && actionType === 'reject') {
            const trimmedReason = reason.trim();

            // Character limit validation
            if (trimmedReason.length > MAX_REASON_LENGTH) {
                return {
                    error: `Reason must be ${MAX_REASON_LENGTH} characters or less`,
                    warning: null
                };
            }

            // Minimum length validation if required
            if (MIN_REASON_LENGTH > 0 && trimmedReason.length < MIN_REASON_LENGTH) {
                return {
                    error: `Reason must be at least ${MIN_REASON_LENGTH} characters`,
                    warning: null
                };
            }

            // Check for potentially offensive or inappropriate content
            const inappropriatePatterns = [
                /\b(fuck|shit|damn|hell|ass|bitch)\b/i,
                /\b(stupid|idiot|moron|dumb|retard)\b/i,
                /\b(hate|sucks|terrible|awful|horrible)\b/i
            ];

            if (inappropriatePatterns.some(pattern => pattern.test(trimmedReason))) {
                return {
                    error: 'Please keep your feedback professional and constructive',
                    warning: null
                };
            }

            // Check for very short reasons that might not be helpful
            if (trimmedReason.length > 0 && trimmedReason.length < 5) {
                return {
                    error: null,
                    warning: 'Consider providing more detail to help the proposer understand'
                };
            }

            // Warning when approaching character limit
            if (trimmedReason.length >= WARNING_LENGTH) {
                return {
                    error: null,
                    warning: `Approaching character limit (${trimmedReason.length}/${MAX_REASON_LENGTH})`
                };
            }

            // Check for all caps (might seem aggressive)
            if (trimmedReason.length > 10 && trimmedReason === trimmedReason.toUpperCase()) {
                return {
                    error: null,
                    warning: 'Consider using normal capitalization for a friendlier tone'
                };
            }
        }

        return { error: null, warning: null };
    }, [showReasonField, actionType, MAX_REASON_LENGTH, MIN_REASON_LENGTH, WARNING_LENGTH]);

    // Handle reason change with validation
    const handleReasonChange = useCallback((value: string) => {
        setRejectionReason(value);
        setIsDirty(true);

        // Real-time validation
        const validation = validateReason(value);
        setReasonError(validation.error);
        setReasonWarning(validation.warning);
    }, [validateReason]);

    const handleConfirm = useCallback(async () => {
        if (loading || isConfirming) return;

        // Validate reason if required
        const validation = validateReason(rejectionReason);
        if (validation.error) {
            setReasonError(validation.error);
            reasonTextareaRef.current?.focus();
            return;
        }

        setIsConfirming(true);

        try {
            const reasonToPass = showReasonField && actionType === 'reject'
                ? rejectionReason.trim() || undefined
                : undefined;

            await onConfirm(reasonToPass);
        } catch (error) {
            console.error('Confirmation action failed:', error);
            // Error handling is managed by parent component
        } finally {
            setIsConfirming(false);
        }
    }, [loading, isConfirming, validateReason, rejectionReason, showReasonField, actionType, onConfirm]);

    const handleCancel = useCallback(() => {
        if (loading || isConfirming) return;

        // Warn about unsaved changes if user has typed something
        if (isDirty && rejectionReason.trim().length > 0 && showReasonField && actionType === 'reject') {
            const confirmDiscard = window.confirm(
                'You have unsaved changes to your rejection reason. Are you sure you want to cancel?'
            );
            if (!confirmDiscard) {
                return;
            }
        }

        onCancel();
    }, [loading, isConfirming, isDirty, rejectionReason, showReasonField, actionType, onCancel]);

    // Don't render if not open
    if (!isOpen) {
        return null;
    }

    // Get action-specific configuration
    const getActionConfig = () => {
        switch (actionType) {
            case 'accept':
                return {
                    title: 'Accept Proposal',
                    icon: '✅',
                    iconBg: tokens.colors.success[100],
                    borderColor: tokens.colors.success[500],
                    confirmButtonStyle: {
                        backgroundColor: tokens.colors.success[500],
                        borderColor: tokens.colors.success[500],
                        color: 'white'
                    },
                    defaultMessage: 'Are you sure you want to accept this proposal? This action will initiate the swap process and cannot be undone.',
                    severity: 'success' as const
                };

            case 'reject':
                return {
                    title: 'Reject Proposal',
                    icon: '❌',
                    iconBg: tokens.colors.error[100],
                    borderColor: tokens.colors.error[500],
                    confirmButtonStyle: {
                        backgroundColor: tokens.colors.error[500],
                        borderColor: tokens.colors.error[500],
                        color: 'white'
                    },
                    defaultMessage: 'Are you sure you want to reject this proposal? The proposer will be notified of your decision.',
                    severity: 'error' as const
                };

            default:
                return {
                    title: 'Confirm Action',
                    icon: '❓',
                    iconBg: tokens.colors.neutral[100],
                    borderColor: tokens.colors.neutral[500],
                    confirmButtonStyle: {
                        backgroundColor: tokens.colors.primary[500],
                        borderColor: tokens.colors.primary[500],
                        color: 'white'
                    },
                    defaultMessage: 'Are you sure you want to perform this action?',
                    severity: 'info' as const
                };
        }
    };

    const config = getActionConfig();
    const message = customMessage || config.defaultMessage;
    const defaultConfirmText = actionType === 'accept' ? 'Yes, Accept' : 'Yes, Reject';
    const confirmText = confirmButtonText || defaultConfirmText;

    // Styles
    const overlayStyles = {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: tokens.spacing[4],
    };

    const dialogStyles = {
        backgroundColor: 'white',
        borderRadius: tokens.borderRadius.lg,
        boxShadow: tokens.shadows.xl,
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto' as const,
        borderTop: `4px solid ${config.borderColor}`,
    };

    const headerStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
        padding: `${tokens.spacing[6]} ${tokens.spacing[6]} ${tokens.spacing[4]} ${tokens.spacing[6]}`,
        borderBottom: `1px solid ${tokens.colors.neutral[100]}`,
    };

    const iconStyles = {
        fontSize: '24px',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        backgroundColor: config.iconBg,
    };

    const titleStyles = {
        margin: 0,
        fontSize: tokens.typography.fontSize.lg,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: tokens.colors.neutral[900],
    };

    const contentStyles = {
        padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
    };

    const messageStyles = {
        margin: `0 0 ${tokens.spacing[4]} 0`,
        fontSize: tokens.typography.fontSize.base,
        lineHeight: tokens.typography.lineHeight.relaxed,
        color: tokens.colors.neutral[700],
    };

    const actionsStyles = {
        display: 'flex',
        gap: tokens.spacing[3],
        justifyContent: 'flex-end',
        padding: `${tokens.spacing[4]} ${tokens.spacing[6]} ${tokens.spacing[6]} ${tokens.spacing[6]}`,
        borderTop: `1px solid ${tokens.colors.neutral[100]}`,
    };

    return (
        <div style={overlayStyles} onClick={handleCancel}>
            <div
                ref={dialogRef}
                style={dialogStyles}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                aria-describedby="dialog-description"
            >
                {/* Header */}
                <div style={headerStyles}>
                    <div style={iconStyles}>
                        {config.icon}
                    </div>
                    <h3 id="dialog-title" style={titleStyles}>
                        {config.title}
                    </h3>
                </div>

                {/* Content */}
                <div style={contentStyles}>
                    <p id="dialog-description" style={messageStyles}>
                        {message}
                    </p>

                    {/* Proposal Details */}
                    {showProposalDetails && proposalDetails && (
                        <div style={{
                            backgroundColor: tokens.colors.neutral[50],
                            borderRadius: tokens.borderRadius.md,
                            padding: tokens.spacing[3],
                            marginBottom: tokens.spacing[4],
                        }}>
                            <h4 style={{
                                margin: `0 0 ${tokens.spacing[2]} 0`,
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[800],
                            }}>
                                Proposal Details
                            </h4>
                            <div style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                                lineHeight: tokens.typography.lineHeight.relaxed,
                            }}>
                                {proposalDetails.targetTitle && (
                                    <div><strong>Target:</strong> {proposalDetails.targetTitle}</div>
                                )}
                                {proposalDetails.proposerName && (
                                    <div><strong>From:</strong> {proposalDetails.proposerName}</div>
                                )}
                                {proposalDetails.proposalType && (
                                    <div><strong>Type:</strong> {proposalDetails.proposalType}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Rejection Reason Field */}
                    {showReasonField && actionType === 'reject' && (
                        <div style={{ marginBottom: tokens.spacing[4] }}>
                            <label style={{
                                display: 'block',
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                                marginBottom: tokens.spacing[2],
                            }}>
                                Reason for rejection (optional)
                            </label>
                            <textarea
                                ref={reasonTextareaRef}
                                placeholder="Let them know why you're rejecting this proposal..."
                                value={rejectionReason}
                                onChange={(e) => handleReasonChange(e.target.value)}
                                maxLength={MAX_REASON_LENGTH}
                                rows={4}
                                aria-describedby={[
                                    reasonError ? 'reason-error' : null,
                                    reasonWarning ? 'reason-warning' : null,
                                    'reason-help',
                                    'reason-suggestions'
                                ].filter(Boolean).join(' ')}
                                aria-invalid={!!reasonError}
                                aria-label="Reason for rejecting this proposal (optional)"
                                aria-required="false"
                                spellCheck={true}
                                autoComplete="off"
                                autoCorrect="on"
                                autoCapitalize="sentences"
                                style={{
                                    width: '100%',
                                    padding: tokens.spacing[3],
                                    fontSize: tokens.typography.fontSize.sm,
                                    lineHeight: tokens.typography.lineHeight.relaxed,
                                    border: `2px solid ${reasonError ? tokens.colors.error[300] : reasonWarning ? tokens.colors.warning[300] : tokens.colors.neutral[300]}`,
                                    borderRadius: tokens.borderRadius.md,
                                    backgroundColor: 'white',
                                    color: tokens.colors.neutral[900],
                                    outline: 'none',
                                    transition: 'all 0.2s ease-in-out',
                                    resize: 'vertical' as const,
                                    fontFamily: 'inherit',
                                    minHeight: '100px',
                                }}
                                onFocus={(e) => {
                                    if (!reasonError) {
                                        e.target.style.borderColor = tokens.colors.primary[500];
                                        e.target.style.boxShadow = `0 0 0 3px ${tokens.colors.primary[200]}`;
                                    }
                                }}
                                onBlur={(e) => {
                                    if (!reasonError) {
                                        e.target.style.borderColor = reasonWarning ? tokens.colors.warning[300] : tokens.colors.neutral[300];
                                        e.target.style.boxShadow = 'none';
                                    }
                                }}
                                onKeyDown={(e) => {
                                    // Enhanced keyboard support
                                    if (e.ctrlKey || e.metaKey) {
                                        // Allow common editing shortcuts
                                        if (['a', 'c', 'v', 'x', 'z', 'y'].includes(e.key.toLowerCase())) {
                                            return;
                                        }
                                    }

                                    // Allow arrow keys, backspace, delete, etc.
                                    if ([
                                        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                                        'Backspace', 'Delete', 'Home', 'End',
                                        'PageUp', 'PageDown'
                                    ].includes(e.key)) {
                                        return;
                                    }
                                }}
                            />

                            {/* Helpful suggestions for rejection reasons */}
                            {rejectionReason.trim().length === 0 && (
                                <div
                                    id="reason-suggestions"
                                    style={{
                                        marginTop: tokens.spacing[2],
                                        padding: tokens.spacing[3],
                                        backgroundColor: tokens.colors.blue[50],
                                        borderRadius: tokens.borderRadius.md,
                                        border: `1px solid ${tokens.colors.blue[200]}`,
                                    }}
                                    role="region"
                                    aria-labelledby="suggestions-title"
                                >
                                    <p
                                        id="suggestions-title"
                                        style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.blue[700],
                                            margin: `0 0 ${tokens.spacing[2]} 0`,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                        }}
                                    >
                                        💡 Helpful rejection reasons:
                                    </p>
                                    <ul style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.blue[600],
                                        margin: 0,
                                        paddingLeft: tokens.spacing[4],
                                        lineHeight: tokens.typography.lineHeight.relaxed,
                                    }}>
                                        <li>Dates don't work for me</li>
                                        <li>Looking for a different location</li>
                                        <li>Already have other plans</li>
                                        <li>Not the right fit for my needs</li>
                                        <li>Prefer a different type of accommodation</li>
                                        <li>Timeline doesn't match my availability</li>
                                    </ul>
                                    <p style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.blue[600],
                                        margin: `${tokens.spacing[2]} 0 0 0`,
                                        fontStyle: 'italic',
                                    }}>
                                        Providing a reason helps proposers improve future offers.
                                    </p>
                                </div>
                            )}

                            {/* Validation messages and character count */}
                            <div style={{
                                marginTop: tokens.spacing[2],
                            }}>
                                {/* Error message */}
                                {reasonError && (
                                    <p id="reason-error" style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.error[600],
                                        margin: `0 0 ${tokens.spacing[1]} 0`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: tokens.spacing[1],
                                    }}>
                                        <span role="img" aria-label="Error">❌</span>
                                        {reasonError}
                                    </p>
                                )}

                                {/* Warning message */}
                                {!reasonError && reasonWarning && (
                                    <p id="reason-warning" style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.warning[600],
                                        margin: `0 0 ${tokens.spacing[1]} 0`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: tokens.spacing[1],
                                    }}>
                                        <span role="img" aria-label="Warning">⚠️</span>
                                        {reasonWarning}
                                    </p>
                                )}

                                {/* Character count */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <div />
                                    <p id="reason-help" style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: rejectionReason.length >= WARNING_LENGTH
                                            ? tokens.colors.warning[600]
                                            : tokens.colors.neutral[500],
                                        margin: 0,
                                        fontWeight: rejectionReason.length >= WARNING_LENGTH
                                            ? tokens.typography.fontWeight.medium
                                            : tokens.typography.fontWeight.normal,
                                    }}>
                                        {rejectionReason.length}/{MAX_REASON_LENGTH} characters
                                        {rejectionReason.length >= WARNING_LENGTH && (
                                            <span style={{ marginLeft: tokens.spacing[1] }}>
                                                ⚠️
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Keyboard shortcuts help */}
                    {showKeyboardShortcuts && (
                        <div style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.neutral[500],
                            padding: tokens.spacing[3],
                            backgroundColor: tokens.colors.neutral[50],
                            borderRadius: tokens.borderRadius.md,
                            marginTop: tokens.spacing[2],
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                        }}>
                            <p style={{
                                margin: `0 0 ${tokens.spacing[1]} 0`,
                                fontWeight: tokens.typography.fontWeight.medium,
                            }}>
                                ⌨️ Keyboard shortcuts:
                            </p>
                            <ul style={{
                                margin: 0,
                                paddingLeft: tokens.spacing[4],
                                lineHeight: tokens.typography.lineHeight.relaxed,
                            }}>
                                <li><kbd style={{
                                    padding: '2px 4px',
                                    backgroundColor: tokens.colors.neutral[200],
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                }}>Esc</kbd> to cancel</li>
                                <li><kbd style={{
                                    padding: '2px 4px',
                                    backgroundColor: tokens.colors.neutral[200],
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                }}>Enter</kbd> to confirm</li>
                                {showReasonField && (
                                    <>
                                        <li><kbd style={{
                                            padding: '2px 4px',
                                            backgroundColor: tokens.colors.neutral[200],
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                        }}>Ctrl+Enter</kbd> to confirm from text field</li>
                                        <li><kbd style={{
                                            padding: '2px 4px',
                                            backgroundColor: tokens.colors.neutral[200],
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                        }}>Tab</kbd> to navigate between fields</li>
                                    </>
                                )}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={actionsStyles}>
                    <Button
                        ref={cancelButtonRef}
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={loading || isConfirming}
                        style={{
                            color: tokens.colors.neutral[600]
                        }}
                    >
                        {cancelButtonText}
                    </Button>
                    <Button
                        ref={confirmButtonRef}
                        variant="primary"
                        onClick={handleConfirm}
                        disabled={loading || isConfirming || !!reasonError}
                        loading={loading || isConfirming}
                        style={config.confirmButtonStyle}
                    >
                        {loading || isConfirming ? 'Processing...' : confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ProposalConfirmationDialog;