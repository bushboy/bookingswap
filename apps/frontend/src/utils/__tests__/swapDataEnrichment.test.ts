/**
 * Tests for Swap Data Enrichment Utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  enrichSwapInfo,
  calculateUrgency,
  determineNextAction,
  generateStatusSummary,
  formatTimeRemaining,
  formatProposalCount,
  formatPaymentTypes,
  formatCashRange,
  calculateActivityIndicators,
  getUrgencyStyles,
  validateSwapInfoCompleteness,
  EnhancedSwapInfo
} from '../swapDataEnrichment';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

describe('swapDataEnrichment', () => {
  let mockSwapInfo: SwapInfo;
  let currentTime: Date;

  beforeEach(() => {
    currentTime = new Date('2024-01-15T12:00:00Z');
    mockSwapInfo = {
      swapId: 'swap-123',
      paymentTypes: ['booking', 'cash'],
      acceptanceStrategy: 'first-match',
      minCashAmount: 100,
      maxCashAmount: 500,
      hasActiveProposals: false,
      activeProposalCount: 0,
      swapConditions: ['Must be similar location', 'Same dates preferred']
    };
  });

  describe('enrichSwapInfo', () => {
    it('should enrich swap info with all computed fields', () => {
      const result = enrichSwapInfo(mockSwapInfo, 'browser', currentTime);

      expect(result).toMatchObject({
        ...mockSwapInfo,
        isUrgent: false,
        urgencyLevel: 'low',
        statusSummary: 'Available for proposals',
        statusIcon: '✨',
        statusType: 'available',
        proposalCountDisplay: 'No proposals yet',
        paymentTypesDisplay: 'Booking exchanges & cash offers',
        cashRangeDisplay: '$100 - $500',
        hasRecentActivity: false,
        requiresAttention: false
      });
    });

    it('should handle auction mode with time remaining', () => {
      const auctionSwap: SwapInfo = {
        ...mockSwapInfo,
        acceptanceStrategy: 'auction',
        auctionEndDate: new Date('2024-01-15T14:00:00Z'),
        timeRemaining: 2 * 60 * 60 * 1000 // 2 hours
      };

      const result = enrichSwapInfo(auctionSwap, 'browser', currentTime);

      expect(result.isUrgent).toBe(true);
      expect(result.urgencyLevel).toBe('critical');
      expect(result.statusSummary).toBe('Auction ending very soon!');
      expect(result.timeRemainingDisplay).toBe('2h');
      expect(result.nextAction).toBe('Bid Now - Ending Soon!');
    });

    it('should handle owner role with active proposals', () => {
      const swapWithProposals: SwapInfo = {
        ...mockSwapInfo,
        hasActiveProposals: true,
        activeProposalCount: 3
      };

      const result = enrichSwapInfo(swapWithProposals, 'owner', currentTime);

      expect(result.nextAction).toBe('Review Proposals');
      expect(result.nextActionType).toBe('primary');
      expect(result.proposalCountDisplay).toBe('3 proposals');
      expect(result.requiresAttention).toBe(true);
    });
  });

  describe('calculateUrgency', () => {
    it('should return low urgency when no time remaining', () => {
      const result = calculateUrgency(mockSwapInfo, currentTime);

      expect(result).toEqual({
        isUrgent: false,
        level: 'low'
      });
    });

    it('should return critical urgency for less than 2 hours', () => {
      const urgentSwap: SwapInfo = {
        ...mockSwapInfo,
        timeRemaining: 1 * 60 * 60 * 1000 // 1 hour
      };

      const result = calculateUrgency(urgentSwap, currentTime);

      expect(result).toEqual({
        isUrgent: true,
        level: 'critical',
        reason: 'Auction ending in less than 2 hours'
      });
    });

    it('should return high urgency for less than 24 hours', () => {
      const urgentSwap: SwapInfo = {
        ...mockSwapInfo,
        timeRemaining: 12 * 60 * 60 * 1000 // 12 hours
      };

      const result = calculateUrgency(urgentSwap, currentTime);

      expect(result).toEqual({
        isUrgent: true,
        level: 'high',
        reason: 'Auction ending within 24 hours'
      });
    });

    it('should return normal urgency for less than 7 days', () => {
      const urgentSwap: SwapInfo = {
        ...mockSwapInfo,
        timeRemaining: 3 * 24 * 60 * 60 * 1000 // 3 days
      };

      const result = calculateUrgency(urgentSwap, currentTime);

      expect(result).toEqual({
        isUrgent: true,
        level: 'normal',
        reason: 'Auction ending within a week'
      });
    });
  });

  describe('determineNextAction', () => {
    it('should return review proposals for owner with active proposals', () => {
      const swapWithProposals: SwapInfo = {
        ...mockSwapInfo,
        hasActiveProposals: true,
        activeProposalCount: 2
      };

      const result = determineNextAction(swapWithProposals, 'owner');

      expect(result).toEqual({
        action: 'Review Proposals',
        type: 'primary',
        icon: '👀'
      });
    });

    it('should return urgent bid action for browser in critical auction', () => {
      const criticalAuction: SwapInfo = {
        ...mockSwapInfo,
        acceptanceStrategy: 'auction',
        timeRemaining: 1 * 60 * 60 * 1000 // 1 hour
      };

      const result = determineNextAction(criticalAuction, 'browser');

      expect(result).toEqual({
        action: 'Bid Now - Ending Soon!',
        type: 'warning',
        icon: '🔥'
      });
    });

    it('should return view proposal for proposer with pending status', () => {
      const swapWithPendingProposal: SwapInfo = {
        ...mockSwapInfo,
        userProposalStatus: 'pending'
      };

      const result = determineNextAction(swapWithPendingProposal, 'proposer');

      expect(result).toEqual({
        action: 'View Your Proposal',
        type: 'secondary',
        icon: '📄'
      });
    });

    it('should return complete exchange for accepted proposer', () => {
      const acceptedSwap: SwapInfo = {
        ...mockSwapInfo,
        userProposalStatus: 'accepted'
      };

      const result = determineNextAction(acceptedSwap, 'proposer');

      expect(result).toEqual({
        action: 'Complete Exchange',
        type: 'primary',
        icon: '✅'
      });
    });
  });

  describe('generateStatusSummary', () => {
    it('should return expired status for ended auction', () => {
      const expiredAuction: SwapInfo = {
        ...mockSwapInfo,
        acceptanceStrategy: 'auction',
        timeRemaining: -1000 // Expired
      };

      const result = generateStatusSummary(expiredAuction, currentTime);

      expect(result).toEqual({
        summary: 'Auction has ended',
        icon: '🏁',
        type: 'expired'
      });
    });

    it('should return active status with urgency for critical auction', () => {
      const criticalAuction: SwapInfo = {
        ...mockSwapInfo,
        acceptanceStrategy: 'auction',
        timeRemaining: 1 * 60 * 60 * 1000 // 1 hour
      };

      const result = generateStatusSummary(criticalAuction, currentTime);

      expect(result).toEqual({
        summary: 'Auction ending very soon!',
        icon: '🔥',
        type: 'active'
      });
    });

    it('should return pending status for active proposals', () => {
      const swapWithProposals: SwapInfo = {
        ...mockSwapInfo,
        hasActiveProposals: true,
        activeProposalCount: 1
      };

      const result = generateStatusSummary(swapWithProposals, currentTime);

      expect(result).toEqual({
        summary: '1 active proposal',
        icon: '📬',
        type: 'pending'
      });
    });

    it('should return available status for no proposals', () => {
      const result = generateStatusSummary(mockSwapInfo, currentTime);

      expect(result).toEqual({
        summary: 'Available for proposals',
        icon: '✨',
        type: 'available'
      });
    });
  });

  describe('formatTimeRemaining', () => {
    it('should return undefined for no time remaining', () => {
      expect(formatTimeRemaining()).toBeUndefined();
      expect(formatTimeRemaining(0)).toBeUndefined();
      expect(formatTimeRemaining(-1000)).toBeUndefined();
    });

    it('should format days and hours', () => {
      const threeDaysAndFiveHours = 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000;
      expect(formatTimeRemaining(threeDaysAndFiveHours)).toBe('3d 5h');
    });

    it('should format days only when no remaining hours', () => {
      const exactlyTwoDays = 2 * 24 * 60 * 60 * 1000;
      expect(formatTimeRemaining(exactlyTwoDays)).toBe('2d');
    });

    it('should format hours and minutes for less than 6 hours', () => {
      const twoHoursThirtyMinutes = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
      expect(formatTimeRemaining(twoHoursThirtyMinutes)).toBe('2h 30m');
    });

    it('should format hours only for more than 6 hours', () => {
      const eightHours = 8 * 60 * 60 * 1000;
      expect(formatTimeRemaining(eightHours)).toBe('8h');
    });

    it('should format minutes', () => {
      const thirtyMinutes = 30 * 60 * 1000;
      expect(formatTimeRemaining(thirtyMinutes)).toBe('30m');
    });

    it('should handle less than one minute', () => {
      const thirtySeconds = 30 * 1000;
      expect(formatTimeRemaining(thirtySeconds)).toBe('Less than 1 minute');
    });
  });

  describe('formatProposalCount', () => {
    it('should format zero proposals', () => {
      expect(formatProposalCount(0)).toBe('No proposals yet');
    });

    it('should format single proposal', () => {
      expect(formatProposalCount(1)).toBe('1 proposal');
    });

    it('should format multiple proposals', () => {
      expect(formatProposalCount(5)).toBe('5 proposals');
    });
  });

  describe('formatPaymentTypes', () => {
    it('should handle empty payment types', () => {
      expect(formatPaymentTypes([])).toBe('No payment types specified');
    });

    it('should format booking only', () => {
      expect(formatPaymentTypes(['booking'])).toBe('Booking exchanges only');
    });

    it('should format cash only', () => {
      expect(formatPaymentTypes(['cash'])).toBe('Cash offers only');
    });

    it('should format both payment types', () => {
      expect(formatPaymentTypes(['booking', 'cash'])).toBe('Booking exchanges & cash offers');
    });
  });

  describe('formatCashRange', () => {
    it('should return undefined for no amounts', () => {
      expect(formatCashRange()).toBeUndefined();
    });

    it('should format single amount when min equals max', () => {
      expect(formatCashRange(100, 100)).toBe('$100');
    });

    it('should format range when min and max differ', () => {
      expect(formatCashRange(100, 500)).toBe('$100 - $500');
    });

    it('should format minimum only', () => {
      expect(formatCashRange(100)).toBe('$100 minimum');
    });

    it('should format maximum only', () => {
      expect(formatCashRange(undefined, 500)).toBe('Up to $500');
    });

    it('should format large numbers with commas', () => {
      expect(formatCashRange(1000, 5000)).toBe('$1,000 - $5,000');
    });
  });

  describe('calculateActivityIndicators', () => {
    it('should indicate no recent activity for basic swap', () => {
      const result = calculateActivityIndicators(mockSwapInfo, 'browser');

      expect(result).toEqual({
        hasRecentActivity: false,
        summary: 'Available for proposals',
        requiresAttention: false
      });
    });

    it('should indicate recent activity for auction', () => {
      const auctionSwap: SwapInfo = {
        ...mockSwapInfo,
        acceptanceStrategy: 'auction',
        timeRemaining: 24 * 60 * 60 * 1000 // 24 hours
      };

      const result = calculateActivityIndicators(auctionSwap, 'browser');

      expect(result).toEqual({
        hasRecentActivity: true,
        summary: 'Auction ending soon!', // 24 hours is considered "high" urgency
        requiresAttention: false
      });
    });

    it('should require attention for owner with proposals', () => {
      const swapWithProposals: SwapInfo = {
        ...mockSwapInfo,
        hasActiveProposals: true,
        activeProposalCount: 2
      };

      const result = calculateActivityIndicators(swapWithProposals, 'owner');

      expect(result).toEqual({
        hasRecentActivity: true,
        summary: '2 proposals waiting for review',
        requiresAttention: true
      });
    });

    it('should require attention for accepted proposer', () => {
      const acceptedSwap: SwapInfo = {
        ...mockSwapInfo,
        userProposalStatus: 'accepted'
      };

      const result = calculateActivityIndicators(acceptedSwap, 'proposer');

      expect(result).toEqual({
        hasRecentActivity: false,
        summary: 'Your proposal was accepted!',
        requiresAttention: true
      });
    });
  });

  describe('getUrgencyStyles', () => {
    it('should return critical styles', () => {
      const result = getUrgencyStyles('critical');
      expect(result).toEqual({
        backgroundColor: '#fef2f2',
        borderColor: '#ef4444',
        textColor: '#dc2626'
      });
    });

    it('should return high urgency styles', () => {
      const result = getUrgencyStyles('high');
      expect(result).toEqual({
        backgroundColor: '#fffbeb',
        borderColor: '#f59e0b',
        textColor: '#d97706'
      });
    });

    it('should return normal urgency styles', () => {
      const result = getUrgencyStyles('normal');
      expect(result).toEqual({
        backgroundColor: '#f0f9ff',
        borderColor: '#3b82f6',
        textColor: '#2563eb'
      });
    });

    it('should return low urgency styles', () => {
      const result = getUrgencyStyles('low');
      expect(result).toEqual({
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        textColor: '#64748b'
      });
    });
  });

  describe('validateSwapInfoCompleteness', () => {
    it('should validate complete swap info', () => {
      const completeSwap: SwapInfo = {
        ...mockSwapInfo,
        minCashAmount: 100
      };

      const result = validateSwapInfoCompleteness(completeSwap);

      expect(result).toEqual({
        isComplete: true,
        missingFields: []
      });
    });

    it('should identify missing required fields', () => {
      const incompleteSwap = {
        paymentTypes: ['cash'],
        acceptanceStrategy: 'first-match'
      } as SwapInfo;

      const result = validateSwapInfoCompleteness(incompleteSwap);

      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('swapId');
    });

    it('should require auction end date for auction strategy', () => {
      const auctionSwap: SwapInfo = {
        ...mockSwapInfo,
        acceptanceStrategy: 'auction'
        // Missing auctionEndDate
      };

      const result = validateSwapInfoCompleteness(auctionSwap);

      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('auctionEndDate');
    });

    it('should require min cash amount for cash payments', () => {
      const cashSwap: SwapInfo = {
        ...mockSwapInfo,
        paymentTypes: ['cash'],
        minCashAmount: undefined
      };

      const result = validateSwapInfoCompleteness(cashSwap);

      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('minCashAmount');
    });
  });
});