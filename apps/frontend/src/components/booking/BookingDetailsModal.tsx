import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { Booking } from '@booking-swap/shared';
import { CompletionStatusIndicator } from '../swap/CompletionStatusIndicator';
import { CompletionDetailsModal } from '../swap/CompletionDetailsModal';
import { CompletionAPI, CompletionStatus } from '@/services/completionAPI';

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
  // Completion-related state
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus | null>(null);
  const [isLoadingCompletion, setIsLoadingCompletion] = useState(false);
  const [showCompletionDetails, setShowCompletionDetails] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Fetch completion status when modal opens
  useEffect(() => {
    const fetchCompletionStatus = async () => {
      if (!isOpen || !booking?.id) return;

      setIsLoadingCompletion(true);
      setCompletionError(null);

      try {
        const completion = await CompletionAPI.getBookingCompletionStatus(booking.id);
        setCompletionStatus(completion);
      } catch (error) {
        console.error('Failed to fetch booking completion status:', error);
        setCompletionError('Failed to load completion information');
      } finally {
        setIsLoadingCompletion(false);
      }
    };

    fetchCompletionStatus();
  }, [isOpen, booking?.id]);

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
              disabled={booking.status === 'locked'}
            >
              Edit Booking
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={booking.status === 'locked'}
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
    <>
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
          {(booking.providerDetails?.provider || booking.providerDetails?.confirmationNumber) && (
            <div style={sectionStyles}>
              <span style={labelStyles}>Provider Details</span>
              {booking.providerDetails?.provider && (
                <div style={valueStyles}>
                  <strong>Provider:</strong> {booking.providerDetails.provider}
                </div>
              )}
              {booking.providerDetails?.confirmationNumber && (
                <div style={valueStyles}>
                  <strong>Confirmation:</strong> {booking.providerDetails.confirmationNumber}
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

          {/* Swap Completion Information */}
          {(booking.status === 'swapped' || completionStatus || isLoadingCompletion || completionError) && (
            <div style={sectionStyles}>
              <span style={labelStyles}>Swap Completion Information</span>

              {isLoadingCompletion && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: tokens.spacing[4],
                    color: tokens.colors.neutral[600],
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: tokens.spacing[2] }}>⏳</div>
                  Loading swap completion details...
                </div>
              )}

              {completionError && (
                <div
                  style={{
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.warning[50],
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${tokens.colors.warning[200]}`,
                    color: tokens.colors.warning[700],
                    marginBottom: tokens.spacing[3],
                  }}
                >
                  <strong>⚠️ Warning:</strong> {completionError}
                </div>
              )}

              {completionStatus && (
                <div>
                  <CompletionStatusIndicator
                    completion={completionStatus}
                    onViewDetails={() => setShowCompletionDetails(true)}
                    compact={true}
                    showTimeline={false}
                  />

                  {/* Completion Timeline */}
                  <div
                    style={{
                      marginTop: tokens.spacing[3],
                      padding: tokens.spacing[3],
                      backgroundColor: tokens.colors.neutral[50],
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${tokens.colors.neutral[200]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[700],
                        marginBottom: tokens.spacing[2],
                      }}
                    >
                      Completion Timeline
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[600] }}>
                          Swap Initiated:
                        </span>
                        <span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[900] }}>
                          {new Date(completionStatus.initiatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {completionStatus.completedAt && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[600] }}>
                            Swap Completed:
                          </span>
                          <span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[900] }}>
                            {new Date(completionStatus.completedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Related Swap Information */}
                  {completionStatus.completedSwaps.length > 0 && (
                    <div
                      style={{
                        marginTop: tokens.spacing[3],
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.primary[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.primary[200]}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.primary[700],
                          marginBottom: tokens.spacing[2],
                        }}
                      >
                        🔗 Related Completed Swaps
                      </div>

                      {completionStatus.completedSwaps.map((swap, index) => (
                        <div
                          key={swap.swapId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: tokens.spacing[2],
                            backgroundColor: tokens.colors.white,
                            borderRadius: tokens.borderRadius.sm,
                            marginBottom: index < completionStatus.completedSwaps.length - 1 ? tokens.spacing[2] : 0,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontFamily: 'monospace',
                                color: tokens.colors.neutral[900],
                              }}
                            >
                              {swap.swapId.slice(0, 8)}...{swap.swapId.slice(-8)}
                            </div>
                            <div
                              style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[600],
                              }}
                            >
                              {swap.previousStatus} → {swap.newStatus}
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            View Swap
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ownership Transfer Information */}
                  {completionStatus.updatedBookings.some(b => b.newOwnerId) && (
                    <div
                      style={{
                        marginTop: tokens.spacing[3],
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.success[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.success[200]}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.success[700],
                          marginBottom: tokens.spacing[2],
                        }}
                      >
                        🔄 Ownership Transfer Details
                      </div>

                      {completionStatus.updatedBookings
                        .filter(b => b.newOwnerId)
                        .map((bookingUpdate, index) => (
                          <div
                            key={bookingUpdate.bookingId}
                            style={{
                              padding: tokens.spacing[2],
                              backgroundColor: tokens.colors.white,
                              borderRadius: tokens.borderRadius.sm,
                              marginBottom: index < completionStatus.updatedBookings.filter(b => b.newOwnerId).length - 1 ? tokens.spacing[2] : 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[900],
                                marginBottom: tokens.spacing[1],
                              }}
                            >
                              {bookingUpdate.bookingId === booking.id ? 'This booking' : 'Related booking'} ownership transferred
                            </div>
                            <div
                              style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[600],
                              }}
                            >
                              Transferred on {new Date(bookingUpdate.swappedAt).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Blockchain Transaction */}
                  {completionStatus.blockchainTransactionId && (
                    <div
                      style={{
                        marginTop: tokens.spacing[3],
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.neutral[700],
                          marginBottom: tokens.spacing[2],
                        }}
                      >
                        🔗 Blockchain Record
                      </div>

                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontFamily: 'monospace',
                          color: tokens.colors.neutral[900],
                          wordBreak: 'break-all',
                          marginBottom: tokens.spacing[2],
                        }}
                      >
                        {completionStatus.blockchainTransactionId}
                      </div>

                      <Button variant="outline" size="sm">
                        View on Explorer
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {booking.status === 'swapped' && !completionStatus && !isLoadingCompletion && !completionError && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: tokens.spacing[4],
                    color: tokens.colors.neutral[500],
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: tokens.spacing[2] }}>📋</div>
                  Booking marked as swapped
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      marginTop: tokens.spacing[2],
                    }}
                  >
                    Detailed completion information not available
                  </div>
                </div>
              )}

              {booking.status !== 'swapped' && !completionStatus && !isLoadingCompletion && !completionError && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: tokens.spacing[4],
                    color: tokens.colors.neutral[500],
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: tokens.spacing[2] }}>⏳</div>
                  No swap completion yet
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      marginTop: tokens.spacing[2],
                    }}
                  >
                    This booking has not been swapped
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={actionsStyles}>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {renderActions()}
          </div>
        </div>
      </Modal>

      {/* Completion Details Modal */}
      {
        showCompletionDetails && completionStatus && (
          <CompletionDetailsModal
            isOpen={showCompletionDetails}
            onClose={() => setShowCompletionDetails(false)}
            completion={{
              id: completionStatus.id,
              proposalId: '', // Will be fetched from audit
              completionType: completionStatus.completionType,
              initiatedBy: '', // Will be fetched from audit
              completedAt: completionStatus.completedAt || new Date(),
              affectedSwaps: completionStatus.completedSwaps.map(s => s.swapId),
              affectedBookings: completionStatus.updatedBookings.map(b => b.bookingId),
              databaseTransactionId: '', // Will be fetched from audit
              blockchainTransactionId: completionStatus.blockchainTransactionId,
              status: completionStatus.status,
              errorDetails: completionStatus.errorDetails,
              preValidationResult: undefined,
              postValidationResult: undefined,
              createdAt: completionStatus.initiatedAt,
              updatedAt: completionStatus.completedAt || completionStatus.initiatedAt,
            }}
          />
        )
      }
    </>
  );
};
