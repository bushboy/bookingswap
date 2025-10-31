import {
  Swap,
  SwapStatus,
  EnhancedSwap,
  SwapAuction,
  AuctionProposal,
  ProposalStatus,
  SwapProposal
} from '@booking-swap/shared';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { AuctionRepository } from '../../database/repositories/AuctionRepository';
import { BookingService } from '../booking/BookingService';
import { HederaService, TransactionData } from '../hedera/HederaService';
import { NotificationService } from '../notification/NotificationService';
import { AuctionNotificationService } from '../notification/AuctionNotificationService';
import { PaymentNotificationService } from '../notification/PaymentNotificationService';
import { AuctionManagementService } from '../auction/AuctionManagementService';
import { PaymentProcessingService } from '../payment/PaymentProcessingService';
import { ProposalAcceptanceService } from './ProposalAcceptanceService';
import { logger } from '../../utils/logger';

export interface SwapResponseRequest {
  swapId: string;
  userId: string;
  response: 'accept' | 'reject';
}

export interface EnhancedSwapResponseRequest extends SwapResponseRequest {
  proposalId?: string; // For auction proposals
  autoProcessPayment?: boolean;
}

export interface SwapResponseResult {
  swap: Swap;
  blockchainTransaction?: {
    transactionId: string;
    consensusTimestamp?: string;
  };
}

export interface AuctionWinnerSelectionRequest {
  auctionId: string;
  proposalId: string;
  userId: string;
}

export interface AuctionWinnerSelectionResult {
  auction: SwapAuction;
  winningProposal: AuctionProposal;
  swap: EnhancedSwap;
  blockchainTransaction: {
    transactionId: string;
    consensusTimestamp?: string;
  };
}

export interface AuctionProposalRejectionRequest {
  auctionId: string;
  proposalIds: string[];
  userId: string;
  reason?: string;
}

export class SwapResponseService {
  constructor(
    private swapRepository: SwapRepository,
    private auctionRepository: AuctionRepository,
    private bookingService: BookingService,
    private hederaService: HederaService,
    private notificationService: NotificationService,
    private auctionNotificationService: AuctionNotificationService,
    private paymentNotificationService: PaymentNotificationService,
    private auctionService: AuctionManagementService,
    private paymentService: PaymentProcessingService,
    private proposalAcceptanceService: ProposalAcceptanceService
  ) { }

  /**
   * Process swap response with auction mode detection
   */
  async processEnhancedSwapResponse(request: SwapResponseRequest): Promise<SwapResponseResult> {
    try {
      logger.info('Processing enhanced swap response', {
        swapId: request.swapId,
        userId: request.userId,
        response: request.response,
      });

      // Step 1: Get the swap and check if it's enhanced
      const enhancedSwap = await this.swapRepository.findEnhancedById(request.swapId);
      if (!enhancedSwap) {
        // Fall back to traditional swap processing
        return await this.processSwapResponse(request);
      }

      // Step 2: Check if this is an auction swap
      const auction = await this.auctionRepository.findBySwapId(request.swapId);
      if (auction && auction.status === 'active') {
        throw new Error('Cannot directly accept/reject auction swaps. Use auction winner selection instead.');
      }

      if (auction && auction.status === 'ended' && !auction.winningProposalId) {
        throw new Error('Auction has ended but no winner has been selected. Please select a winning proposal first.');
      }

      // Step 3: For first-match swaps, process normally but with enhanced features
      return await this.processFirstMatchSwapResponse(request, enhancedSwap);
    } catch (error) {
      logger.error('Failed to process enhanced swap response', { error, request });
      throw error;
    }
  }

