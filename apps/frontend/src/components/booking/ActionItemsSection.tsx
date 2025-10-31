import React from 'react';
import { tokens } from '@/design-system/tokens';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

export interface ActionItemsSectionProps {
  swapInfo: SwapInfo;
  userRole: BookingUserRole;
}

interface ActionItem {
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const ActionItemsSection: React.FC<ActionItemsSectionProps> = ({
  swapInfo,
  userRole
}) => {
  const getActionItems = (): ActionItem[] => {
    const actions: ActionItem[] = [];
    
    if (userRole === 'owner') {
      // Owner actions based on swap state
      if (swapInfo.activeProposalCount > 0) {
        actions.push({
          label: 'Review Proposals',
          type: 'primary',
          icon: '👀',
          onClick: () => {
            // TODO: Navigate to proposals review page
            console.log('Navigate to proposals review');
          }
        });
      }
      
      // Always show manage swap option for owners
      actions.push({
        label: 'Manage Swap',
        type: 'secondary',
        icon: '⚙️',
        onClick: () => {
          // TODO: Navigate to swap management page
          console.log('Navigate to swap management');
        }
      });
    }
    
    if (userRole === 'browser') {
      // Browser can make proposals if swap is active and accepting proposals
      const canMakeProposal = swapInfo.hasActiveProposals || 
        (swapInfo.acceptanceStrategy === 'first-match') ||
        (swapInfo.acceptanceStrategy === 'auction' && swapInfo.timeRemaining && swapInfo.timeRemaining > 0);
      
      if (canMakeProposal) {
        actions.push({
          label: 'Make Proposal',
          type: 'primary',
          icon: '💌',
          onClick: () => {
            // TODO: Open proposal creation modal/form
            console.log('Open proposal creation form');
          }
        });
      }
      
      // Show view details option
      actions.push({
        label: 'View Details',
        type: 'secondary',
        icon: '📄',
        onClick: () => {
          // TODO: Navigate to booking details page
          console.log('Navigate to booking details');
        }
      });
    }
    
    if (userRole === 'proposer') {
      const status = swapInfo.userProposalStatus;
      
      if (status === 'pending') {
        // User has a pending proposal
        actions.push({
          label: 'View Proposal',
          type: 'secondary',
          icon: '📄',
          onClick: () => {
            // TODO: Navigate to proposal details
            console.log('Navigate to proposal details');
          }
        });
        
        actions.push({
          label: 'Withdraw',
          type: 'danger',
          icon: '🗑️',
          onClick: () => {
            // TODO: Withdraw proposal with confirmation
            console.log('Withdraw proposal');
          }
        });
      } else if (status === 'accepted') {
        // Proposal was accepted
        actions.push({
          label: 'View Agreement',
          type: 'primary',
          icon: '✅',
          onClick: () => {
            // TODO: Navigate to agreement details
            console.log('Navigate to agreement details');
          }
        });
      } else if (status === 'rejected') {
        // Proposal was rejected, allow new proposal if still accepting
        const canMakeNewProposal = (swapInfo.acceptanceStrategy === 'first-match') ||
          (swapInfo.acceptanceStrategy === 'auction' && swapInfo.timeRemaining && swapInfo.timeRemaining > 0);
        
        if (canMakeNewProposal) {
          actions.push({
            label: 'Make New Proposal',
            type: 'primary',
            icon: '💌',
            onClick: () => {
              // TODO: Open proposal creation modal/form
              console.log('Open new proposal creation form');
            }
          });
        }
      }
    }
    
    return actions;
  };

  const actions = getActionItems();
  
  // Don't render if no actions available
  if (actions.length === 0) return null;
  
  // Styles
  const actionItemsSectionStyles = {
    marginTop: tokens.spacing[3],
    paddingTop: tokens.spacing[2],
    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const actionButtonsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    flexWrap: 'wrap' as const,
  };

  const getActionButtonStyles = (type: ActionItem['type'], disabled?: boolean) => {
    const baseStyles = {
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[1],
      padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
      borderRadius: tokens.borderRadius.md,
      border: 'none',
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease-in-out',
      opacity: disabled ? 0.6 : 1,
      minHeight: '36px',
    };

    switch (type) {
      case 'primary':
        return {
          ...baseStyles,
          backgroundColor: tokens.colors.primary[600],
          color: 'white',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        };
      case 'secondary':
        return {
          ...baseStyles,
          backgroundColor: tokens.colors.neutral[50],
          color: tokens.colors.neutral[700],
          border: `1px solid ${tokens.colors.neutral[300]}`,
        };
      case 'danger':
        return {
          ...baseStyles,
          backgroundColor: tokens.colors.error[50],
          color: tokens.colors.error[700],
          border: `1px solid ${tokens.colors.error[300]}`,
        };
      default:
        return baseStyles;
    }
  };

  const getHoverStyles = (type: ActionItem['type']) => {
    switch (type) {
      case 'primary':
        return {
          backgroundColor: tokens.colors.primary[700],
        };
      case 'secondary':
        return {
          backgroundColor: tokens.colors.neutral[100],
          borderColor: tokens.colors.neutral[400],
        };
      case 'danger':
        return {
          backgroundColor: tokens.colors.error[100],
          borderColor: tokens.colors.error[400],
        };
      default:
        return {};
    }
  };

  const actionIconStyles = {
    fontSize: tokens.typography.fontSize.base,
    lineHeight: 1,
  };

  const actionLabelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
  };

  return (
    <div style={actionItemsSectionStyles}>
      <div style={actionButtonsStyles}>
        {actions.map((action, index) => (
          <button
            key={index}
            style={getActionButtonStyles(action.type, action.disabled)}
            onClick={action.disabled ? undefined : action.onClick}
            onMouseEnter={(e) => {
              if (!action.disabled) {
                const hoverStyles = getHoverStyles(action.type);
                Object.assign(e.currentTarget.style, hoverStyles);
              }
            }}
            onMouseLeave={(e) => {
              if (!action.disabled) {
                const originalStyles = getActionButtonStyles(action.type);
                Object.assign(e.currentTarget.style, originalStyles);
              }
            }}
            disabled={action.disabled}
          >
            <span style={actionIconStyles}>{action.icon}</span>
            <span style={actionLabelStyles}>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};