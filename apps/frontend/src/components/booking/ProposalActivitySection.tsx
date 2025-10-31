import React from 'react';
import { tokens } from '@/design-system/tokens';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

export interface ProposalActivitySectionProps {
  swapInfo: SwapInfo;
  userRole: BookingUserRole;
  compact?: boolean;
}

interface ActivityDisplay {
  message: string;
  icon: string;
  actionable: boolean;
  urgency?: 'normal' | 'high';
  count?: number;
}

export const ProposalActivitySection: React.FC<ProposalActivitySectionProps> = ({
  swapInfo,
  userRole,
  compact = false
}) => {
  const getProposerStatusMessage = (status?: string): string => {
    switch (status) {
      case 'accepted': return 'Your proposal was accepted!';
      case 'rejected': return 'Your proposal was declined';
      case 'pending': return 'Your proposal is under review';
      default: return 'Available for proposals';
    }
  };

  const getProposerStatusIcon = (status?: string): string => {
    switch (status) {
      case 'accepted': return '✅';
      case 'rejected': return '❌';
      case 'pending': return '⏳';
      default: return '✨';
    }
  };

  const getActivityDisplay = (): ActivityDisplay => {
    const count = swapInfo.activeProposalCount || 0;
    
    if (userRole === 'owner') {
      if (count === 0) {
        return {
          message: 'No proposals received yet',
          icon: '📭',
          actionable: false
        };
      }
      
      return {
        message: `${count} active proposal${count > 1 ? 's' : ''} waiting for review`,
        icon: '📬',
        actionable: true,
        urgency: count > 3 ? 'high' : 'normal',
        count
      };
    }
    
    if (userRole === 'proposer') {
      const status = swapInfo.userProposalStatus;
      return {
        message: getProposerStatusMessage(status),
        icon: getProposerStatusIcon(status),
        actionable: status === 'pending'
      };
    }
    
    // Browser role
    if (count > 0) {
      return {
        message: `${count} proposal${count > 1 ? 's' : ''} submitted`,
        icon: '👥',
        actionable: true,
        count
      };
    }
    
    return {
      message: 'Available for proposals',
      icon: '✨',
      actionable: true
    };
  };

  const activity = getActivityDisplay();
  
  const getActivitySectionStyles = () => {
    const baseStyles = {
      marginBottom: tokens.spacing[2],
      padding: tokens.spacing[3],
      borderRadius: tokens.borderRadius.md,
      border: `1px solid ${tokens.colors.neutral[200]}`,
      backgroundColor: 'white',
      transition: 'all 0.2s ease',
    };

    // Add urgency styling for high priority proposals
    if (activity.urgency === 'high') {
      return {
        ...baseStyles,
        backgroundColor: tokens.colors.error[50],
        borderColor: tokens.colors.error[200],
        borderLeft: `4px solid ${tokens.colors.error[500]}`,
        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)',
      };
    }

    // Add subtle styling for normal activity
    if (activity.actionable) {
      return {
        ...baseStyles,
        backgroundColor: tokens.colors.primary[50],
        borderColor: tokens.colors.primary[200],
        borderLeft: `4px solid ${tokens.colors.primary[500]}`,
        boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)',
      };
    }

    return {
      ...baseStyles,
      backgroundColor: tokens.colors.neutral[50],
      borderColor: tokens.colors.neutral[200],
      borderLeft: `4px solid ${tokens.colors.neutral[300]}`,
    };
  };

  const activityIndicatorStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    marginBottom: !compact && activity.actionable && userRole === 'owner' && swapInfo.activeProposalCount > 0 ? tokens.spacing[2] : 0,
  };

  const activityIconStyles = {
    fontSize: tokens.typography.fontSize.base,
    lineHeight: 1,
  };

  const activityMessageStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[700],
    fontWeight: tokens.typography.fontWeight.medium,
  };

  const reviewButtonStyles = {
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.sm,
    border: 'none',
    backgroundColor: tokens.colors.primary[600],
    color: 'white',
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[1],
    transition: 'all 0.2s ease-in-out',
  };

  return (
    <div style={getActivitySectionStyles()}>
      <div style={activityIndicatorStyles}>
        <span style={activityIconStyles}>{activity.icon}</span>
        <span style={activityMessageStyles}>{activity.message}</span>
        {activity.urgency === 'high' && (
          <span style={{
            fontSize: tokens.typography.fontSize.xs,
            color: tokens.colors.error[600],
            fontWeight: tokens.typography.fontWeight.semibold,
            backgroundColor: tokens.colors.error[100],
            padding: `2px ${tokens.spacing[1]}`,
            borderRadius: tokens.borderRadius.sm,
          }}>
            Needs Attention
          </span>
        )}
      </div>
      
      {/* Action button for owners with pending proposals */}
      {!compact && activity.actionable && userRole === 'owner' && swapInfo.activeProposalCount > 0 && (
        <button 
          style={reviewButtonStyles}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = tokens.colors.primary[700];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = tokens.colors.primary[600];
          }}
        >
          <span>👀</span>
          <span>Review Proposals</span>
        </button>
      )}
    </div>
  );
};