  /**
   * Select auction winner and initiate swap completion
   */
  async selectAuctionWinner(request: AuctionWinnerSelectionRequest): Promise<AuctionWinnerSelectionResult> {
    try {
      logger.info('Selecting auction winner', {
        auctionId: request.auctionId,
        proposalId: request.proposalId,
        userId: request.userId,
      });

      // Step 1: Validate auction and user permissions
      const auction = await this.auctionRepository.findById(request.auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.ownerId !== request.userId) {
        throw new Error('Only the auction owner can select the winner');
      }

      if (auction.status !== 'ended') {
        throw new Error(`Cannot select winner for auction with status: ${auction.status}`);
      }

      if (auction.winningProposalId) {
        throw new Error('Winner has already been selected for this auction');
      }

      // Step 2: Find the winning proposal
      const winningProposal = auction.proposals.find(p => p.id === request.proposalId);
      if (!winningProposal) {
        throw new Error('Proposal not found in this auction');
      }

      if (winningProposal.status !== 'pending') {
        throw new Error(`Cannot select proposal with status: ${winningProposal.status}`);
      }

      // Step 3: Use auction service to select winner
      const auctionResult = await this.auctionService.selectWinningProposal(
        request.auctionId,
        request.proposalId,
        request.userId
      );

      // Step 4: Get the associated swap
      const swap = await this.swapRepository.findEnhancedById(auction.swapId);
      if (!swap) {
        throw new Error('Associated swap not found');
      }

      // Step 5: Process the winning proposal using new acceptance flow
      let updatedSwap: EnhancedSwap;

      // Process the winning proposal based on type using existing methods
      if (winningProposal.proposalType === 'booking') {
        updatedSwap = await this.processBookingProposalWin(swap, winningProposal);
      } else if (winningProposal.proposalType === 'cash') {
        updatedSwap = await this.processCashProposalWin(swap, winningProposal);
      } else {
        throw new Error(`Unsupported proposal type: ${winningProposal.proposalType}`);
      }

      // Step 6: Send notifications to all participants
      await this.sendAuctionCompletionNotifications(
        auctionResult.auction,
        auctionResult.winningProposal,
        updatedSwap
      );

      logger.info('Auction winner selected successfully', {
        auctionId: request.auctionId,
        proposalId: request.proposalId,
        proposalType: winningProposal.proposalType,
      });

      return {
        auction: auctionResult.auction,
        winningProposal: auctionResult.winningProposal,
        swap: updatedSwap,
        blockchainTransaction: auctionResult.blockchainTransaction,
      };
    } catch (error) {
      logger.error('Failed to select auction winner', { error, request });
      throw error;
    }
  }

  /**
   * Reject auction proposals (non-winners)
   */
  async rejectAuctionProposals(request: AuctionProposalRejectionRequest): Promise<{
    rejectedProposals: AuctionProposal[];
    auction: SwapAuction;
  }> {
    try {
      logger.info('Rejecting auction proposals', {
        auctionId: request.auctionId,
        proposalIds: request.proposalIds,
        userId: request.userId,
      });

      // Step 1: Validate auction and permissions
      const auction = await this.auctionRepository.findById(request.auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.ownerId !== request.userId) {
        throw new Error('Only the auction owner can reject proposals');
      }

      // Step 2: Reject each proposal
      const rejectedProposals: AuctionProposal[] = [];
      for (const proposalId of request.proposalIds) {
        const proposal = auction.proposals.find(p => p.id === proposalId);
        if (!proposal) {
          logger.warn('Proposal not found in auction', { proposalId, auctionId: request.auctionId });
          continue;
        }

        if (proposal.status !== 'pending') {
          logger.warn('Cannot reject proposal with non-pending status', {
            proposalId,
            status: proposal.status
          });
          continue;
        }

        // Update proposal status
        const updatedProposal = await this.auctionRepository.updateProposalStatus(
          proposalId,
          'rejected'
        );

        if (updatedProposal) {
          rejectedProposals.push(updatedProposal);

          // Send rejection notification
          await this.notificationService.sendAuctionProposalRejectedNotification({
            auctionId: request.auctionId,
            proposalId,
            recipientUserId: proposal.proposerId,
            reason: request.reason || 'Proposal not selected',
          });

          // Handle cash proposal refunds if needed
          if (proposal.proposalType === 'cash' && proposal.cashOffer?.escrowAccountId) {
            await this.handleCashProposalRefund(proposal);
          }
        }
      }

      // Step 3: Record rejections on blockchain
      if (rejectedProposals.length > 0) {
        const transactionData: TransactionData = {
          type: 'auction_proposals_rejected',
          payload: {
            auctionId: request.auctionId,
            rejectedProposalIds: rejectedProposals.map(p => p.id),
            rejectedBy: request.userId,
            rejectedAt: new Date(),
            reason: request.reason,
          },
          timestamp: new Date(),
        };

        await this.hederaService.submitTransaction(transactionData);
      }

      logger.info('Auction proposals rejected successfully', {
        auctionId: request.auctionId,
        rejectedCount: rejectedProposals.length,
      });

      return {
        rejectedProposals,
        auction,
      };
    } catch (error) {
      logger.error('Failed to reject auction proposals', { error, request });
      throw error;
    }
  }

