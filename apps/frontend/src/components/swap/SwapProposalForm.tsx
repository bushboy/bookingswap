import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { BookingCard } from '@/components/booking/BookingCard';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { tokens } from '@/design-system/tokens';
import { Booking, BookingType, PaymentMethod } from '@booking-swap/shared';
import { paymentService } from '@/services/paymentService';
import { useAuth } from '@/contexts/AuthContext';

// Enhanced proposal types
type ProposalType = 'booking' | 'cash';

interface BookingProposalData {
  type: 'booking';
  sourceBookingId: string;
  additionalPayment?: number;
  conditions: string[];
  expiresAt: Date;
  message: string;
}

interface CashProposalData {
  type: 'cash';
  cashAmount: number;
  paymentMethodId: string;
  conditions: string[];
  expiresAt: Date;
  message: string;
}

type SwapProposalFormData = BookingProposalData | CashProposalData;

interface BookingFilters {
  search: string;
  type: BookingType | '';
  minValue: number;
  maxValue: number;
}

interface SwapProposalFormProps {
  // Target swap/booking information
  targetSwap?: {
    id: string;
    sourceBooking: Booking;
    swapType: 'booking' | 'cash';
    cashDetails?: {
      minAmount: number;
      maxAmount: number;
      preferredAmount?: number;
      currency: string;
    };
  };
  targetBooking?: Booking; // For backward compatibility

  // Context information
  context: 'bookings-table' | 'browse-search'; // Determines if booking is pre-filled
  preFilledBooking?: Booking; // When launched from bookings table

  // User's available bookings (only shown in browse context)
  userBookings: Booking[];

