import React from 'react';
import { tokens } from '@/design-system/tokens';
import { SwapInfo } from '@booking-swap/shared';
import { useSwapStatusBadgeAccessibility, useSwapHighContrast } from '@/hooks/useSwapAccessibility';

export interface SwapStatusBadgeProps {
  swapInfo?: SwapInfo;
  variant?: 'default' | 'compact';
}

export const SwapStatusBadge: React.FC<SwapStatusBadgeProps> = ({
  swapInfo,
  variant = 'default'
}) => {
  const { getBadgeProps, getDescriptionProps } = useSwapStatusBadgeAccessibility(swapInfo);
  const { getSwapIndicatorStyles } = useSwapHighContrast();

  if (!swapInfo || !swapInfo.hasActiveProposals) {
    return null;
  }

  const isCompact = variant === 'compact';
  const isAuction = swapInfo.acceptanceStrategy === 'auction';
  const isEndingSoon = swapInfo.timeRemaining && swapInfo.timeRemaining < 24 * 60 * 60 * 1000; // 24 hours
  const isLastChance = swapInfo.timeRemaining && swapInfo.timeRemaining < 2 * 60 * 60 * 1000; // 2 hours

  // Determine badge type and styling
  const getBadgeConfig = () => {
    if (isLastChance) {
      return {
        text: isCompact ? 'URGENT' : 'Last Chance',
        bg: tokens.colors.error[100],
        color: tokens.colors.error[800],
        border: tokens.colors.error[300],
        icon: '🔥'
      };
    }
    
    if (isEndingSoon) {
      return {
        text: isCompact ? 'SOON' : 'Ending Soon',
        bg: tokens.colors.warning[100],
        color: tokens.colors.warning[800],
        border: tokens.colors.warning[300],
        icon: '⏰'
      };
    }
    
    if (isAuction) {
      return {
        text: isCompact ? 'AUCTION' : 'Auction Active',
        bg: tokens.colors.primary[100],
        color: tokens.colors.primary[800],
        border: tokens.colors.primary[300],
        icon: '🔨'
      };
    }
    
    return {
      text: isCompact ? 'SWAP' : 'Available for Swap',
      bg: tokens.colors.success[100],
      color: tokens.colors.success[800],
      border: tokens.colors.success[300],
      icon: '🔄'
    };
  };

  const config = getBadgeConfig();

  const badgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing[1],
    padding: isCompact 
      ? `${tokens.spacing[1]} ${tokens.spacing[2]}` 
      : `${tokens.spacing[1]} ${tokens.spacing[3]}`,
    borderRadius: tokens.borderRadius.full,
    fontSize: isCompact ? tokens.typography.fontSize.xs : tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: config.bg,
    color: config.color,
    border: `1px solid ${config.border}`,
    whiteSpace: 'nowrap' as const,
  };

  const iconStyles = {
    fontSize: isCompact ? '10px' : '12px',
  };

  return (
    <span style={getSwapIndicatorStyles(badgeStyles)} {...getBadgeProps()}>
      <span style={iconStyles} aria-hidden="true">{config.icon}</span>
      <span>{config.text}</span>
      {!isCompact && swapInfo.activeProposalCount > 0 && (
        <span
          style={{
            marginLeft: tokens.spacing[1],
            padding: `2px ${tokens.spacing[1]}`,
            borderRadius: tokens.borderRadius.full,
            backgroundColor: config.color,
            color: config.bg,
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.bold,
            minWidth: '16px',
            textAlign: 'center' as const,
          }}
          aria-label={`${swapInfo.activeProposalCount} active ${swapInfo.activeProposalCount === 1 ? 'proposal' : 'proposals'}`}
        >
          {swapInfo.activeProposalCount}
        </span>
      )}
      <span {...getDescriptionProps()} />
    </span>
  );
};