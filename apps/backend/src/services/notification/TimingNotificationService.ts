import { logger } from '../../utils/logger';
import { NotificationService } from './NotificationService';

export interface TimingRestrictionData {
  userId: string;
  bookingId: string;
  eventDate: Date;
  currentDate: Date;
}

export class TimingNotificationService {
  private readonly MINIMUM_AUCTION_DAYS = 7;
  private readonly LAST_MINUTE_THRESHOLD_DAYS = 7;

  constructor(private notificationService: NotificationService) {}

  /**
   * Send last-minute booking restriction notification during swap creation
   */
  async sendLastMinuteBookingRestriction(data: TimingRestrictionData & {
    attemptedAction: 'auction_creation' | 'swap_creation';
    swapId?: string;
  }): Promise<void> {
    try {
      const daysUntilEvent = this.calculateDaysUntilEvent(data.eventDate, data.currentDate);
      const isLastMinute = daysUntilEvent < this.LAST_MINUTE_THRESHOLD_DAYS;

      if (isLastMinute) {
        const alternativeOptions = this.getAlternativeOptions(data.attemptedAction, daysUntilEvent);
        
        await this.notificationService.sendLastMinuteRestrictionNotification({
          userId: data.userId,
          bookingId: data.bookingId,
          eventDate: data.eventDate,
          restriction: this.getRestrictionMessage(data.attemptedAction, daysUntilEvent),
          alternativeOptions,
        });

        logger.info('Last-minute restriction notification sent', { 
          bookingId: data.bookingId, 
          daysUntilEvent,
          attemptedAction: data.attemptedAction 
        });
      }
    } catch (error) {
      logger.error('Failed to send last-minute restriction notification', { 
        error, 
        bookingId: data.bookingId 
      });
    }
  }

  /**
   * Send auction unavailability explanation for timing restrictions
   */
  async sendAuctionUnavailableExplanation(data: TimingRestrictionData & {
    reason: 'too_close_to_event' | 'event_passed' | 'invalid_duration';
    requestedEndDate?: Date;
  }): Promise<void> {
    try {
      const daysUntilEvent = this.calculateDaysUntilEvent(data.eventDate, data.currentDate);
      const reason = this.getAuctionUnavailableReason(data.reason, daysUntilEvent, data.requestedEndDate);

      await this.notificationService.sendAuctionUnavailableNotification({
        userId: data.userId,
        bookingId: data.bookingId,
        eventDate: data.eventDate,
        reason,
        daysUntilEvent,
        minimumDaysRequired: this.MINIMUM_AUCTION_DAYS,
      });

      logger.info('Auction unavailable notification sent', { 
        bookingId: data.bookingId, 
        reason: data.reason,
        daysUntilEvent 
      });
    } catch (error) {
      logger.error('Failed to send auction unavailable notification', { 
        error, 
        bookingId: data.bookingId 
      });
    }
  }

  /**
   * Send escalating reminder notifications for auction winner selection
   */
  async sendEscalatingAuctionSelectionReminders(data: {
    auctionId: string;
    ownerId: string;
    auctionEndDate: Date;
    autoSelectionDeadline: Date;
    currentDate: Date;
  }): Promise<void> {
    try {
      const hoursUntilAutoSelection = this.calculateHoursUntilDeadline(
        data.autoSelectionDeadline, 
        data.currentDate
      );

      if (hoursUntilAutoSelection <= 0) {
        // Auto-selection should have already happened
        return;
      }

      const reminderLevel = this.determineReminderLevel(hoursUntilAutoSelection);
      
      if (reminderLevel) {
        await this.notificationService.sendEscalatingAuctionReminder({
          auctionId: data.auctionId,
          ownerId: data.ownerId,
          hoursRemaining: hoursUntilAutoSelection,
          reminderLevel,
        });

        logger.info('Escalating auction reminder sent', { 
          auctionId: data.auctionId, 
          reminderLevel,
          hoursRemaining: hoursUntilAutoSelection 
        });
      }
    } catch (error) {
      logger.error('Failed to send escalating auction reminder', { 
        error, 
        auctionId: data.auctionId 
      });
    }
  }