  /**
   * Accept a swap proposal
   */
  async acceptSwapProposal(request: SwapResponseRequest): Promise<SwapResponseResult> {
    if (request.response !== 'accept') {
      throw new Error('Invalid response type for accept operation');
    }

    try {
      logger.info('Accepting swap proposal', {
        swapId: request.swapId,
        userId: request.userId,
      });

      // Step 1: Validate the swap proposal
      const swap = await this.validateSwapResponse(request);

      // Step 2: Update swap status to completed (per business rule)
      const acceptedSwap = await this.swapRepository.updateStatus(request.swapId, 'completed');
      if (!acceptedSwap) {
        throw new Error('Failed to update swap status to completed');
      }

      // Step 3: Update timeline (responded/completed times)
      const updatedSwap = await this.swapRepository.updateTimeline(request.swapId, {
        respondedAt: new Date(),
        completedAt: new Date(),
      });

      if (!updatedSwap) {
        throw new Error('Failed to update swap timeline');
      }

      // Step 4: Record acceptance on blockchain
      const transactionData: TransactionData = {
        type: 'swap_completed',
        payload: {
          swapId: request.swapId,
          acceptedBy: request.userId,
          acceptedAt: new Date(),
          sourceBookingId: swap.sourceBookingId,
          targetBookingId: swap.targetBookingId,
        },
        timestamp: new Date(),
      };

      const blockchainResult = await this.hederaService.submitTransaction(transactionData);

      // Step 5: Get booking details for notification
      const [sourceBooking, targetBooking] = await Promise.all([
        this.bookingService.getBookingById(swap.sourceBookingId),
        this.bookingService.getBookingById(swap.targetBookingId),
      ]);

      if (!sourceBooking || !targetBooking) {
        throw new Error('Failed to retrieve booking details for notification');
      }

      // Step 6: Send notification to proposer (non-blocking)
      try {
        await this.notificationService.sendSwapResponseNotification({
          swapId: request.swapId,
          recipientUserId: swap.proposerId,
          responderUserId: request.userId,
          response: 'accepted',
          sourceBooking,
          targetBooking,
        });
      } catch (notifyError) {
        logger.error('Failed to send notification', {
          error: notifyError,
          type: 'swap_response',
          response: 'accepted',
          userId: swap.proposerId,
        });
      }

      logger.info('Swap proposal accepted successfully', {
        swapId: request.swapId,
        transactionId: blockchainResult.transactionId,
      });

      return {
        swap: updatedSwap,
        blockchainTransaction: {
          transactionId: blockchainResult.transactionId,
          consensusTimestamp: blockchainResult.consensusTimestamp,
        },
      };
    } catch (error) {
      logger.error('Failed to accept swap proposal', { error, request });
      throw error;
    }
  }

