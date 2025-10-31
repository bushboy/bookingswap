import { HederaService, TransactionData } from './HederaService';
import { AuctionSettings, CashOffer } from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { DateValidator } from '../../utils/DateValidator';
import { AuctionCreationError } from '../../utils/AuctionErrors';

export interface AuctionCreationData {
  auctionId: string;
  swapId: string;
  ownerId: string;
  settings: AuctionSettings;
}

export interface AuctionProposalData {
  proposalId: string;
  auctionId: string;
  proposerId: string;
  proposalType: 'booking' | 'cash';
  bookingId?: string;
  cashOffer?: CashOffer;
  message?: string;
  conditions: string[];
}

export interface AuctionCompletionData {
  auctionId: string;
  winningProposalId?: string;
  endedAt: Date;
  totalProposals: number;
  completionReason: 'owner_selection' | 'auto_selection' | 'timeout' | 'cancelled';
}

export interface AuctionCancellationData {
  auctionId: string;
  reason: string;
  cancelledBy: string;
  cancelledAt: Date;
}

/**
 * Extension of HederaService with auction-specific blockchain operations
 */
export class AuctionHederaExtensions {
  constructor(private hederaService: HederaService) { }

  /**
   * Record auction creation on blockchain
   */
  async recordAuctionCreation(data: AuctionCreationData): Promise<string> {
    try {
      logger.info('Recording auction creation on blockchain', {
        auctionId: data.auctionId,
        swapId: data.swapId,
        ownerId: data.ownerId,
        originalEndDate: data.settings.endDate,
        endDateType: typeof data.settings.endDate,
        endDateIsDate: data.settings.endDate instanceof Date
      });

      // Validate and convert endDate to ensure it's a proper Date object
      let validatedEndDate: Date;
      try {
        validatedEndDate = DateValidator.validateAndConvertDate(
          data.settings.endDate,
          'auction endDate'
        );

        // Additional validation for auction timing
        DateValidator.validateFutureDate(validatedEndDate, 'auction endDate');

        logger.info('Date validation successful', {
          auctionId: data.auctionId,
          originalValue: data.settings.endDate,
          originalType: typeof data.settings.endDate,
          validatedDate: validatedEndDate.toISOString(),
          validationPassed: true
        });
      } catch (dateError) {
        logger.error('Date validation failed during auction creation', {
          auctionId: data.auctionId,
          swapId: data.swapId,
          originalEndDate: data.settings.endDate,
          endDateType: typeof data.settings.endDate,
          endDateValue: data.settings.endDate,
          validationError: dateError instanceof Error ? dateError.message : dateError,
          stack: dateError instanceof Error ? dateError.stack : undefined
        });

        // Wrap date validation errors with auction context
        if (dateError instanceof Error) {
          throw AuctionCreationError.forBlockchainRecording(
            `Date validation failed: ${dateError.message}`,
            data.auctionId,
            data.swapId,
            dateError,
            {
              operation: 'date_validation',
              metadata: {
                originalEndDate: data.settings.endDate,
                endDateType: typeof data.settings.endDate,
                timestamp: new Date().toISOString()
              }
            }
          );
        }
        throw dateError;
      }

      const transactionData: TransactionData = {
        type: 'auction_created',
        payload: {
          auctionId: data.auctionId,
          swapId: data.swapId,
          ownerId: data.ownerId,
          settings: {
            endDate: validatedEndDate.toISOString(), // Now guaranteed to work
            allowBookingProposals: data.settings.allowBookingProposals,
            allowCashProposals: data.settings.allowCashProposals,
            minimumCashOffer: data.settings.minimumCashOffer,
            autoSelectAfterHours: data.settings.autoSelectAfterHours
          },
          metadata: {
            auctionType: 'swap_auction',
            status: 'active',
            createdAt: new Date().toISOString(),
            dateValidationPassed: true,
            originalEndDateType: typeof data.settings.endDate
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);

      logger.info('Auction creation recorded on blockchain', {
        auctionId: data.auctionId,
        swapId: data.swapId,
        transactionId: result.transactionId,
        endDate: validatedEndDate.toISOString(),
        dateValidationSuccess: true
      });

      return result.transactionId;
    } catch (error) {
      // Enhanced error logging with comprehensive context
      logger.error('Failed to record auction creation on blockchain', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        data: {
          auctionId: data.auctionId,
          swapId: data.swapId,
          ownerId: data.ownerId,
          endDateValue: data.settings.endDate,
          endDateType: typeof data.settings.endDate,
          endDateIsDate: data.settings.endDate instanceof Date,
          allowBookingProposals: data.settings.allowBookingProposals,
          allowCashProposals: data.settings.allowCashProposals,
          minimumCashOffer: data.settings.minimumCashOffer,
          autoSelectAfterHours: data.settings.autoSelectAfterHours
        },
        context: {
          operation: 'blockchain_recording',
          timestamp: new Date().toISOString(),
          phase: 'auction_creation'
        }
      });

      // If it's already an AuctionCreationError, just re-throw
      if (error instanceof AuctionCreationError) {
        throw error;
      }

      // Wrap other errors with auction context
      throw AuctionCreationError.forBlockchainRecording(
        error instanceof Error ? error.message : 'Unknown blockchain recording error',
        data.auctionId,
        data.swapId,
        error instanceof Error ? error : undefined,
        {
          operation: 'blockchain_recording',
          metadata: {
            originalEndDate: data.settings.endDate,
            endDateType: typeof data.settings.endDate,
            timestamp: new Date().toISOString()
          }
        }
      );
    }
  }

  /**
   * Record auction proposal submission on blockchain
   */
  async recordAuctionProposal(data: AuctionProposalData): Promise<string> {
    try {
      logger.info('Recording auction proposal on blockchain', {
        proposalId: data.proposalId,
        auctionId: data.auctionId
      });

      const transactionData: TransactionData = {
        type: 'auction_proposal_submitted',
        payload: {
          proposalId: data.proposalId,
          auctionId: data.auctionId,
          proposerId: data.proposerId,
          proposalType: data.proposalType,
          bookingId: data.bookingId,
          cashOffer: data.cashOffer ? {
            amount: data.cashOffer.amount,
            currency: data.cashOffer.currency,
            paymentMethodId: data.cashOffer.paymentMethodId,
            escrowRequired: data.cashOffer.escrowRequired
          } : undefined,
          message: data.message,
          conditions: data.conditions,
          metadata: {
            proposalType: data.proposalType,
            status: 'pending',
            submittedAt: new Date().toISOString()
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);

      logger.info('Auction proposal recorded on blockchain', {
        proposalId: data.proposalId,
        auctionId: data.auctionId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record auction proposal on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record auction completion and winner selection on blockchain
   */
  async recordAuctionCompletion(data: AuctionCompletionData): Promise<string> {
    try {
      logger.info('Recording auction completion on blockchain', {
        auctionId: data.auctionId,
        winningProposalId: data.winningProposalId,
        originalEndedAt: data.endedAt,
        endedAtType: typeof data.endedAt
      });

      // Validate and convert endedAt to ensure it's a proper Date object
      let validatedEndedAt: Date;
      try {
        validatedEndedAt = DateValidator.validateAndConvertDate(
          data.endedAt,
          'auction endedAt'
        );

        logger.info('Date validation successful for auction completion', {
          auctionId: data.auctionId,
          originalValue: data.endedAt,
          originalType: typeof data.endedAt,
          validatedDate: validatedEndedAt.toISOString()
        });
      } catch (dateError) {
        logger.error('Date validation failed during auction completion recording', {
          auctionId: data.auctionId,
          originalEndedAt: data.endedAt,
          endedAtType: typeof data.endedAt,
          validationError: dateError instanceof Error ? dateError.message : dateError,
          stack: dateError instanceof Error ? dateError.stack : undefined
        });

        throw AuctionCreationError.forBlockchainRecording(
          `Date validation failed for auction completion: ${dateError instanceof Error ? dateError.message : 'Unknown error'}`,
          data.auctionId,
          undefined,
          dateError instanceof Error ? dateError : undefined,
          {
            operation: 'completion_date_validation',
            metadata: {
              originalEndedAt: data.endedAt,
              endedAtType: typeof data.endedAt,
              timestamp: new Date().toISOString()
            }
          }
        );
      }

      const transactionData: TransactionData = {
        type: 'auction_ended',
        payload: {
          auctionId: data.auctionId,
          winningProposalId: data.winningProposalId,
          endedAt: validatedEndedAt.toISOString(), // Now guaranteed to work
          totalProposals: data.totalProposals,
          completionReason: data.completionReason,
          metadata: {
            auctionType: 'swap_auction',
            status: 'ended',
            hasWinner: !!data.winningProposalId,
            dateValidationPassed: true
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);

      logger.info('Auction completion recorded on blockchain', {
        auctionId: data.auctionId,
        winningProposalId: data.winningProposalId,
        transactionId: result.transactionId,
        endedAt: validatedEndedAt.toISOString()
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record auction completion on blockchain', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        data: {
          auctionId: data.auctionId,
          winningProposalId: data.winningProposalId,
          endedAtValue: data.endedAt,
          endedAtType: typeof data.endedAt,
          totalProposals: data.totalProposals,
          completionReason: data.completionReason
        }
      });

      if (error instanceof AuctionCreationError) {
        throw error;
      }

      throw AuctionCreationError.forBlockchainRecording(
        error instanceof Error ? error.message : 'Unknown blockchain recording error',
        data.auctionId,
        undefined,
        error instanceof Error ? error : undefined,
        {
          operation: 'auction_completion_recording',
          metadata: {
            originalEndedAt: data.endedAt,
            endedAtType: typeof data.endedAt,
            timestamp: new Date().toISOString()
          }
        }
      );
    }
  }

  /**
   * Record auction winner selection on blockchain
   */
  async recordWinnerSelection(auctionId: string, winningProposalId: string, selectedBy: string): Promise<string> {
    try {
      logger.info('Recording auction winner selection on blockchain', {
        auctionId,
        winningProposalId
      });

      const transactionData: TransactionData = {
        type: 'auction_winner_selected',
        payload: {
          auctionId,
          winningProposalId,
          selectedBy,
          selectedAt: new Date().toISOString(),
          metadata: {
            selectionType: 'manual',
            status: 'winner_selected'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);

      logger.info('Auction winner selection recorded on blockchain', {
        auctionId,
        winningProposalId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record auction winner selection on blockchain', { error, auctionId });
      throw error;
    }
  }

  /**
   * Record auction cancellation on blockchain
   */
  async recordAuctionCancellation(data: AuctionCancellationData): Promise<string> {
    try {
      logger.info('Recording auction cancellation on blockchain', {
        auctionId: data.auctionId,
        cancelledBy: data.cancelledBy,
        originalCancelledAt: data.cancelledAt,
        cancelledAtType: typeof data.cancelledAt
      });

      // Validate and convert cancelledAt to ensure it's a proper Date object
      let validatedCancelledAt: Date;
      try {
        validatedCancelledAt = DateValidator.validateAndConvertDate(
          data.cancelledAt,
          'auction cancelledAt'
        );

        logger.info('Date validation successful for auction cancellation', {
          auctionId: data.auctionId,
          originalValue: data.cancelledAt,
          originalType: typeof data.cancelledAt,
          validatedDate: validatedCancelledAt.toISOString()
        });
      } catch (dateError) {
        logger.error('Date validation failed during auction cancellation recording', {
          auctionId: data.auctionId,
          originalCancelledAt: data.cancelledAt,
          cancelledAtType: typeof data.cancelledAt,
          validationError: dateError instanceof Error ? dateError.message : dateError,
          stack: dateError instanceof Error ? dateError.stack : undefined
        });

        throw AuctionCreationError.forBlockchainRecording(
          `Date validation failed for auction cancellation: ${dateError instanceof Error ? dateError.message : 'Unknown error'}`,
          data.auctionId,
          undefined,
          dateError instanceof Error ? dateError : undefined,
          {
            operation: 'cancellation_date_validation',
            metadata: {
              originalCancelledAt: data.cancelledAt,
              cancelledAtType: typeof data.cancelledAt,
              timestamp: new Date().toISOString()
            }
          }
        );
      }

      const transactionData: TransactionData = {
        type: 'auction_cancelled',
        payload: {
          auctionId: data.auctionId,
          reason: data.reason,
          cancelledBy: data.cancelledBy,
          cancelledAt: validatedCancelledAt.toISOString(), // Now guaranteed to work
          metadata: {
            auctionType: 'swap_auction',
            status: 'cancelled',
            dateValidationPassed: true
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);

      logger.info('Auction cancellation recorded on blockchain', {
        auctionId: data.auctionId,
        transactionId: result.transactionId,
        cancelledAt: validatedCancelledAt.toISOString()
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record auction cancellation on blockchain', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        data: {
          auctionId: data.auctionId,
          reason: data.reason,
          cancelledBy: data.cancelledBy,
          cancelledAtValue: data.cancelledAt,
          cancelledAtType: typeof data.cancelledAt
        }
      });

      if (error instanceof AuctionCreationError) {
        throw error;
      }

      throw AuctionCreationError.forBlockchainRecording(
        error instanceof Error ? error.message : 'Unknown blockchain recording error',
        data.auctionId,
        undefined,
        error instanceof Error ? error : undefined,
        {
          operation: 'auction_cancellation_recording',
          metadata: {
            originalCancelledAt: data.cancelledAt,
            cancelledAtType: typeof data.cancelledAt,
            timestamp: new Date().toISOString()
          }
        }
      );
    }
  }

  /**
   * Record auction timeout event on blockchain
   */
  async recordAuctionTimeout(auctionId: string, autoSelectedProposalId?: string): Promise<string> {
    try {
      logger.info('Recording auction timeout on blockchain', {
        auctionId,
        autoSelectedProposalId
      });

      const transactionData: TransactionData = {
        type: 'auction_ended',
        payload: {
          auctionId,
          winningProposalId: autoSelectedProposalId,
          endedAt: new Date().toISOString(),
          completionReason: 'timeout',
          metadata: {
            auctionType: 'swap_auction',
            status: 'ended',
            selectionType: autoSelectedProposalId ? 'auto_selection' : 'timeout_no_selection',
            timeoutAt: new Date().toISOString()
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);

      logger.info('Auction timeout recorded on blockchain', {
        auctionId,
        autoSelectedProposalId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record auction timeout on blockchain', { error, auctionId });
      throw error;
    }
  }

  /**
   * Record auction conversion to first-match mode on blockchain
   */
  async recordAuctionConversion(auctionId: string, reason: string): Promise<string> {
    try {
      logger.info('Recording auction conversion on blockchain', { auctionId, reason });

      const transactionData: TransactionData = {
        type: 'auction_converted_to_first_match',
        payload: {
          auctionId,
          reason,
          convertedAt: new Date().toISOString(),
          metadata: {
            auctionType: 'swap_auction',
            status: 'converted',
            newMode: 'first_match'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);

      logger.info('Auction conversion recorded on blockchain', {
        auctionId,
        reason,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record auction conversion on blockchain', { error, auctionId });
      throw error;
    }
  }

  /**
   * Record proposal rejection on blockchain
   */
  async recordProposalRejection(proposalId: string, auctionId: string, reason: string): Promise<string> {
    try {
      logger.info('Recording proposal rejection on blockchain', { proposalId, auctionId });

      const transactionData: TransactionData = {
        type: 'auction_proposals_rejected',
        payload: {
          proposalId,
          auctionId,
          reason,
          rejectedAt: new Date().toISOString(),
          metadata: {
            proposalStatus: 'rejected',
            rejectionType: 'manual'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);

      logger.info('Proposal rejection recorded on blockchain', {
        proposalId,
        auctionId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record proposal rejection on blockchain', { error, proposalId });
      throw error;
    }
  }
}