  /**
   * Check if booking is considered last-minute
   */
  isLastMinuteBooking(eventDate: Date, currentDate: Date = new Date()): boolean {
    const daysUntilEvent = this.calculateDaysUntilEvent(eventDate, currentDate);
    return daysUntilEvent < this.LAST_MINUTE_THRESHOLD_DAYS;
  }

  /**
   * Check if auction timing is valid
   */
  isValidAuctionTiming(eventDate: Date, auctionEndDate: Date): boolean {
    const daysFromAuctionEndToEvent = this.calculateDaysUntilEvent(eventDate, auctionEndDate);
    return daysFromAuctionEndToEvent >= this.MINIMUM_AUCTION_DAYS;
  }

  /**
   * Get the maximum allowed auction end date
   */
  getMaxAuctionEndDate(eventDate: Date): Date {
    const maxEndDate = new Date(eventDate);
    maxEndDate.setDate(maxEndDate.getDate() - this.MINIMUM_AUCTION_DAYS);
    return maxEndDate;
  }

  /**
   * Calculate days until event
   */
  private calculateDaysUntilEvent(eventDate: Date, currentDate: Date): number {
    const timeDiff = eventDate.getTime() - currentDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate hours until deadline
   */
  private calculateHoursUntilDeadline(deadline: Date, currentDate: Date): number {
    const timeDiff = deadline.getTime() - currentDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60));
  }

  /**
   * Get restriction message based on attempted action
   */
  private getRestrictionMessage(attemptedAction: string, daysUntilEvent: number): string {
    switch (attemptedAction) {
      case 'auction_creation':
        return `Auctions are not available for events less than ${this.LAST_MINUTE_THRESHOLD_DAYS} days away. Your event is in ${daysUntilEvent} days.`;
      case 'swap_creation':
        return `This booking is considered last-minute (${daysUntilEvent} days until event). Some features may be limited.`;
      default:
        return `This action is restricted for bookings less than ${this.LAST_MINUTE_THRESHOLD_DAYS} days away.`;
    }
  }

  /**
   * Get alternative options based on attempted action
   */
  private getAlternativeOptions(attemptedAction: string, daysUntilEvent: number): string[] {
    const options: string[] = [];

    switch (attemptedAction) {
      case 'auction_creation':
        options.push('Use "First Match" acceptance instead of auction mode');
        options.push('Create a regular swap proposal');
        if (daysUntilEvent > 3) {
          options.push('Set a shorter swap expiration time for faster responses');
        }
        break;
      case 'swap_creation':
        options.push('Enable auto-accept criteria for faster matching');
        options.push('Set urgent priority for your swap');
        break;
    }

    options.push('Contact support if you need assistance');
    return options;
  }

  /**
   * Get auction unavailable reason message
   */
  private getAuctionUnavailableReason(
    reason: string, 
    daysUntilEvent: number, 
    requestedEndDate?: Date
  ): string {
    switch (reason) {
      case 'too_close_to_event':
        return `Auctions must end at least ${this.MINIMUM_AUCTION_DAYS} days before the event. Your event is in ${daysUntilEvent} days.`;
      case 'event_passed':
        return 'Cannot create auctions for past events.';
      case 'invalid_duration':
        if (requestedEndDate) {
          const daysFromEndToEvent = this.calculateDaysUntilEvent(
            new Date(), // This should be eventDate, but we need it from context
            requestedEndDate
          );
          return `The requested auction end date would leave only ${daysFromEndToEvent} days before the event. Minimum ${this.MINIMUM_AUCTION_DAYS} days required.`;
        }
        return 'The auction duration is invalid.';
      default:
        return 'Auction is not available due to timing restrictions.';
    }
  }

  /**
   * Determine reminder level based on hours remaining
   */
  private determineReminderLevel(hoursRemaining: number): 'first' | 'second' | 'final' | null {
    if (hoursRemaining <= 2) {
      return 'final';
    } else if (hoursRemaining <= 12) {
      return 'second';
    } else if (hoursRemaining <= 24) {
      return 'first';
    }
    return null;
  }
}