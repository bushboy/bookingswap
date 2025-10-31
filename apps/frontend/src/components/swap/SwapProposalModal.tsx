import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { BookingCard } from '@/components/booking/BookingCard';
import { tokens } from '@/design-system/tokens';
import { Booking } from '@booking-swap/shared';
import { CashSwapDetails } from '@/services/bookingService';

interface SwapProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBooking: Booking | null;
  userBookings: Booking[];
  onSubmit: (data: SwapProposalData) => void;
  loading?: boolean;
  mode?: 'booking' | 'cash'; // New prop to determine modal mode
  cashDetails?: CashSwapDetails; // Cash swap details for validation
}

export interface SwapProposalData {
  targetBookingId: string;
  sourceBookingId?: string; // Optional for cash offers
  message?: string;
  additionalPayment?: number;
  conditions: string[];
  cashOffer?: {
    amount: number;
    currency?: string;
    paymentMethodId: string;
    escrowAgreement?: boolean;
  };
}

export const SwapProposalModal: React.FC<SwapProposalModalProps> = ({
  isOpen,
  onClose,
  targetBooking,
  userBookings,
  onSubmit,
  loading = false,
  mode = 'booking',
  cashDetails,
}) => {
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [additionalPayment, setAdditionalPayment] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState('');
  const [step, setStep] = useState<'select' | 'details' | 'review'>('select');
  const [proposalType, setProposalType] = useState<'booking' | 'cash'>(
    mode === 'cash' ? 'cash' : 'booking'
  );
  const [cashAmount, setCashAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('card-default');

  // Available bookings (only available and verified ones, excluding the target booking)
  const availableBookings = userBookings.filter(
    booking =>
      booking.status === 'available' &&
      booking.verification.status === 'verified' &&
      booking.id !== targetBooking?.id // Don't allow proposing the same booking
  );

  const selectedBooking = availableBookings.find(
    b => b.id === selectedBookingId
  );

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedBookingId('');
      setMessage('');
      setAdditionalPayment('');
      setConditions([]);
      setCustomCondition('');
      setStep('select');
      setProposalType('booking');
      setCashAmount('');
      setPaymentMethodId('card-default');
    }
  }, [isOpen]);

  // Common conditions
  const commonConditions = [
    'Flexible check-in/check-out times',
    'No additional fees or charges',
    'Original booking terms apply',
    'Cancellation policies remain unchanged',
    'Direct communication for coordination',
    'Verification documents exchange',
  ];

  const handleBookingSelect = useCallback((bookingId: string) => {
    setSelectedBookingId(bookingId);
  }, []);

  const handleAddCondition = useCallback(
    (condition: string) => {
      if (!conditions.includes(condition)) {
        setConditions(prev => [...prev, condition]);
      }
    },
    [conditions]
  );

  const handleRemoveCondition = useCallback((condition: string) => {
    setConditions(prev => prev.filter(c => c !== condition));
  }, []);

  const handleAddCustomCondition = useCallback(() => {
    if (
      customCondition.trim() &&
      !conditions.includes(customCondition.trim())
    ) {
      setConditions(prev => [...prev, customCondition.trim()]);
      setCustomCondition('');
    }
  }, [customCondition, conditions]);

  const handleSubmit = useCallback(() => {
    if (!targetBooking) return;

    if (proposalType === 'booking' && !selectedBookingId) return;
    if (proposalType === 'cash' && (!cashAmount || parseFloat(cashAmount) <= 0))
      return;

    const proposalData: SwapProposalData = {
      targetBookingId: targetBooking.id,
      message: message.trim() || undefined,
      conditions,
    };

    if (proposalType === 'booking') {
      proposalData.sourceBookingId = selectedBookingId;
      proposalData.additionalPayment = additionalPayment
        ? parseFloat(additionalPayment)
        : undefined;
    } else {
      proposalData.cashOffer = {
        amount: parseFloat(cashAmount),
        currency: 'USD',
        paymentMethodId,
        escrowAgreement: true,
      };
    }

    onSubmit(proposalData);
  }, [
    targetBooking,
    proposalType,
    selectedBookingId,
    cashAmount,
    paymentMethodId,
    message,
    additionalPayment,
    conditions,
    onSubmit,
  ]);

  const canProceedToDetails =
    proposalType === 'booking'
      ? selectedBookingId !== ''
      : proposalType === 'cash'
        ? cashAmount !== '' && parseFloat(cashAmount) > 0
        : false;
  const canProceedToReview = canProceedToDetails && conditions.length > 0;
  const canSubmit = canProceedToDetails && conditions.length > 0;

  const modalStyles = {
    content: {
      maxWidth: '900px',
      width: '90vw',
      maxHeight: '90vh',
      overflow: 'auto',
    },
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing[6],
    paddingBottom: tokens.spacing[4],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const stepIndicatorStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[6],
  };

  const stepStyles = (isActive: boolean, isCompleted: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: isActive
      ? tokens.colors.primary[100]
      : isCompleted
        ? tokens.colors.success[100]
        : tokens.colors.neutral[100],
    color: isActive
      ? tokens.colors.primary[700]
      : isCompleted
        ? tokens.colors.success[700]
        : tokens.colors.neutral[500],
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
  });

  const contentStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[6],
  };

  const bookingGridStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacing[4],
  };

  const comparisonStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacing[6],
    alignItems: 'start',
  };

  const sectionStyles = {
    backgroundColor: tokens.colors.neutral[50],
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.lg,
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const conditionItemStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacing[2],
    backgroundColor: 'white',
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.md,
    fontSize: tokens.typography.fontSize.sm,
  };

  const footerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing[6],
    paddingTop: tokens.spacing[4],
    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
  };

  if (!targetBooking) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} style={modalStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div>
          <h2
            style={{
              fontSize: tokens.typography.fontSize['2xl'],
              fontWeight: tokens.typography.fontWeight.bold,
              color: tokens.colors.neutral[900],
              margin: 0,
            }}
          >
            Propose Swap
          </h2>
          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[600],
              margin: `${tokens.spacing[2]} 0 0 0`,
            }}
          >
            Create a swap proposal for "{targetBooking.title}"
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div style={stepIndicatorStyles}>
        <div style={stepStyles(step === 'select', canProceedToDetails)}>
          <span>{canProceedToDetails ? '✓' : '1'}</span>
          <span>
            {proposalType === 'booking'
              ? 'Select Your Booking'
              : 'Enter Cash Offer'}
          </span>
        </div>
        <div
          style={{
            width: '20px',
            height: '1px',
            backgroundColor: tokens.colors.neutral[300],
          }}
        />
        <div style={stepStyles(step === 'details', conditions.length > 0)}>
          <span>{conditions.length > 0 ? '✓' : '2'}</span>
          <span>Add Details</span>
        </div>
        <div
          style={{
            width: '20px',
            height: '1px',
            backgroundColor: tokens.colors.neutral[300],
          }}
        />
        <div style={stepStyles(step === 'review', false)}>
          <span>3</span>
          <span>Review & Submit</span>
        </div>
      </div>

      {/* Content */}
      <div style={contentStyles}>
        {/* Step 1: Select Proposal Type and Booking/Cash */}
        {step === 'select' && (
          <div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                margin: `0 0 ${tokens.spacing[4]} 0`,
              }}
            >
              How would you like to respond to this swap?
            </h3>

            {/* Proposal Type Selection */}
            <div style={{ marginBottom: tokens.spacing[6] }}>
              <div
                style={{
                  display: 'flex',
                  gap: tokens.spacing[4],
                  marginBottom: tokens.spacing[4],
                }}
              >
                <button
                  style={{
                    flex: 1,
                    padding: tokens.spacing[4],
                    border:
                      proposalType === 'booking'
                        ? `2px solid ${tokens.colors.primary[500]}`
                        : `2px solid ${tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.lg,
                    backgroundColor:
                      proposalType === 'booking'
                        ? tokens.colors.primary[50]
                        : tokens.colors.neutral[50],
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onClick={() => setProposalType('booking')}
                >
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      marginBottom: tokens.spacing[2],
                    }}
                  >
                    🔄 Match with My Booking
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                    }}
                  >
                    Offer one of your bookings in exchange
                  </div>
                </button>

                <button
                  style={{
                    flex: 1,
                    padding: tokens.spacing[4],
                    border:
                      proposalType === 'cash'
                        ? `2px solid ${tokens.colors.primary[500]}`
                        : `2px solid ${tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.lg,
                    backgroundColor:
                      proposalType === 'cash'
                        ? tokens.colors.primary[50]
                        : tokens.colors.neutral[50],
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onClick={() => setProposalType('cash')}
                >
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      marginBottom: tokens.spacing[2],
                    }}
                  >
                    💰 Offer Cash
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                    }}
                  >
                    Make a cash offer for this booking
                  </div>
                </button>
              </div>
            </div>

            {/* Booking Selection (only if booking proposal type) */}
            {proposalType === 'booking' && (
              <div>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[4]} 0`,
                  }}
                >
                  Select one of your bookings to offer
                </h4>

                {availableBookings.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center' as const,
                      padding: tokens.spacing[8],
                      color: tokens.colors.neutral[500],
                    }}
                  >
                    <div
                      style={{
                        fontSize: '48px',
                        marginBottom: tokens.spacing[4],
                      }}
                    >
                      📋
                    </div>
                    <h4
                      style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        margin: `0 0 ${tokens.spacing[2]} 0`,
                      }}
                    >
                      No available bookings
                    </h4>
                    <p style={{ margin: 0 }}>
                      You need at least one verified and available booking to
                      create a swap proposal.
                    </p>
                  </div>
                ) : (
                  <div style={bookingGridStyles}>
                    {availableBookings.map(booking => (
                      <div
                        key={booking.id}
                        style={{
                          border:
                            selectedBookingId === booking.id
                              ? `2px solid ${tokens.colors.primary[500]}`
                              : `2px solid transparent`,
                          borderRadius: tokens.borderRadius.lg,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => handleBookingSelect(booking.id)}
                      >
                        <BookingCard
                          booking={booking}
                          variant="swap"
                          onAction={() => handleBookingSelect(booking.id)}
                          showActions={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cash Offer Form (only if cash proposal type) */}
            {proposalType === 'cash' && (
              <div>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[4]} 0`,
                  }}
                >
                  Enter your cash offer
                </h4>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: tokens.spacing[4],
                    marginBottom: tokens.spacing[4],
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[700],
                        marginBottom: tokens.spacing[2],
                      }}
                    >
                      Cash Amount (USD)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={cashAmount}
                      onChange={e => setCashAmount(e.target.value)}
                      placeholder="Enter amount..."
                      style={{
                        width: '100%',
                        padding: tokens.spacing[3],
                        border: `1px solid ${tokens.colors.neutral[300]}`,
                        borderRadius: tokens.borderRadius.md,
                        fontSize: tokens.typography.fontSize.base,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[700],
                        marginBottom: tokens.spacing[2],
                      }}
                    >
                      Payment Method
                    </label>
                    <select
                      value={paymentMethodId}
                      onChange={e => setPaymentMethodId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: tokens.spacing[3],
                        border: `1px solid ${tokens.colors.neutral[300]}`,
                        borderRadius: tokens.borderRadius.md,
                        fontSize: tokens.typography.fontSize.base,
                      }}
                    >
                      <option value="card-default">Credit/Debit Card</option>
                      <option value="bank-transfer">Bank Transfer</option>
                      <option value="paypal">PayPal</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    padding: tokens.spacing[4],
                    backgroundColor: tokens.colors.primary[50],
                    border: `1px solid ${tokens.colors.primary[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.primary[800],
                  }}
                >
                  <strong>💡 Secure Payment:</strong> Your payment will be held
                  in escrow until the booking transfer is completed. This
                  ensures both parties are protected throughout the transaction.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Add Details */}
        {step === 'details' && (
          <div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                margin: `0 0 ${tokens.spacing[4]} 0`,
              }}
            >
              Add proposal details and conditions
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[6],
              }}
            >
              {/* Message */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Personal Message (Optional)
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Add a personal message to introduce yourself and explain why this swap would work well..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: tokens.spacing[3],
                    border: `1px solid ${tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.base,
                    fontFamily: tokens.typography.fontFamily.sans.join(', '),
                    resize: 'vertical' as const,
                    outline: 'none',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = tokens.colors.primary[500];
                    e.target.style.boxShadow = `0 0 0 3px ${tokens.colors.primary[200]}`;
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = tokens.colors.neutral[300];
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Additional Payment */}
              <div>
                <Input
                  label="Additional Payment (Optional)"
                  type="number"
                  placeholder="0.00"
                  value={additionalPayment}
                  onChange={e => setAdditionalPayment(e.target.value)}
                  leftIcon={<span>💰</span>}
                  helperText="Offer additional payment if your booking has lower value"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Conditions */}
              <div>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[3]} 0`,
                  }}
                >
                  Swap Conditions
                </h4>
                <p
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                    margin: `0 0 ${tokens.spacing[4]} 0`,
                  }}
                >
                  Select or add conditions that both parties should agree to
                </p>

                {/* Common Conditions */}
                <div style={{ marginBottom: tokens.spacing[4] }}>
                  <h5
                    style={{
                      fontSize: tokens.typography.fontSize.base,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[700],
                      margin: `0 0 ${tokens.spacing[2]} 0`,
                    }}
                  >
                    Common Conditions
                  </h5>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: tokens.spacing[2],
                    }}
                  >
                    {commonConditions.map(condition => (
                      <label
                        key={condition}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: tokens.spacing[2],
                          padding: tokens.spacing[2],
                          cursor: 'pointer',
                          borderRadius: tokens.borderRadius.md,
                          backgroundColor: conditions.includes(condition)
                            ? tokens.colors.primary[50]
                            : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (!conditions.includes(condition)) {
                            e.currentTarget.style.backgroundColor =
                              tokens.colors.neutral[100];
                          }
                        }}
                        onMouseLeave={e => {
                          if (!conditions.includes(condition)) {
                            e.currentTarget.style.backgroundColor =
                              'transparent';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={conditions.includes(condition)}
                          onChange={e => {
                            if (e.target.checked) {
                              handleAddCondition(condition);
                            } else {
                              handleRemoveCondition(condition);
                            }
                          }}
                        />
                        <span
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[700],
                          }}
                        >
                          {condition}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Custom Condition */}
                <div style={{ marginBottom: tokens.spacing[4] }}>
                  <h5
                    style={{
                      fontSize: tokens.typography.fontSize.base,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[700],
                      margin: `0 0 ${tokens.spacing[2]} 0`,
                    }}
                  >
                    Add Custom Condition
                  </h5>
                  <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                    <Input
                      placeholder="Enter a custom condition..."
                      value={customCondition}
                      onChange={e => setCustomCondition(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomCondition();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="outline"
                      onClick={handleAddCustomCondition}
                      disabled={
                        !customCondition.trim() ||
                        conditions.includes(customCondition.trim())
                      }
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Selected Conditions */}
                {conditions.length > 0 && (
                  <div>
                    <h5
                      style={{
                        fontSize: tokens.typography.fontSize.base,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[700],
                        margin: `0 0 ${tokens.spacing[2]} 0`,
                      }}
                    >
                      Selected Conditions ({conditions.length})
                    </h5>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: tokens.spacing[2],
                      }}
                    >
                      {conditions.map((condition, index) => (
                        <div key={index} style={conditionItemStyles}>
                          <span>{condition}</span>
                          <button
                            onClick={() => handleRemoveCondition(condition)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: tokens.colors.error[500],
                              cursor: 'pointer',
                              padding: tokens.spacing[1],
                            }}
                            aria-label={`Remove condition: ${condition}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' &&
          (proposalType === 'booking'
            ? selectedBooking
            : proposalType === 'cash') && (
            <div>
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  margin: `0 0 ${tokens.spacing[4]} 0`,
                }}
              >
                Review your swap proposal
              </h3>

              {/* Booking Comparison (for booking proposals) */}
              {proposalType === 'booking' && selectedBooking && (
                <div style={sectionStyles}>
                  <h4
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[4]} 0`,
                    }}
                  >
                    Booking Exchange
                  </h4>
                  <div style={comparisonStyles}>
                    <div>
                      <h5
                        style={{
                          fontSize: tokens.typography.fontSize.base,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.neutral[700],
                          margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                      >
                        Your Booking
                      </h5>
                      <BookingCard
                        booking={selectedBooking}
                        variant="own"
                        onAction={() => {}}
                        showActions={false}
                      />
                    </div>
                    <div>
                      <h5
                        style={{
                          fontSize: tokens.typography.fontSize.base,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.neutral[700],
                          margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                      >
                        Their Booking
                      </h5>
                      <BookingCard
                        booking={targetBooking}
                        variant="browse"
                        onAction={() => {}}
                        showActions={false}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cash Offer Summary (for cash proposals) */}
              {proposalType === 'cash' && (
                <div style={sectionStyles}>
                  <h4
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[4]} 0`,
                    }}
                  >
                    Cash Offer Summary
                  </h4>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: tokens.spacing[6],
                    }}
                  >
                    <div>
                      <h5
                        style={{
                          fontSize: tokens.typography.fontSize.base,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.neutral[700],
                          margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                      >
                        Your Cash Offer
                      </h5>
                      <div
                        style={{
                          padding: tokens.spacing[4],
                          backgroundColor: tokens.colors.green[50],
                          border: `1px solid ${tokens.colors.green[200]}`,
                          borderRadius: tokens.borderRadius.md,
                        }}
                      >
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.bold,
                            color: tokens.colors.green[800],
                            marginBottom: tokens.spacing[2],
                          }}
                        >
                          ${parseFloat(cashAmount || '0').toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                          }}
                        >
                          Payment via{' '}
                          {paymentMethodId === 'card-default'
                            ? 'Credit/Debit Card'
                            : paymentMethodId === 'bank-transfer'
                              ? 'Bank Transfer'
                              : 'PayPal'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h5
                        style={{
                          fontSize: tokens.typography.fontSize.base,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.neutral[700],
                          margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                      >
                        Their Booking
                      </h5>
                      <BookingCard
                        booking={targetBooking}
                        variant="browse"
                        onAction={() => {}}
                        showActions={false}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Proposal Details */}
              <div style={sectionStyles}>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[4]} 0`,
                  }}
                >
                  Proposal Details
                </h4>

                {message && (
                  <div style={{ marginBottom: tokens.spacing[4] }}>
                    <h5
                      style={{
                        fontSize: tokens.typography.fontSize.base,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[700],
                        margin: `0 0 ${tokens.spacing[2]} 0`,
                      }}
                    >
                      Personal Message
                    </h5>
                    <p
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        backgroundColor: 'white',
                        padding: tokens.spacing[3],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {message}
                    </p>
                  </div>
                )}

                {additionalPayment && parseFloat(additionalPayment) > 0 && (
                  <div style={{ marginBottom: tokens.spacing[4] }}>
                    <h5
                      style={{
                        fontSize: tokens.typography.fontSize.base,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[700],
                        margin: `0 0 ${tokens.spacing[2]} 0`,
                      }}
                    >
                      Additional Payment
                    </h5>
                    <p
                      style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.primary[600],
                        margin: 0,
                      }}
                    >
                      ${parseFloat(additionalPayment).toFixed(2)}
                    </p>
                  </div>
                )}

                <div>
                  <h5
                    style={{
                      fontSize: tokens.typography.fontSize.base,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[700],
                      margin: `0 0 ${tokens.spacing[2]} 0`,
                    }}
                  >
                    Conditions ({conditions.length})
                  </h5>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: tokens.spacing[4],
                      color: tokens.colors.neutral[600],
                    }}
                  >
                    {conditions.map((condition, index) => (
                      <li
                        key={index}
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          marginBottom: tokens.spacing[1],
                        }}
                      >
                        {condition}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Footer */}
      <div style={footerStyles}>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>

        <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
          {step !== 'select' && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'details') setStep('select');
                if (step === 'review') setStep('details');
              }}
              disabled={loading}
            >
              Back
            </Button>
          )}

          {step === 'select' && (
            <Button
              variant="primary"
              onClick={() => setStep('details')}
              disabled={!canProceedToDetails}
            >
              Next: Add Details
            </Button>
          )}

          {step === 'details' && (
            <Button
              variant="primary"
              onClick={() => setStep('review')}
              disabled={!canProceedToReview}
            >
              Next: Review
            </Button>
          )}

          {step === 'review' && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={loading}
            >
              Submit Proposal
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