  /**
   * Reject a swap proposal
   */
  async rejectSwapProposal(request: SwapResponseRequest): Promise<SwapResponseResult> {
    if (request.response !== 'reject') {
      throw new Error('Invalid response type for reject operation');
    }

    try {
      logger.info('Rejecting swap proposal', {
        swapId: request.swapId,
        userId: request.userId,
      });

      // Step 1: Validate the swap proposal
      const swap = await this.validateSwapResponse(request);

      // Step 2: Update swap status to rejected
      const rejectedSwap = await this.swapRepository.updateStatus(request.swapId, 'rejected');
      if (!rejectedSwap) {
        throw new Error('Failed to update swap status to rejected');
      }

      // Step 3: Update timeline
      const updatedSwap = await this.swapRepository.updateTimeline(request.swapId, {
        respondedAt: new Date(),
      });

      if (!updatedSwap) {
        throw new Error('Failed to update swap timeline');
      }

      // Step 4: Unlock both bookings and delink swaps (remove pending pairing)
      await Promise.all([
        this.bookingService.unlockBooking(swap.sourceBookingId),
        this.bookingService.unlockBooking(swap.targetBookingId),
      ]);

      // Best-effort: clear any counterpart pending proposal in reverse direction
      try {
        const counterpart = await this.swapRepository.findCounterpartPendingProposalBetweenBookings(
          swap.sourceBookingId,
          swap.targetBookingId
        );
        if (counterpart) {
          await this.swapRepository.updateStatus(counterpart.id, 'cancelled');
        }
      } catch (linkError) {
        logger.warn('Failed to delink counterpart proposal', { linkError, swapId: request.swapId });
      }

      // Step 5: Record rejection on blockchain
      const transactionData: TransactionData = {
        type: 'swap_proposal_rejected',
        payload: {
          swapId: request.swapId,
          rejectedBy: request.userId,
          rejectedAt: new Date(),
          sourceBookingId: swap.sourceBookingId,
          targetBookingId: swap.targetBookingId,
        },
        timestamp: new Date(),
      };

      const blockchainResult = await this.hederaService.submitTransaction(transactionData);

      // Step 6: Get booking details for notification
      const [sourceBooking, targetBooking] = await Promise.all([
        this.bookingService.getBookingById(swap.sourceBookingId),
        this.bookingService.getBookingById(swap.targetBookingId),
      ]);

      if (!sourceBooking || !targetBooking) {
        throw new Error('Failed to retrieve booking details for notification');
      }

      // Step 7: Send notification to proposer (non-blocking)
      try {
        await this.notificationService.sendSwapResponseNotification({
          swapId: request.swapId,
          recipientUserId: swap.proposerId,
          responderUserId: request.userId,
          response: 'rejected',
          sourceBooking,
          targetBooking,
        });
      } catch (notifyError) {
        logger.error('Failed to send notification', {
          error: notifyError,
          type: 'swap_response',
          response: 'rejected',
          userId: swap.proposerId,
        });
      }

      logger.info('Swap proposal rejected successfully', {
        swapId: request.swapId,
        transactionId: blockchainResult.transactionId,
      });

      return {
        swap: updatedSwap,
        blockchainTransaction: {
          transactionId: blockchainResult.transactionId,
          consensusTimestamp: blockchainResult.consensusTimestamp,
        },
      };
    } catch (error) {
      logger.error('Failed to reject swap proposal', { error, request });
      throw error;
    }
  }

  /**
   * Process swap response (accept or reject)
   */
  async processSwapResponse(request: SwapResponseRequest): Promise<SwapResponseResult> {
    if (request.response === 'accept') {
      return await this.acceptSwapProposal(request);
    } else if (request.response === 'reject') {
      return await this.rejectSwapProposal(request);
    } else {
      throw new Error(`Invalid response type: ${request.response}`);
    }
  }

  /**
   * Prepare swap execution (called after acceptance)
   */
  async prepareSwapExecution(swapId: string): Promise<{
    swap: Swap;
    executionPlan: {
      sourceBookingTransfer: {
        fromUserId: string;
        toUserId: string;
        bookingId: string;
      };
      targetBookingTransfer: {
        fromUserId: string;
        toUserId: string;
        bookingId: string;
      };
      additionalPayment?: {
        fromUserId: string;
        toUserId: string;
        amount: number;
      };
    };
  }> {
    try {
      logger.info('Preparing swap execution', { swapId });

      const swap = await this.swapRepository.findById(swapId);
      if (!swap) {
        throw new Error('Swap not found');
      }

      if (swap.status !== 'accepted') {
        throw new Error(`Cannot prepare execution for swap with status: ${swap.status}`);
      }

      // Get booking details
      const [sourceBooking, targetBooking] = await Promise.all([
        this.bookingService.getBookingById(swap.sourceBookingId),
        this.bookingService.getBookingById(swap.targetBookingId),
      ]);

      if (!sourceBooking || !targetBooking) {
        throw new Error('Failed to retrieve booking details for execution preparation');
      }

      // Create execution plan
      const executionPlan = {
        sourceBookingTransfer: {
          fromUserId: sourceBooking.userId,
          toUserId: targetBooking.userId,
          bookingId: sourceBooking.id,
        },
        targetBookingTransfer: {
          fromUserId: targetBooking.userId,
          toUserId: sourceBooking.userId,
          bookingId: targetBooking.id,
        },
        additionalPayment: swap.terms.additionalPayment
          ? {
            fromUserId: swap.proposerId,
            toUserId: swap.ownerId,
            amount: swap.terms.additionalPayment,
          }
          : undefined,
      };

      logger.info('Swap execution prepared', { swapId, executionPlan });

      return {
        swap,
        executionPlan,
      };
    } catch (error) {
      logger.error('Failed to prepare swap execution', { error, swapId });
      throw error;
    }
  }

