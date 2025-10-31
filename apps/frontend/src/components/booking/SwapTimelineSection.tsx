import React from 'react';
import { tokens } from '@/design-system/tokens';
import { BookingUserRole } from '@booking-swap/shared';
import { EnhancedSwapInfo } from '@/utils/swapDataEnrichment';

export interface SwapTimelineSectionProps {
  swapInfo: EnhancedSwapInfo;
  userRole: BookingUserRole;
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'proposal' | 'accepted' | 'rejected' | 'expired' | 'updated' | 'viewed';
  title: string;
  description: string;
  icon: string;
  status: 'completed' | 'pending' | 'failed';
  userAction?: boolean;
}

export const SwapTimelineSection: React.FC<SwapTimelineSectionProps> = ({
  swapInfo,
  userRole
}) => {
  const generateTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    const now = new Date();
    
    // Swap creation event
    events.push({
      id: 'swap-created',
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      type: 'created',
      title: 'Swap Created',
      description: 'Swap listing was published and made available for proposals',
      icon: '🚀',
      status: 'completed',
      userAction: userRole === 'owner'
    });
    
    // First view event
    events.push({
      id: 'first-view',
      timestamp: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000), // 1.5 days ago
      type: 'viewed',
      title: 'First View',
      description: 'Someone viewed your swap listing',
      icon: '👀',
      status: 'completed',
      userAction: false
    });
    
    // Proposal events
    if (swapInfo.activeProposalCount > 0) {
      const proposalTimes = [
        new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
        new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      ];
      
      proposalTimes.slice(0, swapInfo.activeProposalCount).forEach((time, index) => {
        events.push({
          id: `proposal-${index + 1}`,
          timestamp: time,
          type: 'proposal',
          title: `Proposal ${index + 1} Received`,
          description: userRole === 'owner' ? 
            'A new proposal was submitted for your swap' : 
            'You submitted a proposal for this swap',
          icon: '💌',
          status: 'completed',
          userAction: userRole === 'proposer'
        });
      });
    }
    
    // Recent activity
    if (swapInfo.hasRecentActivity) {
      events.push({
        id: 'recent-activity',
        timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
        type: 'viewed',
        title: 'Recent Activity',
        description: 'Someone viewed or interacted with your swap',
        icon: '⚡',
        status: 'completed',
        userAction: false
      });
    }
    
    // Auction events (if applicable)
    if (swapInfo.acceptanceStrategy === 'auction') {
      if (swapInfo.timeRemaining && swapInfo.timeRemaining > 0) {
        events.push({
          id: 'auction-active',
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
          type: 'updated',
          title: 'Auction Active',
          description: 'Auction is running and accepting bids',
          icon: '🔨',
          status: 'pending',
          userAction: false
        });
      } else {
        events.push({
          id: 'auction-ended',
          timestamp: new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
          type: 'expired',
          title: 'Auction Ended',
          description: 'Auction period has concluded',
          icon: '🏁',
          status: 'completed',
          userAction: false
        });
      }
    }
    
    // Sort events by timestamp (most recent first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const events = generateTimelineEvents();
  
  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
  };

  const getEventIconStyles = (status: string, userAction?: boolean) => {
    const baseStyles = {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.semibold,
      flexShrink: 0,
    };

    if (status === 'completed') {
      return {
        ...baseStyles,
        backgroundColor: userAction ? tokens.colors.primary[100] : tokens.colors.success[100],
        color: userAction ? tokens.colors.primary[700] : tokens.colors.success[700],
        border: `2px solid ${userAction ? tokens.colors.primary[300] : tokens.colors.success[300]}`,
      };
    } else if (status === 'pending') {
      return {
        ...baseStyles,
        backgroundColor: tokens.colors.warning[100],
        color: tokens.colors.warning[700],
        border: `2px solid ${tokens.colors.warning[300]}`,
        animation: 'pulse 2s infinite',
      };
    } else {
      return {
        ...baseStyles,
        backgroundColor: tokens.colors.error[100],
        color: tokens.colors.error[700],
        border: `2px solid ${tokens.colors.error[300]}`,
      };
    }
  };

  const getTimelineLineStyles = (isLast: boolean) => ({
    position: 'absolute' as const,
    left: '15px',
    top: '32px',
    bottom: isLast ? '0' : 'auto',
    width: '2px',
    backgroundColor: tokens.colors.neutral[200],
    zIndex: 0,
  });

  return (
    <div style={{ marginBottom: tokens.spacing[4] }}>
      <h4 style={{
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: tokens.colors.neutral[800],
        marginBottom: tokens.spacing[3],
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[1],
      }}>
        <span>📅</span>
        <span>Swap Timeline</span>
      </h4>
      
      <div style={{ position: 'relative' }}>
        {events.map((event, index) => (
          <div
            key={event.id}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: tokens.spacing[3],
              marginBottom: tokens.spacing[4],
              paddingLeft: tokens.spacing[2],
            }}
          >
            {/* Timeline line */}
            {index < events.length - 1 && (
              <div style={getTimelineLineStyles(false)} />
            )}
            
            {/* Event icon */}
            <div style={getEventIconStyles(event.status, event.userAction)}>
              {event.icon}
            </div>
            
            {/* Event content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: tokens.spacing[1],
              }}>
                <h5 style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  margin: 0,
                }}>
                  {event.title}
                </h5>
                <span style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.neutral[500],
                  fontWeight: tokens.typography.fontWeight.medium,
                }}>
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              
              <p style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                margin: 0,
                lineHeight: 1.4,
              }}>
                {event.description}
              </p>
              
              {event.userAction && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: tokens.spacing[1],
                  marginTop: tokens.spacing[1],
                  padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                  backgroundColor: tokens.colors.primary[50],
                  color: tokens.colors.primary[700],
                  borderRadius: tokens.borderRadius.sm,
                  fontSize: tokens.typography.fontSize.xs,
                  fontWeight: tokens.typography.fontWeight.medium,
                }}>
                  <span>👤</span>
                  <span>Your Action</span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Add pulse animation for pending events */}
        <style>
          {`
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `}
        </style>
      </div>
    </div>
  );
};
