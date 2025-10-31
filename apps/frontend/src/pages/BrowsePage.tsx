import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/design-system/tokens';
import { Button, Input, CallToActionBanner, MessageBanner } from '@/components/ui';
import { MakeProposalModal } from '@/components/swap/MakeProposalModal';
import { FinancialDataHandler } from '../utils/financialDataHandler';
import { useBrowseData } from '../hooks/useBrowseData';
import { BookingWithProposalStatus, canUserPropose, getProposalStatusConfig } from '../types/browsePageFiltering';

interface SwapBooking {
  id: string;
  title: string;
  description?: string;
  location: {
    city: string;
    country: string;
  };
  swapValue: number;
  type: string;
  userId: string;
  dateRange?: {
    checkIn: string | Date;
    checkOut: string | Date;
  };
}

interface SwapWithProposalInfo {
  id: string;
  sourceBooking: SwapBooking;
  createdAt: string;
  status: string;
  proposalCount: number;
  userHasProposed: boolean;
  highestCashOffer?: number;
  userProposalStatus: 'none' | 'pending' | 'accepted' | 'rejected';
  swapConditions?: string[];
  paymentTypes?: ('booking' | 'cash')[];
  minCashAmount?: number;
  maxCashAmount?: number;
  acceptanceStrategy?: string;
  ownerName?: string;
  ownerId?: string;
}

// Swap Details Modal Component
interface SwapDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  swap: SwapWithProposalInfo;
}

