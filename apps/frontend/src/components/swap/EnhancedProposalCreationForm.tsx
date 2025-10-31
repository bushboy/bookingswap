import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { BookingCard } from '@/components/booking/BookingCard';
import { tokens } from '@/design-system/tokens';
import {
  CreateEnhancedProposalRequest,
  ProposalType,
  CashOfferRequest,
  EnhancedSwap,
  PaymentMethod,
} from '@booking-swap/shared';
import { Booking, BookingType } from '@booking-swap/shared';

interface EnhancedProposalCreationFormProps {
  targetSwap: EnhancedSwap;
  targetBooking: Booking;
  userBookings: Booking[];
  userPaymentMethods: PaymentMethod[];
  onSubmit: (data: CreateEnhancedProposalRequest) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface BookingFilters {
  search: string;
  type: BookingType | '';
  minValue: number;
  maxValue: number;
}

export const EnhancedProposalCreationForm: React.FC<
  EnhancedProposalCreationFormProps
> = ({
  targetSwap,
  targetBooking,
  userBookings,
  userPaymentMethods,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [proposalType, setProposalType] = useState<ProposalType>('booking');
  const [formData, setFormData] = useState<CreateEnhancedProposalRequest>({
    swapId: targetSwap.id,
    proposalType: 'booking',
    bookingId: undefined,
    cashOffer: undefined,
    message: '',
    conditions: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newCondition, setNewCondition] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [filters, setFilters] = useState<BookingFilters>({
    search: '',
    type: '',
    minValue: 0,
    maxValue: 10000,
  });

  // Determine available proposal types based on swap settings
  const availableProposalTypes = useMemo(() => {
    const types: {
      value: ProposalType;
      label: string;
      description: string;
      available: boolean;
    }[] = [
      {
        value: 'booking',
        label: 'Booking Exchange',
        description: 'Offer one of your bookings in exchange',
        available: targetSwap.paymentTypes.bookingExchange,
      },
      {
        value: 'cash',
        label: 'Cash Offer',
        description: 'Make a cash payment offer',
        available: targetSwap.paymentTypes.cashPayment,
      },
    ];
    return types;
  }, [targetSwap.paymentTypes]);

  // Filter and search bookings
  const filteredBookings = useMemo(() => {
    return userBookings.filter(booking => {
      // Exclude bookings that are not available
      if (booking.status !== 'available') return false;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          booking.title.toLowerCase().includes(searchLower) ||
          booking.description.toLowerCase().includes(searchLower) ||
          booking.location.city.toLowerCase().includes(searchLower) ||
          booking.location.country.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (filters.type && booking.type !== filters.type) return false;

      // Value range filter
      if (
        booking.swapValue < filters.minValue ||
        booking.swapValue > filters.maxValue
      )
        return false;

      return true;
    });
  }, [userBookings, filters]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (proposalType === 'booking') {
      if (!formData.bookingId) {
        newErrors.bookingId = 'Please select a booking to offer';
      }

      const selectedBooking = userBookings.find(
        b => b.id === formData.bookingId
      );
      if (selectedBooking && selectedBooking.status !== 'available') {
        newErrors.bookingId = 'Selected booking is no longer available';
      }
    } else if (proposalType === 'cash') {
      if (!formData.cashOffer) {
        newErrors.cashOffer = 'Cash offer details are required';
      } else {
        if (!formData.cashOffer.amount || formData.cashOffer.amount <= 0) {
          newErrors.cashAmount = 'Cash amount must be greater than 0';
        }

        if (
          targetSwap.paymentTypes.minimumCashAmount &&
          formData.cashOffer.amount < targetSwap.paymentTypes.minimumCashAmount
        ) {
          newErrors.cashAmount = `Minimum cash amount is $${targetSwap.paymentTypes.minimumCashAmount}`;
        }

        if (!formData.cashOffer.paymentMethodId) {
          newErrors.paymentMethod = 'Please select a payment method';
        }

        if (!formData.cashOffer.currency) {
          newErrors.currency = 'Currency is required';
        }
      }
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Please include a message with your proposal';
    }

    if (formData.message.length > 1000) {
      newErrors.message = 'Message is too long (max 1000 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        ...formData,
        proposalType,
      });
    }
  };

  const handleProposalTypeChange = (type: ProposalType) => {
    setProposalType(type);
    setFormData(prev => ({
      ...prev,
      proposalType: type,
      bookingId: type === 'booking' ? prev.bookingId : undefined,
      cashOffer:
        type === 'cash'
          ? prev.cashOffer || {
              amount: targetSwap.paymentTypes.minimumCashAmount || 0,
              currency: 'USD',
              paymentMethodId: '',
              escrowAgreement: true,
            }
          : undefined,
    }));
    setErrors({});
  };

  const updateCashOffer = (field: keyof CashOfferRequest, value: any) => {
    setFormData(prev => ({
      ...prev,
      cashOffer: {
        ...prev.cashOffer!,
        [field]: value,
      },
    }));

    // Clear related errors
    if (errors.cashAmount || errors.paymentMethod || errors.currency) {
      setErrors(prev => ({
        ...prev,
        cashAmount: undefined,
        paymentMethod: undefined,
        currency: undefined,
      }));
    }
  };

  const addCondition = () => {
    if (newCondition.trim()) {
      setFormData(prev => ({
        ...prev,
        conditions: [...prev.conditions, newCondition.trim()],
      }));
      setNewCondition('');
    }
  };

  const removeCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const selectedBooking = userBookings.find(b => b.id === formData.bookingId);
  const valueDifference = selectedBooking
    ? targetBooking.swapValue - selectedBooking.swapValue
    : 0;

  const textareaStyles = {
    width: '100%',
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.fontSize.base,
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    color: tokens.colors.neutral[900],
    outline: 'none',
    minHeight: '100px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: tokens.spacing[4],
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  margin: 0,
                }}
              >
                {targetSwap.acceptanceStrategy.type === 'auction'
                  ? 'Submit Auction Proposal'
                  : 'Propose Swap'}
              </h2>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                ✕
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[6],
              }}
            >
              {/* Target booking display */}
              <div>
                <h3
                  style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[3]} 0`,
                  }}
                >
                  You want to get:
                </h3>
                <BookingCard
                  booking={targetBooking}
                  onViewDetails={() => {}}
                  onProposeSwap={() => {}}
                  showSwapButton={false}
                />

                {/* Swap details */}
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
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: tokens.spacing[3],
                      fontSize: tokens.typography.fontSize.sm,
                    }}
                  >
                    <div>
                      <strong>Accepts:</strong>
                      <br />
                      {targetSwap.paymentTypes.bookingExchange &&
                        '🔄 Booking Exchange'}
                      <br />
                      {targetSwap.paymentTypes.cashPayment &&
                        '💰 Cash Payments'}
                    </div>
                    <div>
                      <strong>Strategy:</strong>
                      <br />
                      {targetSwap.acceptanceStrategy.type === 'auction'
                        ? '🏆 Auction Mode'
                        : '⚡ First Match'}
                    </div>
                    {targetSwap.paymentTypes.minimumCashAmount && (
                      <div>
                        <strong>Min Cash:</strong>
                        <br />$
                        {targetSwap.paymentTypes.minimumCashAmount.toLocaleString()}
                      </div>
                    )}
                    {targetSwap.acceptanceStrategy.type === 'auction' &&
                      targetSwap.acceptanceStrategy.auctionEndDate && (
                        <div>
                          <strong>Auction Ends:</strong>
                          <br />
                          {new Date(
                            targetSwap.acceptanceStrategy.auctionEndDate
                          ).toLocaleDateString()}
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Proposal Type Selection */}
              <div>
                <h3
                  style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[3]} 0`,
                  }}
                >
                  Select Proposal Type:
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: tokens.spacing[3],
                  }}
                >
                  {availableProposalTypes.map(type => (
                    <div
                      key={type.value}
                      style={{
                        padding: tokens.spacing[4],
                        border: `2px solid ${
                          !type.available
                            ? tokens.colors.neutral[200]
                            : proposalType === type.value
                              ? tokens.colors.primary[500]
                              : tokens.colors.neutral[300]
                        }`,
                        borderRadius: tokens.borderRadius.md,
                        backgroundColor: !type.available
                          ? tokens.colors.neutral[50]
                          : proposalType === type.value
                            ? tokens.colors.primary[50]
                            : 'white',
                        cursor: type.available ? 'pointer' : 'not-allowed',
                        opacity: type.available ? 1 : 0.6,
                        transition: 'all 0.2s ease-in-out',
                      }}
                      onClick={() =>
                        type.available && handleProposalTypeChange(type.value)
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: tokens.spacing[2],
                          marginBottom: tokens.spacing[2],
                        }}
                      >
                        <input
                          type="radio"
                          name="proposalType"
                          checked={proposalType === type.value}
                          onChange={() =>
                            type.available &&
                            handleProposalTypeChange(type.value)
                          }
                          disabled={!type.available}
                        />
                        <span
                          style={{
                            fontSize: tokens.typography.fontSize.base,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: type.available
                              ? tokens.colors.neutral[900]
                              : tokens.colors.neutral[500],
                          }}
                        >
                          {type.label}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          color: type.available
                            ? tokens.colors.neutral[600]
                            : tokens.colors.neutral[400],
                          margin: 0,
                        }}
                      >
                        {type.description}
                        {!type.available && ' (Not accepted by this swap)'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Booking Selection (for booking proposals) */}
              {proposalType === 'booking' && (
                <div>
                  <h3
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    Select your booking to offer:
                  </h3>

                  {/* Booking filters */}
                  {userBookings.length > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: tokens.spacing[3],
                        marginBottom: tokens.spacing[4],
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                      }}
                    >
                      <Input
                        placeholder="Search bookings..."
                        value={filters.search}
                        onChange={e =>
                          setFilters(prev => ({
                            ...prev,
                            search: e.target.value,
                          }))
                        }
                        leftIcon={<span>🔍</span>}
                      />

                      <div>
                        <select
                          value={filters.type}
                          onChange={e =>
                            setFilters(prev => ({
                              ...prev,
                              type: e.target.value as BookingType | '',
                            }))
                          }
                          style={{
                            width: '100%',
                            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                            fontSize: tokens.typography.fontSize.base,
                            border: `1px solid ${tokens.colors.neutral[300]}`,
                            borderRadius: tokens.borderRadius.md,
                            backgroundColor: 'white',
                            color: tokens.colors.neutral[900],
                            outline: 'none',
                          }}
                        >
                          <option value="">All Types</option>
                          <option value="hotel">Hotel</option>
                          <option value="event">Event</option>
                          <option value="flight">Flight</option>
                          <option value="rental">Rental</option>
                        </select>
                      </div>

                      <Input
                        label="Min Value"
                        type="number"
                        min="0"
                        value={filters.minValue}
                        onChange={e =>
                          setFilters(prev => ({
                            ...prev,
                            minValue: parseInt(e.target.value) || 0,
                          }))
                        }
                        placeholder="0"
                      />

                      <Input
                        label="Max Value"
                        type="number"
                        min="0"
                        value={filters.maxValue}
                        onChange={e =>
                          setFilters(prev => ({
                            ...prev,
                            maxValue: parseInt(e.target.value) || 10000,
                          }))
                        }
                        placeholder="10000"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFilters({
                            search: '',
                            type: '',
                            minValue: 0,
                            maxValue: 10000,
                          })
                        }
                        style={{ alignSelf: 'end' }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}

                  {userBookings.length === 0 ? (
                    <div
                      style={{
                        padding: tokens.spacing[8],
                        textAlign: 'center',
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '48px',
                          marginBottom: tokens.spacing[3],
                        }}
                      >
                        📋
                      </div>
                      <h4
                        style={{
                          fontSize: tokens.typography.fontSize.lg,
                          color: tokens.colors.neutral[700],
                          margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                      >
                        No bookings available
                      </h4>
                      <p
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          color: tokens.colors.neutral[600],
                          margin: 0,
                        }}
                      >
                        You need to list a booking before you can propose swaps.
                      </p>
                    </div>
                  ) : filteredBookings.length === 0 ? (
                    <div
                      style={{
                        padding: tokens.spacing[8],
                        textAlign: 'center',
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '48px',
                          marginBottom: tokens.spacing[3],
                        }}
                      >
                        🔍
                      </div>
                      <h4
                        style={{
                          fontSize: tokens.typography.fontSize.lg,
                          color: tokens.colors.neutral[700],
                          margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                      >
                        No bookings match your filters
                      </h4>
                      <p
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          color: tokens.colors.neutral[600],
                          margin: 0,
                        }}
                      >
                        Try adjusting your search criteria or clear the filters.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: tokens.spacing[4],
                        maxHeight: '400px',
                        overflow: 'auto',
                        padding: tokens.spacing[2],
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                        borderRadius: tokens.borderRadius.md,
                      }}
                    >
                      {filteredBookings.map(booking => (
                        <div
                          key={booking.id}
                          style={{
                            cursor: 'pointer',
                            border: `2px solid ${formData.bookingId === booking.id ? tokens.colors.primary[500] : 'transparent'}`,
                            borderRadius: tokens.borderRadius.md,
                            transition: 'all 0.2s ease-in-out',
                          }}
                          onClick={() =>
                            setFormData(prev => ({
                              ...prev,
                              bookingId: booking.id,
                            }))
                          }
                        >
                          <BookingCard
                            booking={booking}
                            onViewDetails={() => {}}
                            onProposeSwap={() => {}}
                            showSwapButton={false}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.bookingId && (
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.error[600],
                        marginTop: tokens.spacing[2],
                      }}
                    >
                      {errors.bookingId}
                    </div>
                  )}

                  {/* Value difference analysis for booking proposals */}
                  {selectedBooking && (
                    <div
                      style={{
                        marginTop: tokens.spacing[4],
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: tokens.typography.fontSize.base,
                          fontWeight: tokens.typography.fontWeight.semibold,
                          color: tokens.colors.neutral[900],
                          margin: `0 0 ${tokens.spacing[3]} 0`,
                        }}
                      >
                        Swap Value Analysis
                      </h4>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: tokens.spacing[4],
                        }}
                      >
                        <div style={{ textAlign: 'center' }}>
                          <div
                            style={{
                              fontSize: tokens.typography.fontSize.sm,
                              color: tokens.colors.neutral[600],
                              marginBottom: tokens.spacing[1],
                            }}
                          >
                            Your Booking Value
                          </div>
                          <div
                            style={{
                              fontSize: tokens.typography.fontSize.lg,
                              fontWeight: tokens.typography.fontWeight.semibold,
                              color: tokens.colors.neutral[900],
                            }}
                          >
                            ${selectedBooking.swapValue}
                          </div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <div
                            style={{
                              fontSize: tokens.typography.fontSize.sm,
                              color: tokens.colors.neutral[600],
                              marginBottom: tokens.spacing[1],
                            }}
                          >
                            Their Booking Value
                          </div>
                          <div
                            style={{
                              fontSize: tokens.typography.fontSize.lg,
                              fontWeight: tokens.typography.fontWeight.semibold,
                              color: tokens.colors.neutral[900],
                            }}
                          >
                            ${targetBooking.swapValue}
                          </div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <div
                            style={{
                              fontSize: tokens.typography.fontSize.sm,
                              color: tokens.colors.neutral[600],
                              marginBottom: tokens.spacing[1],
                            }}
                          >
                            Difference
                          </div>
                          <div
                            style={{
                              fontSize: tokens.typography.fontSize.lg,
                              fontWeight: tokens.typography.fontWeight.semibold,
                              color:
                                valueDifference >= 0
                                  ? tokens.colors.success[600]
                                  : tokens.colors.error[600],
                            }}
                          >
                            {valueDifference >= 0 ? '+' : ''}${valueDifference}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cash Offer Form (for cash proposals) */}
              {proposalType === 'cash' && (
                <div>
                  <h3
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    Cash Offer Details:
                  </h3>

                  <div
                    style={{
                      padding: tokens.spacing[4],
                      backgroundColor: tokens.colors.warning[50],
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${tokens.colors.warning[200]}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: tokens.spacing[4],
                        marginBottom: tokens.spacing[4],
                      }}
                    >
                      <Input
                        label="Cash Amount ($) *"
                        type="number"
                        min={targetSwap.paymentTypes.minimumCashAmount || 1}
                        step="0.01"
                        value={formData.cashOffer?.amount || ''}
                        onChange={e =>
                          updateCashOffer(
                            'amount',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        error={errors.cashAmount}
                        placeholder="Enter amount"
                        helperText={
                          targetSwap.paymentTypes.minimumCashAmount
                            ? `Minimum: $${targetSwap.paymentTypes.minimumCashAmount}`
                            : undefined
                        }
                      />

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
                          Currency *
                        </label>
                        <select
                          value={formData.cashOffer?.currency || 'USD'}
                          onChange={e =>
                            updateCashOffer('currency', e.target.value)
                          }
                          style={{
                            width: '100%',
                            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                            fontSize: tokens.typography.fontSize.base,
                            border: `1px solid ${errors.currency ? tokens.colors.error[400] : tokens.colors.neutral[300]}`,
                            borderRadius: tokens.borderRadius.md,
                            backgroundColor: 'white',
                            color: tokens.colors.neutral[900],
                            outline: 'none',
                          }}
                        >
                          <option value="USD">USD - US Dollar</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="GBP">GBP - British Pound</option>
                          <option value="CAD">CAD - Canadian Dollar</option>
                        </select>
                        {errors.currency && (
                          <div
                            style={{
                              fontSize: tokens.typography.fontSize.sm,
                              color: tokens.colors.error[600],
                              marginTop: tokens.spacing[1],
                            }}
                          >
                            {errors.currency}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: tokens.spacing[4] }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.neutral[700],
                          marginBottom: tokens.spacing[2],
                        }}
                      >
                        Payment Method *
                      </label>
                      {userPaymentMethods.length === 0 ? (
                        <div
                          style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.neutral[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                            textAlign: 'center',
                          }}
                        >
                          <p
                            style={{
                              fontSize: tokens.typography.fontSize.sm,
                              color: tokens.colors.neutral[600],
                              margin: `0 0 ${tokens.spacing[2]} 0`,
                            }}
                          >
                            No payment methods available
                          </p>
                          <Button variant="outline" size="sm">
                            Add Payment Method
                          </Button>
                        </div>
                      ) : (
                        <select
                          value={formData.cashOffer?.paymentMethodId || ''}
                          onChange={e =>
                            updateCashOffer('paymentMethodId', e.target.value)
                          }
                          style={{
                            width: '100%',
                            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                            fontSize: tokens.typography.fontSize.base,
                            border: `1px solid ${errors.paymentMethod ? tokens.colors.error[400] : tokens.colors.neutral[300]}`,
                            borderRadius: tokens.borderRadius.md,
                            backgroundColor: 'white',
                            color: tokens.colors.neutral[900],
                            outline: 'none',
                          }}
                        >
                          <option value="">Select payment method</option>
                          {userPaymentMethods.map(method => (
                            <option key={method.id} value={method.id}>
                              {method.displayName} ({method.type})
                              {method.isVerified ? ' ✓' : ' (Unverified)'}
                            </option>
                          ))}
                        </select>
                      )}
                      {errors.paymentMethod && (
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.error[600],
                            marginTop: tokens.spacing[1],
                          }}
                        >
                          {errors.paymentMethod}
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: tokens.spacing[2],
                          fontSize: tokens.typography.fontSize.sm,
                          color: tokens.colors.neutral[700],
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.cashOffer?.escrowAgreement || false}
                          onChange={e =>
                            updateCashOffer('escrowAgreement', e.target.checked)
                          }
                        />
                        <span>
                          I agree to use escrow service for secure payment
                          processing
                        </span>
                      </label>
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          color: tokens.colors.neutral[600],
                          marginTop: tokens.spacing[1],
                          marginLeft: tokens.spacing[6],
                        }}
                      >
                        Escrow protects both parties by holding funds until the
                        swap is completed
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Message */}
              <div>
                <label
                  htmlFor="proposal-message"
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Message to the{' '}
                  {targetSwap.acceptanceStrategy.type === 'auction'
                    ? 'auction owner'
                    : 'swap owner'}{' '}
                  *
                </label>
                <textarea
                  id="proposal-message"
                  value={formData.message}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, message: e.target.value }))
                  }
                  placeholder={
                    targetSwap.acceptanceStrategy.type === 'auction'
                      ? 'Explain why your proposal is the best choice for this auction...'
                      : 'Explain why this swap would be beneficial for both parties...'
                  }
                  style={textareaStyles}
                />
                {errors.message && (
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.error[600],
                      marginTop: tokens.spacing[1],
                    }}
                  >
                    {errors.message}
                  </div>
                )}
              </div>

              {/* Conditions */}
              <div>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[3]} 0`,
                  }}
                >
                  Additional Conditions (Optional)
                </h4>

                <div
                  style={{
                    display: 'flex',
                    gap: tokens.spacing[2],
                    marginBottom: tokens.spacing[3],
                  }}
                >
                  <Input
                    value={newCondition}
                    onChange={e => setNewCondition(e.target.value)}
                    placeholder="Add a condition (e.g., 'Must confirm 24h before check-in')"
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCondition}
                    disabled={!newCondition.trim()}
                  >
                    Add
                  </Button>
                </div>

                {formData.conditions.length > 0 && (
                  <div
                    style={{
                      backgroundColor: tokens.colors.neutral[50],
                      padding: tokens.spacing[3],
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${tokens.colors.neutral[200]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        marginBottom: tokens.spacing[2],
                      }}
                    >
                      Conditions:
                    </div>
                    {formData.conditions.map((condition, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: `${tokens.spacing[2]} 0`,
                          borderBottom:
                            index < formData.conditions.length - 1
                              ? `1px solid ${tokens.colors.neutral[200]}`
                              : 'none',
                        }}
                      >
                        <span
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[700],
                          }}
                        >
                          • {condition}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCondition(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Section */}
              {(selectedBooking ||
                (proposalType === 'cash' && formData.cashOffer?.amount)) && (
                <div
                  style={{
                    padding: tokens.spacing[4],
                    backgroundColor: tokens.colors.primary[50],
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${tokens.colors.primary[200]}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: tokens.spacing[3],
                    }}
                  >
                    <h4
                      style={{
                        fontSize: tokens.typography.fontSize.base,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.primary[900],
                        margin: 0,
                      }}
                    >
                      Proposal Preview
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? 'Hide' : 'Show'} Details
                    </Button>
                  </div>

                  {showPreview && (
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.primary[800],
                        lineHeight: tokens.typography.lineHeight.relaxed,
                      }}
                    >
                      {proposalType === 'booking' && selectedBooking ? (
                        <>
                          <p>
                            <strong>You're offering:</strong>{' '}
                            {selectedBooking.title} in{' '}
                            {selectedBooking.location.city}
                          </p>
                          <p>
                            <strong>In exchange for:</strong>{' '}
                            {targetBooking.title} in{' '}
                            {targetBooking.location.city}
                          </p>
                          <p>
                            <strong>Value difference:</strong> $
                            {Math.abs(valueDifference)}{' '}
                            {valueDifference >= 0
                              ? 'in your favor'
                              : 'in their favor'}
                          </p>
                        </>
                      ) : proposalType === 'cash' && formData.cashOffer ? (
                        <>
                          <p>
                            <strong>Cash offer:</strong> $
                            {formData.cashOffer.amount.toLocaleString()}{' '}
                            {formData.cashOffer.currency}
                          </p>
                          <p>
                            <strong>For:</strong> {targetBooking.title} in{' '}
                            {targetBooking.location.city}
                          </p>
                          <p>
                            <strong>Escrow:</strong>{' '}
                            {formData.cashOffer.escrowAgreement ? 'Yes' : 'No'}
                          </p>
                        </>
                      ) : null}
                      {formData.conditions.length > 0 && (
                        <p>
                          <strong>Conditions:</strong>{' '}
                          {formData.conditions.length} condition(s) specified
                        </p>
                      )}
                      <p>
                        <strong>Type:</strong>{' '}
                        {targetSwap.acceptanceStrategy.type === 'auction'
                          ? 'Auction proposal'
                          : 'Direct swap proposal'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: tokens.spacing[4],
                  borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                }}
              >
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                  }}
                >
                  {proposalType === 'booking'
                    ? selectedBooking
                      ? `Ready to propose ${selectedBooking.title}`
                      : 'Select a booking to continue'
                    : proposalType === 'cash'
                      ? formData.cashOffer?.amount
                        ? `Ready to offer $${formData.cashOffer.amount.toLocaleString()}`
                        : 'Enter cash amount to continue'
                      : 'Select proposal type to continue'}
                </div>
                <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={loading}
                    disabled={
                      (proposalType === 'booking' && !selectedBooking) ||
                      (proposalType === 'cash' &&
                        (!formData.cashOffer?.amount ||
                          !formData.cashOffer?.paymentMethodId))
                    }
                  >
                    {targetSwap.acceptanceStrategy.type === 'auction'
                      ? 'Submit to Auction'
                      : 'Send Proposal'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