  /**
   * Get swap response history for a user
   */
  async getUserSwapResponses(
    userId: string,
    status?: SwapStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<Swap[]> {
    try {
      const filters = {
        ownerId: userId,
        ...(status && { status }),
      };

      return await this.swapRepository.findByFilters(filters, limit, offset);
    } catch (error) {
      logger.error('Failed to get user swap responses', { error, userId });
      throw error;
    }
  }

  /**
   * Validate swap response request
   */
  private async validateSwapResponse(request: SwapResponseRequest): Promise<Swap> {
    const swap = await this.swapRepository.findById(request.swapId);
    if (!swap) {
      throw new Error('Swap proposal not found');
    }

    if (swap.ownerId !== request.userId) {
      throw new Error('Only the booking owner can respond to this swap proposal');
    }

    if (swap.status !== 'pending') {
      throw new Error(`Cannot respond to swap proposal with status: ${swap.status}`);
    }

    // Check if proposal has expired
    if (swap.terms.expiresAt <= new Date()) {
      throw new Error('Swap proposal has expired');
    }

    // Verify bookings are still locked and available for swap
    const [sourceBooking, targetBooking] = await Promise.all([
      this.bookingService.getBookingById(swap.sourceBookingId),
      this.bookingService.getBookingById(swap.targetBookingId),
    ]);

    if (!sourceBooking || !targetBooking) {
      throw new Error('One or both bookings no longer exist');
    }

    if (sourceBooking.status !== 'locked') {
      throw new Error(`Source booking is not locked (status: ${sourceBooking.status})`);
    }

    if (targetBooking.status !== 'locked') {
      throw new Error(`Target booking is not locked (status: ${targetBooking.status})`);
    }

    return swap;
  }

  /**
   * Process first-match swap response with enhanced features
   */
  private async processFirstMatchSwapResponse(
    request: SwapResponseRequest,
    enhancedSwap: EnhancedSwap
  ): Promise<SwapResponseResult> {
    // For first-match swaps, we can use the traditional processing
    // but with additional validation for payment types

    if (request.response === 'accept') {
      // Additional validation for enhanced swaps
      await this.validateEnhancedSwapAcceptance(enhancedSwap);
      return await this.acceptSwapProposal(request);
    } else {
      return await this.rejectSwapProposal(request);
    }
  }

  /**
   * Process booking proposal win in auction
   */
  private async processBookingProposalWin(
    swap: EnhancedSwap,
    winningProposal: AuctionProposal
  ): Promise<EnhancedSwap> {
    try {
      if (!winningProposal.bookingId) {
        throw new Error('Booking ID is required for booking proposal');
      }

      // Update swap with target booking
      const updatedSwap = await this.swapRepository.update(swap.id, {
        targetBookingId: winningProposal.bookingId,
        status: 'accepted',
        timeline: {
          ...swap.timeline,
          respondedAt: new Date(),
        },
      });

      if (!updatedSwap) {
        throw new Error('Failed to update swap with winning booking');
      }

      // Lock both bookings
      await Promise.all([
        this.bookingService.lockBooking(swap.sourceBookingId, swap.ownerId),
        this.bookingService.lockBooking(winningProposal.bookingId, winningProposal.proposerId),
      ]);

      logger.info('Booking proposal win processed', {
        swapId: swap.id,
        winningBookingId: winningProposal.bookingId,
      });

      return updatedSwap as EnhancedSwap;
    } catch (error) {
      logger.error('Failed to process booking proposal win', { error, swap, winningProposal });
      throw error;
    }
  }

  /**
   * Process cash proposal win in auction
   */
  private async processCashProposalWin(
    swap: EnhancedSwap,
    winningProposal: AuctionProposal
  ): Promise<EnhancedSwap> {
    try {
      if (!winningProposal.cashOffer) {
        throw new Error('Cash offer is required for cash proposal');
      }

      // Get the auction owner information
      const auction = await this.auctionRepository.findById(winningProposal.auctionId || '');
      if (!auction) {
        throw new Error('Auction not found for cash proposal processing');
      }

      // Process payment transaction using existing payment service
      const paymentResult = await this.paymentService.processPayment({
        amount: winningProposal.cashOffer.amount,
        currency: winningProposal.cashOffer.currency,
        payerId: winningProposal.proposerId,
        recipientId: auction.ownerId,
        paymentMethodId: winningProposal.cashOffer.paymentMethodId,
        swapId: swap.id,
        proposalId: winningProposal.id,
        escrowRequired: winningProposal.cashOffer.escrowRequired,
      });

      // Update swap status
      const updatedSwap = await this.swapRepository.update(swap.id, {
        status: 'accepted',
        timeline: {
          ...swap.timeline,
          respondedAt: new Date(),
        },
      });

      if (!updatedSwap) {
        throw new Error('Failed to update swap with cash payment');
      }

      // Lock source booking
      await this.bookingService.lockBooking(swap.sourceBookingId, auction.ownerId);

      logger.info('Cash proposal win processed', {
        swapId: swap.id,
        paymentTransactionId: paymentResult.transactionId,
        amount: winningProposal.cashOffer.amount,
      });

      return updatedSwap as EnhancedSwap;
    } catch (error) {
      logger.error('Failed to process cash proposal win', { error, swap, winningProposal });
      throw error;
    }
  }

  /**
   * Send notifications for auction completion
   */
  private async sendAuctionCompletionNotifications(
    auction: SwapAuction,
    winningProposal: AuctionProposal,
    swap: EnhancedSwap
  ): Promise<void> {
    try {
      // Notify winner
      await this.notificationService.sendAuctionWinnerNotification({
        auctionId: auction.id,
        proposalId: winningProposal.id,
        winnerId: winningProposal.proposerId,
        ownerId: auction.ownerId,
        proposalType: winningProposal.proposalType,
        swapId: swap.id,
      });

      // Notify losers
      const losingProposals = auction.proposals.filter(
        p => p.id !== winningProposal.id && p.status === 'rejected'
      );

      for (const losingProposal of losingProposals) {
        await this.notificationService.sendAuctionLoserNotification({
          auctionId: auction.id,
          proposalId: losingProposal.id,
          loserId: losingProposal.proposerId,
          ownerId: auction.ownerId,
          winningProposalType: winningProposal.proposalType,
        });
      }

      logger.info('Auction completion notifications sent', {
        auctionId: auction.id,
        winnerId: winningProposal.proposerId,
        loserCount: losingProposals.length,
      });
    } catch (error) {
      logger.warn('Failed to send auction completion notifications', {
        error,
        auctionId: auction.id
      });
      // Don't throw error as this is not critical for auction completion
    }
  }

  /**
   * Handle cash proposal refund for rejected proposals
   */
  private async handleCashProposalRefund(proposal: AuctionProposal): Promise<void> {
    try {
      if (!proposal.cashOffer?.escrowAccountId) {
        return; // No escrow to refund
      }

      // Find the payment transaction
      const payments = await this.paymentService.getTransactionStatus(proposal.cashOffer.escrowAccountId);

      // Process refund if payment was processed
      if (payments === 'completed' || payments === 'processing') {
        await this.paymentService.refundPayment(
          proposal.cashOffer.escrowAccountId,
          undefined, // Full refund
          'Auction proposal not selected'
        );

        logger.info('Cash proposal refund processed', {
          proposalId: proposal.id,
          escrowAccountId: proposal.cashOffer.escrowAccountId,
        });
      }
    } catch (error) {
      logger.error('Failed to process cash proposal refund', {
        error,
        proposalId: proposal.id
      });
      // Don't throw error as this shouldn't block the auction completion
    }
  }

  /**
   * Validate enhanced swap acceptance
   */
  private async validateEnhancedSwapAcceptance(swap: EnhancedSwap): Promise<void> {
    // Check if swap has auction that needs to be completed first
    const auction = await this.auctionRepository.findBySwapId(swap.id);
    if (auction && auction.status === 'active') {
      throw new Error('Cannot accept swap directly while auction is active. Wait for auction to end or cancel the auction first.');
    }

    if (auction && auction.status === 'ended' && !auction.winningProposalId) {
      throw new Error('Auction has ended but no winner selected. Please select a winning proposal first.');
    }

    // Additional validation for payment types could be added here
    logger.info('Enhanced swap acceptance validation passed', { swapId: swap.id });
  }

  /**
   * Get auction proposals for comparison
   */
  async getAuctionProposalsForComparison(auctionId: string, userId: string): Promise<{
    bookingProposals: AuctionProposal[];
    cashProposals: AuctionProposal[];
    rankedCashProposals: AuctionProposal[];
    highestCashOffer?: {
      amount: number;
      currency: string;
      proposalId: string;
    };
    recommendedProposal?: string;
  }> {
    try {
      // Validate user can access this auction
      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.ownerId !== userId) {
        throw new Error('Only the auction owner can view proposal comparisons');
      }

      // Use auction service to compare proposals
      const comparison = await this.auctionService.compareProposals(auctionId);

      return {
        bookingProposals: comparison.bookingProposals,
        cashProposals: comparison.cashProposals,
        rankedCashProposals: comparison.rankedCashProposals,
        highestCashOffer: comparison.highestCashOffer ? {
          amount: comparison.highestCashOffer.amount,
          currency: comparison.highestCashOffer.currency,
          proposalId: comparison.rankedCashProposals[0]?.id,
        } : undefined,
        recommendedProposal: comparison.recommendedProposal,
      };
    } catch (error) {
      logger.error('Failed to get auction proposals for comparison', { error, auctionId, userId });
      throw error;
    }
  }

