import {
    NotificationType,
    NotificationChannel,
    TargetingNotificationData,
    TargetingStatusChangeData,
    RetargetingNotificationData,
    AuctionTargetingUpdateData,
    TargetingRestrictionData
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { NotificationService } from './NotificationService';
import { WebSocketService } from './WebSocketService';
import { NotificationPreferencesService } from './NotificationPreferencesService';
import { TargetingEmailBatchingService } from './TargetingEmailBatchingService';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { UserRepository } from '../../database/repositories/UserRepository';

export class TargetingNotificationService {
    private notificationService: NotificationService;
    private webSocketService: WebSocketService;
    private swapRepository: SwapRepository;
    private userRepository: UserRepository;
    private preferencesService: NotificationPreferencesService;
    private batchingService: TargetingEmailBatchingService;

    constructor(
        notificationService: NotificationService,
        webSocketService: WebSocketService,
        swapRepository: SwapRepository,
        userRepository: UserRepository
    ) {
        this.notificationService = notificationService;
        this.webSocketService = webSocketService;
        this.swapRepository = swapRepository;
        this.userRepository = userRepository;
        this.preferencesService = new NotificationPreferencesService(userRepository);
        this.batchingService = new TargetingEmailBatchingService(notificationService, this.preferencesService);
    }

    /**
     * Send notification when a swap receives a targeting request
     */
    async sendTargetingReceivedNotification(
        targetId: string,
        sourceSwapId: string,
        targetSwapId: string,
        proposalId?: string,
        message?: string
    ): Promise<void> {
        try {
            logger.info('Sending targeting received notification', {
                targetId,
                sourceSwapId,
                targetSwapId
            });

            // Get swap and user details
            const [sourceSwap, targetSwap] = await Promise.all([
                this.swapRepository.findById(sourceSwapId),
                this.swapRepository.findById(targetSwapId)
            ]);

            if (!sourceSwap || !targetSwap) {
                logger.error('Cannot find swaps for targeting notification', {
                    sourceSwapId,
                    targetSwapId
                });
                return;
            }

            const [sourceUser, targetUser] = await Promise.all([
                this.userRepository.findById(sourceSwap.userId),
                this.userRepository.findById(targetSwap.userId)
            ]);

            if (!sourceUser || !targetUser) {
                logger.error('Cannot find users for targeting notification', {
                    sourceUserId: sourceSwap.userId,
                    targetUserId: targetSwap.userId
                });
                return;
            }

            // Prepare notification data
            const notificationData: TargetingNotificationData = {
                targetId,
                sourceSwapId,
                targetSwapId,
                proposalId,
                sourceSwapDetails: {
                    title: sourceSwap.booking?.title || 'Unknown Booking',
                    location: sourceSwap.booking?.location || 'Unknown Location',
                    dates: this.formatDates(sourceSwap.booking?.checkIn, sourceSwap.booking?.checkOut),
                    value: sourceSwap.booking?.totalValue || 0,
                    accommodationType: sourceSwap.booking?.accommodationType || 'Unknown',
                    guests: sourceSwap.booking?.guests || 1,
                    ownerName: sourceUser.name || 'Unknown User'
                },
                targetSwapDetails: {
                    title: targetSwap.booking?.title || 'Unknown Booking',
                    location: targetSwap.booking?.location || 'Unknown Location',
                    dates: this.formatDates(targetSwap.booking?.checkIn, targetSwap.booking?.checkOut),
                    value: targetSwap.booking?.totalValue || 0,
                    accommodationType: targetSwap.booking?.accommodationType || 'Unknown',
                    guests: targetSwap.booking?.guests || 1,
                    ownerName: targetUser.name || 'Unknown User'
                },
                message,
                targetingType: targetSwap.auctionMode ? 'auction' : 'one_for_one',
                auctionInfo: targetSwap.auctionMode ? {
                    endDate: targetSwap.auctionEndDate || new Date(),
                    currentProposalCount: targetSwap.proposalCount || 0,
                    isAuctionMode: true
                } : undefined,
                dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
            };

            // Send notification to target swap owner (use batching for email)
            await this.batchingService.addNotificationToBatch(
                targetUser.id,
                'targeting_received',
                notificationData
            );

            // Send real-time WebSocket notification
            await this.sendRealtimeTargetingUpdate(targetUser.id, {
                type: 'targeting_received',
                targetId,
                sourceSwapId,
                targetSwapId,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                targetSwapTitle: targetSwap.booking?.title || 'Unknown Booking',
                sourceUserName: sourceUser.name || 'Unknown User'
            });

            logger.info('Targeting received notification sent successfully', {
                targetId,
                targetUserId: targetUser.id
            });

        } catch (error) {
            logger.error('Failed to send targeting received notification', {
                error,
                targetId,
                sourceSwapId,
                targetSwapId
            });
        }
    }

    /**
     * Send notification when targeting status changes (accepted/rejected)
     */
    async sendTargetingStatusChangeNotification(
        targetId: string,
        sourceSwapId: string,
        targetSwapId: string,
        newStatus: 'accepted' | 'rejected' | 'cancelled',
        reason?: string
    ): Promise<void> {
        try {
            logger.info('Sending targeting status change notification', {
                targetId,
                newStatus
            });

            const [sourceSwap, targetSwap] = await Promise.all([
                this.swapRepository.findById(sourceSwapId),
                this.swapRepository.findById(targetSwapId)
            ]);

            if (!sourceSwap || !targetSwap) {
                logger.error('Cannot find swaps for status change notification', {
                    sourceSwapId,
                    targetSwapId
                });
                return;
            }

            const sourceUser = await this.userRepository.findById(sourceSwap.userId);
            if (!sourceUser) {
                logger.error('Cannot find source user for status change notification', {
                    sourceUserId: sourceSwap.userId
                });
                return;
            }

            // Determine notification type based on status
            let notificationType: NotificationType;
            switch (newStatus) {
                case 'accepted':
                    notificationType = 'targeting_accepted';
                    break;
                case 'rejected':
                    notificationType = 'targeting_rejected';
                    break;
                case 'cancelled':
                    notificationType = 'targeting_cancelled';
                    break;
                default:
                    logger.warn('Unknown targeting status for notification', { newStatus });
                    return;
            }

            // Prepare notification data
            const notificationData: TargetingStatusChangeData = {
                targetId,
                sourceSwapId,
                targetSwapId,
                previousStatus: 'active',
                newStatus,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                targetSwapTitle: targetSwap.booking?.title || 'Unknown Booking',
                reason,
                swapUrl: `${process.env.FRONTEND_URL}/swaps/${sourceSwapId}`,
                browseUrl: `${process.env.FRONTEND_URL}/browse`
            };

            // Send notification to source swap owner (the one who made the targeting request)
            await this.notificationService.sendNotification(
                notificationType,
                sourceUser.id,
                notificationData,
                ['email', 'in_app', 'push']
            );

            // Send real-time WebSocket notification
            await this.sendRealtimeTargetingUpdate(sourceUser.id, {
                type: notificationType,
                targetId,
                sourceSwapId,
                targetSwapId,
                status: newStatus,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                targetSwapTitle: targetSwap.booking?.title || 'Unknown Booking',
                reason
            });

            logger.info('Targeting status change notification sent successfully', {
                targetId,
                newStatus,
                sourceUserId: sourceUser.id
            });

        } catch (error) {
            logger.error('Failed to send targeting status change notification', {
                error,
                targetId,
                newStatus
            });
        }
    }

    /**
     * Send notification when retargeting occurs
     */
    async sendRetargetingNotification(
        targetId: string,
        sourceSwapId: string,
        previousTargetSwapId: string,
        newTargetSwapId: string,
        reason?: string
    ): Promise<void> {
        try {
            logger.info('Sending retargeting notification', {
                targetId,
                previousTargetSwapId,
                newTargetSwapId
            });

            const [sourceSwap, previousTargetSwap, newTargetSwap] = await Promise.all([
                this.swapRepository.findById(sourceSwapId),
                this.swapRepository.findById(previousTargetSwapId),
                this.swapRepository.findById(newTargetSwapId)
            ]);

            if (!sourceSwap || !previousTargetSwap || !newTargetSwap) {
                logger.error('Cannot find swaps for retargeting notification', {
                    sourceSwapId,
                    previousTargetSwapId,
                    newTargetSwapId
                });
                return;
            }

            const previousTargetUser = await this.userRepository.findById(previousTargetSwap.userId);
            if (!previousTargetUser) {
                logger.error('Cannot find previous target user for retargeting notification', {
                    previousTargetUserId: previousTargetSwap.userId
                });
                return;
            }

            // Prepare notification data
            const notificationData: RetargetingNotificationData = {
                targetId,
                sourceSwapId,
                previousTargetSwapId,
                newTargetSwapId,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                previousTargetTitle: previousTargetSwap.booking?.title || 'Unknown Booking',
                newTargetTitle: newTargetSwap.booking?.title || 'Unknown Booking',
                reason,
                dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
            };

            // Send notification to previous target swap owner
            await this.notificationService.sendNotification(
                'retargeting_occurred',
                previousTargetUser.id,
                notificationData,
                ['email', 'in_app']
            );

            // Send real-time WebSocket notification
            await this.sendRealtimeTargetingUpdate(previousTargetUser.id, {
                type: 'retargeting_occurred',
                targetId,
                sourceSwapId,
                targetSwapId: previousTargetSwapId,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                previousTargetTitle: previousTargetSwap.booking?.title || 'Unknown Booking',
                newTargetTitle: newTargetSwap.booking?.title || 'Unknown Booking'
            });

            logger.info('Retargeting notification sent successfully', {
                targetId,
                previousTargetUserId: previousTargetUser.id
            });

        } catch (error) {
            logger.error('Failed to send retargeting notification', {
                error,
                targetId,
                previousTargetSwapId,
                newTargetSwapId
            });
        }
    }

    /**
     * Send notification for auction targeting updates
     */
    async sendAuctionTargetingUpdateNotification(
        targetId: string,
        sourceSwapId: string,
        targetSwapId: string,
        auctionId: string,
        updateType: 'new_proposal' | 'auction_ending' | 'auction_ended' | 'proposal_selected'
    ): Promise<void> {
        try {
            logger.info('Sending auction targeting update notification', {
                targetId,
                updateType
            });

            const [sourceSwap, targetSwap] = await Promise.all([
                this.swapRepository.findById(sourceSwapId),
                this.swapRepository.findById(targetSwapId)
            ]);

            if (!sourceSwap || !targetSwap) {
                logger.error('Cannot find swaps for auction update notification', {
                    sourceSwapId,
                    targetSwapId
                });
                return;
            }

            const sourceUser = await this.userRepository.findById(sourceSwap.userId);
            if (!sourceUser) {
                logger.error('Cannot find source user for auction update notification', {
                    sourceUserId: sourceSwap.userId
                });
                return;
            }

            // Calculate time remaining
            const timeRemaining = this.calculateTimeRemaining(targetSwap.auctionEndDate);

            // Prepare notification data
            const notificationData: AuctionTargetingUpdateData = {
                targetId,
                sourceSwapId,
                targetSwapId,
                auctionId,
                updateType,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                targetSwapTitle: targetSwap.booking?.title || 'Unknown Booking',
                auctionInfo: {
                    endDate: targetSwap.auctionEndDate || new Date(),
                    currentProposalCount: targetSwap.proposalCount || 0,
                    timeRemaining,
                    isEnding: this.isAuctionEnding(targetSwap.auctionEndDate)
                },
                dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
                browseUrl: `${process.env.FRONTEND_URL}/browse`
            };

            // Determine notification type
            const notificationType = updateType === 'auction_ended' ?
                'auction_targeting_ended' : 'auction_targeting_update';

            // Send notification to source swap owner
            await this.notificationService.sendNotification(
                notificationType,
                sourceUser.id,
                notificationData,
                ['email', 'in_app']
            );

            // Send real-time WebSocket notification
            await this.sendRealtimeTargetingUpdate(sourceUser.id, {
                type: notificationType,
                targetId,
                sourceSwapId,
                targetSwapId,
                updateType,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                targetSwapTitle: targetSwap.booking?.title || 'Unknown Booking',
                auctionInfo: notificationData.auctionInfo
            });

            logger.info('Auction targeting update notification sent successfully', {
                targetId,
                updateType,
                sourceUserId: sourceUser.id
            });

        } catch (error) {
            logger.error('Failed to send auction targeting update notification', {
                error,
                targetId,
                updateType
            });
        }
    }

    /**
     * Send notification for targeting restrictions
     */
    async sendTargetingRestrictionNotification(
        userId: string,
        sourceSwapId: string,
        targetSwapId: string,
        restrictionType: 'auction_ended' | 'proposal_pending' | 'swap_unavailable' | 'circular_targeting',
        message: string,
        suggestedActions?: string[]
    ): Promise<void> {
        try {
            logger.info('Sending targeting restriction notification', {
                userId,
                restrictionType
            });

            const [sourceSwap, targetSwap] = await Promise.all([
                this.swapRepository.findById(sourceSwapId),
                this.swapRepository.findById(targetSwapId)
            ]);

            if (!sourceSwap || !targetSwap) {
                logger.error('Cannot find swaps for restriction notification', {
                    sourceSwapId,
                    targetSwapId
                });
                return;
            }

            const user = await this.userRepository.findById(userId);
            if (!user) {
                logger.error('Cannot find user for restriction notification', { userId });
                return;
            }

            // Prepare notification data
            const notificationData: TargetingRestrictionData = {
                sourceSwapId,
                targetSwapId,
                restrictionType,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                targetSwapTitle: targetSwap.booking?.title || 'Unknown Booking',
                message,
                suggestedActions,
                browseUrl: `${process.env.FRONTEND_URL}/browse`
            };

            // Send notification
            await this.notificationService.sendNotification(
                'targeting_restriction_warning',
                userId,
                notificationData,
                ['in_app']
            );

            // Send real-time WebSocket notification
            await this.sendRealtimeTargetingUpdate(userId, {
                type: 'targeting_restriction_warning',
                sourceSwapId,
                targetSwapId,
                restrictionType,
                message,
                sourceSwapTitle: sourceSwap.booking?.title || 'Unknown Booking',
                targetSwapTitle: targetSwap.booking?.title || 'Unknown Booking'
            });

            logger.info('Targeting restriction notification sent successfully', {
                userId,
                restrictionType
            });

        } catch (error) {
            logger.error('Failed to send targeting restriction notification', {
                error,
                userId,
                restrictionType
            });
        }
    }

    /**
     * Send real-time WebSocket notification for targeting events
     */
    private async sendRealtimeTargetingUpdate(userId: string, data: any): Promise<void> {
        try {
            // Send to user's personal WebSocket room
            const notification = {
                id: `targeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: data.type,
                title: this.getNotificationTitle(data.type, data),
                message: this.getNotificationMessage(data.type, data),
                data,
                timestamp: new Date(),
                read: false
            };

            await this.webSocketService.sendNotification({
                userId,
                notification
            });

            // Also emit to targeting-specific channels
            const io = this.webSocketService.getIOInstance();
            io.to(`targeting_activity:${userId}`).emit('targeting_update', data);
            io.to(`targeting_notifications:${userId}`).emit('targeting_notification', notification);

        } catch (error) {
            logger.error('Failed to send real-time targeting update', { error, userId, data });
        }
    }

    /**
     * Helper method to format dates
     */
    private formatDates(checkIn?: Date, checkOut?: Date): string {
        if (!checkIn || !checkOut) return 'Unknown dates';

        const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        return `${formatDate(checkIn)} - ${formatDate(checkOut)}`;
    }

    /**
     * Helper method to calculate time remaining for auction
     */
    private calculateTimeRemaining(endDate?: Date): string {
        if (!endDate) return 'Unknown';

        const now = new Date();
        const diff = endDate.getTime() - now.getTime();

        if (diff <= 0) return 'Ended';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days} day${days > 1 ? 's' : ''}`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    /**
     * Helper method to check if auction is ending soon
     */
    private isAuctionEnding(endDate?: Date): boolean {
        if (!endDate) return false;

        const now = new Date();
        const diff = endDate.getTime() - now.getTime();
        const hoursRemaining = diff / (1000 * 60 * 60);

        return hoursRemaining <= 2 && hoursRemaining > 0; // Ending within 2 hours
    }

    /**
     * Helper method to get notification title
     */
    private getNotificationTitle(type: string, data: any): string {
        switch (type) {
            case 'targeting_received':
                return 'New Targeting Request';
            case 'targeting_accepted':
                return 'Targeting Accepted!';
            case 'targeting_rejected':
                return 'Targeting Declined';
            case 'targeting_cancelled':
                return 'Targeting Cancelled';
            case 'retargeting_occurred':
                return 'Targeting Redirected';
            case 'auction_targeting_update':
                return 'Auction Update';
            case 'auction_targeting_ended':
                return 'Auction Ended';
            case 'targeting_restriction_warning':
                return 'Targeting Restriction';
            default:
                return 'Targeting Update';
        }
    }

    /**
     * Helper method to get notification message
     */
    private getNotificationMessage(type: string, data: any): string {
        switch (type) {
            case 'targeting_received':
                return `${data.sourceUserName} wants to target your ${data.targetSwapTitle}`;
            case 'targeting_accepted':
                return `Your targeting request for ${data.targetSwapTitle} was accepted!`;
            case 'targeting_rejected':
                return `Your targeting request for ${data.targetSwapTitle} was declined`;
            case 'targeting_cancelled':
                return `Targeting request for ${data.targetSwapTitle} was cancelled`;
            case 'retargeting_occurred':
                return `User switched from ${data.previousTargetTitle} to ${data.newTargetTitle}`;
            case 'auction_targeting_update':
                return `Update on ${data.targetSwapTitle} auction - ${data.updateType}`;
            case 'auction_targeting_ended':
                return `Auction for ${data.targetSwapTitle} has ended`;
            case 'targeting_restriction_warning':
                return `Cannot target ${data.targetSwapTitle}: ${data.message}`;
            default:
                return 'Targeting update received';
        }
    }
}