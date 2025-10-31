import React from 'react';
import { tokens } from '@/design-system/tokens';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';
import { SwapStatusSection } from './SwapStatusSection';
import { ProposalActivitySection } from './ProposalActivitySection';
import { SwapTermsSection } from './SwapTermsSection';
import { SwapMetricsSection } from './SwapMetricsSection';
import { SwapTimelineSection } from './SwapTimelineSection';
import { SwapAnalyticsSection } from './SwapAnalyticsSection';
import { enrichSwapInfo, EnhancedSwapInfo } from '@/utils/swapDataEnrichment';

export interface SwapInfoPanelProps {
  swapInfo: SwapInfo;
  userRole: BookingUserRole;
  compact?: boolean;
  showFullDetails?: boolean;
}

// Note: EnhancedSwapInfo is now imported from swapDataEnrichment utility

export const SwapInfoPanel: React.FC<SwapInfoPanelProps> = ({
  swapInfo,
  userRole,
  compact = false,
  showFullDetails = true
}) => {
  // Use the comprehensive enrichment utility
  const enhancedSwapInfo = enrichSwapInfo(swapInfo, userRole);

  const formatTimeRemaining = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  };



  // Sub-component: ActionItemsSection
  const ActionItemsSection: React.FC<{ swapInfo: EnhancedSwapInfo; userRole: BookingUserRole }> = ({
    swapInfo,
    userRole
  }) => {
    const getActionItems = () => {
      const actions = [];
      
      if (userRole === 'owner') {
        if (swapInfo.activeProposalCount > 0) {
          actions.push({
            label: 'Review Proposals',
            type: 'primary',
            icon: '👀'
          });
        }
        
        actions.push({
          label: 'Manage Swap',
          type: 'secondary',
          icon: '⚙️'
        });
      }
      
      if (userRole === 'browser' && swapInfo.hasActiveProposals) {
        actions.push({
          label: 'Make Proposal',
          type: 'primary',
          icon: '💌'
        });
      }
      
      if (userRole === 'proposer') {
        const status = swapInfo.userProposalStatus;
        if (status === 'pending') {
          actions.push({
            label: 'View Proposal',
            type: 'secondary',
            icon: '📄'
          });
          actions.push({
            label: 'Withdraw',
            type: 'danger',
            icon: '🗑️'
          });
        }
      }
      
      return actions;
    };

    const actions = getActionItems();
    
    if (actions.length === 0) return null;
    
    const getActionButtonStyles = (type: string) => ({
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[1],
      padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
      borderRadius: tokens.borderRadius.sm,
      border: 'none',
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: 'all 0.2s',
      ...(type === 'primary' && {
        backgroundColor: tokens.colors.primary[600],
        color: 'white',
      }),
      ...(type === 'secondary' && {
        backgroundColor: tokens.colors.neutral[100],
        color: tokens.colors.neutral[700],
        border: `1px solid ${tokens.colors.neutral[300]}`,
      }),
      ...(type === 'danger' && {
        backgroundColor: tokens.colors.error[50],
        color: tokens.colors.error[700],
        border: `1px solid ${tokens.colors.error[200]}`,
      }),
    });
    
    return (
      <div style={{
        display: 'flex',
        gap: tokens.spacing[2],
        flexWrap: 'wrap' as const,
      }}>
        {actions.map((action, index) => (
          <button
            key={index}
            style={getActionButtonStyles(action.type)}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  };

  const panelStyles = {
    padding: compact ? tokens.spacing[2] : tokens.spacing[4],
    backgroundColor: 'white',
    borderRadius: tokens.borderRadius.lg,
    border: `1px solid ${tokens.colors.neutral[200]}`,
    fontSize: compact ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
    marginTop: tokens.spacing[3],
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    position: 'relative' as const,
    overflow: 'hidden',
  };

  return (
    <div style={panelStyles}>
      {/* Decorative gradient background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
        zIndex: 0,
      }} />
      
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Swap Status Section */}
        <SwapStatusSection swapInfo={swapInfo} />
        
        {/* Proposal Activity Section */}
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole={userRole}
          compact={compact}
        />
        
        {/* Swap Terms Section - Focus on user preferences */}
        <SwapTermsSection 
          swapInfo={swapInfo}
          showFullDetails={true}
        />
        
        {/* Only show metrics and analytics if user is the owner and wants detailed info */}
        {!compact && userRole === 'owner' && showFullDetails && (
          <>
            {/* Swap Metrics Section - Only for owners */}
            <SwapMetricsSection 
              swapInfo={enhancedSwapInfo}
              userRole={userRole}
            />
            
            {/* Swap Timeline Section - Only for owners */}
            <SwapTimelineSection 
              swapInfo={enhancedSwapInfo}
              userRole={userRole}
            />
            
            {/* Swap Analytics Section - Only for owners */}
            <SwapAnalyticsSection 
              swapInfo={enhancedSwapInfo}
              userRole={userRole}
            />
          </>
        )}
        
        {/* Action Items Section */}
        {!compact && (
          <ActionItemsSection 
            swapInfo={enhancedSwapInfo}
            userRole={userRole}
          />
        )}
      </div>
    </div>
  );
};