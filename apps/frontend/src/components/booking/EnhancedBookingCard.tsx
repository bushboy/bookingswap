/**
 * Enhanced BookingCard component with integrated swap functionality
 * Requirement 2.1, 2.2: Booking listings with integrated swap actions
 */

import React from 'react';
import { BookingCard } from './BookingCard';
import { SwapStatusBadge } from './SwapStatusBadge';
import { SwapInfoPanel } from './SwapInfoPanel';
import { BookingWithSwapInfo, BookingUserRole, SwapInfo } from '@booking-swap/shared';
import { Booking } from '@/services/bookingService';
import { tokens } from '@/design-system/tokens';
import { Button } from '@/components/ui';

export interface EnhancedBookingCardProps {
  booking: BookingWithSwapInfo;
  swapInfo?: SwapInfo;
  userRole: BookingUserRole;
  onViewDetails: (booking: Booking) => void;
  onMakeProposal?: (booking: Booking) => void;
  onManageSwap?: (swapInfo: SwapInfo) => void;
  onEditBooking?: (booking: Booking) => void;
}

export const EnhancedBookingCard: React.FC<EnhancedBookingCardProps> = ({
  booking,
  swapInfo,
  userRole,
  onViewDetails,
  onMakeProposal,
  onManageSwap,
  onEditBooking,
}) => {
  const cardStyles = {
    position: 'relative' as const,
    backgroundColor: 'white',
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing[4],
    boxShadow: tokens.shadows.sm,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing[3],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const contentStyles = {
    marginBottom: tokens.spacing[4],
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    justifyContent: 'flex-end',
  };

  const renderActions = () => {
    switch (userRole) {
      case 'owner':
        return (
          <div style={actionsStyles}>
            {onEditBooking && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEditBooking(booking)}
                disabled={swapInfo?.hasAnySwapInitiated}
                title={swapInfo?.hasAnySwapInitiated ? 'Cannot edit booking with initiated swaps' : 'Edit booking details'}
              >
                Edit Booking
              </Button>
            )}
            {swapInfo && onManageSwap && (
              <Button variant="primary" size="sm" onClick={() => onManageSwap(swapInfo)}>
                Manage Swap
              </Button>
            )}
          </div>
        );

      case 'browser':
        return (
          <div style={actionsStyles}>
            <Button variant="outline" size="sm" onClick={() => onViewDetails(booking)}>
              View Details
            </Button>
            {swapInfo && onMakeProposal && (
              <Button variant="primary" size="sm" onClick={() => onMakeProposal(booking)}>
                Make Proposal
              </Button>
            )}
          </div>
        );

      case 'proposer':
        return (
          <div style={actionsStyles}>
            <Button variant="outline" size="sm" onClick={() => onViewDetails(booking)}>
              View Proposal
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      style={cardStyles}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = tokens.shadows.md;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = tokens.shadows.sm;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={headerStyles}>
        <h3 style={titleStyles}>{booking.title}</h3>
        {swapInfo && <SwapStatusBadge swapInfo={swapInfo} />}
      </div>

      <div style={contentStyles}>
        {/* Basic booking details */}
        <div style={{ marginBottom: tokens.spacing[2] }}>
          <div style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
            marginBottom: tokens.spacing[1],
          }}>
            📍 {booking.location?.city || 'Unknown'}, {booking.location?.country || 'Unknown'}
          </div>
          <div style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
            marginBottom: tokens.spacing[1],
          }}>
            📅 {booking.dateRange?.checkIn ? new Date(booking.dateRange.checkIn).toLocaleDateString() : 'Unknown'} - {booking.dateRange?.checkOut ? new Date(booking.dateRange.checkOut).toLocaleDateString() : 'Unknown'}
          </div>
          <div style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
          }}>
            💰 ${booking.originalPrice.toLocaleString()}
          </div>
        </div>

        {/* Swap information panel */}
        {swapInfo && (
          <SwapInfoPanel
            swapInfo={swapInfo}
            userRole={userRole}
            compact
          />
        )}
      </div>

      {renderActions()}
    </div>
  );
};