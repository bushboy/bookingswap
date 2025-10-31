import {
    NotificationType,
    NotificationChannel,
    ProposalResponseNotificationData,
    ProposalPaymentNotificationData
} from '@booking-swap/shared';
import { NotificationService } from './NotificationService';
import { NotificationTemplateService } from './NotificationTemplateService';
import { NotificationPreferencesService } from './NotificationPreferencesService';
import { UserRepository } from '../../database/repositories/UserRepository';
import { logger } from '../../utils/logger';

/**
 * Service for handling proposal response notifications (acceptance, rejection, payment)
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */
export class ProposalResponseNotificationService {
    private notificationService: NotificationService;
    private templateService: NotificationTemplateService;
    private preferencesService: NotificationPreferencesService;

    constructor(
        notificationService: NotificationService,
        userRepository: UserRepository
    ) {
        this.notificationService = notificationService;
        this.templateService = new NotificationTemplateService();
        this.preferencesService = new NotificationPreferencesService(userRepository);
    }

    /**
     * Send proposal acceptance notifications to both proposer and booking holder
     * Requirements: 7.1, 7.2
     */
    async sendProposalAcceptanceNotifications(
        proposalData: ProposalResponseNotificationData
    ): Promise<void> {
        try {
            // Send notification to proposer (person who made the proposal)
            await this.sendProposalResponseNotification(
                proposalData.proposerId,
                'proposal_accepted',
                proposalData,
                'proposer'
            );

            // Send notification to booking holder (person who accepted the proposal)
            await this.sendProposalResponseNotification(
                proposalData.targetUserId,
                'proposal_accepted',
                proposalData,
                'booking_holder'
            );

            logger.info('Sent proposal acceptance notifications', {
                proposalId: proposalData.proposalId,
                proposerId: proposalData.proposerId,
                targetUserId: proposalData.targetUserId
            });
        } catch (error) {
            logger.error('Failed to send proposal acceptance notifications', {
                error: error instanceof Error ? error.message : 'Unknown error',
                proposalId: proposalData.proposalId
            });
            throw error;
        }
    }

    /**
     * Send proposal rejection notifications to both proposer and booking holder
     * Requirements: 7.1, 7.2
     */
    async sendProposalRejectionNotifications(
        proposalData: ProposalResponseNotificationData
    ): Promise<void> {
        try {
            // Send notification to proposer (person who made the proposal)
            await this.sendProposalResponseNotification(
                proposalData.proposerId,
                'proposal_rejected',
                proposalData,
                'proposer'
            );

            // Send notification to booking holder (person who rejected the proposal)
            await this.sendProposalResponseNotification(
                proposalData.targetUserId,
                'proposal_rejected',
                proposalData,
                'booking_holder'
            );

            logger.info('Sent proposal rejection notifications', {
                proposalId: proposalData.proposalId,
                proposerId: proposalData.proposerId,
                targetUserId: proposalData.targetUserId,
                rejectionReason: proposalData.rejectionReason
            });
        } catch (error) {
            logger.error('Failed to send proposal rejection notifications', {
                error: error instanceof Error ? error.message : 'Unknown error',
                proposalId: proposalData.proposalId
            });
            throw error;
        }
    }

    /**
     * Send payment completion notifications to both payer and recipient
     * Requirements: 7.3
     */
    async sendPaymentCompletionNotifications(
        paymentData: ProposalPaymentNotificationData
    ): Promise<void> {
        try {
            // Send notification to payer (person who sent the payment)
            await this.sendPaymentNotification(
                paymentData.payerUserId,
                'proposal_payment_completed',
                paymentData,
                'payer'
            );

            // Send notification to recipient (person who received the payment)
            await this.sendPaymentNotification(
                paymentData.recipientUserId,
                'proposal_payment_completed',
                paymentData,
                'recipient'
            );

            logger.info('Sent payment completion notifications', {
                transactionId: paymentData.transactionId,
                payerUserId: paymentData.payerUserId,
                recipientUserId: paymentData.recipientUserId,
                amount: paymentData.amount,
                currency: paymentData.currency
            });
        } catch (error) {
            logger.error('Failed to send payment completion notifications', {
                error: error instanceof Error ? error.message : 'Unknown error',
                transactionId: paymentData.transactionId
            });
            throw error;
        }
    }

    /**
     * Send payment failure notifications
     * Requirements: 7.3
     */
    async sendPaymentFailureNotifications(
        paymentData: ProposalPaymentNotificationData
    ): Promise<void> {
        try {
            // Send urgent notification to payer (person who attempted the payment)
            await this.sendPaymentNotification(
                paymentData.payerUserId,
                'proposal_payment_failed',
                paymentData,
                'payer'
            );

            // Send notification to recipient (person who was supposed to receive payment)
            await this.sendPaymentNotification(
                paymentData.recipientUserId,
                'proposal_payment_failed',
                paymentData,
                'recipient'
            );

            logger.info('Sent payment failure notifications', {
                transactionId: paymentData.transactionId,
                payerUserId: paymentData.payerUserId,
                recipientUserId: paymentData.recipientUserId,
                errorMessage: paymentData.errorMessage
            });
        } catch (error) {
            logger.error('Failed to send payment failure notifications', {
                error: error instanceof Error ? error.message : 'Unknown error',
                transactionId: paymentData.transactionId
            });
            throw error;
        }
    }

