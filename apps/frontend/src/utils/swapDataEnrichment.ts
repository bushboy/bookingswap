/**
 * Swap Data Enrichment Utilities
 * 
 * This module provides functions to enrich SwapInfo data with computed display fields,
 * urgency calculations, next action determination, and status summaries for better user understanding.
 */

import { SwapInfo, BookingUserRole } from '@booking-swap/shared';
import { FinancialDataHandler } from './financialDataHandler';

// Enhanced SwapInfo interface with computed display fields
export interface EnhancedSwapInfo extends SwapInfo {
  // Urgency indicators
  isUrgent: boolean;
  urgencyLevel: 'low' | 'normal' | 'high' | 'critical';
  urgencyReason?: string;

  // Next action guidance
  nextAction?: string;
  nextActionType?: 'primary' | 'secondary' | 'warning' | 'danger';
  nextActionIcon?: string;

  // Status summaries
  statusSummary: string;
  statusIcon: string;
  statusType: 'active' | 'pending' | 'completed' | 'expired' | 'available';

  // Display helpers
  timeRemainingDisplay?: string;
  proposalCountDisplay: string;
  paymentTypesDisplay: string;
  cashRangeDisplay?: string;

  // Activity indicators
  hasRecentActivity: boolean;
  activitySummary: string;
  requiresAttention: boolean;
}

