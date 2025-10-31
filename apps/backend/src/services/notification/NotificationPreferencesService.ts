import {
  NotificationType,
  NotificationChannel,
  NotificationPreferences
} from '@booking-swap/shared';
import { UserRepository } from '../../database/repositories/UserRepository';
import { logger } from '../../utils/logger';

export interface ProposalNotificationPreferences {
  browseProposals: {
    enabled: boolean;
    channels: NotificationChannel[];
    reminderFrequency: 'none' | 'once' | 'multiple';
    compatibilityThreshold: number; // Only notify for proposals above this compatibility score
  };
  proposalUpdates: {
    enabled: boolean;
    channels: NotificationChannel[];
    includeCompatibilityDetails: boolean;
    includeSwapComparison: boolean;
  };
  proposalReminders: {
    enabled: boolean;
    channels: NotificationChannel[];
    reminderSchedule: number[]; // Hours before expiration to send reminders
    urgentThreshold: number; // Hours remaining when reminders become urgent
  };
}

export interface ProposalResponseNotificationPreferences {
  proposalAccepted: {
    enabled: boolean;
    channels: NotificationChannel[];
    includeSwapDetails: boolean;
    includePaymentInfo: boolean;
    notifyProposer: boolean; // Notify the person who made the proposal
    notifyBookingHolder: boolean; // Notify the person who accepted the proposal
  };
  proposalRejected: {
    enabled: boolean;
    channels: NotificationChannel[];
    includeRejectionReason: boolean;
    includeAlternativeSuggestions: boolean;
    notifyProposer: boolean;
    notifyBookingHolder: boolean;
  };
  paymentCompleted: {
    enabled: boolean;
    channels: NotificationChannel[];
    includeTransactionDetails: boolean;
    includeReceiptInfo: boolean;
    notifyPayer: boolean; // Notify the person who sent payment
    notifyRecipient: boolean; // Notify the person who received payment
  };
  paymentFailed: {
    enabled: boolean;
    channels: NotificationChannel[];
    includeErrorDetails: boolean;
    includeRetryInstructions: boolean;
    urgentNotification: boolean; // Send as urgent/high priority
  };
}

export interface TargetingNotificationPreferences {
  targetingReceived: {
    enabled: boolean;
    channels: NotificationChannel[];
    batchingEnabled: boolean; // Batch multiple targeting requests
    batchingWindow: number; // Minutes to wait before sending batch
    includeSwapComparison: boolean;
  };
  targetingStatusUpdates: {
    enabled: boolean;
    channels: NotificationChannel[];
    includeAccepted: boolean;
    includeRejected: boolean;
    includeCancelled: boolean;
  };
  auctionTargetingUpdates: {
    enabled: boolean;
    channels: NotificationChannel[];
    notifyOnNewProposals: boolean;
    notifyOnAuctionEnding: boolean;
    notifyOnAuctionEnded: boolean;
    endingThreshold: number; // Hours before auction end to notify
  };
  retargetingNotifications: {
    enabled: boolean;
    channels: NotificationChannel[];
    notifyWhenTargetingRemoved: boolean;
    notifyWhenRetargeted: boolean;
  };
  restrictionWarnings: {
    enabled: boolean;
    channels: NotificationChannel[];
    includeRecommendations: boolean;
  };
}

export interface EnhancedNotificationContent {
  subject: string;
  content: string;
  richContent?: {
    compatibilityChart?: string;
    swapComparison?: string;
    actionButtons?: Array<{
      text: string;
      url: string;
      style: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
    }>;
  };
  metadata: {
    priority: 'low' | 'normal' | 'high' | 'urgent';
    category: 'browse_proposal' | 'proposal_update' | 'reminder';
    compatibilityScore?: number;
    includesComparison: boolean;
  };
}

export class NotificationPreferencesService {
  constructor(private userRepository: UserRepository) { }

  /**
   * Get user's targeting notification preferences
   * Requirements: 7.1, 7.2, 7.3, 7.7
   */
  async getTargetingNotificationPreferences(userId: string): Promise<TargetingNotificationPreferences> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get existing notification preferences or use defaults
      const preferences = user.profile.preferences.notifications;

