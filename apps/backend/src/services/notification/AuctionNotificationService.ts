import { logger } from '../../utils/logger';
import { NotificationService } from './NotificationService';
import { UserRepository } from '../../database/repositories/UserRepository';
import { SwapRepository } from '../../database/repositories/SwapRepository';

export interface InterestedUserCriteria {
  location?: {
    city?: string;
    country?: string;
    radius?: number; // in km
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  swapValue?: {
    min?: number;
    max?: number;
  };
  paymentTypes?: string[];
}

export interface AuctionTimingConfig {
  reminderIntervals: number[]; // hours before auto-selection
  endingSoonThreshold: number; // hours before auction ends
}

export class AuctionNotificationService {
  private timingConfig: AuctionTimingConfig = {
    reminderIntervals: [24, 12, 2], // 24h, 12h, 2h before auto-selection
    endingSoonThreshold: 24, // 24 hours before auction ends
  };

  constructor(
    private notificationService: NotificationService,
    private userRepository: UserRepository,
    private swapRepository: SwapRepository
  ) {}

  /**
   * Find users interested in a specific auction based on their preferences and search history
   */
  async findInterestedUsers(auctionData: {
    swapId: string;
    location: { city: string; country: string };
    dateRange: { checkIn: Date; checkOut: Date };
    swapValue: number;
    paymentTypes: string[];
  }): Promise<string[]> {
    try {
      const criteria: InterestedUserCriteria = {
        location: {
          city: auctionData.location.city,
          country: auctionData.location.country,
          radius: 100, // 100km radius
        },
        dateRange: {
          start: auctionData.dateRange.checkIn,
          end: auctionData.dateRange.checkOut,
        },
        swapValue: {
          min: auctionData.swapValue * 0.7, // 30% below
          max: auctionData.swapValue * 1.3, // 30% above
        },
        paymentTypes: auctionData.paymentTypes,
      };

      // Find users based on search history and preferences
      const interestedUsers = await this.userRepository.findInterestedUsers(criteria);
      
      // Filter out the auction owner
      const swap = await this.swapRepository.findById(auctionData.swapId);
      if (swap) {
        return interestedUsers.filter(userId => userId !== swap.ownerId);
      }

      return interestedUsers;
    } catch (error) {
      logger.error('Failed to find interested users for auction', { error, auctionData });
      return [];
    }
  }

  /**
   * Send auction creation notifications to interested users
   */
  async notifyInterestedUsersOfAuction(data: {
    auctionId: string;
    swapId: string;
    endDate: Date;
    swapDetails: {
      title: string;
      location: { city: string; country: string };
      dateRange: { checkIn: Date; checkOut: Date };
      swapValue: number;
      paymentTypes: string[];
    };
  }): Promise<void> {
    try {
      const interestedUserIds = await this.findInterestedUsers({
        swapId: data.swapId,
        location: data.swapDetails.location,
        dateRange: data.swapDetails.dateRange,
        swapValue: data.swapDetails.swapValue,
        paymentTypes: data.swapDetails.paymentTypes,
      });

      if (interestedUserIds.length === 0) {
        logger.info('No interested users found for auction', { auctionId: data.auctionId });
        return;
      }

      await this.notificationService.sendAuctionCreatedToInterestedUsers({
        auctionId: data.auctionId,
        swapId: data.swapId,
        interestedUserIds,
        endDate: data.endDate,
        swapDetails: {
          title: data.swapDetails.title,
          location: `${data.swapDetails.location.city}, ${data.swapDetails.location.country}`,
          dates: `${data.swapDetails.dateRange.checkIn.toDateString()} - ${data.swapDetails.dateRange.checkOut.toDateString()}`,
          paymentTypes: data.swapDetails.paymentTypes,
        },
      });

      logger.info('Auction creation notifications sent', { 
        auctionId: data.auctionId, 
        recipientCount: interestedUserIds.length 
      });
    } catch (error) {
      logger.error('Failed to notify interested users of auction', { error, auctionId: data.auctionId });
    }
  }

  /**
   * Send auction ending reminders to owner and active bidders
   */
  async sendAuctionEndingReminders(data: {
    auctionId: string;
    ownerId: string;
    activeBidderIds: string[];
    hoursUntilEnd: number;
  }): Promise<void> {
    try {
      if (data.hoursUntilEnd <= this.timingConfig.endingSoonThreshold) {
        // Notify owner
        await this.notificationService.sendAuctionEndingSoonNotification({
          auctionId: data.auctionId,
          recipientUserId: data.ownerId,
          hoursRemaining: data.hoursUntilEnd,
        });

        // Notify active bidders
        const bidderNotifications = data.activeBidderIds.map(bidderId =>
          this.notificationService.sendAuctionEndingSoonNotification({
            auctionId: data.auctionId,
            recipientUserId: bidderId,
            hoursRemaining: data.hoursUntilEnd,
          })
        );

        await Promise.allSettled(bidderNotifications);

        logger.info('Auction ending reminders sent', { 
          auctionId: data.auctionId, 
          recipientCount: data.activeBidderIds.length + 1 
        });
      }
    } catch (error) {
      logger.error('Failed to send auction ending reminders', { error, auctionId: data.auctionId });
    }
  }