// Urgency calculation constants
const URGENCY_THRESHOLDS = {
  CRITICAL: 2 * 60 * 60 * 1000, // 2 hours
  HIGH: 24 * 60 * 60 * 1000,    // 24 hours
  NORMAL: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

/**
 * Main function to enrich SwapInfo with computed display fields
 */
export function enrichSwapInfo(
  swapInfo: SwapInfo,
  userRole: BookingUserRole,
  currentTime: Date = new Date()
): EnhancedSwapInfo {
  try {
    const enhanced = { ...swapInfo } as EnhancedSwapInfo;

    // Calculate urgency
    const urgencyData = calculateUrgency(swapInfo, currentTime);
    enhanced.isUrgent = urgencyData.isUrgent;
    enhanced.urgencyLevel = urgencyData.level;
    enhanced.urgencyReason = urgencyData.reason;

    // Determine next action
    const nextActionData = determineNextAction(swapInfo, userRole);
    enhanced.nextAction = nextActionData.action;
    enhanced.nextActionType = nextActionData.type;
    enhanced.nextActionIcon = nextActionData.icon;

    // Generate status summary
    const statusData = generateStatusSummary(swapInfo, currentTime);
    enhanced.statusSummary = statusData.summary;
    enhanced.statusIcon = statusData.icon;
    enhanced.statusType = statusData.type;

    // Create display helpers
    enhanced.timeRemainingDisplay = formatTimeRemaining(swapInfo.timeRemaining);
    enhanced.proposalCountDisplay = formatProposalCount(swapInfo.activeProposalCount);

    // Debug logging for payment types
    console.log('swapInfo.paymentTypes:', swapInfo.paymentTypes, 'type:', typeof swapInfo.paymentTypes);
    console.log('Full swapInfo object:', swapInfo);

    // Ensure paymentTypes is properly handled
    const paymentTypes = swapInfo.paymentTypes || [];
    enhanced.paymentTypesDisplay = formatPaymentTypes(paymentTypes);
    enhanced.cashRangeDisplay = formatCashRange(swapInfo.minCashAmount, swapInfo.maxCashAmount);

    // Calculate activity indicators
    const activityData = calculateActivityIndicators(swapInfo, userRole);
    enhanced.hasRecentActivity = activityData.hasRecentActivity;
    enhanced.activitySummary = activityData.summary;
    enhanced.requiresAttention = activityData.requiresAttention;

    return enhanced;
  } catch (error) {
    console.error('Error enriching swap info:', error, 'swapInfo:', swapInfo);

    // Return a safe fallback object
    return {
      ...swapInfo,
      isUrgent: false,
      urgencyLevel: 'low',
      timeRemainingDisplay: 'Unknown',
      proposalCountDisplay: '0 proposals',
      paymentTypesDisplay: 'No payment types specified',
      cashRangeDisplay: 'No cash requirements',
      hasRecentActivity: false,
      activitySummary: 'No recent activity',
      requiresAttention: false,
      statusSummary: 'Status unknown',
      statusIcon: '❓',
      statusType: 'pending',
      nextAction: {
        action: 'Contact support',
        type: 'warning' as const,
        icon: '⚠️'
      }
    } as EnhancedSwapInfo;
  }
}

/**
 * Calculate urgency level based on time remaining and swap state
 */
export function calculateUrgency(
  swapInfo: SwapInfo,
  currentTime: Date = new Date()
): {
  isUrgent: boolean;
  level: 'low' | 'normal' | 'high' | 'critical';
  reason?: string;
} {
  // No urgency if no time constraint
  if (!swapInfo.timeRemaining) {
    return {
      isUrgent: false,
      level: 'low'
    };
  }

  const timeLeft = swapInfo.timeRemaining;

  // Critical urgency - less than 2 hours
  if (timeLeft <= URGENCY_THRESHOLDS.CRITICAL) {
    return {
      isUrgent: true,
      level: 'critical',
      reason: 'Auction ending in less than 2 hours'
    };
  }

  // High urgency - less than 24 hours
  if (timeLeft <= URGENCY_THRESHOLDS.HIGH) {
    return {
      isUrgent: true,
      level: 'high',
      reason: 'Auction ending within 24 hours'
    };
  }

  // Normal urgency - less than 7 days
  if (timeLeft <= URGENCY_THRESHOLDS.NORMAL) {
    return {
      isUrgent: true,
      level: 'normal',
      reason: 'Auction ending within a week'
    };
  }

  return {
    isUrgent: false,
    level: 'low'
  };
}

/**
 * Determine the next action based on user role and swap state
 */
export function determineNextAction(
  swapInfo: SwapInfo,
  userRole: BookingUserRole
): {
  action?: string;
  type?: 'primary' | 'secondary' | 'warning' | 'danger';
  icon?: string;
} {
  switch (userRole) {
    case 'owner':
      if (swapInfo.activeProposalCount > 0) {
        return {
          action: 'Review Proposals',
          type: 'primary',
          icon: '👀'
        };
      }

      if (swapInfo.acceptanceStrategy === 'auction' && swapInfo.timeRemaining) {
        const urgency = calculateUrgency(swapInfo);
        if (urgency.level === 'critical') {
          return {
            action: 'Auction Ending Soon',
            type: 'warning',
            icon: '⏰'
          };
        }
      }

      return {
        action: 'Manage Swap Settings',
        type: 'secondary',
        icon: '⚙️'
      };

    case 'browser':
      if (swapInfo.acceptanceStrategy === 'auction' && swapInfo.timeRemaining) {
        const urgency = calculateUrgency(swapInfo);
        if (urgency.level === 'critical') {
          return {
            action: 'Bid Now - Ending Soon!',
            type: 'warning',
            icon: '🔥'
          };
        }
        return {
          action: 'Place Bid',
          type: 'primary',
          icon: '🔨'
        };
      }

      return {
        action: 'Make Proposal',
        type: 'primary',
        icon: '💌'
      };

    case 'proposer':
      const status = swapInfo.userProposalStatus;

      if (status === 'pending') {
        if (swapInfo.acceptanceStrategy === 'auction' && swapInfo.timeRemaining) {
          const urgency = calculateUrgency(swapInfo);
          if (urgency.level === 'critical') {
            return {
              action: 'Update Bid - Ending Soon!',
              type: 'warning',
              icon: '⚡'
            };
          }
        }

        return {
          action: 'View Your Proposal',
          type: 'secondary',
          icon: '📄'
        };
      }

      if (status === 'accepted') {
        return {
          action: 'Complete Exchange',
          type: 'primary',
          icon: '✅'
        };
      }

      if (status === 'rejected') {
        return {
          action: 'Make New Proposal',
          type: 'secondary',
          icon: '🔄'
        };
      }

      break;
  }

  return {};
}

/**
 * Generate comprehensive status summary
 */
export function generateStatusSummary(
  swapInfo: SwapInfo,
  currentTime: Date = new Date()
): {
  summary: string;
  icon: string;
  type: 'active' | 'pending' | 'completed' | 'expired' | 'available';
} {
  // Check if auction has expired
  if (swapInfo.acceptanceStrategy === 'auction' && swapInfo.timeRemaining !== undefined) {
    if (swapInfo.timeRemaining <= 0) {
      return {
        summary: 'Auction has ended',
        icon: '🏁',
        type: 'expired'
      };
    }

    const urgency = calculateUrgency(swapInfo, currentTime);
    if (urgency.level === 'critical') {
      return {
        summary: 'Auction ending very soon!',
        icon: '🔥',
        type: 'active'
      };
    }

    if (urgency.level === 'high') {
      return {
        summary: 'Auction ending within 24 hours',
        icon: '⏰',
        type: 'active'
      };
    }

    return {
      summary: 'Auction is active',
      icon: '🔨',
      type: 'active'
    };
  }

  // First-match strategy
  if (swapInfo.hasActiveProposals) {
    if (swapInfo.activeProposalCount === 1) {
      return {
        summary: '1 active proposal',
        icon: '📬',
        type: 'pending'
      };
    }

    return {
      summary: `${swapInfo.activeProposalCount} active proposals`,
      icon: '📬',
      type: 'pending'
    };
  }

  return {
    summary: 'Available for proposals',
    icon: '✨',
    type: 'available'
  };
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(timeRemaining?: number): string | undefined {
  if (!timeRemaining || timeRemaining <= 0) {
    return undefined;
  }

  const seconds = Math.floor(timeRemaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0 && hours < 6) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return 'Less than 1 minute';
}

/**
 * Format proposal count for display
 */
export function formatProposalCount(count?: number): string {
  if (!count || count === 0) {
    return 'No proposals yet';
  }

  if (count === 1) {
    return '1 proposal';
  }

  return `${count} proposals`;
}

/**
 * Format payment types for display
 */
export function formatPaymentTypes(paymentTypes?: ('booking' | 'cash')[]): string {
  if (!paymentTypes || !Array.isArray(paymentTypes) || paymentTypes.length === 0) {
    return 'No payment types specified';
  }

  if (paymentTypes.length === 1) {
    return paymentTypes[0] === 'booking' ? 'Booking exchanges only' : 'Cash offers only';
  }

  return 'Booking exchanges & cash offers';
}

/**
 * Format cash range for display
 */
export function formatCashRange(minAmount?: number, maxAmount?: number): string | undefined {
  if (!minAmount && !maxAmount) {
    return undefined;
  }

  const formatCurrency = (amount: any) => FinancialDataHandler.formatCurrency(amount, 'USD');

  if (minAmount && maxAmount) {
    if (minAmount === maxAmount) {
      return formatCurrency(minAmount);
    }
    return `${formatCurrency(minAmount)} - ${formatCurrency(maxAmount)}`;
  }

  if (minAmount) {
    return `${formatCurrency(minAmount)} minimum`;
  }

  if (maxAmount) {
    return `Up to ${formatCurrency(maxAmount)}`;
  }

  return undefined;
}

/**
 * Calculate activity indicators
 */
export function calculateActivityIndicators(
  swapInfo: SwapInfo,
  userRole: BookingUserRole
): {
  hasRecentActivity: boolean;
  summary: string;
  requiresAttention: boolean;
} {
  const hasProposals = swapInfo.activeProposalCount > 0;
  const isAuction = swapInfo.acceptanceStrategy === 'auction';
  const urgency = calculateUrgency(swapInfo);

  // Determine if there's recent activity (simplified - in real app would check timestamps)
  const hasRecentActivity = hasProposals || (isAuction && !!swapInfo.timeRemaining);

  // Create activity summary
  let summary = '';
  if (userRole === 'owner') {
    if (hasProposals) {
      summary = `${swapInfo.activeProposalCount} proposal${swapInfo.activeProposalCount > 1 ? 's' : ''} waiting for review`;
    } else if (isAuction && swapInfo.timeRemaining) {
      summary = 'Auction is running, waiting for bids';
    } else {
      summary = 'Swap is active, waiting for proposals';
    }
  } else if (userRole === 'browser') {
    if (isAuction && swapInfo.timeRemaining) {
      summary = urgency.isUrgent ? 'Auction ending soon!' : 'Auction is active';
    } else {
      summary = 'Available for proposals';
    }
  } else if (userRole === 'proposer') {
    const status = swapInfo.userProposalStatus;
    if (status === 'pending') {
      summary = isAuction ? 'Your bid is active' : 'Your proposal is pending';
    } else if (status === 'accepted') {
      summary = 'Your proposal was accepted!';
    } else if (status === 'rejected') {
      summary = 'Your proposal was not selected';
    } else {
      summary = 'You can make a proposal';
    }
  }

  // Determine if requires attention
  const requiresAttention =
    (userRole === 'owner' && hasProposals) ||
    (urgency.level === 'critical') ||
    (userRole === 'proposer' && swapInfo.userProposalStatus === 'accepted');

  return {
    hasRecentActivity,
    summary,
    requiresAttention
  };
}

/**
 * Utility function to get urgency styling classes
 */
export function getUrgencyStyles(urgencyLevel: 'low' | 'normal' | 'high' | 'critical') {
  switch (urgencyLevel) {
    case 'critical':
      return {
        backgroundColor: '#fef2f2',
        borderColor: '#ef4444',
        textColor: '#dc2626'
      };
    case 'high':
      return {
        backgroundColor: '#fffbeb',
        borderColor: '#f59e0b',
        textColor: '#d97706'
      };
    case 'normal':
      return {
        backgroundColor: '#f0f9ff',
        borderColor: '#3b82f6',
        textColor: '#2563eb'
      };
    default:
      return {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        textColor: '#64748b'
      };
  }
}

/**
 * Utility function to check if swap data is complete
 */
export function validateSwapInfoCompleteness(swapInfo: SwapInfo): {
  isComplete: boolean;
  missingFields: string[];
} {
  const requiredFields = ['swapId', 'paymentTypes', 'acceptanceStrategy'];
  const missingFields: string[] = [];

  requiredFields.forEach(field => {
    if (!swapInfo[field as keyof SwapInfo]) {
      missingFields.push(field);
    }
  });

  // Check for auction-specific requirements
  if (swapInfo.acceptanceStrategy === 'auction' && !swapInfo.auctionEndDate) {
    missingFields.push('auctionEndDate');
  }

  // Check for cash payment requirements
  if (swapInfo.paymentTypes.includes('cash') && !swapInfo.minCashAmount) {
    missingFields.push('minCashAmount');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields
  };
}