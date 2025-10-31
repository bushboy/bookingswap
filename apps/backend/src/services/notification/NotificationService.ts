import {
  Booking,
  SwapTerms,
  User,
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationData,
  NotificationDeliveryResult,
  EmailNotificationData,
  SMSNotificationData,
  WebSocketNotificationData
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { EmailService } from './EmailService';
import { SMSService } from './SMSService';
import { WebSocketService } from './WebSocketService';
import { NotificationTemplateService } from './NotificationTemplateService';
import { NotificationRepository } from '../../database/repositories/NotificationRepository';
import { UserRepository } from '../../database/repositories/UserRepository';

export interface SwapProposalNotificationData {
  swapId: string;
  recipientUserId: string;
  proposerUserId: string;
  sourceBooking: Booking;
  targetBooking: Booking;
  terms: SwapTerms;
}

export interface SwapCancellationNotificationData {
  swapId: string;
  recipientUserId: string;
  proposerUserId: string;
}

export interface SwapExpirationNotificationData {
  swapId: string;
  recipientUserId: string;
  role: 'proposer' | 'owner';
}

export interface SwapResponseNotificationData {
  swapId: string;
  recipientUserId: string;
  responderUserId: string;
  response: 'accepted' | 'rejected';
  sourceBooking: Booking;
  targetBooking: Booking;
}

// Enhanced notification interfaces for auction features
export interface AuctionCreatedNotificationData {
  auctionId: string;
  swapId: string;
  ownerId: string;
  endDate: Date;
}

export interface AuctionEndedNotificationData {
  auctionId: string;
  ownerId: string;
  totalProposals: number;
  endedAt: Date;
}

export interface AuctionProposalNotificationData {
  auctionId: string;
  proposalId: string;
  ownerId: string;
  proposerId: string;
  proposalType: 'booking' | 'cash';
}

export interface AuctionWinnerNotificationData {
  auctionId: string;
  proposalId: string;
  winnerId: string;
  ownerId: string;
  proposalType?: 'booking' | 'cash';
  swapId?: string;
}

export interface AuctionLoserNotificationData {
  auctionId: string;
  proposalId: string;
  loserId: string;
  ownerId: string;
  winningProposalType?: 'booking' | 'cash';
}

export interface CashProposalNotificationData {
  swapId: string;
  recipientUserId: string;
  proposerId: string;
  cashOffer: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    escrowAgreement: boolean;
  };
}

export interface SwapCreatedNotificationData {
  swapId: string;
  ownerId: string;
  paymentTypes: any;
  acceptanceStrategy: any;
}

