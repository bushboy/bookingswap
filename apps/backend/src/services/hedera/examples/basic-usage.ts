/**
 * Basic usage examples for Hedera blockchain integration
 * 
 * This file demonstrates how to use the HederaService and WalletService
 * for common blockchain operations in the booking swap platform.
 */

import { getHederaService, WalletService, TransactionData } from '../index';
import { logger } from '../../../utils/logger';

/**
 * Example: Submit a booking listing to Hedera Consensus Service
 */
export async function submitBookingListing(bookingData: any): Promise<string> {
  try {
    const hederaService = getHederaService();
    
    const transactionData: TransactionData = {
      type: 'booking_listing',
      payload: {
        bookingId: bookingData.id,
        userId: bookingData.userId,
        title: bookingData.title,
        location: bookingData.location,
        dateRange: bookingData.dateRange,
        swapValue: bookingData.swapValue,
      },
      timestamp: new Date(),
    };

    const result = await hederaService.submitTransaction(transactionData);
    
    logger.info('Booking listing submitted to blockchain', {
      bookingId: bookingData.id,
      transactionId: result.transactionId,
      consensusTimestamp: result.consensusTimestamp,
    });

    return result.transactionId;
  } catch (error) {
    logger.error('Failed to submit booking listing', { error, bookingData });
    throw error;
  }
}

/**
 * Example: Submit a swap proposal to Hedera Consensus Service
 */
export async function submitSwapProposal(swapData: any): Promise<string> {
  try {
    const hederaService = getHederaService();
    
    const transactionData: TransactionData = {
      type: 'swap_proposal',
      payload: {
        swapId: swapData.id,
        sourceBookingId: swapData.sourceBookingId,
        targetBookingId: swapData.targetBookingId,
        proposerId: swapData.proposerId,
        ownerId: swapData.ownerId,
        terms: swapData.terms,
      },
      timestamp: new Date(),
    };

    const result = await hederaService.submitTransaction(transactionData);
    
    logger.info('Swap proposal submitted to blockchain', {
      swapId: swapData.id,
      transactionId: result.transactionId,
      consensusTimestamp: result.consensusTimestamp,
    });

    return result.transactionId;
  } catch (error) {
    logger.error('Failed to submit swap proposal', { error, swapData });
    throw error;
  }
}

/**
 * Example: Execute a completed swap on blockchain
 */
export async function executeSwap(swapData: any): Promise<string> {
  try {
    const hederaService = getHederaService();
    
    const transactionData: TransactionData = {
      type: 'swap_execution',
      payload: {
        swapId: swapData.id,
        sourceBookingId: swapData.sourceBookingId,
        targetBookingId: swapData.targetBookingId,
        executedAt: new Date(),
        finalTerms: swapData.terms,
      },
      timestamp: new Date(),
    };

    const result = await hederaService.submitTransaction(transactionData);
    
    logger.info('Swap execution recorded on blockchain', {
      swapId: swapData.id,
      transactionId: result.transactionId,
      consensusTimestamp: result.consensusTimestamp,
    });

    return result.transactionId;
  } catch (error) {
    logger.error('Failed to execute swap on blockchain', { error, swapData });
    throw error;
  }
}

/**
 * Example: Verify wallet signature for user authentication
 */
export function authenticateUser(
  message: string,
  signature: string,
  publicKey: string
): { isAuthenticated: boolean; accountId: string } {
  try {
    const verification = WalletService.verifySignature(message, signature, publicKey);
    
    if (verification.isValid) {
      logger.info('User authenticated successfully', {
        accountId: verification.accountId,
      });
      
      return {
        isAuthenticated: true,
        accountId: verification.accountId,
      };
    } else {
      logger.warn('User authentication failed - invalid signature', {
        publicKey,
      });
      
      return {
        isAuthenticated: false,
        accountId: '',
      };
    }
  } catch (error) {
    logger.error('User authentication error', { error, publicKey });
    return {
      isAuthenticated: false,
      accountId: '',
    };
  }
}

/**
 * Example: Generate authentication challenge for wallet connection
 */
export function generateWalletChallenge(accountId: string): string {
  try {
    if (!WalletService.isValidAccountId(accountId)) {
      throw new Error('Invalid account ID format');
    }

    const challenge = WalletService.generateAuthChallenge(accountId);
    
    logger.info('Wallet authentication challenge generated', { accountId });
    
    return challenge;
  } catch (error) {
    logger.error('Failed to generate wallet challenge', { error, accountId });
    throw error;
  }
}

/**
 * Example: Check account balance before performing operations
 */
export async function checkAccountBalance(accountId?: string): Promise<string> {
  try {
    const hederaService = getHederaService();
    const balance = await hederaService.getAccountBalance(accountId);
    
    logger.info('Account balance retrieved', {
      accountId: accountId || 'operator',
      balance: balance.toString(),
    });

    return balance.toString();
  } catch (error) {
    logger.error('Failed to check account balance', { error, accountId });
    throw error;
  }
}

/**
 * Example: Create a new topic for a specific booking category
 */
export async function createBookingTopic(category: string): Promise<string> {
  try {
    const hederaService = getHederaService();
    const memo = `Booking Swap Platform - ${category} bookings`;
    
    const topicId = await hederaService.createTopic(memo);
    
    logger.info('New booking topic created', {
      category,
      topicId,
      memo,
    });

    return topicId;
  } catch (error) {
    logger.error('Failed to create booking topic', { error, category });
    throw error;
  }
}