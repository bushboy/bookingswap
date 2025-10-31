import React from 'react';
import { tokens } from '@/design-system/tokens';
import { BookingUserRole } from '@booking-swap/shared';
import { EnhancedSwapInfo } from '@/utils/swapDataEnrichment';

export interface SwapMetricsSectionProps {
  swapInfo: EnhancedSwapInfo;
  userRole: BookingUserRole;
}

interface MetricCard {
  label: string;
  value: string | number;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  color: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  description?: string;
}

export const SwapMetricsSection: React.FC<SwapMetricsSectionProps> = ({
  swapInfo,
  userRole
}) => {
  const getMetrics = (): MetricCard[] => {
    const metrics: MetricCard[] = [];
    
    // Proposal metrics
    metrics.push({
      label: 'Active Proposals',
      value: swapInfo.activeProposalCount || 0,
      icon: '📬',
      trend: (swapInfo.activeProposalCount || 0) > 0 ? 'up' : 'neutral',
      color: (swapInfo.activeProposalCount || 0) > 0 ? 'primary' : 'neutral',
      description: 'Proposals waiting for review'
    });
    
    // Time metrics
    if (swapInfo.timeRemainingDisplay) {
      metrics.push({
        label: 'Time Remaining',
        value: swapInfo.timeRemainingDisplay,
        icon: '⏰',
        trend: swapInfo.urgencyLevel === 'critical' ? 'down' : 'neutral',
        color: swapInfo.urgencyLevel === 'critical' ? 'error' : 
               swapInfo.urgencyLevel === 'high' ? 'warning' : 'neutral',
        description: swapInfo.acceptanceStrategy === 'auction' ? 'Auction time left' : 'Swap duration'
      });
    }
    
    // Engagement metrics (simulated - would come from analytics)
    const views = Math.floor(Math.random() * 50) + 10; // Simulated view count
    metrics.push({
      label: 'Views',
      value: views,
      icon: '👀',
      trend: 'up',
      color: 'success',
      description: 'Total profile views'
    });
    
    // Interest level
    const interestLevel = swapInfo.activeProposalCount > 0 ? 'High' : 
                         views > 30 ? 'Medium' : 'Low';
    metrics.push({
      label: 'Interest Level',
      value: interestLevel,
      icon: '📈',
      trend: interestLevel === 'High' ? 'up' : 'neutral',
      color: interestLevel === 'High' ? 'success' : 
             interestLevel === 'Medium' ? 'warning' : 'neutral',
      description: 'Based on views and proposals'
    });
    
    // Success rate (for owners)
    if (userRole === 'owner') {
      const successRate = swapInfo.activeProposalCount > 0 ? '100%' : '0%';
      metrics.push({
        label: 'Response Rate',
        value: successRate,
        icon: '🎯',
        trend: successRate === '100%' ? 'up' : 'neutral',
        color: successRate === '100%' ? 'success' : 'neutral',
        description: 'Proposals received vs. expected'
      });
    }
    
    // Compatibility score (if available)
    if (swapInfo.compatibilityScore) {
      metrics.push({
        label: 'Avg. Compatibility',
        value: `${swapInfo.compatibilityScore}%`,
        icon: '🤝',
        trend: swapInfo.compatibilityScore > 70 ? 'up' : 'neutral',
        color: swapInfo.compatibilityScore > 70 ? 'success' : 
               swapInfo.compatibilityScore > 50 ? 'warning' : 'error',
        description: 'Average proposal compatibility'
      });
    }
    
    return metrics;
  };

  const metrics = getMetrics();
  
  const getMetricCardStyles = (color: string) => {
    const baseStyles = {
      padding: tokens.spacing[3],
      borderRadius: tokens.borderRadius.md,
      border: `1px solid ${tokens.colors.neutral[200]}`,
      backgroundColor: 'white',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    };

    const colorStyles = {
      primary: {
        borderLeft: `4px solid ${tokens.colors.primary[500]}`,
        backgroundColor: tokens.colors.primary[50],
      },
      success: {
        borderLeft: `4px solid ${tokens.colors.success[500]}`,
        backgroundColor: tokens.colors.success[50],
      },
      warning: {
        borderLeft: `4px solid ${tokens.colors.warning[500]}`,
        backgroundColor: tokens.colors.warning[50],
      },
      error: {
        borderLeft: `4px solid ${tokens.colors.error[500]}`,
        backgroundColor: tokens.colors.error[50],
      },
      neutral: {
        borderLeft: `4px solid ${tokens.colors.neutral[300]}`,
        backgroundColor: tokens.colors.neutral[50],
      },
    };

    return {
      ...baseStyles,
      ...colorStyles[color as keyof typeof colorStyles],
    };
  };

  const getValueStyles = (color: string) => {
    const colorMap = {
      primary: tokens.colors.primary[700],
      success: tokens.colors.success[700],
      warning: tokens.colors.warning[700],
      error: tokens.colors.error[700],
      neutral: tokens.colors.neutral[700],
    };

    return {
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
      color: colorMap[color as keyof typeof colorMap],
      marginBottom: tokens.spacing[1],
    };
  };

  const getLabelStyles = () => ({
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[1],
  });

  const getDescriptionStyles = () => ({
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.neutral[500],
    lineHeight: 1.4,
  });

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

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
        <span>📊</span>
        <span>Swap Metrics</span>
      </h4>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: tokens.spacing[3],
      }}>
        {metrics.map((metric, index) => (
          <div
            key={index}
            style={getMetricCardStyles(metric.color)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: tokens.spacing[2],
            }}>
              <span style={getLabelStyles()}>{metric.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                <span style={{ fontSize: tokens.typography.fontSize.lg }}>{metric.icon}</span>
                {metric.trend && (
                  <span style={{ fontSize: tokens.typography.fontSize.sm }}>
                    {getTrendIcon(metric.trend)}
                  </span>
                )}
              </div>
            </div>
            
            <div style={getValueStyles(metric.color)}>
              {metric.value}
            </div>
            
            {metric.description && (
              <div style={getDescriptionStyles()}>
                {metric.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
