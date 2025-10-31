import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  ValidationFeedback,
  RealTimeValidation,
} from '@/components/ui/ValidationFeedback';
import { ErrorDisplay, ValidationSummary } from '@/components/ui/ErrorDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import {
  useFormValidation,
  useAuctionTimingValidation,
} from '@/hooks/useValidation';
import { validateSwapCreationForm } from '@/utils/validation';
import { tokens } from '@/design-system/tokens';
import { Booking } from '@/components/booking/BookingCard';
import {
  EnhancedCreateSwapRequest,
  PaymentTypePreference,
  AcceptanceStrategy,
  AcceptanceStrategyType,
} from '@booking-swap/shared';
import { walletService } from '@/services/walletService';
import {
  WalletConnectionStatus
} from '@/components/wallet/WalletValidationErrorDisplay';
import { FEATURE_FLAGS } from '@/config/featureFlags';

interface EnhancedSwapCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onSubmit: (data: EnhancedCreateSwapRequest) => Promise<void>;
  loading?: boolean;
}

export const EnhancedSwapCreationModal: React.FC<
  EnhancedSwapCreationModalProps
> = ({ isOpen, onClose, booking, onSubmit, loading = false }) => {
  const { user } = useAuth();
  const { walletAddress, isConnected, connect, availableProviders, connectionStatus, isConnecting } = useWallet();
  const [formData, setFormData] = useState<EnhancedCreateSwapRequest>({
    sourceBookingId: '',
    title: '',
    description: '',
    paymentTypes: {
      bookingExchange: true,
      cashPayment: false,
      minimumCashAmount: undefined,
      preferredCashAmount: undefined,
    },
    acceptanceStrategy: {
      type: 'first_match',
      auctionEndDate: undefined,
      autoSelectHighest: false,
    },
    auctionSettings: undefined,
    swapPreferences: {
      preferredLocations: [],
      preferredDates: [],
      additionalRequirements: [],
    },
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    walletAddress: '',
  });

  const [preferredLocationInput, setPreferredLocationInput] = useState('');
  const [isLastMinuteBooking, setIsLastMinuteBooking] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [isValidatingWallet, setIsValidatingWallet] = useState(false);

  // Use enhanced validation hooks
  const formValidation = useFormValidation(formData, {
    title: {
      required: true,
      minLength: 5,
      maxLength: 200,
    },
    description: {
      required: true,
      minLength: 20,
      maxLength: 2000,
    },
    expirationDate: {
      custom: value => {
        if (value <= new Date()) {
          return 'Expiration date must be in the future';
        }
        return null;
      },
    },
  });

  // Memoize the event date to prevent infinite re-renders
  const eventDate = useMemo(() => {
    return booking ? new Date(booking.dateRange.checkIn) : undefined;
  }, [booking?.dateRange?.checkIn]);

  const auctionTiming = useAuctionTimingValidation(eventDate);

  // Real-time validation
  const realTimeValidation = validateSwapCreationForm(
    formData,
    eventDate
  );



  // Clear wallet validation and error state when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      setIsValidatingWallet(false);
      // Clear any previous errors when modal closes
      setSubmitError(null);
    } else {
      // Also clear errors when modal opens to ensure clean state
      setSubmitError(null);
    }
  }, [isOpen]);

  // Persist form data during wallet operations to prevent data loss
  useEffect(() => {
    if (isOpen && booking) {
      // Save form data to session storage for recovery
      const formDataKey = `swap-form-${booking.id}`;
      try {
        sessionStorage.setItem(formDataKey, JSON.stringify(formData));
      } catch (error) {
        console.warn('Failed to persist form data:', error);
      }
    }
  }, [formData, isOpen, booking?.id]);

  // Restore form data when modal opens
  useEffect(() => {
    if (isOpen && booking && formData.sourceBookingId !== booking.id) {
      const formDataKey = `swap-form-${booking.id}`;
      try {
        const savedData = sessionStorage.getItem(formDataKey);
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          // Only restore if it's for the same booking
          if (parsedData.sourceBookingId === booking.id) {
            setFormData(parsedData);
            return; // Skip the default initialization
          }
        }
      } catch (error) {
        console.warn('Failed to restore form data:', error);
      }
    }
  }, [isOpen, booking?.id]);

  // Initialize form data when booking changes
  useEffect(() => {
    if (booking && isOpen && formData.sourceBookingId !== booking.id && eventDate) {
      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const isLastMinute = eventDate <= oneWeekFromNow;

      setIsLastMinuteBooking(isLastMinute);

      setFormData(prev => ({
        ...prev,
        sourceBookingId: booking.id,
        title: `Swap: ${booking.title}`,
        description: `Looking to swap my ${booking.type} booking in ${booking.location?.city || 'Unknown'}. Original booking: ${booking.title}`,
        swapPreferences: {
          ...prev.swapPreferences,
          preferredLocations: [],
        },
        // Force first_match for last-minute bookings or when auction mode is disabled
        acceptanceStrategy: (isLastMinute || !FEATURE_FLAGS.ENABLE_AUCTION_MODE)
          ? {
            type: 'first_match',
            auctionEndDate: undefined,
            autoSelectHighest: false,
          }
          : prev.acceptanceStrategy,
      }));
    }
  }, [booking?.id, isOpen, formData.sourceBookingId, eventDate]);

  // Enforce default values when features are disabled
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
      setFormData(prev => ({
        ...prev,
        paymentTypes: {
          ...prev.paymentTypes,
          cashPayment: false,
          minimumCashAmount: undefined,
          preferredCashAmount: undefined,
        },
      }));
    }
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
      setFormData(prev => ({
        ...prev,
        acceptanceStrategy: {
          type: 'first_match',
          auctionEndDate: undefined,
          autoSelectHighest: false,
        },
      }));
    }
  }, []);

  const validateForm = (): boolean => {
    // Use the comprehensive validation
    const validation = validateSwapCreationForm(
      formData,
      eventDate
    );

    console.log('Validation details:', validation);

    // Skip cash-related validations when cash swaps are disabled
    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
      // Remove cash-related validation errors
      if (validation.paymentTypes) {
        validation.paymentTypes.errors = validation.paymentTypes.errors.filter(
          error => !error.toLowerCase().includes('cash')
        );
        validation.paymentTypes.isValid = validation.paymentTypes.errors.length === 0;
      }
    }

    // Skip auction-related validations when auction mode is disabled
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
      // Remove auction-related validation errors
      if (validation.acceptanceStrategy) {
        validation.acceptanceStrategy.errors = validation.acceptanceStrategy.errors.filter(
          error => !error.toLowerCase().includes('auction')
        );
        validation.acceptanceStrategy.isValid = validation.acceptanceStrategy.errors.length === 0;
      }
      if (validation.auctionSettings) {
        validation.auctionSettings.errors = [];
        validation.auctionSettings.isValid = true;
      }
    }

    // Check if all fields are valid
    const isValid = Object.values(validation).every(field => field.isValid);
    console.log('Overall validation result:', isValid);

    // Log any validation errors
    Object.entries(validation).forEach(([field, result]) => {
      if (!result.isValid) {
        console.log(`Validation error in ${field}:`, result.errors);
      }
    });

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    console.log('EnhancedSwapCreationModal: handleSubmit called');
    console.log('Form data:', formData);

    const validationResult = validateForm();
    console.log('Validation result:', validationResult);

    if (!validationResult) {
      console.log('Validation failed, not submitting');
      return;
    }

    // Check if wallet is connected before proceeding
    if (!isConnected) {
      console.log('Wallet not connected, not submitting');
      setSubmitError(new Error('Please connect your wallet before creating a swap'));
      return;
    }

    try {
      // Prepare auction settings if auction mode is selected
      const enhancedFormData: EnhancedCreateSwapRequest = {
        ...formData,
        walletAddress: walletAddress, // Use current wallet address
        auctionSettings:
          formData.acceptanceStrategy.type === 'auction'
            ? {
              endDate: formData.acceptanceStrategy.auctionEndDate!,
              allowBookingProposals: formData.paymentTypes.bookingExchange,
              allowCashProposals: formData.paymentTypes.cashPayment,
              minimumCashOffer: formData.paymentTypes.minimumCashAmount,
              autoSelectAfterHours: formData.acceptanceStrategy
                .autoSelectHighest
                ? 24
                : undefined,
            }
            : undefined,
      };

      console.log('Calling onSubmit with data:', enhancedFormData);
      await onSubmit(enhancedFormData);
      console.log('onSubmit completed successfully');

      // Clear persisted form data on successful submission
      if (booking) {
        const formDataKey = `swap-form-${booking.id}`;
        try {
          sessionStorage.removeItem(formDataKey);
        } catch (error) {
          console.warn('Failed to clear persisted form data:', error);
        }
      }

      onClose();
    } catch (error) {
      console.error('Swap creation failed:', error);

      // Provide user-friendly error messages based on error type
      let errorMessage = 'Failed to create swap';

      if (error instanceof Error) {
        if (error.message.includes('503') || error.message.includes('Service Unavailable')) {
          errorMessage = 'The service is temporarily unavailable. Please try again in a few moments.';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          errorMessage = 'There was a server error. Please try again later.';
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
          errorMessage = 'The requested resource was not found. Please refresh the page and try again.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage = 'You are not authorized to perform this action. Please log in again.';
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMessage = 'You do not have permission to create this swap.';
        } else if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      setSubmitError(new Error(errorMessage));
    }
  };

  const updatePaymentTypes = (
    field: keyof PaymentTypePreference,
    value: any
  ) => {
    setFormData(prev => ({
      ...prev,
      paymentTypes: {
        ...prev.paymentTypes,
        [field]: value,
        // Clear cash amounts if cash payment is disabled
        ...(field === 'cashPayment' && !value
          ? {
            minimumCashAmount: undefined,
            preferredCashAmount: undefined,
          }
          : {}),
      },
    }));
  };

  const updateAcceptanceStrategy = (
    field: keyof AcceptanceStrategy,
    value: any
  ) => {
    const newFormData = {
      ...formData,
      acceptanceStrategy: {
        ...formData.acceptanceStrategy,
        [field]: value,
        // Clear auction date if switching to first_match
        ...(field === 'type' && value === 'first_match'
          ? {
            auctionEndDate: undefined,
            autoSelectHighest: false,
          }
          : {}),
      },
    };

    setFormData(newFormData);

    // Update auction timing validation if changing auction end date
    if (field === 'auctionEndDate' && value) {
      auctionTiming.setAuctionEndDate(new Date(value));
    }
  };

  const addPreferredLocation = () => {
    if (
      preferredLocationInput.trim() &&
      !formData.swapPreferences.preferredLocations?.includes(
        preferredLocationInput.trim()
      )
    ) {
      setFormData(prev => ({
        ...prev,
        swapPreferences: {
          ...prev.swapPreferences,
          preferredLocations: [
            ...(prev.swapPreferences.preferredLocations || []),
            preferredLocationInput.trim(),
          ],
        },
      }));
      setPreferredLocationInput('');
    }
  };

  const removePreferredLocation = (location: string) => {
    setFormData(prev => ({
      ...prev,
      swapPreferences: {
        ...prev.swapPreferences,
        preferredLocations:
          prev.swapPreferences.preferredLocations?.filter(
            l => l !== location
          ) || [],
      },
    }));
  };

  console.log('🟡 EnhancedSwapCreationModal render - isOpen:', isOpen, 'booking:', booking?.id);
  if (!booking) {
    console.log('🔴 EnhancedSwapCreationModal: booking is null, returning null');
    return null;
  }

  const formStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[4],
  };

  const sectionStyles = {
    marginBottom: tokens.spacing[4],
  };

  const labelStyles = {
    display: 'block',
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
    marginBottom: tokens.spacing[2],
  };

  const checkboxStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
  };

  const tagStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
    backgroundColor: tokens.colors.primary[100],
    color: tokens.colors.primary[800],
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.sm,
  };

  const warningStyles = {
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.warning[50],
    border: `1px solid ${tokens.colors.warning[200]}`,
    borderRadius: tokens.borderRadius.md,
    color: tokens.colors.warning[800],
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing[4],
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Swap Proposal"
      size="lg"
    >
      <form onSubmit={handleSubmit} style={formStyles}>
        {/* Booking Summary */}
        <div
          style={{
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.neutral[50],
            borderRadius: tokens.borderRadius.md,
            marginBottom: tokens.spacing[4],
          }}
        >
          <h3
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              marginBottom: tokens.spacing[2],
            }}
          >
            Your Booking to Swap
          </h3>
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
            }}
          >
            <div>
              <strong>{booking.title}</strong>
            </div>
            <div>
              📍 {booking.location.city}, {booking.location.country}
            </div>
            <div>
              📅 {new Date(booking.dateRange.checkIn).toLocaleDateString()} -{' '}
              {new Date(booking.dateRange.checkOut).toLocaleDateString()}
            </div>
            <div>💰 ${booking.swapValue.toLocaleString()}</div>
          </div>
        </div>

        {/* Last-minute booking warning */}
        {isLastMinuteBooking && (
          <div style={warningStyles}>
            <strong>⚠️ Last-Minute Booking Notice:</strong> Since your event is
            less than one week away, auction mode is not available. Your swap
            will use first-match acceptance to ensure quick processing.
          </div>
        )}

        {/* Wallet Connection Status */}
        <WalletConnectionStatus
          isConnected={isConnected}
          walletAddress={walletAddress}
          isValidating={isValidatingWallet || isConnecting}
          isRecovering={false}
        />


        {/* General Error Display */}
        {submitError && (
          <ErrorDisplay
            error={submitError}
            onAction={action => {
              if (action === 'retry') {
                setSubmitError(null);
              }
            }}
            onDismiss={() => setSubmitError(null)}
          />
        )}

        {/* Validation Summary */}
        <ValidationSummary
          errors={Object.fromEntries(
            Object.entries(realTimeValidation)
              .filter(([_, validation]) => !validation.isValid)
              .map(([field, validation]) => [field, validation.errors])
          )}
          warnings={Object.fromEntries(
            Object.entries(realTimeValidation)
              .filter(([_, validation]) => validation.warnings.length > 0)
              .map(([field, validation]) => [field, validation.warnings])
          )}
        />

        {/* Swap Title */}
        <div>
          <Input
            label="Swap Title"
            value={formData.title}
            onChange={e =>
              setFormData(prev => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g., Swap: Paris Hotel for London Experience"
            required
          />
          <RealTimeValidation
            fieldName="title"
            value={formData.title}
            validation={realTimeValidation.title}
            touched={formData.title.length > 0}
          />
        </div>

        {/* Description */}
        <div style={sectionStyles}>
          <label style={labelStyles}>Description *</label>
          <textarea
            value={formData.description}
            onChange={e =>
              setFormData(prev => ({ ...prev, description: e.target.value }))
            }
            placeholder="Describe what you're looking for in a swap. Be specific about your preferences..."
            style={{
              width: '100%',
              minHeight: '100px',
              padding: tokens.spacing[3],
              border: `1px solid ${realTimeValidation.description?.isValid === false ? tokens.colors.error[400] : tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.base,
              resize: 'vertical' as const,
            }}
            required
          />
          <RealTimeValidation
            fieldName="description"
            value={formData.description}
            validation={realTimeValidation.description}
            touched={formData.description.length > 0}
          />
        </div>

        {/* Payment Type Selection */}
        <div style={sectionStyles}>
          <label style={labelStyles}>Payment Types Accepted *</label>
          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.neutral[50],
              borderRadius: tokens.borderRadius.md,
              border: `1px solid ${realTimeValidation.paymentTypes?.isValid === false ? tokens.colors.error[400] : tokens.colors.neutral[200]}`,
            }}
          >
            <div style={{ marginBottom: tokens.spacing[3] }}>
              <label style={checkboxStyles}>
                <input
                  type="radio"
                  name="paymentTypes"
                  checked={
                    formData.paymentTypes.bookingExchange &&
                    !formData.paymentTypes.cashPayment
                  }
                  onChange={() => {
                    updatePaymentTypes('bookingExchange', true);
                    updatePaymentTypes('cashPayment', false);
                  }}
                />
                <span>Booking Exchange Only</span>
              </label>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.neutral[600],
                  marginLeft: tokens.spacing[6],
                  marginTop: tokens.spacing[1],
                }}
              >
                Accept other users' bookings in exchange for yours
              </div>
            </div>

            {FEATURE_FLAGS.ENABLE_CASH_SWAPS && (
              <div>
                <label style={checkboxStyles}>
                  <input
                    type="radio"
                    name="paymentTypes"
                    checked={
                      formData.paymentTypes.bookingExchange &&
                      formData.paymentTypes.cashPayment
                    }
                    onChange={() => {
                      updatePaymentTypes('bookingExchange', true);
                      updatePaymentTypes('cashPayment', true);
                    }}
                  />
                  <span>Booking Exchange and Cash</span>
                </label>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.neutral[600],
                    marginLeft: tokens.spacing[6],
                    marginTop: tokens.spacing[1],
                  }}
                >
                  Accept both booking exchanges and cash offers
                </div>
              </div>
            )}

            {/* Cash Payment Settings */}
            {FEATURE_FLAGS.ENABLE_CASH_SWAPS &&
              formData.paymentTypes.bookingExchange &&
              formData.paymentTypes.cashPayment && (
                <div
                  style={{
                    marginTop: tokens.spacing[4],
                    padding: tokens.spacing[3],
                    backgroundColor: 'white',
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: tokens.spacing[3],
                    }}
                  >
                    <Input
                      label="Minimum Cash Amount ($) *"
                      type="number"
                      min="1"
                      step="0.01"
                      value={formData.paymentTypes.minimumCashAmount || ''}
                      onChange={e =>
                        updatePaymentTypes(
                          'minimumCashAmount',
                          parseFloat(e.target.value) || undefined
                        )
                      }
                      placeholder="100.00"
                      helperText="Lowest cash offer you'll accept"
                    />

                    <Input
                      label="Preferred Cash Amount ($)"
                      type="number"
                      min="1"
                      step="0.01"
                      value={formData.paymentTypes.preferredCashAmount || ''}
                      onChange={e =>
                        updatePaymentTypes(
                          'preferredCashAmount',
                          parseFloat(e.target.value) || undefined
                        )
                      }
                      placeholder="150.00"
                      helperText="Your ideal cash offer amount"
                    />
                  </div>
                </div>
              )}
          </div>
          <ValidationFeedback
            isValid={realTimeValidation.paymentTypes?.isValid}
            errors={realTimeValidation.paymentTypes?.errors}
            warnings={realTimeValidation.paymentTypes?.warnings}
          />
        </div>

        {/* Acceptance Strategy Selection */}
        <div style={sectionStyles}>
          <label style={labelStyles}>Deal Acceptance Strategy *</label>
          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.neutral[50],
              borderRadius: tokens.borderRadius.md,
              border: `1px solid ${realTimeValidation.auctionTiming?.isValid === false ? tokens.colors.error[400] : tokens.colors.neutral[200]}`,
            }}
          >
            <div style={{ marginBottom: tokens.spacing[3] }}>
              <label style={checkboxStyles}>
                <input
                  type="radio"
                  name="acceptanceStrategy"
                  checked={formData.acceptanceStrategy.type === 'first_match'}
                  onChange={() =>
                    updateAcceptanceStrategy('type', 'first_match')
                  }
                />
                <span>First Match Acceptance</span>
              </label>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.neutral[600],
                  marginLeft: tokens.spacing[6],
                  marginTop: tokens.spacing[1],
                }}
              >
                Automatically accept the first proposal that meets your criteria
              </div>
            </div>

            {FEATURE_FLAGS.ENABLE_AUCTION_MODE && (
              <div>
                <label style={checkboxStyles}>
                  <input
                    type="radio"
                    name="acceptanceStrategy"
                    checked={formData.acceptanceStrategy.type === 'auction'}
                    onChange={() => updateAcceptanceStrategy('type', 'auction')}
                    disabled={isLastMinuteBooking}
                  />
                  <span>
                    Auction Mode {isLastMinuteBooking && '(Not Available)'}
                  </span>
                </label>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: isLastMinuteBooking
                      ? tokens.colors.neutral[400]
                      : tokens.colors.neutral[600],
                    marginLeft: tokens.spacing[6],
                    marginTop: tokens.spacing[1],
                  }}
                >
                  {isLastMinuteBooking
                    ? 'Not available for events less than one week away'
                    : 'Collect multiple proposals and choose the best one'}
                </div>
              </div>
            )}

            {/* Auction Settings */}
            {FEATURE_FLAGS.ENABLE_AUCTION_MODE &&
              formData.acceptanceStrategy.type === 'auction' &&
              !isLastMinuteBooking && (
                <div
                  style={{
                    marginTop: tokens.spacing[4],
                    padding: tokens.spacing[3],
                    backgroundColor: 'white',
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                  }}
                >
                  <div style={{ marginBottom: tokens.spacing[3] }}>
                    <div>
                      <Input
                        label="Auction End Date *"
                        type="datetime-local"
                        value={
                          formData.acceptanceStrategy.auctionEndDate
                            ? (() => {
                              try {
                                const date = new Date(formData.acceptanceStrategy.auctionEndDate);
                                // Check if date is valid before calling toISOString
                                if (isNaN(date.getTime())) {
                                  return '';
                                }
                                return date.toISOString().slice(0, 16);
                              } catch (error) {
                                console.warn('Invalid auction end date:', error);
                                return '';
                              }
                            })()
                            : ''
                        }
                        onChange={e =>
                          updateAcceptanceStrategy(
                            'auctionEndDate',
                            new Date(e.target.value)
                          )
                        }
                        helperText={
                          booking
                            ? `Must be at least one week before event date (${new Date(booking.dateRange.checkIn).toLocaleDateString()})`
                            : 'Must be at least one week before event date'
                        }
                      />
                      <ValidationFeedback
                        isValid={auctionTiming.validation.isValid}
                        errors={auctionTiming.validation.errors}
                        warnings={auctionTiming.validation.warnings}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={checkboxStyles}>
                      <input
                        type="checkbox"
                        checked={
                          formData.acceptanceStrategy.autoSelectHighest || false
                        }
                        onChange={e =>
                          updateAcceptanceStrategy(
                            'autoSelectHighest',
                            e.target.checked
                          )
                        }
                      />
                      <span>
                        Auto-select highest offer if I don't respond within 24
                        hours
                      </span>
                    </label>
                  </div>
                </div>
              )}
          </div>
          <ValidationFeedback
            isValid={realTimeValidation.auctionTiming?.isValid}
            errors={realTimeValidation.auctionTiming?.errors}
            warnings={realTimeValidation.auctionTiming?.warnings}
          />
        </div>

        {/* Preferred Locations */}
        <div style={sectionStyles}>
          <label style={labelStyles}>Preferred Locations</label>
          <div
            style={{
              display: 'flex',
              gap: tokens.spacing[2],
              marginBottom: tokens.spacing[2],
            }}
          >
            <Input
              value={preferredLocationInput}
              onChange={e => setPreferredLocationInput(e.target.value)}
              placeholder="e.g., London, UK"
              onKeyPress={e =>
                e.key === 'Enter' &&
                (e.preventDefault(), addPreferredLocation())
              }
            />
            <Button
              type="button"
              variant="outline"
              onClick={addPreferredLocation}
            >
              Add
            </Button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: tokens.spacing[2],
              flexWrap: 'wrap',
            }}
          >
            {formData.swapPreferences.preferredLocations?.map(location => (
              <span key={location} style={tagStyles}>
                {location}
                <button
                  type="button"
                  onClick={() => removePreferredLocation(location)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: tokens.colors.primary[600],
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Expiration Date */}
        <div>
          <Input
            label="Expires On"
            type="date"
            value={(() => {
              try {
                // Check if expirationDate is a valid date
                if (!formData.expirationDate || isNaN(new Date(formData.expirationDate).getTime())) {
                  return '';
                }
                return new Date(formData.expirationDate).toISOString().split('T')[0];
              } catch (error) {
                console.warn('Invalid expiration date:', error);
                return '';
              }
            })()}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                expirationDate: new Date(e.target.value),
              }))
            }
            required
          />
          <RealTimeValidation
            fieldName="expirationDate"
            value={formData.expirationDate}
            validation={realTimeValidation.expirationDate}
            touched={true}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: tokens.spacing[3],
            justifyContent: 'flex-end',
            marginTop: tokens.spacing[4],
            paddingTop: tokens.spacing[4],
            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
          }}
        >
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading || isValidatingWallet || isConnecting}
            disabled={loading || isValidatingWallet || isConnecting || !isConnected}
          >
            {isValidatingWallet ? 'Validating Wallet...' : isConnecting ? 'Connecting Wallet...' : 'Create Swap'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