      // Extract or create targeting-specific preferences
      const targetingPreferences: TargetingNotificationPreferences = {
        targetingReceived: {
          enabled: preferences.email || preferences.in_app, // Default enabled if any channel is enabled
          channels: preferences.channels.targeting_received || ['email', 'in_app', 'push'],
          batchingEnabled: true, // Default to batching to prevent spam
          batchingWindow: 15, // 15 minutes batching window
          includeSwapComparison: true,
        },
        targetingStatusUpdates: {
          enabled: preferences.email || preferences.in_app,
          channels: preferences.channels.targeting_accepted || ['email', 'in_app', 'push'],
          includeAccepted: true,
          includeRejected: true,
          includeCancelled: true,
        },
        auctionTargetingUpdates: {
          enabled: preferences.email || preferences.in_app,
          channels: preferences.channels.auction_targeting_update || ['email', 'in_app'],
          notifyOnNewProposals: true,
          notifyOnAuctionEnding: true,
          notifyOnAuctionEnded: true,
          endingThreshold: 2, // Notify 2 hours before auction ends
        },
        retargetingNotifications: {
          enabled: preferences.email || preferences.in_app,
          channels: preferences.channels.retargeting_occurred || ['email', 'in_app'],
          notifyWhenTargetingRemoved: true,
          notifyWhenRetargeted: true,
        },
        restrictionWarnings: {
          enabled: preferences.in_app, // Default to in-app only for warnings
          channels: preferences.channels.targeting_restriction_warning || ['in_app'],
          includeRecommendations: true,
        },
      };

