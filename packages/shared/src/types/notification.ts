import { BaseEntity } from './index.js';

export type NotificationType =
  | 'swap_proposal'
  | 'swap_accepted'
  | 'swap_rejected'
  | 'swap_expired'
  | 'swap_cancelled'
  | 'booking_verified'
  | 'booking_expired'
  // Browse proposal notifications
  | 'browse_proposal_received'
  | 'browse_proposal_confirmed'
  | 'browse_proposal_status_update'
  | 'browse_proposal_reminder'
  // Auction-specific notifications
  | 'auction_created'
  | 'auction_ended'
  | 'auction_proposal'
  | 'auction_winner'
  | 'auction_loser'
  | 'auction_cancelled'
  | 'auction_proposal_rejected'
  | 'auction_auto_selected'
  | 'auction_converted'
  | 'auction_selection_reminder'
  | 'auction_ending_soon'
  // Payment-specific notifications
  | 'cash_proposal'
  | 'payment_processing'
  | 'payment_completed'
  | 'payment_failed'
  | 'escrow_created'
  | 'escrow_released'
  | 'swap_created'
  // Timing restriction notifications
  | 'last_minute_restriction'
  | 'auction_unavailable'
  // Targeting-specific notifications
  | 'targeting_received'
  | 'targeting_accepted'
  | 'targeting_rejected'
  | 'targeting_cancelled'
  | 'retargeting_occurred'
  | 'targeting_removed'
  | 'auction_targeting_update'
  | 'auction_targeting_ended'
  | 'proposal_from_targeting'
  | 'targeting_restriction_warning'
  | 'targeting_eligibility_changed'
  // Proposal response notifications
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'proposal_payment_completed'
  | 'proposal_payment_failed';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'read';

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  in_app: boolean;
  channels: Record<NotificationType, NotificationChannel[]>;
}

export interface NotificationTemplate {
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  template: string;
  variables: string[];
}

export interface NotificationData {
  [key: string]: any;
}

export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
}

export interface NotificationDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt: Date;
}

export interface EmailNotificationData extends NotificationData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SMSNotificationData extends NotificationData {
  to: string;
  message: string;
}

export interface PushNotificationData extends NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface WebSocketNotificationData extends NotificationData {
  userId: string;
  notification: Notification;
}

// Browse proposal notification data interfaces
export interface BrowseProposalNotificationData extends NotificationData {
  proposalId: string;
  sourceSwapId: string;
  targetSwapId: string;
  proposerId: string;
  targetOwnerId: string;
  message?: string;
  compatibilityScore?: number;
  sourceSwapDetails: {
    title: string;
    location: string;
    dates: string;
    value: number;
    accommodationType: string;
    guests: number;
  };
  targetSwapDetails: {
    title: string;
    location: string;
    dates: string;
    value: number;
    accommodationType: string;
    guests: number;
  };
  compatibilityAnalysis?: {
    overallScore: number;
    locationScore: number;
    dateScore: number;
    valueScore: number;
    accommodationScore: number;
    guestScore: number;
  };
}

export interface BrowseProposalReminderData extends NotificationData {
  proposalId: string;
  sourceSwapTitle: string;
  targetSwapTitle: string;
  hoursRemaining: number;
  reminderType: 'first' | 'second' | 'final';
}

// Targeting notification data interfaces
export interface TargetingNotificationData extends NotificationData {
  targetId: string;
  sourceSwapId: string;
  targetSwapId: string;
  proposalId?: string;
  sourceSwapDetails: {
    title: string;
    location: string;
    dates: string;
    value: number;
    accommodationType: string;
    guests: number;
    ownerName: string;
  };
  targetSwapDetails: {
    title: string;
    location: string;
    dates: string;
    value: number;
    accommodationType: string;
    guests: number;
    ownerName: string;
  };
  message?: string;
  targetingType: 'direct' | 'auction' | 'one_for_one';
  auctionInfo?: {
    endDate: Date;
    currentProposalCount: number;
    isAuctionMode: boolean;
  };
}

export interface TargetingStatusChangeData extends NotificationData {
  targetId: string;
  sourceSwapId: string;
  targetSwapId: string;
  previousStatus: string;
  newStatus: string;
  sourceSwapTitle: string;
  targetSwapTitle: string;
  reason?: string;
}

export interface RetargetingNotificationData extends NotificationData {
  targetId: string;
  sourceSwapId: string;
  previousTargetSwapId: string;
  newTargetSwapId: string;
  sourceSwapTitle: string;
  previousTargetTitle: string;
  newTargetTitle: string;
  reason?: string;
}

export interface AuctionTargetingUpdateData extends NotificationData {
  targetId: string;
  sourceSwapId: string;
  targetSwapId: string;
  auctionId: string;
  updateType: 'new_proposal' | 'auction_ending' | 'auction_ended' | 'proposal_selected';
  sourceSwapTitle: string;
  targetSwapTitle: string;
  auctionInfo: {
    endDate: Date;
    currentProposalCount: number;
    timeRemaining: string;
    isEnding: boolean;
  };
}

export interface TargetingRestrictionData extends NotificationData {
  sourceSwapId: string;
  targetSwapId: string;
  restrictionType: 'auction_ended' | 'proposal_pending' | 'swap_unavailable' | 'circular_targeting';
  sourceSwapTitle: string;
  targetSwapTitle: string;
  message: string;
  suggestedActions?: string[];
}

// Proposal response notification data interfaces
export interface ProposalResponseNotificationData extends NotificationData {
  proposalId: string;
  sourceSwapId: string;
  targetSwapId?: string;
  proposerId: string;
  targetUserId: string;
  proposalType: 'booking' | 'cash';
  response: 'accepted' | 'rejected';
  rejectionReason?: string;
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
    escrowRequired: boolean;
  };
  swapId?: string; // Created swap ID for accepted booking proposals
}

export interface ProposalPaymentNotificationData extends NotificationData {
  proposalId: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: 'processing' | 'completed' | 'failed';
  recipientUserId: string;
  payerUserId: string;
  swapId?: string;
  errorMessage?: string;
}
