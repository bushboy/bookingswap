import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '@/store';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { BookingOverview } from '@/components/dashboard/BookingOverview';
import { TransactionHistory } from '@/components/dashboard/TransactionHistory';
import { SwapStatusCenter } from '@/components/dashboard/SwapStatusCenter';
import { NotificationCenter } from '@/components/dashboard/NotificationCenter';
import { UnifiedBookingForm } from '@/components/booking/UnifiedBookingForm';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { UnifiedBookingService } from '@/services/UnifiedBookingService';
import { UnifiedBookingData, BookingWithSwapInfo } from '@booking-swap/shared';
import {
  setStats,
  setTransactions,
  setNotifications,
  setSwapProposals,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/store/slices/dashboardSlice';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, walletConnected } = useSelector(
    (state: RootState) => state.auth
  );
  const { bookings } = useSelector((state: RootState) => state.bookings);
  const { stats, transactions, notifications, swapProposals } = useSelector(
    (state: RootState) => state.dashboard
  );

  // Enhanced dashboard state
  const [showUnifiedBookingForm, setShowUnifiedBookingForm] = useState(false);
  const [unifiedBookings, setUnifiedBookings] = useState<BookingWithSwapInfo[]>([]);
  const [unifiedService] = useState(() => new UnifiedBookingService());
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  const headerStyles = {
    marginBottom: tokens.spacing[6],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const contentGridStyles = {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: tokens.spacing[6],
    marginBottom: tokens.spacing[6],
  };

  const quickActionStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
  };

  // Load enhanced dashboard data
  const loadEnhancedDashboardData = async () => {
    if (!user?.id) return;

    try {
      // Load user's bookings with swap information
      const userBookingsWithSwap = await unifiedService.getBookingsWithSwapInfo(
        { userId: user.id },
        user.id
      );
      setUnifiedBookings(userBookingsWithSwap);

      // Load enhanced statistics
      const enhancedStats = await unifiedService.getBookingSwapStatistics({
        userId: user.id
      });
      setDashboardStats(enhancedStats);

      // Update Redux stats with enhanced data
      dispatch(
        setStats({
          activeBookings: enhancedStats.totalBookings,
          pendingSwaps: enhancedStats.activeAuctions,
          completedSwaps: userBookingsWithSwap.filter(b => b.status === 'swapped').length,
          totalValue: `$${enhancedStats.averageCashOffer.toLocaleString()}`,
        })
      );
    } catch (error) {
      console.error('Failed to load enhanced dashboard data:', error);
      // Fallback to existing logic
      loadLegacyDashboardData();
    }
  };

  // Legacy data initialization - fallback for compatibility
  const loadLegacyDashboardData = () => {
    dispatch(
      setStats({
        activeBookings: bookings.filter(b => b.status === 'available').length,
        pendingSwaps: 2,
        completedSwaps: 8,
        totalValue: '$12,500',
      })
    );

    dispatch(
      setTransactions([
        {
          id: '1',
          type: 'swap_completed',
          title: 'Swap completed successfully',
          description: 'Hotel in Paris ⇄ Concert Tickets',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          amount: 2500,
          blockchainTxId: '0x1234567890abcdef',
          status: 'completed',
        },
        {
          id: '2',
          type: 'swap_proposed',
          title: 'New swap proposal received',
          description: 'Flight to Tokyo ⇄ Ski Resort Booking',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          amount: 1800,
          blockchainTxId: '0xabcdef1234567890',
          status: 'pending',
        },
        {
          id: '3',
          type: 'booking_listed',
          title: 'Booking listed for swap',
          description: 'Luxury Hotel in Miami',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          amount: 3200,
          blockchainTxId: '0x567890abcdef1234',
          status: 'completed',
        },
      ])
    );

    dispatch(
      setNotifications([
        {
          id: '1',
          type: 'swap_proposal',
          title: 'New swap proposal',
          message:
            'Someone wants to swap their Tokyo flight for your Miami hotel booking',
          timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          read: false,
          priority: 'high',
        },
        {
          id: '2',
          type: 'swap_completed',
          title: 'Swap completed',
          message: 'Your Paris hotel swap has been completed successfully',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          read: false,
          priority: 'medium',
        },
        {
          id: '3',
          type: 'booking_expired',
          title: 'Booking expiring soon',
          message: 'Your concert tickets listing will expire in 24 hours',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          read: true,
          priority: 'medium',
        },
      ])
    );

    dispatch(
      setSwapProposals([
        {
          id: '1',
          sourceBookingTitle: 'Tokyo Flight',
          targetBookingTitle: 'Miami Hotel',
          proposerName: 'Alice Johnson',
          status: 'pending',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
          additionalPayment: 500,
          isIncoming: true,
        },
        {
          id: '2',
          sourceBookingTitle: 'Paris Hotel',
          targetBookingTitle: 'Concert Tickets',
          proposerName: 'Bob Smith',
          status: 'completed',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
          isIncoming: false,
        },
      ])
    );
  };

  // Main useEffect for data loading
  useEffect(() => {
    if (user?.id) {
      loadEnhancedDashboardData();
    } else {
      loadLegacyDashboardData();
    }
  }, [dispatch, bookings, user?.id]);

  const handleViewAllBookings = () => {
    navigate('/bookings');
  };

  // Enhanced booking creation handler
  const handleCreateBookingWithSwap = async (data: UnifiedBookingData) => {
    try {
      const result = await unifiedService.createBookingWithSwap(data);

      // Refresh dashboard data immediately to show the new booking
      await loadEnhancedDashboardData();

      // Close the form
      setShowUnifiedBookingForm(false);

      // Show success message after refresh
      alert(`Booking created successfully${result.swap ? ' with swap enabled' : ''}!`);
    } catch (error) {
      console.error('Failed to create booking:', error);
      alert(error instanceof Error ? error.message : 'Failed to create booking');
    }
  };

  const handleViewTransaction = (txId: string) => {
    // Open blockchain explorer in new tab
    window.open(`https://hashscan.io/testnet/transaction/${txId}`, '_blank');
  };

  const handleAcceptSwap = (swapId: string) => {
    navigate(`/swaps/${swapId}/accept`);
  };

  const handleRejectSwap = (swapId: string) => {
    if (confirm('Are you sure you want to reject this swap proposal?')) {
      // TODO: Implement reject swap API call
      console.log('Reject swap:', swapId);
    }
  };

  const handleViewSwap = (swapId: string) => {
    navigate(`/swaps/${swapId}`);
  };

  const handleNotificationClick = (notification: any) => {
    // Navigate based on notification type
    switch (notification.type) {
      case 'swap_proposal':
        navigate('/swaps');
        break;
      case 'swap_completed':
        navigate('/swaps');
        break;
      case 'booking_expired':
        navigate('/bookings');
        break;
      default:
        console.log('Notification clicked:', notification);
    }
  };

  const handleMarkAsRead = (notificationId: string) => {
    dispatch(markNotificationAsRead(notificationId));
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllNotificationsAsRead());
  };

  return (
    <div>
      <div style={headerStyles}>
        <h1 style={titleStyles}>
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}!
        </h1>
      </div>

      {/* Dashboard Stats */}
      <DashboardStats stats={stats} />

      {/* Main Content Grid */}
      <div style={contentGridStyles}>
        {/* Left Column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[6],
          }}
        >
          <BookingOverview
            bookings={bookings}
            onViewAll={handleViewAllBookings}
          />
          <TransactionHistory
            transactions={transactions}
            onViewTransaction={handleViewTransaction}
          />
        </div>

        {/* Right Column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[4],
          }}
        >
          <Card variant="outlined">
            <CardHeader>
              <h2
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  margin: 0,
                }}
              >
                Quick Actions
              </h2>
            </CardHeader>
            <CardContent>
              <div style={quickActionStyles}>
                <Button
                  variant="primary"
                  style={{ width: '100%' }}
                  onClick={() => setShowUnifiedBookingForm(true)}
                >
                  Create Booking + Swap
                </Button>
                <Button
                  variant="outline"
                  style={{ width: '100%' }}
                  onClick={() => navigate('/browse')}
                >
                  Browse Enhanced Listings
                </Button>
                <Button
                  variant="ghost"
                  style={{ width: '100%' }}
                  onClick={() => navigate('/bookings/new')}
                >
                  Legacy Booking Form
                </Button>
                <Button
                  variant="ghost"
                  style={{ width: '100%' }}
                  onClick={() => navigate('/profile')}
                >
                  View Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <h2
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  margin: 0,
                }}
              >
                Wallet Status
              </h2>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: tokens.spacing[3],
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                    }}
                  >
                    Connection
                  </span>
                  <span
                    style={{
                      padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                      borderRadius: tokens.borderRadius.md,
                      fontSize: tokens.typography.fontSize.xs,
                      fontWeight: tokens.typography.fontWeight.medium,
                      backgroundColor: walletConnected
                        ? tokens.colors.success[100]
                        : tokens.colors.error[100],
                      color: walletConnected
                        ? tokens.colors.success[800]
                        : tokens.colors.error[800],
                    }}
                  >
                    {walletConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                    }}
                  >
                    Balance
                  </span>
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.base,
                      fontWeight: tokens.typography.fontWeight.medium,
                    }}
                  >
                    {walletConnected ? '1,234.56 HBAR' : '--'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ width: '100%' }}
                  onClick={() =>
                    window.open('https://hashscan.io/testnet', '_blank')
                  }
                >
                  View Transactions
                </Button>
              </div>
            </CardContent>
          </Card>

          <NotificationCenter
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      </div>

      {/* Swap Status Center */}
      <SwapStatusCenter
        swapProposals={swapProposals}
        onAcceptSwap={handleAcceptSwap}
        onRejectSwap={handleRejectSwap}
        onViewSwap={handleViewSwap}
      />

      {/* Enhanced Dashboard Stats */}
      {dashboardStats && (
        <Card variant="outlined" style={{ marginTop: tokens.spacing[6] }}>
          <CardHeader>
            <h2
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                margin: 0,
              }}
            >
              Enhanced Swap Statistics
            </h2>
          </CardHeader>
          <CardContent>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.spacing[4],
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.primary[600],
                }}>
                  {dashboardStats.swappableBookings}
                </div>
                <div style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}>
                  Swappable Bookings
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.warning[600],
                }}>
                  {dashboardStats.activeAuctions}
                </div>
                <div style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}>
                  Active Auctions
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.success[600],
                }}>
                  ${dashboardStats.averageCashOffer.toLocaleString()}
                </div>
                <div style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}>
                  Avg Cash Offer
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.error[600],
                }}>
                  {dashboardStats.endingSoonCount}
                </div>
                <div style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}>
                  Ending Soon
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unified Booking Form Modal */}
      <UnifiedBookingForm
        isOpen={showUnifiedBookingForm}
        onClose={() => setShowUnifiedBookingForm(false)}
        onSubmit={handleCreateBookingWithSwap}
        mode="create"
      />
    </div>
  );
};