      return targetingPreferences;
    } catch (error) {
      logger.error('Failed to get targeting notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Update user's targeting notification preferences
   * Requirements: 7.1, 7.2, 7.3, 7.7
   */
  async updateTargetingNotificationPreferences(
    userId: string,
    preferences: Partial<TargetingNotificationPreferences>
  ): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update the user's notification preferences
      const updatedPreferences = { ...user.profile.preferences.notifications };

      if (preferences.targetingReceived) {
        updatedPreferences.channels.targeting_received = preferences.targetingReceived.channels;
      }

      if (preferences.targetingStatusUpdates) {
        updatedPreferences.channels.targeting_accepted = preferences.targetingStatusUpdates.channels;
        updatedPreferences.channels.targeting_rejected = preferences.targetingStatusUpdates.channels;
        updatedPreferences.channels.targeting_cancelled = preferences.targetingStatusUpdates.channels;
      }

      if (preferences.auctionTargetingUpdates) {
        updatedPreferences.channels.auction_targeting_update = preferences.auctionTargetingUpdates.channels;
        updatedPreferences.channels.auction_targeting_ended = preferences.auctionTargetingUpdates.channels;
      }

      if (preferences.retargetingNotifications) {
        updatedPreferences.channels.retargeting_occurred = preferences.retargetingNotifications.channels;
        updatedPreferences.channels.targeting_removed = preferences.retargetingNotifications.channels;
      }

      if (preferences.restrictionWarnings) {
        updatedPreferences.channels.targeting_restriction_warning = preferences.restrictionWarnings.channels;
      }

      // Update user in database (assuming the user repository handles this)
      user.profile.preferences.notifications = updatedPreferences;
      await this.userRepository.update(user.id, user);

      logger.info('Updated targeting notification preferences', { userId });
    } catch (error) {
      logger.error('Failed to update targeting notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get user's proposal notification preferences
   * Requirements: 6.7
   */
  async getProposalNotificationPreferences(userId: string): Promise<ProposalNotificationPreferences> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get existing notification preferences or use defaults
      const preferences = user.profile.preferences.notifications;

      // Extract or create proposal-specific preferences
      const proposalPreferences: ProposalNotificationPreferences = {
        browseProposals: {
          enabled: preferences.email || preferences.in_app,
          channels: preferences.channels.browse_proposal_received || ['email', 'in_app'],
          reminderFrequency: 'multiple', // Default to multiple reminders
          compatibilityThreshold: 30, // Default minimum compatibility score
        },
        proposalUpdates: {
          enabled: preferences.email || preferences.in_app,
          channels: preferences.channels.browse_proposal_status_update || ['email', 'in_app'],
          includeCompatibilityDetails: true,
          includeSwapComparison: true,
        },
        proposalReminders: {
          enabled: preferences.email || preferences.sms || preferences.in_app,
          channels: preferences.channels.browse_proposal_reminder || ['email', 'sms', 'in_app'],
          reminderSchedule: [48, 24, 6], // 48h, 24h, 6h before expiration
          urgentThreshold: 12, // Last 12 hours are considered urgent
        },
      };

      return proposalPreferences;
    } catch (error) {
      logger.error('Failed to get proposal notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Update user's proposal notification preferences
   * Requirements: 6.7
   */
  async updateProposalNotificationPreferences(
    userId: string,
    preferences: Partial<ProposalNotificationPreferences>
  ): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update the user's notification preferences
      const updatedPreferences = { ...user.profile.preferences.notifications };

      if (preferences.browseProposals) {
        updatedPreferences.channels.browse_proposal_received = preferences.browseProposals.channels;
      }

      if (preferences.proposalUpdates) {
        updatedPreferences.channels.browse_proposal_status_update = preferences.proposalUpdates.channels;
      }

      if (preferences.proposalReminders) {
        updatedPreferences.channels.browse_proposal_reminder = preferences.proposalReminders.channels;
      }

      // Update user in database
      user.profile.preferences.notifications = updatedPreferences;
      await this.userRepository.update(user.id, user);

      logger.info('Updated proposal notification preferences', { userId });
    } catch (error) {
      logger.error('Failed to update proposal notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get user's proposal response notification preferences
   * Requirements: 7.1, 7.2, 7.3, 7.5
   */
  async getProposalResponseNotificationPreferences(userId: string): Promise<ProposalResponseNotificationPreferences> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get existing notification preferences or use defaults
      const preferences = user.profile.preferences.notifications;

      // Extract or create proposal response-specific preferences
      const proposalResponsePreferences: ProposalResponseNotificationPreferences = {
        proposalAccepted: {
          enabled: preferences.email || preferences.in_app || preferences.push,
          channels: preferences.channels.proposal_accepted || ['email', 'in_app', 'push'],
          includeSwapDetails: true,
          includePaymentInfo: true,
          notifyProposer: true,
          notifyBookingHolder: true,
        },
        proposalRejected: {
          enabled: preferences.email || preferences.in_app,
          channels: preferences.channels.proposal_rejected || ['email', 'in_app'],
          includeRejectionReason: true,
          includeAlternativeSuggestions: false, // Default to false to avoid spam
          notifyProposer: true,
          notifyBookingHolder: true,
        },
        paymentCompleted: {
          enabled: preferences.email || preferences.in_app || preferences.sms,
          channels: preferences.channels.proposal_payment_completed || ['email', 'in_app', 'sms'],
          includeTransactionDetails: true,
          includeReceiptInfo: true,
          notifyPayer: true,
          notifyRecipient: true,
        },
        paymentFailed: {
          enabled: preferences.email || preferences.in_app || preferences.sms,
          channels: preferences.channels.proposal_payment_failed || ['email', 'in_app', 'sms'],
          includeErrorDetails: true,
          includeRetryInstructions: true,
          urgentNotification: true, // Payment failures should be urgent
        },
      };

      return proposalResponsePreferences;
    } catch (error) {
      logger.error('Failed to get proposal response notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Update user's proposal response notification preferences
   * Requirements: 7.1, 7.2, 7.3, 7.5
   */
  async updateProposalResponseNotificationPreferences(
    userId: string,
    preferences: Partial<ProposalResponseNotificationPreferences>
  ): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update the user's notification preferences
      const updatedPreferences = { ...user.profile.preferences.notifications };

      if (preferences.proposalAccepted) {
        updatedPreferences.channels.proposal_accepted = preferences.proposalAccepted.channels;
      }

      if (preferences.proposalRejected) {
        updatedPreferences.channels.proposal_rejected = preferences.proposalRejected.channels;
      }

      if (preferences.paymentCompleted) {
        updatedPreferences.channels.proposal_payment_completed = preferences.paymentCompleted.channels;
      }

      if (preferences.paymentFailed) {
        updatedPreferences.channels.proposal_payment_failed = preferences.paymentFailed.channels;
      }

      // Update user in database
      user.profile.preferences.notifications = updatedPreferences;
      await this.userRepository.update(user.id, user);

      logger.info('Updated proposal response notification preferences', { userId });
    } catch (error) {
      logger.error('Failed to update proposal response notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Check if user should receive notification based on preferences and compatibility
   * Requirements: 6.1, 6.7, 7.1, 7.2, 7.3, 7.7
   */
  async shouldSendNotification(
    userId: string,
    notificationType: NotificationType,
    compatibilityScore?: number
  ): Promise<boolean> {
    try {
      // Handle targeting notifications
      if (this.isTargetingNotification(notificationType)) {
        const targetingPreferences = await this.getTargetingNotificationPreferences(userId);
        return this.shouldSendTargetingNotification(notificationType, targetingPreferences);
      }

      // Handle proposal response notifications
      if (this.isProposalResponseNotification(notificationType)) {
        const proposalResponsePreferences = await this.getProposalResponseNotificationPreferences(userId);
        return this.shouldSendProposalResponseNotification(notificationType, proposalResponsePreferences);
      }

      // Handle proposal notifications
      const preferences = await this.getProposalNotificationPreferences(userId);

      switch (notificationType) {
        case 'browse_proposal_received':
          if (!preferences.browseProposals.enabled) return false;
          if (compatibilityScore !== undefined && compatibilityScore < preferences.browseProposals.compatibilityThreshold) {
            return false;
          }
          return true;

        case 'browse_proposal_status_update':
          return preferences.proposalUpdates.enabled;

        case 'browse_proposal_reminder':
          return preferences.proposalReminders.enabled;

        default:
          return true; // Default to sending for other notification types
      }
    } catch (error) {
      logger.warn('Failed to check notification preferences, defaulting to send', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        notificationType
      });
      return true; // Default to sending if preferences check fails
    }
  }

  /**
   * Check if notification type is targeting-related
   */
  private isTargetingNotification(notificationType: NotificationType): boolean {
    const targetingTypes: NotificationType[] = [
      'targeting_received',
      'targeting_accepted',
      'targeting_rejected',
      'targeting_cancelled',
      'retargeting_occurred',
      'targeting_removed',
      'auction_targeting_update',
      'auction_targeting_ended',
      'proposal_from_targeting',
      'targeting_restriction_warning',
      'targeting_eligibility_changed'
    ];
    return targetingTypes.includes(notificationType);
  }

  /**
   * Check if notification type is proposal response-related
   * Requirements: 7.1, 7.2, 7.3, 7.5
   */
  private isProposalResponseNotification(notificationType: NotificationType): boolean {
    const proposalResponseTypes: NotificationType[] = [
      'proposal_accepted',
      'proposal_rejected',
      'proposal_payment_completed',
      'proposal_payment_failed'
    ];
    return proposalResponseTypes.includes(notificationType);
  }

  /**
   * Check if user should receive specific targeting notification
   */
  private shouldSendTargetingNotification(
    notificationType: NotificationType,
    preferences: TargetingNotificationPreferences
  ): boolean {
    switch (notificationType) {
      case 'targeting_received':
        return preferences.targetingReceived.enabled;

      case 'targeting_accepted':
        return preferences.targetingStatusUpdates.enabled && preferences.targetingStatusUpdates.includeAccepted;

      case 'targeting_rejected':
        return preferences.targetingStatusUpdates.enabled && preferences.targetingStatusUpdates.includeRejected;

      case 'targeting_cancelled':
        return preferences.targetingStatusUpdates.enabled && preferences.targetingStatusUpdates.includeCancelled;

      case 'retargeting_occurred':
        return preferences.retargetingNotifications.enabled && preferences.retargetingNotifications.notifyWhenRetargeted;

      case 'targeting_removed':
        return preferences.retargetingNotifications.enabled && preferences.retargetingNotifications.notifyWhenTargetingRemoved;

      case 'auction_targeting_update':
        return preferences.auctionTargetingUpdates.enabled;

      case 'auction_targeting_ended':
        return preferences.auctionTargetingUpdates.enabled && preferences.auctionTargetingUpdates.notifyOnAuctionEnded;

      case 'proposal_from_targeting':
        return preferences.targetingStatusUpdates.enabled;

      case 'targeting_restriction_warning':
        return preferences.restrictionWarnings.enabled;

      case 'targeting_eligibility_changed':
        return preferences.targetingStatusUpdates.enabled;

      default:
        return true;
    }
  }

  /**
   * Check if user should receive specific proposal response notification
   * Requirements: 7.1, 7.2, 7.3, 7.5
   */
  private shouldSendProposalResponseNotification(
    notificationType: NotificationType,
    preferences: ProposalResponseNotificationPreferences
  ): boolean {
    switch (notificationType) {
      case 'proposal_accepted':
        return preferences.proposalAccepted.enabled;

      case 'proposal_rejected':
        return preferences.proposalRejected.enabled;

      case 'proposal_payment_completed':
        return preferences.paymentCompleted.enabled;

      case 'proposal_payment_failed':
        return preferences.paymentFailed.enabled;

      default:
        return true;
    }
  }

  /**
   * Generate enhanced notification content with compatibility and comparison details
   * Requirements: 6.1, 6.2, 6.3
   */
  async generateEnhancedNotificationContent(
    userId: string,
    notificationType: NotificationType,
    baseContent: { subject: string; content: string },
    enhancementData: {
      compatibilityAnalysis?: any;
      swapComparison?: any;
      urgency?: 'low' | 'normal' | 'high' | 'urgent';
    }
  ): Promise<EnhancedNotificationContent> {
    try {
      const preferences = await this.getProposalNotificationPreferences(userId);

      let enhancedContent = { ...baseContent };
      const richContent: NonNullable<EnhancedNotificationContent['richContent']> = {};

      // Add compatibility information if available and user prefers it
      if (enhancementData.compatibilityAnalysis && preferences.proposalUpdates.includeCompatibilityDetails) {
        const compatibilityChart = this.generateCompatibilityChart(enhancementData.compatibilityAnalysis);
        richContent.compatibilityChart = compatibilityChart;

        // Enhance subject with compatibility score
        const score = enhancementData.compatibilityAnalysis.overallScore;
        if (score >= 80) {
          enhancedContent.subject = `🌟 ${enhancedContent.subject} (${score}% Match!)`;
        } else if (score >= 60) {
          enhancedContent.subject = `✨ ${enhancedContent.subject} (${score}% Match)`;
        }
      }

      // Add swap comparison if available and user prefers it
      if (enhancementData.swapComparison && preferences.proposalUpdates.includeSwapComparison) {
        const comparisonTable = this.generateSwapComparisonTable(enhancementData.swapComparison);
        richContent.swapComparison = comparisonTable;
      }

      // Add action buttons based on notification type
      const actionButtons = this.generateActionButtons(notificationType, enhancementData);
      if (actionButtons && actionButtons.length > 0) {
        (richContent as any).actionButtons = actionButtons;
      }

      // Determine priority based on compatibility and urgency
      let priority: EnhancedNotificationContent['metadata']['priority'] = 'normal';
      if (enhancementData.urgency === 'urgent') {
        priority = 'urgent';
      } else if (enhancementData.compatibilityAnalysis?.overallScore >= 80) {
        priority = 'high';
      } else if (enhancementData.compatibilityAnalysis?.overallScore < 40) {
        priority = 'low';
      }

      return {
        subject: enhancedContent.subject,
        content: enhancedContent.content,
        richContent,
        metadata: {
          priority,
          category: this.getNotificationCategory(notificationType),
          compatibilityScore: enhancementData.compatibilityAnalysis?.overallScore,
          includesComparison: !!enhancementData.swapComparison,
        },
      };
    } catch (error) {
      logger.error('Failed to generate enhanced notification content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        notificationType
      });

      // Return basic content if enhancement fails
      return {
        subject: baseContent.subject,
        content: baseContent.content,
        metadata: {
          priority: 'normal',
          category: this.getNotificationCategory(notificationType),
          includesComparison: false,
        },
      };
    }
  }

  /**
   * Generate visual compatibility chart for email notifications
   */
  private generateCompatibilityChart(compatibilityAnalysis: any): string {
    const factors = compatibilityAnalysis.factors;

    return `
      <div style="background-color: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 8px;">
        <h4 style="margin-top: 0; color: #495057;">📊 Compatibility Breakdown</h4>
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span>📍 Location Match:</span>
            <span style="font-weight: bold; color: ${this.getScoreColor(factors.locationCompatibility.score)};">
              ${factors.locationCompatibility.score}%
            </span>
          </div>
          <div style="background-color: #e9ecef; height: 8px; border-radius: 4px;">
            <div style="background-color: ${this.getScoreColor(factors.locationCompatibility.score)}; height: 100%; width: ${factors.locationCompatibility.score}%; border-radius: 4px;"></div>
          </div>
        </div>
        
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span>📅 Date Compatibility:</span>
            <span style="font-weight: bold; color: ${this.getScoreColor(factors.dateCompatibility.score)};">
              ${factors.dateCompatibility.score}%
            </span>
          </div>
          <div style="background-color: #e9ecef; height: 8px; border-radius: 4px;">
            <div style="background-color: ${this.getScoreColor(factors.dateCompatibility.score)}; height: 100%; width: ${factors.dateCompatibility.score}%; border-radius: 4px;"></div>
          </div>
        </div>
        
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span>💰 Value Match:</span>
            <span style="font-weight: bold; color: ${this.getScoreColor(factors.valueCompatibility.score)};">
              ${factors.valueCompatibility.score}%
            </span>
          </div>
          <div style="background-color: #e9ecef; height: 8px; border-radius: 4px;">
            <div style="background-color: ${this.getScoreColor(factors.valueCompatibility.score)}; height: 100%; width: ${factors.valueCompatibility.score}%; border-radius: 4px;"></div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <span style="font-size: 18px; font-weight: bold; color: ${this.getScoreColor(compatibilityAnalysis.overallScore)};">
            Overall Match: ${compatibilityAnalysis.overallScore}%
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Generate side-by-side swap comparison table
   */
  private generateSwapComparisonTable(swapComparison: any): string {
    return `
      <div style="background-color: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 8px;">
        <h4 style="margin-top: 0; color: #495057;">🔄 Swap Comparison</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;"></th>
              <th style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">Their Offer</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">Your Booking</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">📍 Location</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${swapComparison.source.location}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${swapComparison.target.location}</td>
            </tr>
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">📅 Dates</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${swapComparison.source.dates}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${swapComparison.target.dates}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">🏠 Type</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${swapComparison.source.accommodationType}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${swapComparison.target.accommodationType}</td>
            </tr>
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">👥 Guests</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${swapComparison.source.guests}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${swapComparison.target.guests}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border: 1px solid #dee2e6;">💰 Value</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">$${swapComparison.source.value}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">$${swapComparison.target.value}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Generate action buttons based on notification type
   */
  private generateActionButtons(
    notificationType: NotificationType,
    enhancementData: any
  ): Array<{
    text: string;
    url: string;
    style: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  }> {
    const buttons: Array<{
      text: string;
      url: string;
      style: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
    }> = [];

    switch (notificationType) {
      case 'browse_proposal_received':
        buttons.push(
          {
            text: 'Review Proposal',
            url: `${process.env.FRONTEND_URL}/dashboard/proposals/${enhancementData.proposalId}`,
            style: 'primary'
          },
          {
            text: 'View All Proposals',
            url: `${process.env.FRONTEND_URL}/dashboard/proposals`,
            style: 'secondary'
          }
        );
        break;

      case 'browse_proposal_confirmed':
        buttons.push(
          {
            text: 'Track Proposal',
            url: `${process.env.FRONTEND_URL}/dashboard/proposals`,
            style: 'success'
          },
          {
            text: 'Browse More Swaps',
            url: `${process.env.FRONTEND_URL}/swaps/browse`,
            style: 'secondary'
          }
        );
        break;

      case 'browse_proposal_reminder':
        buttons.push(
          {
            text: 'Review Now',
            url: `${process.env.FRONTEND_URL}/dashboard/proposals/${enhancementData.proposalId}`,
            style: enhancementData.urgency === 'urgent' ? 'danger' : 'warning'
          }
        );
        break;

      default:
        buttons.push({
          text: 'View Dashboard',
          url: `${process.env.FRONTEND_URL}/dashboard`,
          style: 'primary'
        });
    }

    return buttons;
  }

  /**
   * Get color based on compatibility score
   */
  private getScoreColor(score: number): string {
    if (score >= 80) return '#28a745'; // Green
    if (score >= 60) return '#ffc107'; // Yellow
    if (score >= 40) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
  }

  /**
   * Get notification category based on type
   */
  private getNotificationCategory(type: NotificationType): EnhancedNotificationContent['metadata']['category'] {
    if (type === 'browse_proposal_received') return 'browse_proposal';
    if (type === 'browse_proposal_status_update') return 'proposal_update';
    if (type === 'browse_proposal_reminder') return 'reminder';
    return 'browse_proposal';
  }

  /**
   * Get preferred notification channels for proposal response notifications
   * Requirements: 7.1, 7.2, 7.3, 7.5
   */
  async getProposalResponseNotificationChannels(
    userId: string,
    notificationType: NotificationType,
    userRole: 'proposer' | 'booking_holder' | 'payer' | 'recipient'
  ): Promise<NotificationChannel[]> {
    try {
      const preferences = await this.getProposalResponseNotificationPreferences(userId);

      switch (notificationType) {
        case 'proposal_accepted':
          // Check if this user role should receive notifications
          if (userRole === 'proposer' && !preferences.proposalAccepted.notifyProposer) return [];
          if (userRole === 'booking_holder' && !preferences.proposalAccepted.notifyBookingHolder) return [];
          return preferences.proposalAccepted.channels;

        case 'proposal_rejected':
          if (userRole === 'proposer' && !preferences.proposalRejected.notifyProposer) return [];
          if (userRole === 'booking_holder' && !preferences.proposalRejected.notifyBookingHolder) return [];
          return preferences.proposalRejected.channels;

        case 'proposal_payment_completed':
          if (userRole === 'payer' && !preferences.paymentCompleted.notifyPayer) return [];
          if (userRole === 'recipient' && !preferences.paymentCompleted.notifyRecipient) return [];
          return preferences.paymentCompleted.channels;

        case 'proposal_payment_failed':
          return preferences.paymentFailed.channels;

        default:
          return ['email', 'in_app']; // Default channels
      }
    } catch (error) {
      logger.error('Failed to get proposal response notification channels', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        notificationType,
        userRole
      });
      return ['email', 'in_app']; // Default fallback
    }
  }

  /**
   * Check if proposal response notification should include specific content
   * Requirements: 7.1, 7.2, 7.3, 7.5
   */
  async shouldIncludeProposalResponseContent(
    userId: string,
    notificationType: NotificationType,
    contentType: 'swap_details' | 'payment_info' | 'rejection_reason' | 'transaction_details' | 'error_details' | 'retry_instructions'
  ): Promise<boolean> {
    try {
      const preferences = await this.getProposalResponseNotificationPreferences(userId);

      switch (notificationType) {
        case 'proposal_accepted':
          if (contentType === 'swap_details') return preferences.proposalAccepted.includeSwapDetails;
          if (contentType === 'payment_info') return preferences.proposalAccepted.includePaymentInfo;
          break;

        case 'proposal_rejected':
          if (contentType === 'rejection_reason') return preferences.proposalRejected.includeRejectionReason;
          break;

        case 'proposal_payment_completed':
          if (contentType === 'transaction_details') return preferences.paymentCompleted.includeTransactionDetails;
          break;

        case 'proposal_payment_failed':
          if (contentType === 'error_details') return preferences.paymentFailed.includeErrorDetails;
          if (contentType === 'retry_instructions') return preferences.paymentFailed.includeRetryInstructions;
          break;
      }

      return true; // Default to including content
    } catch (error) {
      logger.error('Failed to check proposal response content preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        notificationType,
        contentType
      });
      return true; // Default to including content
    }
  }
}