const SwapDetailsModal: React.FC<SwapDetailsModalProps> = ({ isOpen, onClose, swap }) => {
  console.log('SwapDetailsModal render - isOpen:', isOpen, 'swap:', swap?.id);
  if (!isOpen) {
    console.log('Modal not open, returning null');
    return null;
  }

  console.log('Modal should be visible now');

  const formatCurrency = (amount: any): string => {
    return FinancialDataHandler.formatCurrency(amount, 'USD');
  };

  const getPaymentTypeIcon = (type: 'booking' | 'cash'): string => {
    return type === 'booking' ? '🔄' : '💰';
  };

  const getPaymentTypeLabel = (type: 'booking' | 'cash'): string => {
    return type === 'booking' ? 'Booking Exchange' : 'Cash Offers';
  };

  const modalStyles = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: tokens.spacing[4],
    width: '100vw',
    height: '100vh',
  };

  const contentStyles = {
    backgroundColor: 'white',
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing[6],
    maxWidth: '600px',
    width: '100%',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    border: '3px solid red', // Temporary debugging border
    position: 'relative' as const,
    zIndex: 10000,
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing[6],
    paddingBottom: tokens.spacing[4],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
  };

  const closeButtonStyles = {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: tokens.colors.neutral[500],
    padding: tokens.spacing[1],
    borderRadius: tokens.borderRadius.sm,
    transition: 'background-color 0.2s ease',
  };

  const sectionStyles = {
    marginBottom: tokens.spacing[6],
  };

  const sectionTitleStyles = {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[800],
    marginBottom: tokens.spacing[3],
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
  };

  const bookingInfoStyles = {
    backgroundColor: tokens.colors.neutral[50],
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const conditionTagStyles = {
    display: 'inline-block',
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    backgroundColor: tokens.colors.primary[100],
    color: tokens.colors.primary[700],
    borderRadius: tokens.borderRadius.sm,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    border: `1px solid ${tokens.colors.primary[200]}`,
    margin: `${tokens.spacing[1]} ${tokens.spacing[1]} ${tokens.spacing[1]} 0`,
  };

  const paymentBadgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: tokens.colors.success[100],
    color: tokens.colors.success[800],
    border: `1px solid ${tokens.colors.success[200]}`,
    marginRight: tokens.spacing[2],
  };

  return createPortal(
    <div style={modalStyles} onClick={onClose}>
      <div style={contentStyles} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyles}>
          <h2 style={titleStyles}>Swap Details</h2>
          <button
            style={closeButtonStyles}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ×
          </button>
        </div>

        {/* Booking Information */}
        <div style={sectionStyles}>
          <h3 style={sectionTitleStyles}>
            <span>🏨</span>
            <span>Booking Information</span>
          </h3>
          <div style={bookingInfoStyles}>
            <h4 style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              marginBottom: tokens.spacing[2],
              color: tokens.colors.neutral[900]
            }}>
              {swap.sourceBooking.title}
            </h4>
            <p style={{
              color: tokens.colors.neutral[600],
              marginBottom: tokens.spacing[3],
              fontSize: tokens.typography.fontSize.sm
            }}>
              {swap.sourceBooking.description}
            </p>
            <div style={{ marginBottom: tokens.spacing[2] }}>
              <strong>📍 Location:</strong> {swap.sourceBooking.location.city}, {swap.sourceBooking.location.country}
            </div>
            <div style={{ marginBottom: tokens.spacing[2] }}>
              <strong>💰 Swap Value:</strong> {formatCurrency(swap.sourceBooking.swapValue)}
            </div>
            <div>
              <strong>📅 Created:</strong> {new Date(swap.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Payment Types */}
        {swap.paymentTypes && swap.paymentTypes.length > 0 && (
          <div style={sectionStyles}>
            <h3 style={sectionTitleStyles}>
              <span>💳</span>
              <span>Payment Types</span>
            </h3>
            <div>
              {swap.paymentTypes.map(type => (
                <span key={type} style={paymentBadgeStyles}>
                  <span>{getPaymentTypeIcon(type)}</span>
                  <span>{getPaymentTypeLabel(type)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cash Requirements */}
        {(swap.minCashAmount || swap.maxCashAmount) && (
          <div style={sectionStyles}>
            <h3 style={sectionTitleStyles}>
              <span>💰</span>
              <span>Cash Requirements</span>
            </h3>
            <div>
              {swap.minCashAmount && (
                <span style={{ fontWeight: tokens.typography.fontWeight.semibold }}>
                  Minimum: {formatCurrency(swap.minCashAmount)}
                </span>
              )}
              {swap.minCashAmount && swap.maxCashAmount && (
                <span style={{ margin: `0 ${tokens.spacing[2]}` }}>-</span>
              )}
              {swap.maxCashAmount && (
                <span style={{ fontWeight: tokens.typography.fontWeight.semibold }}>
                  Maximum: {formatCurrency(swap.maxCashAmount)}
                </span>
              )}
              {!swap.maxCashAmount && swap.minCashAmount && (
                <span style={{ color: tokens.colors.neutral[600] }}>minimum</span>
              )}
            </div>
          </div>
        )}

        {/* Swap Conditions */}
        {swap.swapConditions && swap.swapConditions.length > 0 && (
          <div style={sectionStyles}>
            <h3 style={sectionTitleStyles}>
              <span>📋</span>
              <span>Swap Conditions</span>
            </h3>
            <div>
              {swap.swapConditions.map((condition, index) => (
                <span key={index} style={conditionTagStyles}>
                  {condition}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Proposal Information */}
        <div style={sectionStyles}>
          <h3 style={sectionTitleStyles}>
            <span>📊</span>
            <span>Proposal Information</span>
          </h3>
          <div>
            <div style={{ marginBottom: tokens.spacing[2] }}>
              <strong>Proposals Received:</strong> {swap.proposalCount}
            </div>
            {swap.highestCashOffer && (
              <div style={{ marginBottom: tokens.spacing[2] }}>
                <strong>Highest Cash Offer:</strong> {formatCurrency(swap.highestCashOffer)}
              </div>
            )}
            {swap.acceptanceStrategy && (
              <div>
                <strong>Acceptance Strategy:</strong> {swap.acceptanceStrategy}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: tokens.spacing[3],
          justifyContent: 'flex-end',
          marginTop: tokens.spacing[6],
          paddingTop: tokens.spacing[4],
          borderTop: `1px solid ${tokens.colors.neutral[200]}`
        }}>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const BrowsePage: React.FC = () => {
  console.log('BrowsePage: Component mounting/remounting');

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Use the enhanced browse data hook
  const { bookings, loading, error, refreshData } = useBrowseData();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'price' | 'proposals'>('created');

  // Modal state
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [selectedBookingForProposal, setSelectedBookingForProposal] = useState<BookingWithProposalStatus | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);

  // Message state for user feedback
  const [messageText, setMessageText] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'info' | 'warning' | 'error' | 'success'>('info');

  // Swap details modal state (keeping existing functionality)
  const [isSwapDetailsModalOpen, setIsSwapDetailsModalOpen] = useState(false);
  const [selectedSwapForDetails, setSelectedSwapForDetails] = useState<SwapWithProposalInfo | null>(null);

  /**
   * Show a temporary message to the user
   */
  const showMessage = (text: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setMessageText(null);
    }, 5000);
  };

  /**
   * Handle proposal attempts with intelligent checks for ownership and duplicate proposals
   * Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3
   */
  const handleProposalAttempt = async (booking: BookingWithProposalStatus) => {
    console.log('BrowsePage: handleProposalAttempt called for booking:', booking.id);

    // Check if user is authenticated
    if (!isAuthenticated) {
      console.log('🔒 LOGIN REDIRECT TRIGGERED by BrowsePage:', {
        component: 'BrowsePage',
        reason: 'User not authenticated for browse page',
        conditions: {
          isAuthenticated: isAuthenticated,
          hasUser: !!user,
          currentPath: location.pathname
        },
        redirectTo: '/login',
        timestamp: new Date().toISOString()
      });
      console.log('BrowsePage: User not authenticated, redirecting to login');
      navigate('/login', {
        state: {
          from: location.pathname,
          action: 'make-proposal',
          context: { bookingId: booking.id }
        }
      });
      return;
    }

    // Check if it's user's own booking
    if (booking.isOwnBooking || booking.userId === user?.id) {
      console.log('BrowsePage: User attempting to propose on own booking');
      showMessage("You cannot propose on your own booking", 'info');

      // Refresh data to ensure proper filtering
      await refreshData();
      return;
    }

    // Check if user already has an active proposal
    if (booking.userProposalStatus === 'pending') {
      console.log('BrowsePage: User already has pending proposal');
      showMessage("You already have a pending proposal for this booking", 'info');

      // Refresh data to update UI state
      await refreshData();
      return;
    }

    // Check if user can propose based on proposal status
    if (!canUserPropose(booking, user?.id)) {
      console.log('BrowsePage: User cannot propose based on current status');
      const statusConfig = getProposalStatusConfig(booking.userProposalStatus || 'none');
      showMessage(statusConfig.tooltipText || "You cannot propose on this booking at this time", 'warning');

      // Refresh data to update UI state
      await refreshData();
      return;
    }

    // All checks passed - proceed with proposal creation
    console.log('BrowsePage: All checks passed, opening proposal modal');
    setSelectedBookingForProposal(booking);
    setIsProposalModalOpen(true);
  };

  // Filter and sort bookings based on search and sort criteria
  const filteredAndSortedBookings = useMemo(() => {
    let filtered = [...bookings];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(booking =>
        booking.title?.toLowerCase().includes(query) ||
        booking.description?.toLowerCase().includes(query) ||
        booking.location?.city?.toLowerCase().includes(query) ||
        booking.location?.country?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          const aPrice = (a as any).swapValue || 0;
          const bPrice = (b as any).swapValue || 0;
          return bPrice - aPrice; // Highest first
        case 'proposals':
          // For now, sort by creation date since we don't have proposal count in booking data
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'created':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Newest first
      }
    });

    return filtered;
  }, [bookings, searchQuery, sortBy]);

  /**
   * Handle booking selection for details view (keeping existing functionality)
   */
  const handleBookingSelect = (booking: BookingWithProposalStatus) => {
    try {
      console.log('View Details clicked for booking:', booking.id);
      // Convert booking to swap format for existing modal
      const swapForDetails: SwapWithProposalInfo = {
        id: booking.id,
        sourceBooking: {
          id: booking.id,
          title: booking.title,
          description: booking.description,
          location: {
            city: booking.location?.city || 'Unknown',
            country: booking.location?.country || 'Unknown'
          },
          swapValue: (booking as any).swapValue || 0,
          type: (booking as any).type || 'hotel',
          userId: booking.userId,
          dateRange: (booking as any).dateRange
        },
        createdAt: booking.createdAt instanceof Date ? booking.createdAt.toISOString() : booking.createdAt,
        status: 'pending',
        proposalCount: 0,
        userHasProposed: booking.userProposalStatus !== 'none',
        userProposalStatus: booking.userProposalStatus || 'none',
        swapConditions: [],
        paymentTypes: [],
        ownerName: (booking as any).ownerName
      };

      setSelectedSwapForDetails(swapForDetails);
      setIsSwapDetailsModalOpen(true);
      console.log('Modal state updated - should be open now');
    } catch (error) {
      console.error('Error selecting booking:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to select booking';
      showMessage(`Failed to select booking: ${errorMessage}`, 'error');
    }
  };

  /**
   * Handle closing the proposal modal
   */
  const handleCloseProposalModal = () => {
    setIsProposalModalOpen(false);
    setSelectedBookingForProposal(null);
    setProposalLoading(false);
  };

  /**
   * Handle proposal creation failures
   * Requirements: 3.3, 4.1 - Add error handling for proposal creation failures
   */
  const handleProposalError = async (error: any) => {
    console.error('Proposal creation failed:', error);

    let errorMessage = 'Failed to submit proposal';
    let shouldRefreshData = false;

    if (error instanceof Error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        errorMessage = 'You already have a pending proposal for this booking';
        shouldRefreshData = true; // Refresh to update UI state
      } else if (error.message.includes('own booking') || error.message.includes('ownership')) {
        errorMessage = 'You cannot propose on your own booking';
        shouldRefreshData = true; // Refresh to apply filtering
      } else if (error.message.includes('auth') || error.message.includes('unauthorized')) {
        errorMessage = 'Authentication required. Please log in and try again';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again';
      } else {
        errorMessage = `Proposal submission failed: ${error.message}`;
      }
    }

    showMessage(errorMessage, 'error');

    // Refresh data if needed to update UI state
    if (shouldRefreshData) {
      try {
        await refreshData();
        console.log('Data refreshed after proposal error to update UI state');
      } catch (refreshError) {
        console.error('Failed to refresh data after proposal error:', refreshError);
      }
    }

    // Don't close the modal on error - let user retry or manually close
    setProposalLoading(false);
  };

  /**
   * Handle closing the swap details modal
   */
  const handleCloseSwapDetailsModal = () => {
    setIsSwapDetailsModalOpen(false);
    setSelectedSwapForDetails(null);
  };

  /**
   * Handle successful proposal submission
   * Requirements: 3.3, 4.1 - Refresh browse data and update proposal status immediately
   */
  const handleProposalSubmit = async (proposalData: any) => {
    if (!selectedBookingForProposal) return;

    setProposalLoading(true);

    try {
      console.log('Proposal submitted successfully:', proposalData);

      // Determine if this was a cash offer or swap proposal
      const isCashOffer = proposalData.cashOffer || !proposalData.sourceSwapId;
      const bookingTitle = selectedBookingForProposal.title || 'the selected booking';

      // Show success message based on proposal type
      const successMessage = isCashOffer
        ? `Your cash offer for "${bookingTitle}" has been submitted successfully!`
        : `Your proposal for "${bookingTitle}" has been submitted successfully!`;

      showMessage(successMessage, 'success');

      // Close modal first to provide immediate feedback
      handleCloseProposalModal();

      // Provide immediate visual feedback by showing a temporary loading state
      showMessage('Updating proposal status...', 'info');

      // Refresh browse data to update proposal status immediately
      console.log('Refreshing browse data to update proposal status...');
      await refreshData();

      console.log('Browse data refreshed - proposal status should now be updated in UI');

      // Clear the loading message and show confirmation
      setTimeout(() => {
        showMessage('Proposal status updated successfully!', 'success');
      }, 500);

    } catch (error) {
      console.error('Error in proposal submission callback:', error);

      // Enhanced error handling with specific error messages
      let errorMessage = 'Failed to refresh booking list after proposal submission';

      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error occurred while updating the page. Your proposal was submitted, but the page may not reflect the latest status. Please refresh manually.';
        } else if (error.message.includes('auth')) {
          errorMessage = 'Authentication error occurred while updating the page. Your proposal was submitted successfully.';
        } else {
          errorMessage = `Error updating page: ${error.message}. Your proposal was submitted successfully.`;
        }
      }

      showMessage(errorMessage, 'warning');

      // Still close the modal since the proposal was actually submitted successfully
      // The error is just in the refresh process
      handleCloseProposalModal();

      // Try to refresh data anyway, but don't throw if it fails
      try {
        await refreshData();
      } catch (refreshError) {
        console.error('Failed to refresh data after proposal submission:', refreshError);
        // Show additional message suggesting manual refresh
        setTimeout(() => {
          showMessage('Please refresh the page manually to see your updated proposal status.', 'info');
        }, 3000);
      }
    } finally {
      setProposalLoading(false);
    }
  };

  const formatCurrency = (amount: any): string => {
    return FinancialDataHandler.formatCurrency(amount, 'USD');
  };

  const getBookingTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      hotel: '🏨',
      vacation_rental: '🏠',
      resort: '🏖️',
      event: '🎫',
      concert: '🎵',
      sports: '⚽',
      theater: '🎭',
      flight: '✈️',
      rental: '🚗',
    };
    return icons[type] || '📋';
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: tokens.colors.neutral[50],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[3],
          color: tokens.colors.neutral[500],
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: `3px solid ${tokens.colors.neutral[200]}`,
            borderTop: `3px solid ${tokens.colors.primary[500]}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="browse-page-container"
      style={{
        minHeight: '100vh',
        backgroundColor: tokens.colors.neutral[50],
        padding: `${tokens.spacing[6]} 0`,
      }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: `0 ${tokens.spacing[6]}` }}>
        {/* Header */}
        <div style={{ marginBottom: tokens.spacing[8] }}>
          <h1 style={{
            fontSize: tokens.typography.fontSize['3xl'],
            fontWeight: tokens.typography.fontWeight.bold,
            color: tokens.colors.neutral[900],
            margin: `0 0 ${tokens.spacing[2]} 0`,
          }}>
            Browse Swaps
          </h1>
          <p style={{
            fontSize: tokens.typography.fontSize.lg,
            color: tokens.colors.neutral[600],
            margin: 0,
          }}>
            {isAuthenticated
              ? 'Find swaps you can match with your bookings'
              : 'Discover amazing swap opportunities from our community'
            }
          </p>
        </div>

        {/* Call-to-Action Banner for Unauthenticated Users */}
        {!isAuthenticated && (
          <CallToActionBanner
            message="Sign up to create proposals and manage your swaps. Join thousands of users already swapping their bookings!"
            primaryAction={{ label: "Sign Up Free", path: "/register" }}
            secondaryAction={{ label: "Sign In", path: "/login" }}
          />
        )}

        {/* Search and Sort Controls */}
        <div style={{
          display: 'flex',
          gap: tokens.spacing[4],
          marginBottom: tokens.spacing[6],
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <Input
              placeholder="Search by title, location, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<span>🔍</span>}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
            <label style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
            }}>
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                border: `1px solid ${tokens.colors.neutral[300]}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.sm,
              }}
            >
              <option value="created">Newest First</option>
              <option value="price">Highest Value</option>
              <option value="proposals">Most Proposals</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: tokens.spacing[12],
            color: tokens.colors.neutral[500],
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: `3px solid ${tokens.colors.neutral[200]}`,
              borderTop: `3px solid ${tokens.colors.primary[500]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: tokens.spacing[3],
            }} />
            Loading swaps...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            padding: tokens.spacing[6],
            backgroundColor: tokens.colors.error[50],
            border: `1px solid ${tokens.colors.error[200]}`,
            borderRadius: tokens.borderRadius.lg,
            marginBottom: tokens.spacing[6],
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: tokens.spacing[3],
              marginBottom: tokens.spacing[4],
            }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <h3 style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.error[800],
                margin: 0,
              }}>
                Unable to Load Swaps
              </h3>
            </div>

            <p style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.error[700],
              margin: `0 0 ${tokens.spacing[4]} 0`,
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              {error}
            </p>

            <div style={{
              display: 'flex',
              gap: tokens.spacing[3],
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <Button
                variant="primary"
                onClick={() => {
                  refreshData();
                }}
                disabled={loading}
              >
                {loading ? 'Retrying...' : 'Try Again'}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  // Error will be cleared by refreshData or user can dismiss
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Message Banner for User Feedback */}
        {messageText && (
          <MessageBanner
            message={messageText}
            type={messageType}
            onDismiss={() => setMessageText(null)}
            autoDissmissTimeout={5000}
          />
        )}

        {/* Results Count and Last Refresh */}
        {!loading && !error && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: tokens.spacing[4],
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
            flexWrap: 'wrap',
            gap: tokens.spacing[2],
          }}>
            <span>
              Showing {filteredAndSortedBookings.length} booking{filteredAndSortedBookings.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[3],
            }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshData()}
                disabled={loading}
                style={{
                  padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                  fontSize: tokens.typography.fontSize.xs,
                }}
              >
                {loading ? '🔄' : '↻'} Refresh
              </Button>
            </div>
          </div>
        )}

        {/* Bookings Grid */}
        {!loading && !error && filteredAndSortedBookings.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: tokens.spacing[6],
          }}>
            {filteredAndSortedBookings.map((booking) => (
              <div
                key={booking.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: tokens.borderRadius.lg,
                  border: `1px solid ${tokens.colors.neutral[200]}`,
                  padding: tokens.spacing[6],
                  boxShadow: tokens.shadows.sm,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = tokens.shadows.md;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = tokens.shadows.sm;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onClick={() => handleBookingSelect(booking)}
              >
                {/* Booking Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[3],
                  marginBottom: tokens.spacing[4],
                }}>
                  <span style={{ fontSize: '24px' }}>
                    {getBookingTypeIcon((booking as any).type || 'hotel')}
                  </span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: 0,
                      lineHeight: tokens.typography.lineHeight.tight,
                    }}>
                      {booking.title || 'Untitled Booking'}
                    </h3>
                    <p style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                      margin: 0,
                    }}>
                      {booking.location ? `${booking.location.city}, ${booking.location.country}` : 'Unknown Location'}
                    </p>
                    {(booking as any).ownerName && (
                      <p style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                        margin: `${tokens.spacing[1]} 0 0 0`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[1],
                      }}>
                        <span>👤</span>
                        <span>Posted by {(booking as any).ownerName}</span>
                      </p>
                    )}
                    {(booking as any).dateRange && (
                      <p style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                        margin: `${tokens.spacing[1]} 0 0 0`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[1],
                      }}>
                        <span>📅</span>
                        <span>
                          {new Date((booking as any).dateRange.checkIn).toLocaleDateString()} - {new Date((booking as any).dateRange.checkOut).toLocaleDateString()}
                        </span>
                      </p>
                    )}
                  </div>
                  <div style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.primary[600],
                  }}>
                    {formatCurrency((booking as any).swapValue || 0)}
                  </div>
                </div>

                {/* Booking Description */}
                {booking.description && (
                  <p style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[700],
                    margin: `0 0 ${tokens.spacing[4]} 0`,
                    lineHeight: tokens.typography.lineHeight.relaxed,
                  }}>
                    {booking.description.length > 120
                      ? `${booking.description.substring(0, 120)}...`
                      : booking.description
                    }
                  </p>
                )}

                {/* Proposal Status Information */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[4],
                  marginBottom: tokens.spacing[4],
                  padding: tokens.spacing[3],
                  backgroundColor: tokens.colors.neutral[50],
                  borderRadius: tokens.borderRadius.md,
                }}>
                  {/* Proposal Status Indicator */}
                  {isAuthenticated && booking.userProposalStatus && booking.userProposalStatus !== 'none' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                    }}>
                      <span style={{ fontSize: '16px' }}>
                        {booking.userProposalStatus === 'pending' ? '⏳' :
                          booking.userProposalStatus === 'accepted' ? '✅' :
                            booking.userProposalStatus === 'rejected' ? '❌' : '💬'}
                      </span>
                      <span style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: booking.userProposalStatus === 'pending' ? tokens.colors.warning[700] :
                          booking.userProposalStatus === 'accepted' ? tokens.colors.success[700] :
                            booking.userProposalStatus === 'rejected' ? tokens.colors.error[700] :
                              tokens.colors.neutral[700],
                        fontWeight: tokens.typography.fontWeight.medium,
                      }}>
                        {getProposalStatusConfig(booking.userProposalStatus).displayText}
                      </span>
                    </div>
                  )}

                  {!isAuthenticated && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                      marginLeft: 'auto',
                    }}>
                      <span style={{ fontSize: '16px' }}>🔐</span>
                      <span style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        fontWeight: tokens.typography.fontWeight.medium,
                      }}>
                        Sign in to propose
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: tokens.spacing[3],
                  justifyContent: 'flex-end',
                }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBookingSelect(booking);
                    }}
                  >
                    View Details
                  </Button>

                  {(() => {
                    if (!isAuthenticated) {
                      return (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProposalAttempt(booking);
                          }}
                        >
                          Sign In to Propose
                        </Button>
                      );
                    }

                    const statusConfig = getProposalStatusConfig(booking.userProposalStatus || 'none');

                    return (
                      <Button
                        variant={statusConfig.buttonDisabled ? "outline" : "primary"}
                        size="sm"
                        disabled={statusConfig.buttonDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProposalAttempt(booking);
                        }}
                        title={statusConfig.tooltipText}
                      >
                        {statusConfig.buttonText}
                      </Button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredAndSortedBookings.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: tokens.spacing[12],
            color: tokens.colors.neutral[500],
          }}>
            <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
              {bookings.length === 0 ? '📭' : '🔍'}
            </div>
            <h3 style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[700],
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}>
              {bookings.length === 0 ? 'No bookings available' : 'No bookings match your search'}
            </h3>
            <p style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[500],
              margin: 0,
              maxWidth: '500px',
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.5,
            }}>
              {bookings.length === 0
                ? `There are no available bookings${isAuthenticated ? ' for you to propose on' : ''} at the moment. Check back later!`
                : 'Try adjusting your search terms to find more results.'
              }
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => setSearchQuery('')}
                style={{ marginTop: tokens.spacing[4] }}
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Make Proposal Modal - Only for authenticated users */}
      {
        isAuthenticated && selectedBookingForProposal && (
          <MakeProposalModal
            isOpen={isProposalModalOpen}
            onClose={handleCloseProposalModal}
            targetSwap={{
              id: selectedBookingForProposal.swapId, // Use the swap ID, not booking ID
              sourceBooking: {
                id: selectedBookingForProposal.id,
                title: selectedBookingForProposal.title,
                description: selectedBookingForProposal.description,
                location: {
                  city: selectedBookingForProposal.location?.city || 'Unknown',
                  country: selectedBookingForProposal.location?.country || 'Unknown'
                },
                swapValue: selectedBookingForProposal.swapValue || 0,
                type: (selectedBookingForProposal as any).type || 'hotel',
                userId: selectedBookingForProposal.userId,
                dateRange: selectedBookingForProposal.dateRange ? {
                  checkIn: selectedBookingForProposal.dateRange.checkIn instanceof Date
                    ? selectedBookingForProposal.dateRange.checkIn
                    : new Date(selectedBookingForProposal.dateRange.checkIn),
                  checkOut: selectedBookingForProposal.dateRange.checkOut instanceof Date
                    ? selectedBookingForProposal.dateRange.checkOut
                    : new Date(selectedBookingForProposal.dateRange.checkOut)
                } : undefined
              },
              createdAt: selectedBookingForProposal.createdAt instanceof Date ? selectedBookingForProposal.createdAt.toISOString() : selectedBookingForProposal.createdAt,
              status: 'pending',
              proposalCount: 0,
              userHasProposed: selectedBookingForProposal.userProposalStatus !== 'none',
              userProposalStatus: selectedBookingForProposal.userProposalStatus || 'none'
            } as any}
            userEligibleSwaps={[]}
            onSubmit={(proposalData) => {
              // Wrap the proposal submit handler to catch any errors in the success flow
              handleProposalSubmit(proposalData).catch((error) => {
                console.error('Error in proposal success handler:', error);
                handleProposalError(error);
              });
            }}
            loading={proposalLoading}
          />
        )
      }

      {/* Swap Details Modal */}
      {
        selectedSwapForDetails && (
          <SwapDetailsModal
            isOpen={isSwapDetailsModalOpen}
            onClose={handleCloseSwapDetailsModal}
            swap={selectedSwapForDetails}
          />
        )
      }

    </div >
  );
};