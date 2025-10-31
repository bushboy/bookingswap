import { Notification, NotificationType } from '@booking-swap/shared';
import { logger } from '@/utils/logger';

/**
 * Service for creating and managing proposal-related notifications
 * Implements requirements 6.4, 6.5
 */
export class ProposalNotificationService {
    /**
     * Create success notification for proposal acceptance
     * Requirement: 6.4
     */
    static createAcceptanceSuccessNotification(
        proposalId: string,
        proposerName?: string,
        paymentAmount?: number,
        currency?: string
    ): Omit<Notification, 'userId'> {
        const hasPayment = paymentAmount && currency;

        return {
            id: `proposal-accepted-${proposalId}-${Date.now()}`,
            type: 'proposal_accepted' as NotificationType,
            title: 'Proposal Accepted Successfully',
            message: hasPayment
                ? `You have successfully accepted the proposal from ${proposerName || 'another user'}. Payment of ${paymentAmount} ${currency} has been processed.`
                : `You have successfully accepted the proposal from ${proposerName || 'another user'}.`,
            data: {
                proposalId,
                proposerName,
                paymentAmount,
                currency,
                action: 'accept'
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create success notification for proposal rejection
     * Requirement: 6.4
     */
    static createRejectionSuccessNotification(
        proposalId: string,
        proposerName?: string,
        reason?: string
    ): Omit<Notification, 'userId'> {
        return {
            id: `proposal-rejected-${proposalId}-${Date.now()}`,
            type: 'proposal_rejected' as NotificationType,
            title: 'Proposal Rejected',
            message: reason
                ? `You have rejected the proposal from ${proposerName || 'another user'}. Reason: ${reason}`
                : `You have rejected the proposal from ${proposerName || 'another user'}.`,
            data: {
                proposalId,
                proposerName,
                reason,
                action: 'reject'
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create notification for payment completion
     * Requirement: 6.4
     */
    static createPaymentCompletedNotification(
        proposalId: string,
        transactionId: string,
        amount: number,
        currency: string,
        proposerName?: string
    ): Omit<Notification, 'userId'> {
        return {
            id: `payment-completed-${proposalId}-${Date.now()}`,
            type: 'proposal_payment_completed' as NotificationType,
            title: 'Payment Completed',
            message: `Payment of ${amount} ${currency} has been successfully processed for your accepted proposal from ${proposerName || 'another user'}.`,
            data: {
                proposalId,
                transactionId,
                amount,
                currency,
                proposerName,
                action: 'payment_completed'
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create notification for payment failure
     * Requirement: 6.5
     */
    static createPaymentFailedNotification(
        proposalId: string,
        amount: number,
        currency: string,
        errorMessage: string,
        proposerName?: string
    ): Omit<Notification, 'userId'> {
        return {
            id: `payment-failed-${proposalId}-${Date.now()}`,
            type: 'proposal_payment_failed' as NotificationType,
            title: 'Payment Failed',
            message: `Payment of ${amount} ${currency} failed for your proposal from ${proposerName || 'another user'}. ${errorMessage}`,
            data: {
                proposalId,
                amount,
                currency,
                errorMessage,
                proposerName,
                action: 'payment_failed',
                canRetry: true
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create error notification for proposal operations
     * Requirement: 6.5
     */
    static createOperationErrorNotification(
        proposalId: string,
        operation: 'accept' | 'reject',
        errorMessage: string,
        canRetry: boolean = false,
        proposerName?: string
    ): Omit<Notification, 'userId'> {
        const operationText = operation === 'accept' ? 'accepting' : 'rejecting';

        return {
            id: `proposal-error-${proposalId}-${Date.now()}`,
            type: 'swap_proposal' as NotificationType, // Using existing type for errors
            title: `Error ${operationText.charAt(0).toUpperCase() + operationText.slice(1)} Proposal`,
            message: `Failed to ${operation} proposal from ${proposerName || 'another user'}. ${errorMessage}`,
            data: {
                proposalId,
                operation,
                errorMessage,
                proposerName,
                canRetry,
                action: 'error'
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create notification for successful retry
     * Requirement: 6.4
     */
    static createRetrySuccessNotification(
        proposalId: string,
        operation: 'accept' | 'reject',
        proposerName?: string
    ): Omit<Notification, 'userId'> {
        const operationText = operation === 'accept' ? 'accepted' : 'rejected';

        return {
            id: `proposal-retry-success-${proposalId}-${Date.now()}`,
            type: 'payment_processing' as NotificationType, // Using existing type for retry success
            title: `Proposal ${operationText.charAt(0).toUpperCase() + operationText.slice(1)} Successfully`,
            message: `Your proposal from ${proposerName || 'another user'} has been ${operationText} successfully after retry.`,
            data: {
                proposalId,
                operation,
                proposerName,
                action: 'retry_success'
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create blockchain transaction notification
     */
    static createBlockchainTransactionNotification(
        proposalId: string,
        transactionId: string,
        operation: 'accept' | 'reject',
        consensusTimestamp?: string
    ): Omit<Notification, 'userId'> {
        return {
            id: `blockchain-tx-${proposalId}-${Date.now()}`,
            type: 'proposal_accepted' as NotificationType, // Use existing type for consistency
            title: 'Blockchain Transaction Recorded',
            message: `Your proposal ${operation} has been recorded on the blockchain.`,
            data: {
                proposalId,
                transactionId,
                consensusTimestamp,
                operation,
                action: 'blockchain_recorded'
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create authentication error notification
     * Requirement: 6.2
     */
    static createAuthenticationErrorNotification(): Omit<Notification, 'userId'> {
        return {
            id: `auth-error-${Date.now()}`,
            type: 'swap_proposal' as NotificationType,
            title: 'Authentication Required',
            message: 'Your session has expired. Please log in again to continue.',
            data: {
                action: 'auth_required',
                redirectToLogin: true
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create network error notification
     */
    static createNetworkErrorNotification(
        proposalId: string,
        operation: 'accept' | 'reject',
        canRetry: boolean = true
    ): Omit<Notification, 'userId'> {
        return {
            id: `network-error-${proposalId}-${Date.now()}`,
            type: 'swap_proposal' as NotificationType,
            title: 'Network Error',
            message: `Network error occurred while ${operation}ing proposal. ${canRetry ? 'Please try again.' : 'Please check your connection.'}`,
            data: {
                proposalId,
                operation,
                errorType: 'network',
                canRetry,
                action: 'network_error'
            },
            channel: 'in_app',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Log notification creation for debugging
     */
    static logNotificationCreated(notification: Notification | Omit<Notification, 'userId'>): void {
        logger.info('Proposal notification created', {
            notificationId: notification.id,
            type: notification.type,
            title: notification.title,
            proposalId: notification.data?.proposalId,
            operation: notification.data?.operation
        });
    }

    /**
     * Get notification icon for different types
     */
    static getNotificationIcon(type: NotificationType): string {
        const iconMap: Record<string, string> = {
            proposal_accepted: '✅',
            proposal_rejected: '❌',
            proposal_payment_completed: '💰',
            proposal_payment_failed: '⚠️',
            swap_proposal: '🚨',
            payment_processing: '🔄'
        };

        return iconMap[type] || '📋';
    }

    /**
     * Get notification color for different types
     */
    static getNotificationColor(type: NotificationType): string {
        const colorMap: Record<string, string> = {
            proposal_accepted: '#10B981', // green
            proposal_rejected: '#EF4444', // red
            proposal_payment_completed: '#10B981', // green
            proposal_payment_failed: '#EF4444', // red
            swap_proposal: '#EF4444', // red
            payment_processing: '#3B82F6' // blue
        };

        return colorMap[type] || '#6B7280'; // gray
    }

    /**
     * Format notification for display
     */
    static formatNotificationForDisplay(notification: Notification): {
        icon: string;
        color: string;
        displayMessage: string;
        actionButtons: Array<{ label: string; action: string; variant: 'primary' | 'secondary' }>;
    } {
        const icon = this.getNotificationIcon(notification.type);
        const color = this.getNotificationColor(notification.type);

        let actionButtons: Array<{ label: string; action: string; variant: 'primary' | 'secondary' }> = [];

        switch (notification.type) {
            case 'proposal_accepted':
                actionButtons = [
                    { label: 'View Details', action: 'view', variant: 'primary' }
                ];
                break;

            case 'proposal_rejected':
                actionButtons = [
                    { label: 'View Proposals', action: 'view', variant: 'secondary' }
                ];
                break;

            case 'proposal_payment_completed':
                actionButtons = [
                    { label: 'View Transaction', action: 'view_transaction', variant: 'primary' }
                ];
                break;

            case 'proposal_payment_failed':
                if (notification.data?.canRetry) {
                    actionButtons = [
                        { label: 'Retry Payment', action: 'retry_payment', variant: 'primary' },
                        { label: 'View Details', action: 'view', variant: 'secondary' }
                    ];
                } else {
                    actionButtons = [
                        { label: 'Contact Support', action: 'contact_support', variant: 'primary' }
                    ];
                }
                break;

            case 'swap_proposal':
                if (notification.data?.canRetry) {
                    actionButtons = [
                        { label: 'Try Again', action: 'retry', variant: 'primary' },
                        { label: 'Dismiss', action: 'dismiss', variant: 'secondary' }
                    ];
                } else if (notification.data?.redirectToLogin) {
                    actionButtons = [
                        { label: 'Log In', action: 'login', variant: 'primary' }
                    ];
                } else {
                    actionButtons = [
                        { label: 'Dismiss', action: 'dismiss', variant: 'secondary' }
                    ];
                }
                break;

            default:
                actionButtons = [
                    { label: 'Dismiss', action: 'dismiss', variant: 'secondary' }
                ];
        }

        return {
            icon,
            color,
            displayMessage: notification.message,
            actionButtons
        };
    }
}