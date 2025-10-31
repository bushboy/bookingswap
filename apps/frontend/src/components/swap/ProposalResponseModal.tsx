import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  acceptProposal,
  rejectProposal,
  fetchProposals,
} from '@/store/thunks/swapThunks';
import {
  selectCurrentProposals,
  selectSwapsLoading,
} from '@/store/slices/swapsSlice';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import { SwapWithBookings, SwapProposal } from '@/services/swapService';
import { BookingType } from '@booking-swap/shared';

interface ProposalResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  swap: SwapWithBookings;
  proposals: SwapProposal[];
  onProposalAccepted?: (proposalId: string) => void;
  onProposalRejected?: (proposalId: string) => void;
}

interface ProposalWithBooking extends SwapProposal {
  booking?: {
    id: string;
    title: string;
    type: BookingType;
    location: {
      city: string;
      country: string;
    };
    dateRange: {
      checkIn: Date;
      checkOut: Date;
    };
    swapValue: number;
  };
}

const getBookingTypeIcon = (type: BookingType): string => {
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
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const ProposalResponseModal: React.FC<ProposalResponseModalProps> = ({
  isOpen,
  onClose,
  swap,
  proposals,
  onProposalAccepted,
  onProposalRejected,
}) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectSwapsLoading);

  // Local state
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processingProposal, setProcessingProposal] = useState<string | null>(
    null
  );

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedProposal(null);
      setShowRejectModal(false);
      setRejectReason('');
      setProcessingProposal(null);
    }
  }, [isOpen]);

  // Load proposals when modal opens
  useEffect(() => {
    if (isOpen && swap.id) {
      dispatch(fetchProposals(swap.id));
    }
  }, [isOpen, swap.id, dispatch]);

  // Handle proposal acceptance
  const handleAcceptProposal = async (proposalId: string) => {
    try {
      setProcessingProposal(proposalId);
      await dispatch(acceptProposal({ swapId: swap.id, proposalId })).unwrap();
      onProposalAccepted?.(proposalId);
      onClose();
    } catch (error) {
      console.error('Failed to accept proposal:', error);
    } finally {
      setProcessingProposal(null);
    }
  };

  // Handle proposal rejection
  const handleRejectProposal = async (proposalId: string) => {
    try {
      setProcessingProposal(proposalId);
      await dispatch(
        rejectProposal({
          swapId: swap.id,
          proposalId,
          reason: rejectReason.trim() || undefined,
        })
      ).unwrap();
      onProposalRejected?.(proposalId);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject proposal:', error);
    } finally {
      setProcessingProposal(null);
    }
  };

  // Open reject modal
  const openRejectModal = (proposalId: string) => {
    setSelectedProposal(proposalId);
    setShowRejectModal(true);
  };

  // Close reject modal
  const closeRejectModal = () => {
    setShowRejectModal(false);
    setSelectedProposal(null);
    setRejectReason('');
  };

  // Filter pending proposals
  const pendingProposals = proposals.filter(p => p.status === 'pending');

  // Styles
  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing[6],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const subtitleStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginTop: tokens.spacing[1],
  };

  const originalSwapStyles = {
    marginBottom: tokens.spacing[6],
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.neutral[50],
    borderRadius: tokens.borderRadius.lg,
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const swapComparisonStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: tokens.spacing[4],
    alignItems: 'center',
    marginBottom: tokens.spacing[4],
  };

  const bookingCardStyles = {
    padding: tokens.spacing[4],
    border: `2px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    backgroundColor: 'white',
  };

  const swapArrowStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: tokens.colors.primary[500],
  };

  const proposalsListStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[4],
    maxHeight: '400px',
    overflowY: 'auto' as const,
  };

  const proposalCardStyles = {
    border: `2px solid ${tokens.colors.primary[200]}`,
    borderRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
  };

  const proposalHeaderStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.primary[50],
    borderBottom: `1px solid ${tokens.colors.primary[200]}`,
  };

  const proposalContentStyles = {
    padding: tokens.spacing[4],
  };

  const proposalActionsStyles = {
    display: 'flex',
    gap: tokens.spacing[3],
    justifyContent: 'flex-end',
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.neutral[50],
    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const emptyStateStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[8],
    color: tokens.colors.neutral[600],
  };

  const conditionsListStyles = {
    margin: 0,
    paddingLeft: tokens.spacing[4],
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[700],
  };

  const messageStyles = {
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[100],
    borderRadius: tokens.borderRadius.md,
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[700],
    fontStyle: 'italic',
    marginTop: tokens.spacing[3],
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Review Swap Proposals"
        size="xl"
      >
        <div>
          {/* Header */}
          <div style={headerStyles}>
            <div>
              <h2 style={titleStyles}>Swap Proposals</h2>
              <p style={subtitleStyles}>
                {pendingProposals.length} pending proposal
                {pendingProposals.length !== 1 ? 's' : ''} for your swap
              </p>
            </div>
          </div>

          {/* Original Swap Display */}
          <div style={originalSwapStyles}>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.base,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                marginBottom: tokens.spacing[3],
              }}
            >
              Your Original Swap Request
            </h3>

            <div style={swapComparisonStyles}>
              {/* Your booking */}
              <div style={bookingCardStyles}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  <span style={{ fontSize: '18px' }}>
                    {getBookingTypeIcon(swap.sourceBooking.type)}
                  </span>
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.primary[600],
                      textTransform: 'uppercase',
                    }}
                  >
                    Your {swap.sourceBooking.type}
                  </span>
                </div>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  {swap.sourceBooking.title}
                </h4>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                  }}
                >
                  📍 {swap.sourceBooking.location.city},{' '}
                  {swap.sourceBooking.location.country}
                  <br />
                  📅 {formatDate(swap.sourceBooking.dateRange.checkIn)} -{' '}
                  {formatDate(swap.sourceBooking.dateRange.checkOut)}
                  <br />
                  💰 {formatCurrency(swap.sourceBooking.swapValue)}
                </div>
              </div>

              <div style={swapArrowStyles}>⇄</div>

              {/* Target booking */}
              <div style={bookingCardStyles}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  <span style={{ fontSize: '18px' }}>
                    {getBookingTypeIcon(swap.targetBooking.type)}
                  </span>
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.primary[600],
                      textTransform: 'uppercase',
                    }}
                  >
                    Requested {swap.targetBooking.type}
                  </span>
                </div>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  {swap.targetBooking.title}
                </h4>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                  }}
                >
                  📍 {swap.targetBooking.location.city},{' '}
                  {swap.targetBooking.location.country}
                  <br />
                  📅 {formatDate(swap.targetBooking.dateRange.checkIn)} -{' '}
                  {formatDate(swap.targetBooking.dateRange.checkOut)}
                  <br />
                  💰 {formatCurrency(swap.targetBooking.swapValue)}
                </div>
              </div>
            </div>
          </div>

          {/* Proposals List */}
          {loading ? (
            <div style={emptyStateStyles}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  marginBottom: tokens.spacing[4],
                }}
              >
                ⏳
              </div>
              <p>Loading proposals...</p>
            </div>
          ) : pendingProposals.length === 0 ? (
            <div style={emptyStateStyles}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  marginBottom: tokens.spacing[4],
                }}
              >
                📭
              </div>
              <h3 style={{ marginBottom: tokens.spacing[2] }}>
                No proposals yet
              </h3>
              <p>
                When users propose swaps for your booking, they'll appear here.
              </p>
            </div>
          ) : (
            <div>
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.lg,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  marginBottom: tokens.spacing[4],
                }}
              >
                Incoming Proposals ({pendingProposals.length})
              </h3>

              <div style={proposalsListStyles}>
                {pendingProposals.map(proposal => (
                  <Card key={proposal.id} style={proposalCardStyles}>
                    <div style={proposalHeaderStyles}>
                      <div>
                        <h4
                          style={{
                            fontSize: tokens.typography.fontSize.base,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            margin: 0,
                          }}
                        >
                          Proposal from User
                        </h4>
                        <p
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            margin: `${tokens.spacing[1]} 0 0 0`,
                          }}
                        >
                          Proposed on {formatDate(proposal.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div style={proposalContentStyles}>
                      {/* Proposed booking details would go here */}
                      <div
                        style={{
                          padding: tokens.spacing[3],
                          backgroundColor: tokens.colors.primary[50],
                          borderRadius: tokens.borderRadius.md,
                          marginBottom: tokens.spacing[3],
                        }}
                      >
                        <h5
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            marginBottom: tokens.spacing[2],
                          }}
                        >
                          They're offering: Booking ID {proposal.bookingId}
                        </h5>
                        <p
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            margin: 0,
                          }}
                        >
                          Full booking details would be loaded here
                        </p>
                      </div>

                      {/* Additional payment */}
                      {proposal.additionalPayment &&
                        proposal.additionalPayment > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: tokens.spacing[2],
                              marginBottom: tokens.spacing[3],
                              padding: tokens.spacing[3],
                              backgroundColor: tokens.colors.success[50],
                              borderRadius: tokens.borderRadius.md,
                            }}
                          >
                            <span style={{ fontSize: '18px' }}>💰</span>
                            <span
                              style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.success[700],
                                fontWeight: tokens.typography.fontWeight.medium,
                              }}
                            >
                              Additional payment:{' '}
                              {formatCurrency(proposal.additionalPayment)}
                            </span>
                          </div>
                        )}

                      {/* Conditions */}
                      {proposal.conditions.length > 0 && (
                        <div style={{ marginBottom: tokens.spacing[3] }}>
                          <h5
                            style={{
                              fontSize: tokens.typography.fontSize.sm,
                              fontWeight: tokens.typography.fontWeight.semibold,
                              color: tokens.colors.neutral[900],
                              marginBottom: tokens.spacing[2],
                            }}
                          >
                            Conditions:
                          </h5>
                          <ul style={conditionsListStyles}>
                            {proposal.conditions.map((condition, index) => (
                              <li
                                key={index}
                                style={{ marginBottom: tokens.spacing[1] }}
                              >
                                {condition}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Message */}
                      {proposal.message && (
                        <div style={messageStyles}>"{proposal.message}"</div>
                      )}
                    </div>

                    <div style={proposalActionsStyles}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRejectModal(proposal.id)}
                        disabled={processingProposal === proposal.id}
                        style={{
                          color: tokens.colors.error[600],
                          borderColor: tokens.colors.error[300],
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAcceptProposal(proposal.id)}
                        loading={processingProposal === proposal.id}
                      >
                        Accept Proposal
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: tokens.spacing[3],
              marginTop: tokens.spacing[6],
              paddingTop: tokens.spacing[4],
              borderTop: `1px solid ${tokens.colors.neutral[200]}`,
            }}
          >
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Confirmation Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={closeRejectModal}
        title="Reject Proposal"
        size="md"
      >
        <div>
          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[4],
            }}
          >
            Are you sure you want to reject this proposal? You can optionally
            provide a reason.
          </p>

          <Input
            label="Reason for rejection (optional)"
            placeholder="Let them know why you're rejecting..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            style={{ marginBottom: tokens.spacing[6] }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: tokens.spacing[3],
            }}
          >
            <Button variant="outline" onClick={closeRejectModal}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                selectedProposal && handleRejectProposal(selectedProposal)
              }
              loading={processingProposal === selectedProposal}
            >
              Reject Proposal
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
