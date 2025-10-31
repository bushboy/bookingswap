import React, { useState, useEffect } from 'react';
import { tokens } from '@/design-system/tokens';
import { SwapInfo } from '@booking-swap/shared';

export interface SwapStatusSectionProps {
  swapInfo: SwapInfo;
}

interface StatusDisplay {
  icon: string;
  label: string;
  status: string;
  urgency: 'low' | 'normal' | 'high';
}

interface CountdownTimerProps {
  timeRemaining: number;
  urgency: 'low' | 'normal' | 'high';
}

// Countdown Timer Component for auction time remaining
const CountdownTimer: React.FC<CountdownTimerProps> = ({ timeRemaining, urgency }) => {
  const [currentTimeRemaining, setCurrentTimeRemaining] = useState(timeRemaining);

  useEffect(() => {
    setCurrentTimeRemaining(timeRemaining);
    
    const interval = setInterval(() => {
      setCurrentTimeRemaining(prev => {
        const newTime = prev - 1000; // Subtract 1 second
        return newTime > 0 ? newTime : 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const formatTimeRemaining = (milliseconds: number): string => {
    if (milliseconds <= 0) return 'Expired';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getTimerStyles = () => {
    const baseStyles = {
      padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
      borderRadius: tokens.borderRadius.md,
      fontSize: tokens.typography.fontSize.xs,
      fontWeight: tokens.typography.fontWeight.semibold,
      display: 'inline-flex',
      alignItems: 'center',
      gap: tokens.spacing[1],
    };

    switch (urgency) {
      case 'high':
        return {
          ...baseStyles,
          backgroundColor: tokens.colors.error[100],
          color: tokens.colors.error[800],
          border: `1px solid ${tokens.colors.error[200]}`,
          animation: currentTimeRemaining < 60000 ? 'pulse 1s infinite' : 'none', // Pulse when < 1 minute
        };
      case 'normal':
        return {
          ...baseStyles,
          backgroundColor: tokens.colors.warning[100],
          color: tokens.colors.warning[800],
          border: `1px solid ${tokens.colors.warning[200]}`,
        };
      default:
        return {
          ...baseStyles,
          backgroundColor: tokens.colors.neutral[100],
          color: tokens.colors.neutral[700],
          border: `1px solid ${tokens.colors.neutral[200]}`,
        };
    }
  };

  return (
    <div style={getTimerStyles()}>
      <span>⏰</span>
      <span>{formatTimeRemaining(currentTimeRemaining)}</span>
      {urgency === 'high' && <span>⚠️</span>}
    </div>
  );
};

export const SwapStatusSection: React.FC<SwapStatusSectionProps> = ({ swapInfo }) => {
  const getStatusDisplay = (): StatusDisplay => {
    if (swapInfo.acceptanceStrategy === 'auction') {
      const isActive = swapInfo.timeRemaining && swapInfo.timeRemaining > 0;
      const urgency = swapInfo.timeRemaining && swapInfo.timeRemaining < 24 * 60 * 60 * 1000 ? 'high' : 'normal';
      
      return {
        icon: '🔨',
        label: 'Auction Mode',
        status: isActive ? 'Active' : 'Ended',
        urgency: isActive ? urgency : 'low'
      };
    }
    
    return {
      icon: '🔄',
      label: 'First Match',
      status: swapInfo.hasActiveProposals ? 'Active' : 'Available',
      urgency: 'normal'
    };
  };

  const statusInfo = getStatusDisplay();
  
  const getStatusSectionStyles = () => {
    const baseStyles = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: tokens.spacing[3],
      paddingBottom: tokens.spacing[2],
      borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
      position: 'relative' as const,
    };

    // Add urgency styling for high priority swaps
    if (statusInfo.urgency === 'high') {
      return {
        ...baseStyles,
        borderLeft: `4px solid ${tokens.colors.error[500]}`,
        paddingLeft: tokens.spacing[3],
        backgroundColor: tokens.colors.error[50],
        borderRadius: tokens.borderRadius.sm,
        padding: tokens.spacing[3],
        paddingBottom: tokens.spacing[2],
        marginBottom: tokens.spacing[3],
        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)',
      };
    }

    // Add subtle styling for normal priority
    if (statusInfo.urgency === 'normal') {
      return {
        ...baseStyles,
        borderLeft: `4px solid ${tokens.colors.warning[500]}`,
        paddingLeft: tokens.spacing[3],
        backgroundColor: tokens.colors.warning[50],
        borderRadius: tokens.borderRadius.sm,
        padding: tokens.spacing[3],
        paddingBottom: tokens.spacing[2],
        marginBottom: tokens.spacing[3],
        boxShadow: '0 1px 3px rgba(245, 158, 11, 0.1)',
      };
    }

    return {
      ...baseStyles,
      borderLeft: `4px solid ${tokens.colors.primary[500]}`,
      paddingLeft: tokens.spacing[3],
      backgroundColor: tokens.colors.primary[50],
      borderRadius: tokens.borderRadius.sm,
      padding: tokens.spacing[3],
      paddingBottom: tokens.spacing[2],
      marginBottom: tokens.spacing[3],
      boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)',
    };
  };

  const statusHeaderStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
  };

  const statusIconStyles = {
    fontSize: tokens.typography.fontSize.lg,
    lineHeight: 1,
  };

  const statusLabelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
  };

  const statusValueStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: statusInfo.urgency === 'high' ? tokens.colors.error[800] : tokens.colors.neutral[900],
  };

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
      <div style={getStatusSectionStyles()}>
        <div style={statusHeaderStyles}>
          <span style={statusIconStyles}>{statusInfo.icon}</span>
          <span style={statusLabelStyles}>{statusInfo.label}</span>
          <span style={statusValueStyles}>{statusInfo.status}</span>
        </div>
        
        {/* Countdown Timer for auction mode with time remaining */}
        {swapInfo.timeRemaining && swapInfo.timeRemaining > 0 && (
          <CountdownTimer 
            timeRemaining={swapInfo.timeRemaining}
            urgency={statusInfo.urgency}
          />
        )}
        
        {/* Show "Expired" indicator for auctions that have ended */}
        {swapInfo.acceptanceStrategy === 'auction' && (!swapInfo.timeRemaining || swapInfo.timeRemaining <= 0) && (
          <div style={{
            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
            borderRadius: tokens.borderRadius.md,
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.semibold,
            backgroundColor: tokens.colors.neutral[100],
            color: tokens.colors.neutral[600],
            display: 'inline-flex',
            alignItems: 'center',
            gap: tokens.spacing[1],
          }}>
            <span>⏰</span>
            <span>Expired</span>
          </div>
        )}
      </div>
    </>
  );
};