    /**
     * Send proposal response notification to a specific user
     * Requirements: 7.1, 7.2, 7.5
     */
    private async sendProposalResponseNotification(
        userId: string,
        notificationType: 'proposal_accepted' | 'proposal_rejected',
        proposalData: ProposalResponseNotificationData,
        userRole: 'proposer' | 'booking_holder'
    ): Promise<void> {
        try {
            // Check if user should receive this notification
            const shouldSend = await this.preferencesService.shouldSendNotification(
                userId,
                notificationType
            );

            if (!shouldSend) {
                logger.debug('User has disabled this notification type', {
                    userId,
                    notificationType
                });
                return;
            }

            // Get user's preferred channels for this notification type
            const channels = await this.preferencesService.getProposalResponseNotificationChannels(
                userId,
                notificationType,
                userRole
            );

            if (channels.length === 0) {
                logger.debug('User has disabled notifications for their role', {
                    userId,
                    notificationType,
                    userRole
                });
                return;
            }

            // Send notification on each preferred channel
            for (const channel of channels) {
                await this.sendNotificationOnChannel(
                    userId,
                    notificationType,
                    proposalData,
                    channel,
                    userRole
                );
            }
        } catch (error) {
            logger.error('Failed to send proposal response notification', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                notificationType,
                userRole
            });
            throw error;
        }
    }

    /**
     * Send payment notification to a specific user
     * Requirements: 7.3, 7.5
     */
    private async sendPaymentNotification(
        userId: string,
        notificationType: 'proposal_payment_completed' | 'proposal_payment_failed',
        paymentData: ProposalPaymentNotificationData,
        userRole: 'payer' | 'recipient'
    ): Promise<void> {
        try {
            // Check if user should receive this notification
            const shouldSend = await this.preferencesService.shouldSendNotification(
                userId,
                notificationType
            );

            if (!shouldSend) {
                logger.debug('User has disabled this notification type', {
                    userId,
                    notificationType
                });
                return;
            }

            // Get user's preferred channels for this notification type
            const channels = await this.preferencesService.getProposalResponseNotificationChannels(
                userId,
                notificationType,
                userRole
            );

            if (channels.length === 0) {
                logger.debug('User has disabled notifications for their role', {
                    userId,
                    notificationType,
                    userRole
                });
                return;
            }

            // Send notification on each preferred channel
            for (const channel of channels) {
                await this.sendPaymentNotificationOnChannel(
                    userId,
                    notificationType,
                    paymentData,
                    channel,
                    userRole
                );
            }
        } catch (error) {
            logger.error('Failed to send payment notification', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                notificationType,
                userRole
            });
            throw error;
        }
    }

    /**
     * Send notification on a specific channel
     * Requirements: 7.1, 7.2, 7.5
     */
    private async sendNotificationOnChannel(
        userId: string,
        notificationType: 'proposal_accepted' | 'proposal_rejected',
        proposalData: ProposalResponseNotificationData,
        channel: NotificationChannel,
        userRole: 'proposer' | 'booking_holder'
    ): Promise<void> {
        try {
            // Get the appropriate template for this notification type and channel
            const template = this.templateService.getTemplate(notificationType, channel);
            if (!template) {
                logger.warn('No template found for notification', {
                    notificationType,
                    channel
                });
                return;
            }

            // Prepare template data based on user role and preferences
            const templateData = await this.prepareProposalTemplateData(
                userId,
                proposalData,
                userRole
            );

            // Render the template
            const renderedContent = this.templateService.renderTemplate(template, templateData);

            // Send the notification
            await this.notificationService.sendNotification(
                notificationType,
                userId,
                templateData
            );

            logger.debug('Sent notification on channel', {
                userId,
                notificationType,
                channel,
                userRole
            });
        } catch (error) {
            logger.error('Failed to send notification on channel', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                notificationType,
                channel,
                userRole
            });
            throw error;
        }
    }

    /**
     * Send payment notification on a specific channel
     * Requirements: 7.3, 7.5
     */
    private async sendPaymentNotificationOnChannel(
        userId: string,
        notificationType: 'proposal_payment_completed' | 'proposal_payment_failed',
        paymentData: ProposalPaymentNotificationData,
        channel: NotificationChannel,
        userRole: 'payer' | 'recipient'
    ): Promise<void> {
        try {
            // Get the appropriate template for this notification type and channel
            const template = this.templateService.getTemplate(notificationType, channel);
            if (!template) {
                logger.warn('No template found for payment notification', {
                    notificationType,
                    channel
                });
                return;
            }

            // Prepare template data based on user role and preferences
            const templateData = await this.preparePaymentTemplateData(
                userId,
                paymentData,
                userRole
            );

            // Render the template
            const renderedContent = this.templateService.renderTemplate(template, templateData);

            // Send the notification
            await this.notificationService.sendNotification(
                notificationType,
                userId,
                templateData
            );

            logger.debug('Sent payment notification on channel', {
                userId,
                notificationType,
                channel,
                userRole
            });
        } catch (error) {
            logger.error('Failed to send payment notification on channel', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                notificationType,
                channel,
                userRole
            });
            throw error;
        }
    }

    /**
     * Prepare template data for proposal notifications based on user preferences
     * Requirements: 7.1, 7.2, 7.5
     */
    private async prepareProposalTemplateData(
        userId: string,
        proposalData: ProposalResponseNotificationData,
        userRole: 'proposer' | 'booking_holder'
    ): Promise<Record<string, any>> {
        try {
            // Check user preferences for content inclusion
            const includeSwapDetails = await this.preferencesService.shouldIncludeProposalResponseContent(
                userId,
                proposalData.response === 'accepted' ? 'proposal_accepted' : 'proposal_rejected',
                'swap_details'
            );

            const includePaymentInfo = proposalData.response === 'accepted' &&
                await this.preferencesService.shouldIncludeProposalResponseContent(
                    userId,
                    'proposal_accepted',
                    'payment_info'
                );

            const includeRejectionReason = proposalData.response === 'rejected' &&
                await this.preferencesService.shouldIncludeProposalResponseContent(
                    userId,
                    'proposal_rejected',
                    'rejection_reason'
                );

            // Base template data
            const templateData: Record<string, any> = {
                recipientName: 'User', // This would be fetched from user service
                proposalId: proposalData.proposalId,
                proposalType: proposalData.proposalType,
                role: userRole,
                dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/proposals`
            };

            // Add swap details if user prefers them
            if (includeSwapDetails) {
                templateData.sourceSwapTitle = proposalData.sourceSwapDetails.title;
                templateData.sourceSwapLocation = proposalData.sourceSwapDetails.location;
                templateData.sourceSwapDates = proposalData.sourceSwapDetails.dates;

                if (proposalData.targetSwapDetails) {
                    templateData.targetSwapTitle = proposalData.targetSwapDetails.title;
                    templateData.targetSwapLocation = proposalData.targetSwapDetails.location;
                    templateData.targetSwapDates = proposalData.targetSwapDetails.dates;
                }
            }

            // Add payment info if user prefers it and it's relevant
            if (includePaymentInfo && proposalData.cashOffer) {
                templateData.cashAmount = proposalData.cashOffer.amount;
                templateData.cashCurrency = proposalData.cashOffer.currency;
                templateData.escrowRequired = proposalData.cashOffer.escrowRequired;
            }

            // Add rejection reason if user prefers it and it exists
            if (includeRejectionReason && proposalData.rejectionReason) {
                templateData.rejectionReason = proposalData.rejectionReason;
            }

            return templateData;
        } catch (error) {
            logger.error('Failed to prepare proposal template data', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                userRole
            });

            // Return basic template data as fallback
            return {
                recipientName: 'User',
                proposalId: proposalData.proposalId,
                proposalType: proposalData.proposalType,
                role: userRole,
                dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/proposals`
            };
        }
    }

    /**
     * Prepare template data for payment notifications based on user preferences
     * Requirements: 7.3, 7.5
     */
    private async preparePaymentTemplateData(
        userId: string,
        paymentData: ProposalPaymentNotificationData,
        userRole: 'payer' | 'recipient'
    ): Promise<Record<string, any>> {
        try {
            // Check user preferences for content inclusion
            const includeTransactionDetails = await this.preferencesService.shouldIncludeProposalResponseContent(
                userId,
                paymentData.status === 'completed' ? 'proposal_payment_completed' : 'proposal_payment_failed',
                'transaction_details'
            );

            const includeErrorDetails = paymentData.status === 'failed' &&
                await this.preferencesService.shouldIncludeProposalResponseContent(
                    userId,
                    'proposal_payment_failed',
                    'error_details'
                );

            // Base template data
            const templateData: Record<string, any> = {
                recipientName: 'User', // This would be fetched from user service
                transactionId: paymentData.transactionId,
                amount: paymentData.amount,
                currency: paymentData.currency,
                role: userRole,
                proposalId: paymentData.proposalId,
                dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/transactions`,
                timestamp: new Date().toISOString()
            };

            // Add swap ID if available
            if (paymentData.swapId) {
                templateData.swapId = paymentData.swapId;
            }

            // Add error details if user prefers them and they exist
            if (includeErrorDetails && paymentData.errorMessage) {
                templateData.errorMessage = paymentData.errorMessage;
            }

            return templateData;
        } catch (error) {
            logger.error('Failed to prepare payment template data', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                userRole
            });

            // Return basic template data as fallback
            return {
                recipientName: 'User',
                transactionId: paymentData.transactionId,
                amount: paymentData.amount,
                currency: paymentData.currency,
                role: userRole,
                proposalId: paymentData.proposalId,
                dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/transactions`
            };
        }
    }
}