  // Callbacks
  onSubmit: (data: SwapProposalFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const SwapProposalForm: React.FC<SwapProposalFormProps> = ({
  targetSwap,
  targetBooking, // For backward compatibility
  context,
  preFilledBooking,
  userBookings,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { user } = useAuth();
  const [proposalType, setProposalType] = useState<ProposalType>('booking');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);

  // Determine the actual target booking
  const actualTargetBooking = targetSwap?.sourceBooking || targetBooking;

  // Initialize form data based on proposal type
  const [formData, setFormData] = useState<SwapProposalFormData>(() => {
    const baseData = {
      conditions: [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      message: '',
    };

    if (proposalType === 'booking') {
      return {
        type: 'booking',
        sourceBookingId: context === 'bookings-table' && preFilledBooking ? preFilledBooking.id : '',
        additionalPayment: 0,
        ...baseData,
      } as BookingProposalData;
    } else {
      return {
        type: 'cash',
        cashAmount: targetSwap?.cashDetails?.preferredAmount || targetSwap?.cashDetails?.minAmount || 0,
        paymentMethodId: '',
        ...baseData,
      } as CashProposalData;
    }
  });

  // Load payment methods when cash proposal is selected
  useEffect(() => {
    if (proposalType === 'cash' && user?.id) {
      setLoadingPaymentMethods(true);
      paymentService.getPaymentMethods(user.id)
        .then(methods => setPaymentMethods(methods))
        .catch(error => console.error('Failed to load payment methods:', error))
        .finally(() => setLoadingPaymentMethods(false));
    }
  }, [proposalType, user?.id]);

  // Update form data when proposal type changes
  useEffect(() => {
    const baseData = {
      conditions: formData.conditions,
      expiresAt: formData.expiresAt,
      message: formData.message,
    };

    if (proposalType === 'booking') {
      setFormData({
        type: 'booking',
        sourceBookingId: context === 'bookings-table' && preFilledBooking ? preFilledBooking.id : '',
        additionalPayment: 0,
        ...baseData,
      } as BookingProposalData);
    } else {
      setFormData({
        type: 'cash',
        cashAmount: targetSwap?.cashDetails?.preferredAmount || targetSwap?.cashDetails?.minAmount || 0,
        paymentMethodId: '',
        ...baseData,
      } as CashProposalData);
    }
  }, [proposalType, context, preFilledBooking, targetSwap]);

  const [errors, setErrors] = useState<{
    sourceBookingId?: string;
    additionalPayment?: string;
    cashAmount?: string;
    paymentMethodId?: string;
    message?: string;
    general?: string;
  }>({});

  const [newCondition, setNewCondition] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [filters, setFilters] = useState<BookingFilters>({
    search: '',
    type: '',
    minValue: 0,
    maxValue: 10000,
  });

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
    const newErrors: typeof errors = {};

    // Common validations
    if (!formData.message.trim()) {
      newErrors.message = 'Please include a message with your proposal';
    }

    if (formData.message.length > 1000) {
      newErrors.message = 'Message is too long (max 1000 characters)';
    }

    if (formData.expiresAt <= new Date()) {
      newErrors.general = 'Expiration date must be in the future';
    }

    if (formData.expiresAt > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
      newErrors.general = 'Expiration date cannot be more than 30 days from now';
    }

    // Type-specific validations
    if (formData.type === 'booking') {
      const bookingData = formData as BookingProposalData;

      if (!bookingData.sourceBookingId) {
        newErrors.sourceBookingId = 'Please select a booking to offer';
      }

      const selectedBooking = userBookings.find(b => b.id === bookingData.sourceBookingId);
      if (selectedBooking && selectedBooking.status !== 'available') {
        newErrors.sourceBookingId = 'Selected booking is no longer available';
      }

      if (bookingData.additionalPayment && bookingData.additionalPayment < 0) {
        newErrors.additionalPayment = 'Additional payment cannot be negative';
      }

      if (bookingData.additionalPayment && bookingData.additionalPayment > 10000) {
        newErrors.additionalPayment = 'Additional payment seems unusually high';
      }
    } else if (formData.type === 'cash') {
      const cashData = formData as CashProposalData;

      if (!cashData.cashAmount || cashData.cashAmount <= 0) {
        newErrors.cashAmount = 'Cash amount must be greater than 0';
      }

      if (targetSwap?.cashDetails) {
        if (cashData.cashAmount < targetSwap.cashDetails.minAmount) {
          newErrors.cashAmount = `Minimum amount is $${targetSwap.cashDetails.minAmount}`;
        }
        if (cashData.cashAmount > targetSwap.cashDetails.maxAmount) {
          newErrors.cashAmount = `Maximum amount is $${targetSwap.cashDetails.maxAmount}`;
        }
      }

      if (!cashData.paymentMethodId) {
        newErrors.paymentMethodId = 'Please select a payment method';
      }

      const selectedPaymentMethod = paymentMethods.find(pm => pm.id === cashData.paymentMethodId);
      if (selectedPaymentMethod && !selectedPaymentMethod.isVerified) {
        newErrors.paymentMethodId = 'Selected payment method is not verified';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
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

  const selectedBooking = formData.type === 'booking'
    ? userBookings.find(b => b.id === (formData as BookingProposalData).sourceBookingId)
    : null;
  const valueDifference = selectedBooking && actualTargetBooking
    ? actualTargetBooking.swapValue - selectedBooking.swapValue
    : 0;

  // Determine available proposal types based on target swap
  const availableProposalTypes = useMemo(() => {
    const types: { value: ProposalType; label: string; disabled?: boolean; reason?: string }[] = [
      { value: 'booking', label: 'Booking Exchange' }
    ];

    if (targetSwap?.swapType === 'cash' || targetSwap?.cashDetails) {
      types.push({ value: 'cash', label: 'Cash Offer' });
    } else if (!targetSwap) {
      // If no target swap info, assume both are available
      types.push({ value: 'cash', label: 'Cash Offer' });
    }

    return types;
  }, [targetSwap]);

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
                Propose Swap
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
              {actualTargetBooking && (
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
                    booking={actualTargetBooking}
                    onViewDetails={() => { }}
                    onProposeSwap={() => { }}
                    showSwapButton={false}
                  />

                  {/* Cash swap details */}
                  {targetSwap?.cashDetails && (
                    <div
                      style={{
                        marginTop: tokens.spacing[3],
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.primary[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.primary[200]}`,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: tokens.typography.fontSize.base,
                          fontWeight: tokens.typography.fontWeight.semibold,
                          color: tokens.colors.primary[900],
                          margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                      >
                        💰 Cash Swap Available
                      </h4>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: tokens.spacing[3],
                          fontSize: tokens.typography.fontSize.sm,
                          color: tokens.colors.primary[800],
                        }}
                      >
                        <div>
                          <strong>Min Amount:</strong> ${targetSwap.cashDetails.minAmount}
                        </div>
                        <div>
                          <strong>Max Amount:</strong> ${targetSwap.cashDetails.maxAmount}
                        </div>
                        {targetSwap.cashDetails.preferredAmount && (
                          <div>
                            <strong>Preferred:</strong> ${targetSwap.cashDetails.preferredAmount}
                          </div>
                        )}
                        <div>
                          <strong>Currency:</strong> {targetSwap.cashDetails.currency}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Proposal Type Selection */}
              {availableProposalTypes.length > 1 && (
                <div>
                  <h3
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    Choose Proposal Type:
                  </h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: tokens.spacing[3],
                    }}
                  >
                    {availableProposalTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        disabled={type.disabled}
                        onClick={() => setProposalType(type.value)}
                        style={{
                          padding: tokens.spacing[4],
                          border: `2px solid ${proposalType === type.value
                            ? tokens.colors.primary[500]
                            : tokens.colors.neutral[300]
                            }`,
                          borderRadius: tokens.borderRadius.md,
                          backgroundColor: proposalType === type.value
                            ? tokens.colors.primary[50]
                            : 'white',
                          color: type.disabled
                            ? tokens.colors.neutral[400]
                            : proposalType === type.value
                              ? tokens.colors.primary[700]
                              : tokens.colors.neutral[700],
                          cursor: type.disabled ? 'not-allowed' : 'pointer',
                          textAlign: 'center',
                          fontSize: tokens.typography.fontSize.base,
                          fontWeight: tokens.typography.fontWeight.medium,
                          transition: 'all 0.2s ease-in-out',
                        }}
                        title={type.reason}
                      >
                        <div style={{ marginBottom: tokens.spacing[2] }}>
                          {type.value === 'booking' ? '🏠' : '💰'}
                        </div>
                        {type.label}
                        {type.disabled && type.reason && (
                          <div
                            style={{
                              fontSize: tokens.typography.fontSize.xs,
                              color: tokens.colors.neutral[500],
                              marginTop: tokens.spacing[1],
                            }}
                          >
                            {type.reason}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking Proposal Section */}
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
                    {context === 'bookings-table' && preFilledBooking
                      ? 'Your booking to offer:'
                      : 'Select your booking to offer:'}
                  </h3>

                  {/* Pre-filled booking display (bookings table context) */}
                  {context === 'bookings-table' && preFilledBooking && (
                    <div
                      style={{
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.success[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `2px solid ${tokens.colors.success[200]}`,
                        marginBottom: tokens.spacing[4],
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: tokens.spacing[2],
                          marginBottom: tokens.spacing[3],
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>✅</span>
                        <span
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.success[700],
                          }}
                        >
                          Pre-selected from your bookings
                        </span>
                      </div>
                      <BookingCard
                        booking={preFilledBooking}
                        onViewDetails={() => { }}
                        onProposeSwap={() => { }}
                        showSwapButton={false}
                      />
                    </div>
                  )}

                  {/* Booking selection dropdown (browse context) */}
                  {context === 'browse-search' && (

                    <>
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
                                border: `2px solid ${formData.type === 'booking' &&
                                  (formData as BookingProposalData).sourceBookingId === booking.id
                                  ? tokens.colors.primary[500]
                                  : 'transparent'
                                  }`,
                                borderRadius: tokens.borderRadius.md,
                                transition: 'all 0.2s ease-in-out',
                              }}
                              onClick={() =>
                                updateFormData('sourceBookingId', booking.id)
                              }
                            >
                              <BookingCard
                                booking={booking}
                                onViewDetails={() => { }}
                                onProposeSwap={() => { }}
                                showSwapButton={false}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {errors.sourceBookingId && (
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.error[600],
                            marginTop: tokens.spacing[2],
                          }}
                        >
                          {errors.sourceBookingId}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Cash Proposal Section */}
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
                    💰 Make Cash Offer
                  </h3>

                  {/* Cash amount input */}
                  <div style={{ marginBottom: tokens.spacing[4] }}>
                    <Input
                      label="Cash Offer Amount"
                      type="number"
                      min={targetSwap?.cashDetails?.minAmount || 0}
                      max={targetSwap?.cashDetails?.maxAmount || 100000}
                      step="0.01"
                      value={formData.type === 'cash' ? (formData as CashProposalData).cashAmount : 0}
                      onChange={e =>
                        updateFormData('cashAmount', parseFloat(e.target.value) || 0)
                      }
                      error={errors.cashAmount}
                      placeholder="Enter your cash offer"
                      helperText={
                        targetSwap?.cashDetails
                          ? `Range: $${targetSwap.cashDetails.minAmount} - $${targetSwap.cashDetails.maxAmount}${targetSwap.cashDetails.preferredAmount
                            ? ` (Preferred: $${targetSwap.cashDetails.preferredAmount})`
                            : ''
                          }`
                          : 'Enter the amount you want to offer'
                      }
                      leftIcon={<span>$</span>}
                    />
                  </div>

                  {/* Payment method selection */}
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
                      Payment Method
                    </label>

                    {loadingPaymentMethods ? (
                      <div
                        style={{
                          padding: tokens.spacing[4],
                          textAlign: 'center',
                          backgroundColor: tokens.colors.neutral[50],
                          borderRadius: tokens.borderRadius.md,
                          border: `1px solid ${tokens.colors.neutral[200]}`,
                        }}
                      >
                        <div style={{ marginBottom: tokens.spacing[2] }}>🔄</div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                          }}
                        >
                          Loading payment methods...
                        </div>
                      </div>
                    ) : paymentMethods.length === 0 ? (
                      <div
                        style={{
                          padding: tokens.spacing[4],
                          textAlign: 'center',
                          backgroundColor: tokens.colors.warning[50],
                          borderRadius: tokens.borderRadius.md,
                          border: `1px solid ${tokens.colors.warning[200]}`,
                        }}
                      >
                        <div style={{ marginBottom: tokens.spacing[2] }}>💳</div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.warning[700],
                            marginBottom: tokens.spacing[2],
                          }}
                        >
                          No payment methods available
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // This would open a modal to add payment method
                            console.log('Add payment method clicked');
                          }}
                        >
                          Add Payment Method
                        </Button>
                      </div>
                    ) : (
                      <PaymentMethodSelector
                        paymentMethods={paymentMethods}
                        selectedMethodId={
                          formData.type === 'cash' ? (formData as CashProposalData).paymentMethodId : ''
                        }
                        onSelect={(methodId) => updateFormData('paymentMethodId', methodId)}
                        error={errors.paymentMethodId}
                      />
                    )}
                  </div>

                  {/* Cash offer preview */}
                  {formData.type === 'cash' && (formData as CashProposalData).cashAmount > 0 && (
                    <div
                      style={{
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.primary[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.primary[200]}`,
                        marginBottom: tokens.spacing[4],
                      }}
                    >
                      <h4
                        style={{
                          fontSize: tokens.typography.fontSize.base,
                          fontWeight: tokens.typography.fontWeight.semibold,
                          color: tokens.colors.primary[900],
                          margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                      >
                        Cash Offer Preview
                      </h4>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: tokens.spacing[3],
                          fontSize: tokens.typography.fontSize.sm,
                          color: tokens.colors.primary[800],
                        }}
                      >
                        <div>
                          <strong>Offer Amount:</strong> ${(formData as CashProposalData).cashAmount}
                        </div>
                        <div>
                          <strong>Booking Value:</strong> ${actualTargetBooking?.swapValue || 0}
                        </div>
                        <div>
                          <strong>Difference:</strong>{' '}
                          <span
                            style={{
                              color:
                                (formData as CashProposalData).cashAmount >= (actualTargetBooking?.swapValue || 0)
                                  ? tokens.colors.success[600]
                                  : tokens.colors.warning[600],
                            }}
                          >
                            {(formData as CashProposalData).cashAmount >= (actualTargetBooking?.swapValue || 0)
                              ? `+$${(formData as CashProposalData).cashAmount - (actualTargetBooking?.swapValue || 0)}`
                              : `-$${(actualTargetBooking?.swapValue || 0) - (formData as CashProposalData).cashAmount}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Value difference and additional payment (booking proposals only) */}
              {proposalType === 'booking' && selectedBooking && (
                <div
                  style={{
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
                      marginBottom: tokens.spacing[4],
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

                  <Input
                    label="Additional Payment ($)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      formData.type === 'booking'
                        ? (formData as BookingProposalData).additionalPayment || 0
                        : 0
                    }
                    onChange={e =>
                      updateFormData(
                        'additionalPayment',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    error={errors.additionalPayment}
                    placeholder="0.00"
                    helperText={
                      valueDifference > 0
                        ? `Consider offering $${valueDifference} to match their booking value`
                        : 'Optional additional payment to sweeten the deal'
                    }
                  />
                </div>
              )}

              {/* Message */}
              <div>
                <label
                  htmlFor="swap-message"
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Message to the booking owner
                </label>
                <textarea
                  id="swap-message"
                  value={formData.message}
                  onChange={e => updateFormData('message', e.target.value)}
                  placeholder="Explain why this swap would be beneficial for both parties..."
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
                  Swap Conditions (Optional)
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

              {/* Expiration */}
              <Input
                label="Proposal expires on"
                type="datetime-local"
                value={formData.expiresAt.toISOString().slice(0, 16)}
                onChange={e =>
                  updateFormData('expiresAt', new Date(e.target.value))
                }
                helperText="The proposal will automatically expire after this date"
              />

              {/* General errors */}
              {errors.general && (
                <div
                  style={{
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.error[50],
                    border: `1px solid ${tokens.colors.error[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    color: tokens.colors.error[700],
                    fontSize: tokens.typography.fontSize.sm,
                  }}
                >
                  {errors.general}
                </div>
              )}

              {/* Preview Section */}
              {((proposalType === 'booking' && selectedBooking) ||
                (proposalType === 'cash' && formData.type === 'cash' && (formData as CashProposalData).cashAmount > 0)) && (
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
                              {selectedBooking.location?.city || 'Unknown'}
                            </p>
                            <p>
                              <strong>In exchange for:</strong> {actualTargetBooking?.title || 'Target booking'}{' '}
                              in {actualTargetBooking?.location?.city || 'Unknown'}
                            </p>
                            <p>
                              <strong>Value difference:</strong> $
                              {Math.abs(valueDifference)}{' '}
                              {valueDifference >= 0
                                ? 'in your favor'
                                : 'in their favor'}
                            </p>
                            {formData.type === 'booking' && (formData as BookingProposalData).additionalPayment && (formData as BookingProposalData).additionalPayment! > 0 && (
                              <p>
                                <strong>Additional payment:</strong> $
                                {(formData as BookingProposalData).additionalPayment}
                              </p>
                            )}
                          </>
                        ) : proposalType === 'cash' && formData.type === 'cash' ? (
                          <>
                            <p>
                              <strong>You're offering:</strong> ${(formData as CashProposalData).cashAmount} cash
                            </p>
                            <p>
                              <strong>For booking:</strong> {actualTargetBooking?.title || 'Target booking'}{' '}
                              in {actualTargetBooking?.location?.city || 'Unknown'}
                            </p>
                            <p>
                              <strong>Booking value:</strong> ${actualTargetBooking?.swapValue || 0}
                            </p>
                            <p>
                              <strong>Your offer vs booking value:</strong>{' '}
                              <span
                                style={{
                                  color:
                                    (formData as CashProposalData).cashAmount >= (actualTargetBooking?.swapValue || 0)
                                      ? tokens.colors.success[600]
                                      : tokens.colors.warning[600],
                                }}
                              >
                                {(formData as CashProposalData).cashAmount >= (actualTargetBooking?.swapValue || 0)
                                  ? `+$${(formData as CashProposalData).cashAmount - (actualTargetBooking?.swapValue || 0)} above`
                                  : `-$${(actualTargetBooking?.swapValue || 0) - (formData as CashProposalData).cashAmount} below`}
                              </span>
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
                          <strong>Expires:</strong>{' '}
                          {formData.expiresAt.toLocaleDateString()} at{' '}
                          {formData.expiresAt.toLocaleTimeString()}
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
                    ? (selectedBooking
                      ? `Ready to send booking proposal for ${selectedBooking.title}`
                      : 'Select a booking to continue')
                    : (formData.type === 'cash' && (formData as CashProposalData).cashAmount > 0 && (formData as CashProposalData).paymentMethodId
                      ? `Ready to send cash offer of $${(formData as CashProposalData).cashAmount}`
                      : 'Enter cash amount and select payment method to continue')
                  }
                </div>
                <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={loading}
                    disabled={
                      proposalType === 'booking'
                        ? (!selectedBooking || filteredBookings.length === 0)
                        : (formData.type !== 'cash' ||
                          !(formData as CashProposalData).cashAmount ||
                          (formData as CashProposalData).cashAmount <= 0 ||
                          !(formData as CashProposalData).paymentMethodId)
                    }
                  >
                    {proposalType === 'booking' ? 'Send Booking Proposal' : 'Send Cash Offer'}
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