  /**
   * Send auction completion notifications with winner announcement
   */
  async sendAuctionCompletionNotifications(data: {
    auctionId: string;
    ownerId: string;
    winningProposalId: string;
    winnerId: string;
    loserIds: string[];
    proposalType: 'booking' | 'cash';
    swapId?: string;
  }): Promise<void> {
    try {
      // Notify winner
      await this.notificationService.sendAuctionWinnerNotification({
        auctionId: data.auctionId,
        proposalId: data.winningProposalId,
        winnerId: data.winnerId,
        ownerId: data.ownerId,
        proposalType: data.proposalType,
        swapId: data.swapId,
      });

      // Notify losers
      const loserNotifications = data.loserIds.map(loserId =>
        this.notificationService.sendAuctionLoserNotification({
          auctionId: data.auctionId,
          proposalId: '', // Not relevant for losers
          loserId,
          ownerId: data.ownerId,
          winningProposalType: data.proposalType,
        })
      );

      await Promise.allSettled(loserNotifications);

      logger.info('Auction completion notifications sent', { 
        auctionId: data.auctionId, 
        winnerId: data.winnerId,
        loserCount: data.loserIds.length 
      });
    } catch (error) {
      logger.error('Failed to send auction completion notifications', { error, auctionId: data.auctionId });
    }
  }

  /**
   * Send automatic selection notifications when owners don't respond in time
   */
  async sendAutoSelectionNotifications(data: {
    auctionId: string;
    ownerId: string;
    winningProposalId: string;
    winnerId: string;
    loserIds: string[];
    reason: string;
  }): Promise<void> {
    try {
      // Notify owner about auto-selection
      await this.notificationService.sendAutoSelectionNotification({
        auctionId: data.auctionId,
        ownerId: data.ownerId,
        winningProposalId: data.winningProposalId,
      });

      // Notify winner
      await this.notificationService.sendAuctionWinnerNotification({
        auctionId: data.auctionId,
        proposalId: data.winningProposalId,
        winnerId: data.winnerId,
        ownerId: data.ownerId,
      });

      // Notify losers
      const loserNotifications = data.loserIds.map(loserId =>
        this.notificationService.sendAuctionLoserNotification({
          auctionId: data.auctionId,
          proposalId: '',
          loserId,
          ownerId: data.ownerId,
        })
      );

      await Promise.allSettled(loserNotifications);

      logger.info('Auto-selection notifications sent', { 
        auctionId: data.auctionId, 
        reason: data.reason,
        winnerId: data.winnerId,
        loserCount: data.loserIds.length 
      });
    } catch (error) {
      logger.error('Failed to send auto-selection notifications', { error, auctionId: data.auctionId });
    }
  }

  /**
   * Send escalating reminder notifications for auction winner selection
   */
  async sendEscalatingSelectionReminders(data: {
    auctionId: string;
    ownerId: string;
    hoursUntilAutoSelection: number;
  }): Promise<void> {
    try {
      let reminderLevel: 'first' | 'second' | 'final' = 'first';
      
      if (data.hoursUntilAutoSelection <= 2) {
        reminderLevel = 'final';
      } else if (data.hoursUntilAutoSelection <= 12) {
        reminderLevel = 'second';
      }

      await this.notificationService.sendEscalatingAuctionReminder({
        auctionId: data.auctionId,
        ownerId: data.ownerId,
        hoursRemaining: data.hoursUntilAutoSelection,
        reminderLevel,
      });

      logger.info('Escalating selection reminder sent', { 
        auctionId: data.auctionId, 
        reminderLevel,
        hoursRemaining: data.hoursUntilAutoSelection 
      });
    } catch (error) {
      logger.error('Failed to send escalating selection reminder', { error, auctionId: data.auctionId });
    }
  }

  /**
   * Schedule all auction-related notifications
   */
  async scheduleAuctionNotifications(data: {
    auctionId: string;
    ownerId: string;
    endDate: Date;
    autoSelectionDeadline: Date;
  }): Promise<void> {
    try {
      const now = new Date();
      const hoursUntilEnd = Math.floor((data.endDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      const hoursUntilAutoSelection = Math.floor((data.autoSelectionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Schedule ending soon notifications
      if (hoursUntilEnd > 0 && hoursUntilEnd <= this.timingConfig.endingSoonThreshold) {
        // This would typically be handled by a job scheduler
        logger.info('Auction ending soon notification scheduled', { 
          auctionId: data.auctionId, 
          hoursUntilEnd 
        });
      }

      // Schedule selection reminders
      for (const reminderHours of this.timingConfig.reminderIntervals) {
        if (hoursUntilAutoSelection > reminderHours) {
          // This would typically be handled by a job scheduler
          logger.info('Selection reminder scheduled', { 
            auctionId: data.auctionId, 
            reminderHours 
          });
        }
      }
    } catch (error) {
      logger.error('Failed to schedule auction notifications', { error, auctionId: data.auctionId });
    }
  }
}