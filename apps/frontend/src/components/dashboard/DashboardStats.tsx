import React from 'react';
import { Card } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';

interface DashboardStatsProps {
  stats: {
    activeBookings: number;
    pendingSwaps: number;
    completedSwaps: number;
    totalValue: string;
  };
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  const statsGridStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[8],
  };

  const statCardStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[6],
  };

  const statNumberStyles = {
    fontSize: tokens.typography.fontSize['3xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing[2],
  };

  const statLabelStyles = {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[600],
  };

  const statsData = [
    {
      label: 'Active Bookings',
      value: stats.activeBookings.toString(),
      color: tokens.colors.primary[600],
    },
    {
      label: 'Pending Swaps',
      value: stats.pendingSwaps.toString(),
      color: tokens.colors.warning[600],
    },
    {
      label: 'Completed Swaps',
      value: stats.completedSwaps.toString(),
      color: tokens.colors.success[600],
    },
    {
      label: 'Total Value',
      value: stats.totalValue,
      color: tokens.colors.secondary[600],
    },
  ];

  return (
    <div style={statsGridStyles}>
      {statsData.map((stat, index) => (
        <Card key={index} variant="elevated">
          <div style={statCardStyles}>
            <div style={{ ...statNumberStyles, color: stat.color }}>
              {stat.value}
            </div>
            <div style={statLabelStyles}>{stat.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
};
