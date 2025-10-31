import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { Booking } from './BookingCard';

export interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  variant?: 'own' | 'browse' | 'swap';
  onEdit?: (booking: Booking) => void;
  onDelete?: (bookingId: string) => void;
  onCreateSwap?: (booking: Booking) => void;
  onProposeSwap?: (booking: Booking) => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  isOpen,
  onClose,
  booking,
  variant = 'browse',
  onEdit,
  onDelete,
  onCreateSwap,
  onProposeSwap,
}) => {
  if (!booking) return null;

  const sectionStyles = {
    marginBottom: tokens.spacing[6],
  };

  const labelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
    marginBottom: tokens.spacing[1],
    display: 'block',
  };

  const valueStyles = {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[3],
  };

  const priceContainerStyles = {
    display: 'flex',
    gap: tokens.spacing[6],
    marginBottom: tokens.spacing[4],
  };

  const priceBoxStyles = {
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.neutral[50],
    borderRadius: tokens.borderRadius.lg,
    flex: 1,
  };

  const statusBadgeStyles = {
    display: 'inline-block',
    padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: getStatusColor(booking.status).bg,
    color: getStatusColor(booking.status).text,
    marginBottom: tokens.spacing[4],
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[3],
    justifyContent: 'flex-end',
    marginTop: tokens.spacing[6],
    paddingTop: tokens.spacing[4],
    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
  };

  function getStatusColor(status: string) {
    switch (status) {
      case 'available':
        return {
          bg: tokens.colors.success[100],
          text: tokens.colors.success[800],
        };
      case 'swapping':
        return {
          bg: tokens.colors.warning[100],
          text: tokens.colors.warning[800],
        };
      case 'completed':
        return {
          bg: tokens.colors.neutral[100],
          text: tokens.colors.neutral[800],
        };
      case 'cancelled':
        return { bg: tokens.colors.error[100], text: tokens.colors.error[800] };
      default:
        return {
          bg: tokens.colors.neutral[100],
          text: tokens.colors.neutral[800],
        };
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'hotel':
        return '🏨';
      case 'event':
        return '🎫';
      case 'flight':
        return '✈️';
      case 'rental':
        return '🏠';
      default:
        return '📋';
    }
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(booking);
      onClose();
    }
  };

  const handleDelete = () => {
    if (
      onDelete &&
      window.confirm('Are you sure you want to delete this booking?')
    ) {
      onDelete(booking.id);
      onClose();
    }
  };

  const handleCreateSwap = () => {
    if (onCreateSwap) {
      onCreateSwap(booking);
      onClose();
    }
  };

  const handleProposeSwap = () => {
    if (onProposeSwap) {
      onProposeSwap(booking);
      onClose();
    }
  };

  const renderActions = () => {
    switch (variant) {
      case 'own':
        return (
          <>
            <Button
              variant="outline"
              onClick={handleEdit}
              disabled={booking.status === 'swapping'}
            >
              Edit Booking
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={booking.status === 'swapping'}
            >
              Delete Booking
            </Button>
            {booking.status === 'available' && (
              <Button variant="primary" onClick={handleCreateSwap}>
                Create Swap
              </Button>
            )}
          </>
        );

      case 'browse':
        return (
          <Button
            variant="primary"
            onClick={handleProposeSwap}
            disabled={booking.status !== 'available'}
          >
            Propose Swap
          </Button>
        );

      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Booking Details">
      <div>
        {/* Header with title and status */}
        <div style={sectionStyles}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[3],
              marginBottom: tokens.spacing[4],
            }}
          >
            <span style={{ fontSize: '2rem' }}>
              {getTypeIcon(booking.type)}
            </span>
            <div>
              <h2
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.neutral[900],
                  margin: 0,
                }}
              >
                {booking.title}
              </h2>
              <span style={statusBadgeStyles}>
                {booking.status.charAt(0).toUpperCase() +
                  booking.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Location and Dates */}
        <div style={sectionStyles}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: tokens.spacing[4],
            }}
          >
            <div>
              <span style={labelStyles}>Location</span>
              <div style={valueStyles}>📍 {booking.location?.city || 'Unknown'}, {booking.location?.country || 'Unknown'}</div>
            </div>
            <div>
              <span style={labelStyles}>Dates</span>
              <div style={valueStyles}>📅 {booking.dateRange?.checkIn ? new Date(booking.dateRange.checkIn).toLocaleDateString() : 'Unknown'} - {booking.dateRange?.checkOut ? new Date(booking.dateRange.checkOut).toLocaleDateString() : 'Unknown'}</div>
            </div>
          </div>
        </div>

        {/* Description */}
        {booking.description && (
          <div style={sectionStyles}>
            <span style={labelStyles}>Description</span>
            <div style={valueStyles}>{booking.description}</div>
          </div>
        )}

        {/* Pricing */}
        <div style={sectionStyles}>
          <span style={labelStyles}>Pricing</span>
          <div style={priceContainerStyles}>
            <div style={priceBoxStyles}>
              <div style={labelStyles}>Original Price</div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.lg,
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.neutral[600],
                  textDecoration: 'line-through',
                }}
              >
                ${booking.originalPrice.toLocaleString()}
              </div>
            </div>
            <div style={priceBoxStyles}>
              <div style={labelStyles}>Swap Value</div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.primary[600],
                }}
              >
                ${booking.swapValue.toLocaleString()}
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.success[600],
              fontWeight: tokens.typography.fontWeight.medium,
            }}
          >
            💰 Save $
            {(booking.originalPrice - booking.swapValue).toLocaleString()}
          </div>
        </div>

        {/* Provider Details */}
        {(booking.provider || booking.confirmationNumber) && (
          <div style={sectionStyles}>
            <span style={labelStyles}>Provider Details</span>
            {booking.provider && (
              <div style={valueStyles}>
                <strong>Provider:</strong> {booking.provider}
              </div>
            )}
            {booking.confirmationNumber && (
              <div style={valueStyles}>
                <strong>Confirmation:</strong> {booking.confirmationNumber}
              </div>
            )}
          </div>
        )}

        {/* Booking Type */}
        <div style={sectionStyles}>
          <span style={labelStyles}>Booking Type</span>
          <div style={valueStyles}>
            {getTypeIcon(booking.type)}{' '}
            {booking.type.charAt(0).toUpperCase() + booking.type.slice(1)}
          </div>
        </div>

        {/* Actions */}
        <div style={actionsStyles}>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {renderActions()}
        </div>
      </div>
    </Modal>
  );
};