export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService | null = null;
  private templateService: NotificationTemplateService;
  public webSocketService?: WebSocketService;

  constructor(
    private notificationRepository: NotificationRepository,
    private userRepository: UserRepository,
    webSocketService?: WebSocketService
  ) {
    this.webSocketService = webSocketService;
    this.emailService = new EmailService();
    this.templateService = new NotificationTemplateService();

    // SMS service is optional (requires Twilio credentials)
    try {
      this.smsService = new SMSService();
    } catch (error) {
      logger.warn('SMS service not available', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Send notification when a swap proposal is created
   */
  async sendSwapProposalNotification(data: SwapProposalNotificationData): Promise<void> {
    await this.sendNotification('swap_proposal', data.recipientUserId, {
      swapId: data.swapId,
      recipientUserId: data.recipientUserId,
      proposerUserId: data.proposerUserId,
      sourceBookingTitle: data.sourceBooking.title,
      sourceBookingLocation: `${data.sourceBooking.location.city}, ${data.sourceBooking.location.country}`,
      sourceBookingDates: `${data.sourceBooking.dateRange.checkIn.toDateString()} - ${data.sourceBooking.dateRange.checkOut.toDateString()}`,
      sourceBookingValue: data.sourceBooking.swapValue,
      targetBookingTitle: data.targetBooking.title,
      targetBookingLocation: `${data.targetBooking.location.city}, ${data.targetBooking.location.country}`,
      targetBookingDates: `${data.targetBooking.dateRange.checkIn.toDateString()} - ${data.targetBooking.dateRange.checkOut.toDateString()}`,
      targetBookingValue: data.targetBooking.swapValue,
      additionalPayment: data.terms.additionalPayment,
      conditions: data.terms.conditions,
      expiresAt: data.terms.expiresAt.toDateString(),
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
    });
  }

  /**
   * Send notification when a swap proposal is cancelled
   */
  async sendSwapCancellationNotification(data: SwapCancellationNotificationData): Promise<void> {
    await this.sendNotification('swap_cancelled', data.recipientUserId, {
      swapId: data.swapId,
      recipientUserId: data.recipientUserId,
      proposerUserId: data.proposerUserId,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
    });
  }

  /**
   * Send notification when a swap proposal expires
   */
  async sendSwapExpirationNotification(data: SwapExpirationNotificationData): Promise<void> {
    await this.sendNotification('swap_expired', data.recipientUserId, {
      swapId: data.swapId,
      recipientUserId: data.recipientUserId,
      role: data.role,
      isProposer: data.role === 'proposer',
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
    });
  }

  /**
   * Send notification when a swap proposal is accepted or rejected
   */
  async sendSwapResponseNotification(data: SwapResponseNotificationData): Promise<void> {
    const type: NotificationType = data.response === 'accepted' ? 'swap_accepted' : 'swap_rejected';

    await this.sendNotification(type, data.recipientUserId, {
      swapId: data.swapId,
      recipientUserId: data.recipientUserId,
      responderUserId: data.responderUserId,
      response: data.response,
      sourceBookingTitle: data.sourceBooking.title,
      sourceBookingLocation: `${data.sourceBooking.location.city}, ${data.sourceBooking.location.country}`,
      targetBookingTitle: data.targetBooking.title,
      targetBookingLocation: `${data.targetBooking.location.city}, ${data.targetBooking.location.country}`,
      swapUrl: `${process.env.FRONTEND_URL}/swaps/${data.swapId}`,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
    });
  }

  /**
   * Send notification when an auction is created
   */
  async sendAuctionCreatedNotification(data: AuctionCreatedNotificationData): Promise<void> {
    await this.sendNotification('auction_created', data.ownerId, {
      auctionId: data.auctionId,
      swapId: data.swapId,
      endDate: data.endDate.toDateString(),
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
    });
  }

  /**
   * Send notification when an auction ends
   */
  async sendAuctionEndedNotification(data: AuctionEndedNotificationData): Promise<void> {
    await this.sendNotification('auction_ended', data.ownerId, {
      auctionId: data.auctionId,
      totalProposals: data.totalProposals,
      endedAt: data.endedAt.toDateString(),
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
    });
  }

  /**
   * Send notification when a proposal is submitted to an auction
   */
  async sendAuctionProposalNotification(data: AuctionProposalNotificationData): Promise<void> {
    await this.sendNotification('auction_proposal', data.ownerId, {
      auctionId: data.auctionId,
      proposalId: data.proposalId,
      proposerId: data.proposerId,
      proposalType: data.proposalType,
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
    });
  }

  /**
   * Send notification to auction winner
   */
  async sendAuctionWinnerNotification(data: AuctionWinnerNotificationData): Promise<void> {
    await this.sendNotification('auction_winner', data.winnerId, {
      auctionId: data.auctionId,
      proposalId: data.proposalId,
      ownerId: data.ownerId,
      proposalType: data.proposalType,
      swapId: data.swapId,
      dashboardUrl: `${process.env.FRONTEND_URL}/swaps/${data.swapId}`,
    });
  }

  /**
   * Send notification to auction losers
   */
  async sendAuctionLoserNotification(data: AuctionLoserNotificationData): Promise<void> {
    await this.sendNotification('auction_loser', data.loserId, {
      auctionId: data.auctionId,
      proposalId: data.proposalId,
      ownerId: data.ownerId,
      winningProposalType: data.winningProposalType,
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
    });
  }

  /**
   * Send notification for cash proposal
   */
  async sendCashProposalNotification(data: CashProposalNotificationData): Promise<void> {
    await this.sendNotification('cash_proposal', data.recipientUserId, {
      swapId: data.swapId,
      proposerId: data.proposerId,
      amount: data.cashOffer.amount,
      currency: data.cashOffer.currency,
      escrowRequired: data.cashOffer.escrowAgreement,
      dashboardUrl: `${process.env.FRONTEND_URL}/swaps/${data.swapId}`,
    });
  }

  /**
   * Send notification when enhanced swap is created
   */
  async sendSwapCreatedNotification(data: SwapCreatedNotificationData): Promise<void> {
    await this.sendNotification('swap_created', data.ownerId, {
      swapId: data.swapId,
      paymentTypes: data.paymentTypes,
      acceptanceStrategy: data.acceptanceStrategy,
      dashboardUrl: `${process.env.FRONTEND_URL}/swaps/${data.swapId}`,
    });
  }

  /**
   * Send notification when auction is cancelled
   */
  async sendAuctionCancelledNotification(data: { auctionId: string; recipientUserId: string; cancelledAt: Date }): Promise<void> {
    await this.sendNotification('auction_cancelled', data.recipientUserId, {
      auctionId: data.auctionId,
      cancelledAt: data.cancelledAt.toDateString(),
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions`,
    });
  }

  /**
   * Send notification when auction proposal is rejected
   */
  async sendAuctionProposalRejectedNotification(data: { auctionId: string; proposalId: string; recipientUserId: string; reason: string }): Promise<void> {
    await this.sendNotification('auction_proposal_rejected', data.recipientUserId, {
      auctionId: data.auctionId,
      proposalId: data.proposalId,
      reason: data.reason,
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions`,
    });
  }

  /**
   * Send notification for auto-selection
   */
  async sendAutoSelectionNotification(data: { auctionId: string; ownerId: string; winningProposalId: string }): Promise<void> {
    await this.sendNotification('auction_auto_selected', data.ownerId, {
      auctionId: data.auctionId,
      winningProposalId: data.winningProposalId,
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
    });
  }

  /**
   * Send notification when auction is converted to first-match
   */
  async sendAuctionConvertedNotification(data: { auctionId: string; ownerId: string; reason: string }): Promise<void> {
    await this.sendNotification('auction_converted', data.ownerId, {
      auctionId: data.auctionId,
      reason: data.reason,
      dashboardUrl: `${process.env.FRONTEND_URL}/swaps`,
    });
  }

  /**
   * Send reminder notification for auction selection
   */
  async sendAuctionSelectionReminderNotification(data: { auctionId: string; ownerId: string; hoursRemaining: number }): Promise<void> {
    await this.sendNotification('auction_selection_reminder', data.ownerId, {
      auctionId: data.auctionId,
      hoursRemaining: data.hoursRemaining,
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
    });
  }

  /**
   * Send notification when auction is ending soon
   */
  async sendAuctionEndingSoonNotification(data: { auctionId: string; recipientUserId: string; hoursRemaining: number }): Promise<void> {
    await this.sendNotification('auction_ending_soon', data.recipientUserId, {
      auctionId: data.auctionId,
      hoursRemaining: data.hoursRemaining,
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
    });
  }

  /**
   * Send notifications to interested users when auction is created
   */
  async sendAuctionCreatedToInterestedUsers(data: {
    auctionId: string;
    swapId: string;
    interestedUserIds: string[];
    endDate: Date;
    swapDetails: {
      title: string;
      location: string;
      dates: string;
      paymentTypes: string[];
    };
  }): Promise<void> {
    const notificationPromises = data.interestedUserIds.map(userId =>
      this.sendNotification('auction_created', userId, {
        auctionId: data.auctionId,
        swapId: data.swapId,
        endDate: data.endDate.toDateString(),
        swapTitle: data.swapDetails.title,
        swapLocation: data.swapDetails.location,
        swapDates: data.swapDetails.dates,
        paymentTypes: data.swapDetails.paymentTypes.join(', '),
        dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
      })
    );

    await Promise.allSettled(notificationPromises);
  }

  /**
   * Send escalating reminder notifications for auction winner selection
   */
  async sendEscalatingAuctionReminder(data: {
    auctionId: string;
    ownerId: string;
    hoursRemaining: number;
    reminderLevel: 'first' | 'second' | 'final';
  }): Promise<void> {
    await this.sendNotification('auction_selection_reminder', data.ownerId, {
      auctionId: data.auctionId,
      hoursRemaining: data.hoursRemaining,
      reminderLevel: data.reminderLevel,
      isUrgent: data.reminderLevel === 'final',
      dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
    });
  }

  /**
   * Send notification to active bidders when auction ends
   */
  async sendAuctionEndedToBidders(data: {
    auctionId: string;
    bidderIds: string[];
    endedAt: Date;
    totalProposals: number;
  }): Promise<void> {
    const notificationPromises = data.bidderIds.map(bidderId =>
      this.sendNotification('auction_ended', bidderId, {
        auctionId: data.auctionId,
        totalProposals: data.totalProposals,
        endedAt: data.endedAt.toDateString(),
        role: 'bidder',
        dashboardUrl: `${process.env.FRONTEND_URL}/auctions/${data.auctionId}`,
      })
    );

    await Promise.allSettled(notificationPromises);
  }

  /**
   * Send payment processing status notifications
   */
  async sendPaymentProcessingNotification(data: {
    userId: string;
    transactionId: string;
    status: 'processing' | 'completed' | 'failed';
    amount: number;
    currency: string;
    swapId?: string;
  }): Promise<void> {
    const notificationType = data.status === 'processing' ? 'payment_processing' :
      data.status === 'completed' ? 'payment_completed' : 'payment_failed';

    await this.sendNotification(notificationType, data.userId, {
      transactionId: data.transactionId,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      swapId: data.swapId,
      dashboardUrl: data.swapId ?
        `${process.env.FRONTEND_URL}/swaps/${data.swapId}` :
        `${process.env.FRONTEND_URL}/payments/${data.transactionId}`,
    });
  }

  /**
   * Send proposal acceptance notification to both proposer and booking holder
   * Requirements: 7.1, 7.2
   */
  async sendProposalAcceptanceNotification(data: {
    proposalId: string;
    sourceSwapId: string;
    targetSwapId?: string;
    proposerId: string;
    targetUserId: string;
    proposalType: 'booking' | 'cash';
    sourceSwapDetails: any;
    targetSwapDetails?: any;
    cashOffer?: {
      amount: number;
      currency: string;
      escrowRequired: boolean;
    };
    swapId?: string;
  }): Promise<void> {
    // Send notification to proposer
    await this.sendNotification('proposal_accepted', data.proposerId, {
      proposalId: data.proposalId,
      sourceSwapId: data.sourceSwapId,
      targetSwapId: data.targetSwapId,
      proposalType: data.proposalType,
      response: 'accepted',
      sourceSwapTitle: data.sourceSwapDetails.title,
      sourceSwapLocation: data.sourceSwapDetails.location,
      sourceSwapDates: data.sourceSwapDetails.dates,
      targetSwapTitle: data.targetSwapDetails?.title,
      targetSwapLocation: data.targetSwapDetails?.location,
      targetSwapDates: data.targetSwapDetails?.dates,
      cashAmount: data.cashOffer?.amount,
      cashCurrency: data.cashOffer?.currency,
      escrowRequired: data.cashOffer?.escrowRequired,
      swapId: data.swapId,
      dashboardUrl: data.swapId ?
        `${process.env.FRONTEND_URL}/swaps/${data.swapId}` :
        `${process.env.FRONTEND_URL}/proposals/${data.proposalId}`,
    });

    // Send notification to booking holder (target user)
    await this.sendNotification('proposal_accepted', data.targetUserId, {
      proposalId: data.proposalId,
      sourceSwapId: data.sourceSwapId,
      targetSwapId: data.targetSwapId,
      proposalType: data.proposalType,
      response: 'accepted',
      role: 'accepter',
      sourceSwapTitle: data.sourceSwapDetails.title,
      sourceSwapLocation: data.sourceSwapDetails.location,
      sourceSwapDates: data.sourceSwapDetails.dates,
      targetSwapTitle: data.targetSwapDetails?.title,
      targetSwapLocation: data.targetSwapDetails?.location,
      targetSwapDates: data.targetSwapDetails?.dates,
      cashAmount: data.cashOffer?.amount,
      cashCurrency: data.cashOffer?.currency,
      escrowRequired: data.cashOffer?.escrowRequired,
      swapId: data.swapId,
      dashboardUrl: data.swapId ?
        `${process.env.FRONTEND_URL}/swaps/${data.swapId}` :
        `${process.env.FRONTEND_URL}/proposals/${data.proposalId}`,
    });
  }

  /**
   * Send proposal rejection notification with optional reason
   * Requirements: 7.1, 7.2, 7.3
   */
  async sendProposalRejectionNotification(data: {
    proposalId: string;
    sourceSwapId: string;
    targetSwapId?: string;
    proposerId: string;
    targetUserId: string;
    proposalType: 'booking' | 'cash';
    rejectionReason?: string;
    sourceSwapDetails: any;
    targetSwapDetails?: any;
    cashOffer?: {
      amount: number;
      currency: string;
    };
  }): Promise<void> {
    // Send notification to proposer
    await this.sendNotification('proposal_rejected', data.proposerId, {
      proposalId: data.proposalId,
      sourceSwapId: data.sourceSwapId,
      targetSwapId: data.targetSwapId,
      proposalType: data.proposalType,
      response: 'rejected',
      rejectionReason: data.rejectionReason,
      sourceSwapTitle: data.sourceSwapDetails.title,
      sourceSwapLocation: data.sourceSwapDetails.location,
      sourceSwapDates: data.sourceSwapDetails.dates,
      targetSwapTitle: data.targetSwapDetails?.title,
      targetSwapLocation: data.targetSwapDetails?.location,
      targetSwapDates: data.targetSwapDetails?.dates,
      cashAmount: data.cashOffer?.amount,
      cashCurrency: data.cashOffer?.currency,
      hasReason: !!data.rejectionReason,
      dashboardUrl: `${process.env.FRONTEND_URL}/proposals`,
    });

    // Send confirmation notification to booking holder (target user)
    await this.sendNotification('proposal_rejected', data.targetUserId, {
      proposalId: data.proposalId,
      sourceSwapId: data.sourceSwapId,
      targetSwapId: data.targetSwapId,
      proposalType: data.proposalType,
      response: 'rejected',
      role: 'rejecter',
      rejectionReason: data.rejectionReason,
      sourceSwapTitle: data.sourceSwapDetails.title,
      sourceSwapLocation: data.sourceSwapDetails.location,
      sourceSwapDates: data.sourceSwapDetails.dates,
      targetSwapTitle: data.targetSwapDetails?.title,
      targetSwapLocation: data.targetSwapDetails?.location,
      targetSwapDates: data.targetSwapDetails?.dates,
      cashAmount: data.cashOffer?.amount,
      cashCurrency: data.cashOffer?.currency,
      hasReason: !!data.rejectionReason,
      dashboardUrl: `${process.env.FRONTEND_URL}/proposals`,
    });
  }

  /**
   * Send payment completion notifications for financial proposals
   * Requirements: 7.3, 7.4
   */
  async sendProposalPaymentNotification(data: {
    proposalId: string;
    transactionId: string;
    amount: number;
    currency: string;
    status: 'processing' | 'completed' | 'failed';
    recipientUserId: string;
    payerUserId: string;
    swapId?: string;
    errorMessage?: string;
  }): Promise<void> {
    const notificationType = data.status === 'processing' ? 'payment_processing' :
      data.status === 'completed' ? 'proposal_payment_completed' : 'proposal_payment_failed';

    // Send notification to payment recipient
    await this.sendNotification(notificationType, data.recipientUserId, {
      proposalId: data.proposalId,
      transactionId: data.transactionId,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      role: 'recipient',
      swapId: data.swapId,
      errorMessage: data.errorMessage,
      dashboardUrl: data.swapId ?
        `${process.env.FRONTEND_URL}/swaps/${data.swapId}` :
        `${process.env.FRONTEND_URL}/payments/${data.transactionId}`,
    });

    // Send notification to payer
    await this.sendNotification(notificationType, data.payerUserId, {
      proposalId: data.proposalId,
      transactionId: data.transactionId,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      role: 'payer',
      swapId: data.swapId,
      errorMessage: data.errorMessage,
      dashboardUrl: data.swapId ?
        `${process.env.FRONTEND_URL}/swaps/${data.swapId}` :
        `${process.env.FRONTEND_URL}/payments/${data.transactionId}`,
    });
  }

  /**
   * Send escrow account notifications
   */
  async sendEscrowNotification(data: {
    userId: string;
    escrowId: string;
    status: 'created' | 'released';
    amount: number;
    currency: string;
    swapId?: string;
  }): Promise<void> {
    const notificationType = data.status === 'created' ? 'escrow_created' : 'escrow_released';

    await this.sendNotification(notificationType, data.userId, {
      escrowId: data.escrowId,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      swapId: data.swapId,
      dashboardUrl: data.swapId ?
        `${process.env.FRONTEND_URL}/swaps/${data.swapId}` :
        `${process.env.FRONTEND_URL}/payments`,
    });
  }

  /**
   * Send last-minute booking restriction notification
   */
  async sendLastMinuteRestrictionNotification(data: {
    userId: string;
    bookingId: string;
    eventDate: Date;
    restriction: string;
    alternativeOptions: string[];
  }): Promise<void> {
    await this.sendNotification('last_minute_restriction', data.userId, {
      bookingId: data.bookingId,
      eventDate: data.eventDate.toDateString(),
      restriction: data.restriction,
      alternativeOptions: data.alternativeOptions,
      dashboardUrl: `${process.env.FRONTEND_URL}/bookings/${data.bookingId}`,
    });
  }

  /**
   * Send swap completion success notification to all involved users
   * Requirements: 8.1, 8.2, 8.3
   */
  async sendSwapCompletionSuccessNotification(data: {
    proposalId: string;
    completionType: 'booking_exchange' | 'cash_payment';
    completedSwaps: Array<{
      swapId: string;
      previousStatus: string;
      newStatus: string;
      completedAt: Date;
    }>;
    updatedBookings: Array<{
      bookingId: string;
      previousStatus: string;
      newStatus: string;
      swappedAt: Date;
      newOwnerId?: string;
    }>;
    blockchainTransaction?: {
      transactionId: string;
      consensusTimestamp?: string;
    };
    completionTimestamp: Date;
    proposerId: string;
    targetUserId: string;
    sourceSwapDetails: {
      title: string;
      location: string;
      dates: string;
      value: number;
      accommodationType: string;
      guests: number;
    };
    targetSwapDetails?: {
      title: string;
      location: string;
      dates: string;
      value: number;
      accommodationType: string;
      guests: number;
    };
    cashOffer?: {
      amount: number;
      currency: string;
    };
  }): Promise<void> {
    const notificationData = {
      proposalId: data.proposalId,
      completionType: data.completionType,
      completedSwaps: data.completedSwaps,
      updatedBookings: data.updatedBookings,
      blockchainTransaction: data.blockchainTransaction,
      completionTimestamp: data.completionTimestamp,
      sourceSwapDetails: data.sourceSwapDetails,
      targetSwapDetails: data.targetSwapDetails,
      cashOffer: data.cashOffer,
      totalSwapsCompleted: data.completedSwaps.length,
      totalBookingsUpdated: data.updatedBookings.length,
      ownershipTransfersCount: data.updatedBookings.filter(b => b.newOwnerId).length,
      isBookingExchange: data.completionType === 'booking_exchange',
      isCashPayment: data.completionType === 'cash_payment',
      hasBlockchainRecord: !!data.blockchainTransaction?.transactionId,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
    };

    // Send notification to proposer
    await this.sendNotification('swap_completion_success', data.proposerId, {
      ...notificationData,
      role: 'proposer',
      title: 'Swap Proposal Accepted and Completed',
      message: data.completionType === 'booking_exchange'
        ? `Your booking exchange proposal has been accepted! ${data.completedSwaps.length} swap(s) completed and ${data.updatedBookings.length} booking(s) updated.`
        : `Your cash offer has been accepted! Payment of ${data.cashOffer?.amount} ${data.cashOffer?.currency} has been processed.`,
    });

    // Send notification to target user (accepter)
    await this.sendNotification('swap_completion_success', data.targetUserId, {
      ...notificationData,
      role: 'accepter',
      title: 'Swap Completed Successfully',
      message: data.completionType === 'booking_exchange'
        ? `You have successfully completed a booking exchange! ${data.completedSwaps.length} swap(s) completed and ${data.updatedBookings.length} booking(s) updated.`
        : `You have successfully accepted a cash offer of ${data.cashOffer?.amount} ${data.cashOffer?.currency}.`,
    });
  }

  /**
   * Send booking ownership transfer notifications for booking exchanges
   * Requirements: 8.3, 8.4
   */
  async sendBookingOwnershipTransferNotification(data: {
    proposalId: string;
    bookingId: string;
    previousOwnerId: string;
    newOwnerId: string;
    transferredAt: Date;
    bookingDetails: {
      title: string;
      location: string;
      dates: string;
      value: number;
      accommodationType: string;
      guests: number;
    };
    exchangePartnerDetails: {
      name: string;
      bookingTitle: string;
      bookingLocation: string;
      bookingDates: string;
    };
  }): Promise<void> {
    const notificationData = {
      proposalId: data.proposalId,
      bookingId: data.bookingId,
      previousOwnerId: data.previousOwnerId,
      newOwnerId: data.newOwnerId,
      transferredAt: data.transferredAt,
      bookingDetails: data.bookingDetails,
      exchangePartnerDetails: data.exchangePartnerDetails,
      dashboardUrl: `${process.env.FRONTEND_URL}/bookings/${data.bookingId}`,
    };

    // Send notification to new owner
    await this.sendNotification('booking_ownership_transferred', data.newOwnerId, {
      ...notificationData,
      role: 'new_owner',
      title: 'Booking Ownership Transferred to You',
      message: `You are now the owner of "${data.bookingDetails.title}" in ${data.bookingDetails.location} (${data.bookingDetails.dates}) through a booking exchange with ${data.exchangePartnerDetails.name}.`,
    });

    // Send notification to previous owner
    await this.sendNotification('booking_ownership_transferred', data.previousOwnerId, {
      ...notificationData,
      role: 'previous_owner',
      title: 'Booking Ownership Transferred',
      message: `Ownership of "${data.bookingDetails.title}" has been transferred to ${data.exchangePartnerDetails.name} as part of your booking exchange for "${data.exchangePartnerDetails.bookingTitle}".`,
    });
  }

  /**
   * Send completion validation warning notifications
   * Requirements: 8.1, 8.5
   */
  async sendCompletionValidationWarningNotification(data: {
    proposalId: string;
    userId: string;
    validationErrors: string[];
    validationWarnings: string[];
    inconsistentEntities: string[];
    correctionAttempts?: Array<{
      entityType: 'swap' | 'booking' | 'proposal';
      entityId: string;
      expectedStatus: string;
      actualStatus: string;
      correctionApplied: boolean;
      correctionError?: string;
    }>;
    requiresManualReview: boolean;
  }): Promise<void> {
    await this.sendNotification('completion_validation_warning', data.userId, {
      proposalId: data.proposalId,
      validationErrors: data.validationErrors,
      validationWarnings: data.validationWarnings,
      inconsistentEntities: data.inconsistentEntities,
      correctionAttempts: data.correctionAttempts,
      requiresManualReview: data.requiresManualReview,
      errorCount: data.validationErrors.length,
      warningCount: data.validationWarnings.length,
      inconsistentEntityCount: data.inconsistentEntities.length,
      correctionAttemptCount: data.correctionAttempts?.length || 0,
      successfulCorrections: data.correctionAttempts?.filter(c => c.correctionApplied).length || 0,
      title: 'Swap Completion Validation Warning',
      message: data.requiresManualReview
        ? `Your swap completion has validation issues that require manual review. ${data.validationErrors.length} error(s) and ${data.validationWarnings.length} warning(s) detected.`
        : `Your swap completion has minor validation warnings. ${data.validationWarnings.length} warning(s) detected but completion was successful.`,
      dashboardUrl: `${process.env.FRONTEND_URL}/proposals/${data.proposalId}`,
    });
  }

  /**
   * Send swap completion failure notification
   * Requirements: 8.1, 8.5
   */
  async sendSwapCompletionFailureNotification(data: {
    proposalId: string;
    userId: string;
    errorMessage: string;
    errorCode?: string;
    affectedEntities?: string[];
    rollbackSuccessful: boolean;
    requiresManualIntervention: boolean;
  }): Promise<void> {
    await this.sendNotification('swap_completion_failed', data.userId, {
      proposalId: data.proposalId,
      errorMessage: data.errorMessage,
      errorCode: data.errorCode,
      affectedEntities: data.affectedEntities,
      rollbackSuccessful: data.rollbackSuccessful,
      requiresManualIntervention: data.requiresManualIntervention,
      affectedEntityCount: data.affectedEntities?.length || 0,
      title: 'Swap Completion Failed',
      message: data.rollbackSuccessful
        ? `Your swap completion failed but all changes have been rolled back successfully. Error: ${data.errorMessage}`
        : `Your swap completion failed and rollback was unsuccessful. Manual intervention may be required. Error: ${data.errorMessage}`,
      dashboardUrl: `${process.env.FRONTEND_URL}/proposals/${data.proposalId}`,
    });
  }

  /**
   * Send auction unavailability explanation
   */
  async sendAuctionUnavailableNotification(data: {
    userId: string;
    bookingId: string;
    eventDate: Date;
    reason: string;
    daysUntilEvent: number;
    minimumDaysRequired: number;
  }): Promise<void> {
    await this.sendNotification('auction_unavailable', data.userId, {
      bookingId: data.bookingId,
      eventDate: data.eventDate.toDateString(),
      reason: data.reason,
      daysUntilEvent: data.daysUntilEvent,
      minimumDaysRequired: data.minimumDaysRequired,
      dashboardUrl: `${process.env.FRONTEND_URL}/swaps/create?booking=${data.bookingId}`,
    });
  }

  /**
   * Generic method to send notifications across all channels
   */
  async sendNotification(
    type: NotificationType,
    userId: string,
    data: NotificationData
  ): Promise<void> {
    try {
      logger.info('Sending notification', { type, userId });

      // Get user and their notification preferences
      const user = await this.userRepository.findById(userId);
      if (!user) {
        logger.error('User not found for notification', { userId, type });
        return;
      }

      const preferences = user.profile.preferences.notifications;
      const channels = preferences.channels[type] || [];

      // Add recipient name to data
      data.recipientName = user.profile.displayName || 'User';

      // Send notifications on enabled channels
      const deliveryPromises: Promise<void>[] = [];

      for (const channel of channels) {
        if (this.isChannelEnabled(preferences, channel)) {
          deliveryPromises.push(this.sendOnChannel(type, channel, user, data));
        }
      }

      // Always send in-app notification if enabled
      if (preferences.in_app && !channels.includes('in_app')) {
        deliveryPromises.push(this.sendOnChannel(type, 'in_app', user, data));
      }

      await Promise.allSettled(deliveryPromises);

      logger.info('Notification sent successfully', { type, userId, channels });
    } catch (error) {
      logger.error('Failed to send notification', { error, type, userId });
      throw error;
    }
  }

  /**
   * Send notification on a specific channel
   */
  private async sendOnChannel(
    type: NotificationType,
    channel: NotificationChannel,
    user: User,
    data: NotificationData
  ): Promise<void> {
    try {
      const template = this.templateService.getTemplate(type, channel);
      if (!template) {
        logger.warn('No template found for notification', { type, channel });
        return;
      }

      const rendered = this.templateService.renderTemplate(template, data);

      // Create notification record
      const notification = await this.notificationRepository.create({
        userId: user.id,
        type,
        title: rendered.subject || this.getDefaultTitle(type),
        message: rendered.content,
        data,
        channel,
        status: 'pending',
      });

      let deliveryResult: NotificationDeliveryResult;

      // Send via appropriate service
      switch (channel) {
        case 'email':
          if (user.profile.email) {
            deliveryResult = await this.emailService.sendEmail({
              to: user.profile.email,
              subject: rendered.subject || this.getDefaultTitle(type),
              html: rendered.content,
              ...data
            } as EmailNotificationData);
          } else {
            throw new Error('User email not available');
          }
          break;

        case 'sms':
          if (this.smsService && user.profile.phone) {
            deliveryResult = await this.smsService.sendSMS({
              to: user.profile.phone,
              message: rendered.content,
              ...data
            } as SMSNotificationData);
          } else {
            throw new Error('SMS service not available or user phone not available');
          }
          break;

        case 'in_app':
          if (this.webSocketService) {
            deliveryResult = await this.webSocketService.sendNotification({
              userId: user.id,
              notification,
              ...data
            } as WebSocketNotificationData);
          } else {
            // Store in database for later retrieval
            deliveryResult = {
              success: true,
              messageId: notification.id,
              deliveredAt: new Date(),
            };
          }
          break;

        default:
          throw new Error(`Unsupported notification channel: ${channel}`);
      }

      // Update notification status
      if (deliveryResult.success) {
        await this.notificationRepository.updateStatus(
          notification.id,
          channel === 'in_app' ? 'delivered' : 'sent',
          deliveryResult.deliveredAt
        );
      } else {
        await this.notificationRepository.updateStatus(notification.id, 'failed');
        logger.error('Notification delivery failed', {
          notificationId: notification.id,
          error: deliveryResult.error
        });
      }

    } catch (error) {
      logger.error('Failed to send notification on channel', { error, type, channel, userId: user.id });
      throw error;
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {}
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const [result, unreadCount] = await Promise.all([
      this.notificationRepository.findByUserId(userId, options),
      this.notificationRepository.getUnreadCount(userId)
    ]);

    return {
      ...result,
      unreadCount
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or access denied');
    }

    await this.notificationRepository.markAsRead(notificationId);

    // Notify other user sessions via WebSocket
    if (this.webSocketService) {
      this.webSocketService.sendNotification({
        userId,
        notification: { ...notification, status: 'read', readAt: new Date() }
      } as WebSocketNotificationData);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    return await this.notificationRepository.deleteExpired();
  }

  private isChannelEnabled(preferences: any, channel: NotificationChannel): boolean {
    return preferences[channel] === true;
  }

  /**
   * Send notification when a browse proposal is received
   * Requirements: 6.1, 6.2, 6.3
   */
  async sendBrowseProposalReceivedNotification(data: {
    proposalId: string;
    sourceSwapId: string;
    targetSwapId: string;
    proposerId: string;
    targetOwnerId: string;
    message?: string;
    sourceSwapDetails: any;
    targetSwapDetails: any;
    compatibilityAnalysis?: any;
  }): Promise<void> {
    await this.sendNotification('browse_proposal_received', data.targetOwnerId, {
      proposalId: data.proposalId,
      sourceSwapId: data.sourceSwapId,
      targetSwapId: data.targetSwapId,
      proposerId: data.proposerId,
      targetOwnerId: data.targetOwnerId,
      message: data.message,
      sourceSwapDetails: data.sourceSwapDetails,
      targetSwapDetails: data.targetSwapDetails,
      compatibilityAnalysis: data.compatibilityAnalysis,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/proposals/${data.proposalId}`,
    });
  }

  /**
   * Send confirmation notification to proposer
   * Requirements: 6.1, 6.2
   */
  async sendBrowseProposalConfirmedNotification(data: {
    proposalId: string;
    sourceSwapId: string;
    targetSwapId: string;
    proposerId: string;
    status: string;
    sourceSwapDetails: any;
    targetSwapDetails: any;
    compatibilityAnalysis?: any;
    nextSteps: string[];
    estimatedResponseTime: string;
  }): Promise<void> {
    await this.sendNotification('browse_proposal_confirmed', data.proposerId, {
      proposalId: data.proposalId,
      sourceSwapId: data.sourceSwapId,
      targetSwapId: data.targetSwapId,
      status: data.status,
      sourceSwapDetails: data.sourceSwapDetails,
      targetSwapDetails: data.targetSwapDetails,
      compatibilityAnalysis: data.compatibilityAnalysis,
      nextSteps: data.nextSteps,
      estimatedResponseTime: data.estimatedResponseTime,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/proposals`,
    });
  }

  /**
   * Send proposal status update notifications
   * Requirements: 6.2, 6.3
   */
  async sendBrowseProposalStatusUpdateNotification(data: {
    proposalId: string;
    sourceSwapId: string;
    targetSwapId: string;
    recipientUserId: string;
    status: string;
    updatedBy: string;
    sourceSwapDetails: any;
    targetSwapDetails: any;
    statusMessage: string;
    actionRequired: boolean;
  }): Promise<void> {
    await this.sendNotification('browse_proposal_status_update', data.recipientUserId, {
      proposalId: data.proposalId,
      sourceSwapId: data.sourceSwapId,
      targetSwapId: data.targetSwapId,
      status: data.status,
      updatedBy: data.updatedBy,
      sourceSwapDetails: data.sourceSwapDetails,
      targetSwapDetails: data.targetSwapDetails,
      statusMessage: data.statusMessage,
      actionRequired: data.actionRequired,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/proposals`,
    });
  }

  /**
   * Send reminder notifications for pending proposals
   * Requirements: 6.4, 6.5
   */
  async sendBrowseProposalReminderNotification(data: {
    proposalId: string;
    targetOwnerId: string;
    sourceSwapTitle: string;
    targetSwapTitle: string;
    hoursRemaining: number;
    reminderType: 'first' | 'second' | 'final';
  }): Promise<void> {
    await this.sendNotification('browse_proposal_reminder', data.targetOwnerId, {
      proposalId: data.proposalId,
      sourceSwapTitle: data.sourceSwapTitle,
      targetSwapTitle: data.targetSwapTitle,
      hoursRemaining: data.hoursRemaining,
      reminderType: data.reminderType,
      isUrgent: data.reminderType === 'final',
      expirationWarning: data.hoursRemaining <= 24 ? 'This proposal will expire soon!' : undefined,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/proposals/${data.proposalId}`,
    });
  }

  private getDefaultTitle(type: NotificationType): string {
    const titles: Record<NotificationType, string> = {
      swap_proposal: 'New Swap Proposal',
      swap_accepted: 'Swap Proposal Accepted',
      swap_rejected: 'Swap Proposal Declined',
      swap_expired: 'Swap Proposal Expired',
      swap_cancelled: 'Swap Proposal Cancelled',
      booking_verified: 'Booking Verified',
      booking_expired: 'Booking Expired',
      // Browse proposal notifications
      browse_proposal_received: 'New Browse Proposal',
      browse_proposal_confirmed: 'Proposal Submitted',
      browse_proposal_status_update: 'Proposal Status Update',
      browse_proposal_reminder: 'Proposal Reminder',
      // Auction notifications
      auction_created: 'New Auction Available',
      auction_ended: 'Auction Ended',
      auction_proposal: 'New Auction Proposal',
      auction_winner: 'You Won the Auction!',
      auction_loser: 'Auction Completed',
      auction_cancelled: 'Auction Cancelled',
      auction_proposal_rejected: 'Proposal Not Selected',
      auction_auto_selected: 'Winner Auto-Selected',
      auction_converted: 'Auction Converted',
      auction_selection_reminder: 'Action Required: Select Auction Winner',
      auction_ending_soon: 'Auction Ending Soon',
      // Payment notifications
      cash_proposal: 'New Cash Offer',
      payment_processing: 'Payment Processing',
      payment_completed: 'Payment Completed',
      payment_failed: 'Payment Failed',
      escrow_created: 'Escrow Account Created',
      escrow_released: 'Payment Released',
      swap_created: 'Swap Created Successfully',
      // Timing notifications
      last_minute_restriction: 'Last-Minute Booking Restriction',
      auction_unavailable: 'Auction Not Available',
      // Targeting notifications
      targeting_received: 'New Targeting Request',
      targeting_accepted: 'Targeting Request Accepted',
      targeting_rejected: 'Targeting Request Rejected',
      targeting_cancelled: 'Targeting Request Cancelled',
      retargeting_occurred: 'Targeting Request Redirected',
      targeting_removed: 'Targeting Request Removed',
      auction_targeting_update: 'Auction Targeting Update',
      auction_targeting_ended: 'Auction Targeting Ended',
      proposal_from_targeting: 'Proposal Created from Targeting',
      targeting_restriction_warning: 'Targeting Restriction Warning',
      targeting_eligibility_changed: 'Targeting Eligibility Changed',
      // Proposal response notifications
      proposal_accepted: 'Proposal Accepted',
      proposal_rejected: 'Proposal Rejected',
      proposal_payment_completed: 'Payment Completed',
      proposal_payment_failed: 'Payment Failed',
      // Swap completion notifications
      swap_completion_success: 'Swap Completed Successfully',
      swap_completion_failed: 'Swap Completion Failed',
      booking_ownership_transferred: 'Booking Ownership Transferred',
      completion_validation_warning: 'Completion Validation Warning',
    };
    return titles[type] || 'Notification';
  }
}