  /**
   * Handle automatic auction winner selection (timeout scenario)
   */
  async handleAutomaticWinnerSelection(auctionId: string): Promise<AuctionWinnerSelectionResult | null> {
    try {
      logger.info('Handling automatic winner selection', { auctionId });

      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== 'ended') {
        logger.warn('Automatic selection called for non-ended auction', {
          auctionId,
          status: auction.status
        });
        return null;
      }

      if (auction.winningProposalId) {
        logger.info('Auction already has winning proposal', { auctionId });
        return null;
      }

      // Use auction service to handle auto-selection
      const autoSelectionResult = await this.auctionService.handleAutoSelection(auctionId);
      if (!autoSelectionResult) {
        return null;
      }

      // Process the automatically selected winner
      const winnerSelectionRequest: AuctionWinnerSelectionRequest = {
        auctionId,
        proposalId: autoSelectionResult.winningProposal.id,
        userId: auction.ownerId,
      };

      return await this.selectAuctionWinner(winnerSelectionRequest);
    } catch (error) {
      logger.error('Failed to handle automatic winner selection', { error, auctionId });
      throw error;
    }
  }

  /**
   * Get enhanced swap response options
   */
  async getSwapResponseOptions(swapId: string, userId: string): Promise<{
    canAcceptDirectly: boolean;
    canRejectDirectly: boolean;
    requiresAuctionWinnerSelection: boolean;
    auctionId?: string;
    auctionStatus?: string;
    proposalCount?: number;
    auctionEndDate?: Date;
  }> {
    try {
      const swap = await this.swapRepository.findEnhancedById(swapId);
      if (!swap) {
        throw new Error('Swap not found');
      }

      if (swap.ownerId !== userId) {
        throw new Error('Only the swap owner can view response options');
      }

      // Check if this is an auction swap
      const auction = await this.auctionRepository.findBySwapId(swapId);

      if (!auction) {
        // Regular first-match swap
        return {
          canAcceptDirectly: swap.status === 'pending',
          canRejectDirectly: swap.status === 'pending',
          requiresAuctionWinnerSelection: false,
        };
      }

      // Auction swap
      return {
        canAcceptDirectly: false,
        canRejectDirectly: false,
        requiresAuctionWinnerSelection: auction.status === 'ended' && !auction.winningProposalId,
        auctionId: auction.id,
        auctionStatus: auction.status,
        proposalCount: auction.proposals.length,
        auctionEndDate: auction.settings.endDate,
      };
    } catch (error) {
      logger.error('Failed to get swap response options', { error, swapId, userId });
      throw error;
    }
  }

  /**
   * Process proposal acceptance using ProposalAcceptanceService
   * Requirements: 1.1, 1.2
   */
  async processProposalAcceptance(request: EnhancedSwapResponseRequest): Promise<SwapResponseResult> {
    try {
      logger.info('Processing proposal acceptance', {
        swapId: request.swapId,
        proposalId: request.proposalId,
        userId: request.userId,
      });

      if (!request.proposalId) {
        throw new Error('Proposal ID is required for proposal acceptance');
      }

      // Use ProposalAcceptanceService for proposal-specific logic
      const acceptanceResult = await this.proposalAcceptanceService.acceptProposal({
        proposalId: request.proposalId,
        userId: request.userId,
        action: 'accept'
      });

      // Get the swap for the response
      const swap = acceptanceResult.swap || await this.swapRepository.findById(request.swapId);
      if (!swap) {
        throw new Error('Swap not found');
      }

      // Convert to SwapResponseResult format for backward compatibility
      return {
        swap,
        blockchainTransaction: acceptanceResult.blockchainTransaction
      };
    } catch (error) {
      logger.error('Failed to process proposal acceptance', { error, request });
      throw error;
    }
  }

  /**
   * Process proposal rejection using ProposalAcceptanceService
   * Requirements: 2.1, 2.2
   */
  async processProposalRejection(request: EnhancedSwapResponseRequest & { rejectionReason?: string }): Promise<SwapResponseResult> {
    try {
      logger.info('Processing proposal rejection', {
        swapId: request.swapId,
        proposalId: request.proposalId,
        userId: request.userId,
        reason: request.rejectionReason
      });

      if (!request.proposalId) {
        throw new Error('Proposal ID is required for proposal rejection');
      }

      // Use ProposalAcceptanceService for proposal-specific logic
      const rejectionResult = await this.proposalAcceptanceService.rejectProposal({
        proposalId: request.proposalId,
        userId: request.userId,
        action: 'reject',
        rejectionReason: request.rejectionReason
      });

      // Get the swap for the response
      const swap = await this.swapRepository.findById(request.swapId);
      if (!swap) {
        throw new Error('Swap not found');
      }

      // Convert to SwapResponseResult format for backward compatibility
      return {
        swap,
        blockchainTransaction: rejectionResult.blockchainTransaction
      };
    } catch (error) {
      logger.error('Failed to process proposal rejection', { error, request });
      throw error;
    }
  }

  /**
   * Handle financial proposal processing with automatic payment
   * Requirements: 3.1
   */
  async handleFinancialProposal(proposal: SwapProposal): Promise<{
    paymentTransaction?: any;
    transferCompleted: boolean;
    fees?: {
      platformFee: number;
      processingFee: number;
      totalFees: number;
      netAmount: number;
    };
  }> {
    try {
      logger.info('Handling financial proposal', {
        proposalId: proposal.id,
        amount: proposal.cashOffer?.amount,
        currency: proposal.cashOffer?.currency,
        proposalType: proposal.proposalType
      });

      if (proposal.proposalType !== 'cash' || !proposal.cashOffer) {
        return {
          transferCompleted: false
        };
      }

      // Process financial transfer using ProposalAcceptanceService
      const transferResult = await this.proposalAcceptanceService.processFinancialTransfer({
        proposal,
        securityContext: {
          userId: proposal.targetUserId,
          ipAddress: '0.0.0.0', // Would be provided by request context
          deviceFingerprint: undefined,
          previousTransactions: 0,
          accountAge: 30
        }
      });

      logger.info('Financial proposal processed successfully', {
        proposalId: proposal.id,
        transactionId: transferResult.paymentTransaction.id,
        netAmount: transferResult.fees.netAmount,
        escrowReleased: transferResult.escrowReleased
      });

      return {
        paymentTransaction: transferResult.paymentTransaction,
        transferCompleted: true,
        fees: transferResult.fees
      };
    } catch (error) {
      logger.error('Failed to handle financial proposal', { error, proposalId: proposal.id });
      throw error;
    }
  }
}