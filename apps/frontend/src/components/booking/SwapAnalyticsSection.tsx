import React from 'react';
import { tokens } from '@/design-system/tokens';
import { BookingUserRole } from '@booking-swap/shared';
import { EnhancedSwapInfo } from '@/utils/swapDataEnrichment';

export interface SwapAnalyticsSectionProps {
  swapInfo: EnhancedSwapInfo;
  userRole: BookingUserRole;
}

interface AnalyticsData {
  views: number;
  uniqueViewers: number;
  proposalRate: number;
  engagementScore: number;
  peakActivityTime: string;
  geographicReach: string[];
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  conversionFunnel: {
    views: number;
    interested: number;
    proposals: number;
    accepted: number;
  };
}

export const SwapAnalyticsSection: React.FC<SwapAnalyticsSectionProps> = ({
  swapInfo,
  userRole
}) => {
  // Generate simulated analytics data
  const generateAnalyticsData = (): AnalyticsData => {
    const baseViews = Math.floor(Math.random() * 100) + 20;
    const uniqueViewers = Math.floor(baseViews * 0.7);
    const proposals = swapInfo.activeProposalCount || 0;
    const proposalRate = baseViews > 0 ? (proposals / baseViews) * 100 : 0;
    
    return {
      views: baseViews,
      uniqueViewers,
      proposalRate: Math.round(proposalRate * 10) / 10,
      engagementScore: Math.floor(Math.random() * 40) + 60, // 60-100
      peakActivityTime: ['Morning (9-11 AM)', 'Afternoon (2-4 PM)', 'Evening (7-9 PM)'][Math.floor(Math.random() * 3)],
      geographicReach: ['United States', 'Canada', 'United Kingdom', 'Australia'].slice(0, Math.floor(Math.random() * 4) + 1),
      deviceBreakdown: {
        mobile: Math.floor(Math.random() * 30) + 50, // 50-80%
        desktop: Math.floor(Math.random() * 30) + 15, // 15-45%
        tablet: Math.floor(Math.random() * 10) + 5, // 5-15%
      },
      conversionFunnel: {
        views: baseViews,
        interested: Math.floor(baseViews * 0.3),
        proposals: proposals,
        accepted: Math.floor(proposals * 0.8), // 80% acceptance rate
      }
    };
  };

  const analytics = generateAnalyticsData();
  
  const getEngagementColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getProposalRateColor = (rate: number) => {
    if (rate >= 10) return 'success';
    if (rate >= 5) return 'warning';
    return 'error';
  };

  const formatPercentage = (value: number) => `${value}%`;
  
  const getMetricCardStyles = (color: string) => {
    const colorMap = {
      success: {
        backgroundColor: tokens.colors.success[50],
        borderColor: tokens.colors.success[200],
        textColor: tokens.colors.success[700],
      },
      warning: {
        backgroundColor: tokens.colors.warning[50],
        borderColor: tokens.colors.warning[200],
        textColor: tokens.colors.warning[700],
      },
      error: {
        backgroundColor: tokens.colors.error[50],
        borderColor: tokens.colors.error[200],
        textColor: tokens.colors.error[700],
      },
      neutral: {
        backgroundColor: tokens.colors.neutral[50],
        borderColor: tokens.colors.neutral[200],
        textColor: tokens.colors.neutral[700],
      },
    };

    const colors = colorMap[color as keyof typeof colorMap];
    
    return {
      padding: tokens.spacing[3],
      borderRadius: tokens.borderRadius.md,
      border: `1px solid ${colors.borderColor}`,
      backgroundColor: colors.backgroundColor,
      color: colors.textColor,
    };
  };

  const getBarChartStyles = (percentage: number, color: string) => {
    const colorMap = {
      success: tokens.colors.success[500],
      warning: tokens.colors.warning[500],
      error: tokens.colors.error[500],
      neutral: tokens.colors.neutral[500],
    };

    return {
      width: `${percentage}%`,
      height: '8px',
      backgroundColor: colorMap[color as keyof typeof colorMap],
      borderRadius: tokens.borderRadius.sm,
      transition: 'width 0.3s ease',
    };
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
        <span>📈</span>
        <span>Swap Analytics</span>
      </h4>
      
      {/* Key Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: tokens.spacing[3],
        marginBottom: tokens.spacing[4],
      }}>
        <div style={getMetricCardStyles('neutral')}>
          <div style={{
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.medium,
            marginBottom: tokens.spacing[1],
            opacity: 0.8,
          }}>
            Total Views
          </div>
          <div style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.bold,
          }}>
            {analytics.views}
          </div>
        </div>
        
        <div style={getMetricCardStyles('neutral')}>
          <div style={{
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.medium,
            marginBottom: tokens.spacing[1],
            opacity: 0.8,
          }}>
            Unique Viewers
          </div>
          <div style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.bold,
          }}>
            {analytics.uniqueViewers}
          </div>
        </div>
        
        <div style={getMetricCardStyles(getProposalRateColor(analytics.proposalRate))}>
          <div style={{
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.medium,
            marginBottom: tokens.spacing[1],
            opacity: 0.8,
          }}>
            Proposal Rate
          </div>
          <div style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.bold,
          }}>
            {formatPercentage(analytics.proposalRate)}
          </div>
        </div>
        
        <div style={getMetricCardStyles(getEngagementColor(analytics.engagementScore))}>
          <div style={{
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.medium,
            marginBottom: tokens.spacing[1],
            opacity: 0.8,
          }}>
            Engagement Score
          </div>
          <div style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.bold,
          }}>
            {analytics.engagementScore}/100
          </div>
        </div>
      </div>
      
      {/* Engagement Score Bar */}
      <div style={{ marginBottom: tokens.spacing[4] }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.spacing[2],
        }}>
          <span style={{
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.neutral[700],
          }}>
            Engagement Level
          </span>
          <span style={{
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[600],
          }}>
            {analytics.engagementScore}/100
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '12px',
          backgroundColor: tokens.colors.neutral[200],
          borderRadius: tokens.borderRadius.full,
          overflow: 'hidden',
        }}>
          <div style={getBarChartStyles(analytics.engagementScore, getEngagementColor(analytics.engagementScore))} />
        </div>
      </div>
      
      {/* Device Breakdown */}
      <div style={{ marginBottom: tokens.spacing[4] }}>
        <h5 style={{
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: tokens.colors.neutral[700],
          marginBottom: tokens.spacing[2],
        }}>
          Device Breakdown
        </h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
          {Object.entries(analytics.deviceBreakdown).map(([device, percentage]) => (
            <div key={device} style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
              <span style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[600],
                minWidth: '60px',
                textTransform: 'capitalize',
              }}>
                {device}
              </span>
              <div style={{
                flex: 1,
                height: '8px',
                backgroundColor: tokens.colors.neutral[200],
                borderRadius: tokens.borderRadius.sm,
                overflow: 'hidden',
              }}>
                <div style={getBarChartStyles(percentage, 'primary')} />
              </div>
              <span style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[600],
                minWidth: '40px',
                textAlign: 'right',
              }}>
                {formatPercentage(percentage)}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Peak Activity Time */}
      <div style={{
        padding: tokens.spacing[3],
        backgroundColor: tokens.colors.primary[50],
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${tokens.colors.primary[200]}`,
        marginBottom: tokens.spacing[3],
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          marginBottom: tokens.spacing[1],
        }}>
          <span style={{ fontSize: tokens.typography.fontSize.lg }}>⏰</span>
          <span style={{
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.primary[800],
          }}>
            Peak Activity Time
          </span>
        </div>
        <p style={{
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.primary[700],
          margin: 0,
        }}>
          Most views occur during {analytics.peakActivityTime}
        </p>
      </div>
      
      {/* Geographic Reach */}
      {analytics.geographicReach.length > 0 && (
        <div>
          <h5 style={{
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[700],
            marginBottom: tokens.spacing[2],
          }}>
            Geographic Reach
          </h5>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: tokens.spacing[1],
          }}>
            {analytics.geographicReach.map((country, index) => (
              <span
                key={index}
                style={{
                  padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                  backgroundColor: tokens.colors.neutral[100],
                  color: tokens.colors.neutral[700],
                  borderRadius: tokens.borderRadius.sm,
                  fontSize: tokens.typography.fontSize.xs,
                  fontWeight: tokens.typography.fontWeight.medium,
                  border: `1px solid ${tokens.colors.neutral[200]}`,
                }}
              >
                {country}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
