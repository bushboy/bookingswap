import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectPendingSwaps,
  selectActiveSwaps,
  selectCompletedSwaps,
  selectSwapsLoading,
  selectSwapsError,
  selectSwapsFilters,
  selectUserStats,
} from '@/store/slices/swapsSlice';
import {
  fetchSwaps,
  fetchUserSwapStats,
  refreshSwaps,
} from '@/store/thunks/swapThunks';
import { SwapCard } from './SwapCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import { SwapWithBookings, SwapFilters } from '@/services/swapService';
import { SwapStatus } from '@booking-swap/shared';

interface SwapDashboardProps {
  userId: string;
  onCreateSwap?: () => void;
  onBrowseBookings?: () => void;
}

type TabType = 'all' | 'pending' | 'active' | 'completed';

export const SwapDashboard: React.FC<SwapDashboardProps> = ({
  userId,
  onCreateSwap,
  onBrowseBookings,
}) => {
  const dispatch = useAppDispatch();

  // Redux state
  const pendingSwaps = useAppSelector(selectPendingSwaps);
  const activeSwaps = useAppSelector(selectActiveSwaps);
  const completedSwaps = useAppSelector(selectCompletedSwaps);
  const loading = useAppSelector(selectSwapsLoading);
  const error = useAppSelector(selectSwapsError);
  const filters = useAppSelector(selectSwapsFilters);
  const userStats = useAppSelector(selectUserStats);

  // Local state
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'value'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load data on mount
  useEffect(() => {
    dispatch(fetchSwaps({ userId }));
    dispatch(fetchUserSwapStats(userId));
  }, [dispatch, userId]);

  // Get swaps for current tab
  const currentSwaps = useMemo(() => {
    let swaps: SwapWithBookings[] = [];

    switch (activeTab) {
      case 'pending':
        swaps = pendingSwaps;
        break;
      case 'active':
        swaps = activeSwaps;
        break;
      case 'completed':
        swaps = completedSwaps;
        break;
      default:
        swaps = [...pendingSwaps, ...activeSwaps, ...completedSwaps];
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      swaps = swaps.filter(
        swap =>
          swap.sourceBooking.title.toLowerCase().includes(query) ||
          swap.targetBooking.title.toLowerCase().includes(query) ||
          swap.sourceBooking.location.city.toLowerCase().includes(query) ||
          swap.targetBooking.location.city.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    swaps.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.timeline.createdAt);
          bValue = new Date(b.timeline.createdAt);
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'value':
          aValue = a.sourceBooking.swapValue;
          bValue = b.sourceBooking.swapValue;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return swaps;
  }, [
    activeTab,
    pendingSwaps,
    activeSwaps,
    completedSwaps,
    searchQuery,
    sortBy,
    sortOrder,
  ]);

  // Handle refresh
  const handleRefresh = () => {
    dispatch(refreshSwaps({ userId }));
    dispatch(fetchUserSwapStats(userId));
  };

  // Tab counts
  const tabCounts = {
    all: pendingSwaps.length + activeSwaps.length + completedSwaps.length,
    pending: pendingSwaps.length,
    active: activeSwaps.length,
    completed: completedSwaps.length,
  };

  // Styles
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[6],
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: tokens.spacing[4],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[3],
    alignItems: 'center',
  };

  const statsStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[6],
  };

  const statCardStyles = {
    padding: tokens.spacing[4],
    textAlign: 'center' as const,
    backgroundColor: tokens.colors.neutral[50],
    borderRadius: tokens.borderRadius.lg,
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const statValueStyles = {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary[600],
    margin: 0,
  };

  const statLabelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginTop: tokens.spacing[1],
  };

  const filtersStyles = {
    display: 'flex',
    gap: tokens.spacing[4],
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.neutral[50],
    borderRadius: tokens.borderRadius.lg,
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const tabsStyles = {
    display: 'flex',
    gap: tokens.spacing[1],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const tabStyles = (isActive: boolean) => ({
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${isActive ? tokens.colors.primary[600] : 'transparent'}`,
    cursor: 'pointer',
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: isActive ? tokens.colors.primary[600] : tokens.colors.neutral[600],
    transition: 'all 0.2s ease-in-out',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
  });

  const tabCountStyles = {
    backgroundColor: tokens.colors.neutral[200],
    color: tokens.colors.neutral[700],
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.full,
    minWidth: '20px',
    textAlign: 'center' as const,
  };

  const swapsListStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[4],
  };

  const emptyStateStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[12],
  };

  const emptyIconStyles = {
    fontSize: tokens.typography.fontSize['4xl'],
    marginBottom: tokens.spacing[4],
  };

  const emptyTitleStyles = {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[2],
  };

  const emptyDescriptionStyles = {
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[6],
  };

  const sortSelectStyles = {
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    fontSize: tokens.typography.fontSize.sm,
    cursor: 'pointer',
  };

  // Empty state content based on tab
  const getEmptyStateContent = (tab: TabType) => {
    const content = {
      all: {
        icon: '🔄',
        title: 'No swaps yet',
        description:
          'Start by browsing available swaps and proposing your first swap.',
        action: 'Browse Swaps',
      },
      pending: {
        icon: '⏳',
        title: 'No pending swaps',
        description: "You don't have any pending swap proposals at the moment.",
        action: 'Create New Swap',
      },
      active: {
        icon: '🔄',
        title: 'No active swaps',
        description: "You don't have any swaps currently in progress.",
        action: 'Browse Swaps',
      },
      completed: {
        icon: '✅',
        title: 'No completed swaps',
        description:
          'Your completed swaps will appear here once you finish your first exchange.',
        action: 'Start Swapping',
      },
    };
    return content[tab];
  };

  if (error) {
    return (
      <Card variant="outlined">
        <CardContent
          style={{ textAlign: 'center', padding: tokens.spacing[8] }}
        >
          <div
            style={{
              fontSize: tokens.typography.fontSize['2xl'],
              marginBottom: tokens.spacing[4],
            }}
          >
            ⚠️
          </div>
          <h3
            style={{
              color: tokens.colors.error[600],
              marginBottom: tokens.spacing[2],
            }}
          >
            Error loading swaps
          </h3>
          <p
            style={{
              color: tokens.colors.neutral[600],
              marginBottom: tokens.spacing[4],
            }}
          >
            {error}
          </p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <h1 style={titleStyles}>My Proposals</h1>
        <div style={actionsStyles}>
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            loading={loading}
          >
            🔄 Refresh
          </Button>
          {onBrowseBookings && (
            <Button onClick={onBrowseBookings} variant="outline">
              Browse Swaps
            </Button>
          )}
          {onCreateSwap && (
            <Button onClick={onCreateSwap} variant="primary">
              Create Swap
            </Button>
          )}
        </div>
      </div>

      {/* Statistics */}
      {userStats && (
        <div style={statsStyles}>
          <div style={statCardStyles}>
            <div style={statValueStyles}>{userStats.total}</div>
            <div style={statLabelStyles}>Total Swaps</div>
          </div>
          <div style={statCardStyles}>
            <div style={statValueStyles}>{userStats.pending}</div>
            <div style={statLabelStyles}>Pending</div>
          </div>
          <div style={statCardStyles}>
            <div style={statValueStyles}>{userStats.completed}</div>
            <div style={statLabelStyles}>Completed</div>
          </div>
          <div style={statCardStyles}>
            <div style={statValueStyles}>
              {Math.round(userStats.successRate)}%
            </div>
            <div style={statLabelStyles}>Success Rate</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={filtersStyles}>
        <Input
          placeholder="Search swaps..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          leftIcon="🔍"
          style={{ minWidth: '250px', maxWidth: '400px' }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
          }}
        >
          <label
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[700],
            }}
          >
            Sort by:
          </label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={sortSelectStyles}
          >
            <option value="date">Date</option>
            <option value="status">Status</option>
            <option value="value">Value</option>
          </select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </Button>
      </div>

      {/* Tabs */}
      <div style={tabsStyles}>
        {(['all', 'pending', 'active', 'completed'] as TabType[]).map(tab => (
          <button
            key={tab}
            style={tabStyles(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
          >
            <span style={{ textTransform: 'capitalize' }}>
              {tab === 'all' ? 'All Swaps' : tab}
            </span>
            <span style={tabCountStyles}>{tabCounts[tab]}</span>
          </button>
        ))}
      </div>

      {/* Swaps List */}
      {loading && currentSwaps.length === 0 ? (
        <Card variant="outlined">
          <CardContent
            style={{ textAlign: 'center', padding: tokens.spacing[8] }}
          >
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                marginBottom: tokens.spacing[4],
              }}
            >
              ⏳
            </div>
            <p>Loading swaps...</p>
          </CardContent>
        </Card>
      ) : currentSwaps.length > 0 ? (
        <div style={swapsListStyles}>
          {currentSwaps.map(swap => (
            <SwapCard
              key={swap.id}
              swap={swap}
              userRole={swap.proposerId === userId ? 'proposer' : 'owner'}
              variant="dashboard"
            />
          ))}
        </div>
      ) : (
        <Card variant="outlined">
          <CardContent style={emptyStateStyles}>
            <div style={emptyIconStyles}>
              {getEmptyStateContent(activeTab).icon}
            </div>
            <h3 style={emptyTitleStyles}>
              {getEmptyStateContent(activeTab).title}
            </h3>
            <p style={emptyDescriptionStyles}>
              {getEmptyStateContent(activeTab).description}
            </p>
            <Button
              variant="primary"
              onClick={
                activeTab === 'pending' ? onCreateSwap : onBrowseBookings
              }
            >
              {getEmptyStateContent(activeTab).action}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
