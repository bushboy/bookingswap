import { store } from '../store';
import { addNotification } from '../store/slices/notificationSlice';
import { Notification } from '@booking-swap/shared';

export interface ProposalToastOptions {
    /** Duration in milliseconds (default: 5000) */
    duration?: number;
    /** Whether the toast should auto-close (default: true) */
    autoClose?: boolean;
    /** Whether to persist the notification in history (default: true) */
    persist?: boolean;
    /** Additional data to include with the notification */
    data?: Record<string, any>;
}

export interface ProposalActionResult {
    success: boolean;
    proposalId: string;
    swapId?: string;
    paymentTransactionId?: string;
    errorMessage?: string;
    errorCode?: string;
}

export class ProposalToastService {
    private static instance: ProposalToastService;

    private constructor() { }

    static getInstance(): ProposalToastService {
        if (!ProposalToastService.instance) {
            ProposalToastService.instance = new ProposalToastService();
        }
        return ProposalToastService.instance;
    }

    /**
     * Show success toast for proposal acceptance
     * Requirements: 7.1, 7.2
     */
    showAcceptanceSuccess(
        proposalId: string,
        proposalType: 'booking' | 'cash',
        targetTitle: string,
        options: ProposalToastOptions = {}
    ): void {
        const notification: Notification = {
            id: `proposal-accept-${proposalId}-${Date.now()}`,
            userId: '', // Will be set by the notification system
            type: 'proposal_accepted',
            title: 'Proposal Accepted Successfully!',
            message: `Your ${proposalType} proposal for "${targetTitle}" has been accepted and is being processed.`,
            data: {
                proposalId,
                proposalType,
                targetTitle,
                action: 'accepted',
                ...options.data,
            },
            status: 'unread',
            channel: 'in_app',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.dispatchNotification(notification, options);
    }

    /**
     * Show success toast for proposal rejection
     * Requirements: 7.1, 7.2
     */
    showRejectionSuccess(
        proposalId: string,
        proposalType: 'booking' | 'cash',
        targetTitle: string,
        reason?: string,
        options: ProposalToastOptions = {}
    ): void {
        const notification: Notification = {
            id: `proposal-reject-${proposalId}-${Date.now()}`,
            userId: '',
            type: 'proposal_rejected',
            title: 'Proposal Rejected',
            message: `The ${proposalType} proposal for "${targetTitle}" has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
            data: {
                proposalId,
                proposalType,
                targetTitle,
                reason,
                action: 'rejected',
                ...options.data,
            },
            status: 'unread',
            channel: 'in_app',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.dispatchNotification(notification, options);
    }

    /**
     * Show processing toast for long-running operations
     * Requirements: 7.4, 6.1
     */
    showProcessingToast(
        proposalId: string,
        operation: 'accepting' | 'rejecting' | 'processing_payment',
        targetTitle: string,
        options: ProposalToastOptions = {}
    ): string {
        const operationLabels = {
            accepting: 'Accepting Proposal',
            rejecting: 'Rejecting Proposal',
            processing_payment: 'Processing Payment',
        };

        const operationMessages = {
            accepting: `Processing your acceptance of the proposal for "${targetTitle}". This may take a few moments...`,
            rejecting: `Processing your rejection of the proposal for "${targetTitle}".`,
            processing_payment: `Processing payment for the proposal "${targetTitle}". Please wait...`,
        };

        const notificationId = `proposal-${operation}-${proposalId}-${Date.now()}`;

        const notification: Notification = {
            id: notificationId,
            userId: '',
            type: 'payment_processing',
            title: operationLabels[operation],
            message: operationMessages[operation],
            data: {
                proposalId,
                operation,
                targetTitle,
                isProcessing: true,
                ...options.data,
            },
            status: 'unread',
            channel: 'in_app',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.dispatchNotification(notification, { ...options, autoClose: false });
        return notificationId;
    }

    /**
     * Update processing toast with completion status
     */
    updateProcessingToast(
        notificationId: string,
        result: ProposalActionResult,
        targetTitle: string
    ): void {
        if (result.success) {
            // Remove processing toast and show success
            this.removeNotification(notificationId);

            if (result.paymentTransactionId) {
                this.showPaymentSuccess(result.proposalId, result.paymentTransactionId, targetTitle);
            }
        } else {
            // Update processing toast to show error
            this.showError(
                result.proposalId,
                result.errorMessage || 'An unexpected error occurred',
                targetTitle,
                result.errorCode
            );
            this.removeNotification(notificationId);
        }
    }

    /**
     * Show error toast for failed operations
     * Requirements: 6.1, 6.4
     */
    showError(
        proposalId: string,
        errorMessage: string,
        targetTitle: string,
        errorCode?: string,
        options: ProposalToastOptions = {}
    ): void {
        const actionableMessages = this.getActionableErrorMessage(errorCode, errorMessage);

        const notification: Notification = {
            id: `proposal-error-${proposalId}-${Date.now()}`,
            userId: '',
            type: 'proposal_payment_failed',
            title: 'Action Failed',
            message: actionableMessages.message,
            data: {
                proposalId,
                targetTitle,
                errorMessage,
                errorCode,
                actionableGuidance: actionableMessages.guidance,
                canRetry: actionableMessages.canRetry,
                ...options.data,
            },
            status: 'unread',
            channel: 'in_app',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.dispatchNotification(notification, { ...options, duration: 8000 });
    }

    /**
     * Show payment completion notification
     * Requirements: 7.3, 7.4
     */
    showPaymentSuccess(
        proposalId: string,
        transactionId: string,
        targetTitle: string,
        amount?: number,
        currency?: string,
        options: ProposalToastOptions = {}
    ): void {
        const amountText = amount && currency ? ` of ${currency} ${amount.toLocaleString()}` : '';

        const notification: Notification = {
            id: `payment-success-${proposalId}-${Date.now()}`,
            userId: '',
            type: 'proposal_payment_completed',
            title: 'Payment Completed!',
            message: `Payment${amountText} for "${targetTitle}" has been successfully processed.`,
            data: {
                proposalId,
                transactionId,
                targetTitle,
                amount,
                currency,
                ...options.data,
            },
            status: 'unread',
            channel: 'in_app',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.dispatchNotification(notification, options);
    }

    /**
     * Show payment failure notification
     * Requirements: 6.1, 6.4
     */
    showPaymentError(
        proposalId: string,
        errorMessage: string,
        targetTitle: string,
        errorCode?: string,
        options: ProposalToastOptions = {}
    ): void {
        const actionableMessages = this.getActionableErrorMessage(errorCode, errorMessage);

        const notification: Notification = {
            id: `payment-error-${proposalId}-${Date.now()}`,
            userId: '',
            type: 'proposal_payment_failed',
            title: 'Payment Failed',
            message: `Payment for "${targetTitle}" failed: ${actionableMessages.message}`,
            data: {
                proposalId,
                targetTitle,
                errorMessage,
                errorCode,
                actionableGuidance: actionableMessages.guidance,
                canRetry: actionableMessages.canRetry,
                ...options.data,
            },
            status: 'unread',
            channel: 'in_app',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.dispatchNotification(notification, { ...options, duration: 10000 });
    }

    /**
     * Show validation error for proposal actions
     */
    showValidationError(
        proposalId: string,
        validationErrors: string[],
        targetTitle: string,
        options: ProposalToastOptions = {}
    ): void {
        const errorMessage = validationErrors.length === 1
            ? validationErrors[0]
            : `Multiple validation errors: ${validationErrors.join(', ')}`;

        const notification: Notification = {
            id: `validation-error-${proposalId}-${Date.now()}`,
            userId: '',
            type: 'proposal_payment_failed',
            title: 'Validation Error',
            message: `Cannot process proposal for "${targetTitle}": ${errorMessage}`,
            data: {
                proposalId,
                targetTitle,
                validationErrors,
                ...options.data,
            },
            status: 'unread',
            channel: 'in_app',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.dispatchNotification(notification, { ...options, duration: 6000 });
    }

    /**
     * Remove a specific notification
     */
    private removeNotification(notificationId: string): void {
        // This would typically dispatch an action to remove the notification
        // For now, we'll just log it since the notification slice doesn't have a remove action
        console.log(`Removing notification: ${notificationId}`);
    }

    /**
     * Dispatch notification to the store
     */
    private dispatchNotification(
        notification: Notification,
        options: ProposalToastOptions
    ): void {
        // Set default options
        const finalOptions = {
            duration: 5000,
            autoClose: true,
            persist: true,
            ...options,
        };

        // Add duration to notification data for toast container
        notification.data = {
            ...notification.data,
            toastDuration: finalOptions.duration,
            toastAutoClose: finalOptions.autoClose,
        };

        // Dispatch to store
        store.dispatch(addNotification(notification));
    }

    /**
     * Get actionable error messages with guidance
     * Requirements: 6.1, 6.4
     */
    private getActionableErrorMessage(
        errorCode?: string,
        originalMessage?: string
    ): {
        message: string;
        guidance: string;
        canRetry: boolean;
    } {
        const errorMap: Record<string, { message: string; guidance: string; canRetry: boolean }> = {
            PROPOSAL_NOT_FOUND: {
                message: 'Proposal not found or has been removed.',
                guidance: 'Please refresh the page and try again.',
                canRetry: false,
            },
            UNAUTHORIZED_USER: {
                message: 'You are not authorized to perform this action.',
                guidance: 'Please ensure you are logged in with the correct account.',
                canRetry: false,
            },
            INVALID_PROPOSAL_STATUS: {
                message: 'This proposal can no longer be modified.',
                guidance: 'The proposal may have already been accepted, rejected, or expired.',
                canRetry: false,
            },
            PAYMENT_PROCESSING_FAILED: {
                message: 'Payment processing failed.',
                guidance: 'Please check your payment method and try again.',
                canRetry: true,
            },
            BLOCKCHAIN_RECORDING_FAILED: {
                message: 'Blockchain recording failed.',
                guidance: 'The system will retry automatically. Please wait a moment.',
                canRetry: true,
            },
            DATABASE_TRANSACTION_FAILED: {
                message: 'Database operation failed.',
                guidance: 'Please try again in a few moments.',
                canRetry: true,
            },
            ESCROW_TRANSFER_FAILED: {
                message: 'Escrow fund transfer failed.',
                guidance: 'Please contact support if this issue persists.',
                canRetry: true,
            },
            NETWORK_ERROR: {
                message: 'Network connection error.',
                guidance: 'Please check your internet connection and try again.',
                canRetry: true,
            },
        };

        const errorInfo = errorMap[errorCode || ''] || {
            message: originalMessage || 'An unexpected error occurred.',
            guidance: 'Please try again or contact support if the issue persists.',
            canRetry: true,
        };

        return errorInfo;
    }
}

// Export singleton instance
export const proposalToastService = ProposalToastService.getInstance();