import {
    SwapCompletionNotificationData,
    BookingOwnershipTransferNotificationData,
    CompletionValidationWarningData
} from '@booking-swap/shared';
import { logger } from '@/utils/logger';

/**
 * CompletionNotificationService handles completion-specific notifications
 * Provides methods for creating and managing swap completion notifications
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export class CompletionNotificationService {
    /**
     * Create success notification for swap completion
     * Requirements: 8.1, 8.2
     */
    static createCompletionSuccessNotification(
        data: SwapCompletionNotificationData,
        userRole: 'proposer' | 'accepter'
    ) {
        const isBookingExchange = data.completionType === 'booking_exchange';
        const isCashPayment = data.completionType === 'cash_payment';

        let title: string;
        let message: string;

        if (userRole === 'proposer') {
            title = isBookingExchange ? 'Booking Exchange Accepted!' : 'Cash Offer Accepted!';
            message = isBookingExchange
                ? `Your booking exchange proposal has been accepted and completed. ${data.completedSwaps.length} swap(s) and ${data.updatedBookings.length} booking(s) have been updated.`
                : `Your cash offer of ${data.cashOffer?.amount} ${data.cashOffer?.currency} has been accepted and processed.`;
        } else {
            title = isBookingExchange ? 'Booking Exchange Completed!' : 'Cash Payment Received!';
            message = isBookingExchange
                ? `You have successfully completed a booking exchange. ${data.completedSwaps.length} swap(s) and ${data.updatedBookings.length} booking(s) have been updated.`
                : `You have successfully received a cash payment of ${data.cashOffer?.amount} ${data.cashOffer?.currency}.`;
        }

        return {
            id: `completion_${data.proposalId}_${Date.now()}`,
            type: 'swap_completion_success' as const,
            title,
            message,
            timestamp: data.completionTimestamp,
            priority: 'high' as const,
            category: 'completion' as const,
            data: {
                ...data,
                userRole,
                isBookingExchange,
                isCashPayment,
                hasOwnershipTransfers: data.updatedBookings.some(b => b.newOwnerId),
                hasBlockchainRecord: !!data.blockchainTransaction?.transactionId
            },
            actions: [
                {
                    label: 'View Details',
                    action: 'navigate',
                    url: `/dashboard/proposals/${data.proposalId}`
                },
                {
                    label: 'View Bookings',
                    action: 'navigate',
                    url: '/dashboard/bookings'
                }
            ]
        };
    }

    /**
     * Create ownership transfer notification
     * Requirements: 8.3, 8.4
     */
    static createOwnershipTransferNotification(
        data: BookingOwnershipTransferNotificationData,
        userRole: 'new_owner' | 'previous_owner'
    ) {
        let title: string;
        let message: string;

        if (userRole === 'new_owner') {
            title = 'Booking Ownership Transferred to You';
            message = `You are now the owner of "${data.bookingDetails.title}" in ${data.bookingDetails.location} (${data.bookingDetails.dates}) through a booking exchange with ${data.exchangePartnerDetails.name}.`;
        } else {
            title = 'Booking Ownership Transferred';
            message = `Ownership of "${data.bookingDetails.title}" has been transferred to ${data.exchangePartnerDetails.name} as part of your booking exchange for "${data.exchangePartnerDetails.bookingTitle}".`;
        }

        return {
            id: `ownership_${data.bookingId}_${Date.now()}`,
            type: 'booking_ownership_transferred' as const,
            title,
            message,
            timestamp: data.transferredAt,
            priority: 'high' as const,
            category: 'ownership' as const,
            data: {
                ...data,
                userRole
            },
            actions: [
                {
                    label: 'View Booking',
                    action: 'navigate',
                    url: `/dashboard/bookings/${data.bookingId}`
                },
                {
                    label: 'View Exchange Details',
                    action: 'navigate',
                    url: `/dashboard/proposals/${data.proposalId}`
                }
            ]
        };
    }

    /**
     * Create validation warning notification
     * Requirements: 8.1, 8.5
     */
    static createValidationWarningNotification(data: CompletionValidationWarningData) {
        const title = data.requiresManualReview
            ? 'Completion Validation Issues Detected'
            : 'Minor Completion Validation Warnings';

        const message = data.requiresManualReview
            ? `Your swap completion has validation issues that require manual review. ${data.validationErrors.length} error(s) and ${data.validationWarnings.length} warning(s) detected.`
            : `Your swap completion has minor validation warnings but was completed successfully. ${data.validationWarnings.length} warning(s) detected.`;

        return {
            id: `validation_${data.proposalId}_${Date.now()}`,
            type: 'completion_validation_warning' as const,
            title,
            message,
            timestamp: new Date(),
            priority: data.requiresManualReview ? 'high' as const : 'medium' as const,
            category: 'validation' as const,
            data,
            actions: [
                {
                    label: 'View Details',
                    action: 'navigate',
                    url: `/dashboard/proposals/${data.proposalId}`
                },
                ...(data.requiresManualReview ? [{
                    label: 'Contact Support',
                    action: 'navigate',
                    url: '/support'
                }] : [])
            ]
        };
    }

    /**
     * Create completion failure notification
     * Requirements: 8.1, 8.5
     */
    static createCompletionFailureNotification(data: {
        proposalId: string;
        errorMessage: string;
        errorCode?: string;
        rollbackSuccessful: boolean;
        requiresManualIntervention: boolean;
    }) {
        const title = 'Swap Completion Failed';
        const message = data.rollbackSuccessful
            ? `Your swap completion failed but all changes have been rolled back successfully. Error: ${data.errorMessage}`
            : `Your swap completion failed and rollback was unsuccessful. Manual intervention may be required. Error: ${data.errorMessage}`;

        return {
            id: `failure_${data.proposalId}_${Date.now()}`,
            type: 'swap_completion_failed' as const,
            title,
            message,
            timestamp: new Date(),
            priority: 'high' as const,
            category: 'error' as const,
            data,
            actions: [
                {
                    label: 'View Details',
                    action: 'navigate',
                    url: `/dashboard/proposals/${data.proposalId}`
                },
                {
                    label: 'Retry',
                    action: 'retry_completion',
                    proposalId: data.proposalId
                },
                ...(data.requiresManualIntervention ? [{
                    label: 'Contact Support',
                    action: 'navigate',
                    url: '/support'
                }] : [])
            ]
        };
    }

    /**
     * Format completion summary for display
     * Requirements: 8.2, 8.3
     */
    static formatCompletionSummary(data: SwapCompletionNotificationData): string {
        const parts: string[] = [];

        if (data.completionType === 'booking_exchange') {
            parts.push(`Booking exchange completed between "${data.sourceSwapDetails.title}" and "${data.targetSwapDetails?.title}"`);
        } else {
            parts.push(`Cash payment of ${data.cashOffer?.amount} ${data.cashOffer?.currency} completed for "${data.sourceSwapDetails.title}"`);
        }

        parts.push(`${data.completedSwaps.length} swap(s) completed`);
        parts.push(`${data.updatedBookings.length} booking(s) updated`);

        const ownershipTransfers = data.updatedBookings.filter(b => b.newOwnerId).length;
        if (ownershipTransfers > 0) {
            parts.push(`${ownershipTransfers} ownership transfer(s)`);
        }

        if (data.blockchainTransaction?.transactionId) {
            parts.push('Blockchain record created');
        }

        return parts.join(' • ');
    }

    /**
     * Get completion notification icon based on type and status
     */
    static getCompletionIcon(type: string, status?: string): string {
        const icons: Record<string, string> = {
            swap_completion_success: '🎉',
            swap_completion_failed: '❌',
            booking_ownership_transferred: '🔄',
            completion_validation_warning: '⚠️'
        };

        return icons[type] || '📢';
    }

    /**
     * Get completion notification color based on type and priority
     */
    static getCompletionColor(type: string, priority?: string): string {
        if (priority === 'high') {
            return type.includes('success') || type.includes('transferred') ? 'green' : 'red';
        }

        const colors: Record<string, string> = {
            swap_completion_success: 'green',
            swap_completion_failed: 'red',
            booking_ownership_transferred: 'blue',
            completion_validation_warning: 'orange'
        };

        return colors[type] || 'gray';
    }

    /**
     * Log notification creation for debugging
     */
    static logNotificationCreated(notification: any): void {
        logger.info('Completion notification created', {
            id: notification.id,
            type: notification.type,
            category: notification.category,
            priority: notification.priority,
            proposalId: notification.data?.proposalId,
            completionType: notification.data?.completionType
        });
    }

    /**
     * Validate completion notification data
     */
    static validateNotificationData(data: any): boolean {
        try {
            if (!data.proposalId) {
                logger.error('Completion notification missing proposalId');
                return false;
            }

            if (data.completionType && !['booking_exchange', 'cash_payment'].includes(data.completionType)) {
                logger.error('Invalid completion type', { completionType: data.completionType });
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Completion notification validation failed', { error });
            return false;
        }
    }
}

export default CompletionNotificationService;