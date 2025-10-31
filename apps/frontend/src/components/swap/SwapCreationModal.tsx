import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { WalletConnectButton } from '@/components/wallet';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { tokens } from '@/design-system/tokens';
import { Booking } from '@booking-swap/shared';
import { FEATURE_FLAGS } from '@/config/featureFlags';
// Temporary local types until shared package import is resolved
interface PaymentTypePreference {
  bookingExchange: boolean;
  cashPayment: boolean;
  minimumCashAmount?: number;
  preferredCashAmount?: number;
}

interface AcceptanceStrategy {
  type: 'first_match' | 'auction';
  auctionEndDate?: Date;
  autoSelectHighest?: boolean;
}

interface EnhancedCreateSwapRequest {
  sourceBookingId: string;
  title: string;
  description: string;
  paymentTypes: PaymentTypePreference;
  acceptanceStrategy: AcceptanceStrategy;
  auctionSettings?: {
    endDate: Date;
    allowBookingProposals: boolean;
    allowCashProposals: boolean;
    minimumCashOffer?: number;
    autoSelectAfterHours?: number;
  };
  swapPreferences: {
    preferredLocations?: string[];
    preferredDates?: Date[];
    additionalRequirements?: string[];
  };
  expirationDate: Date;
}

// Keep the old interface for backward compatibility
export interface SwapCreationRequest {
  sourceBookingId: string;
  title: string;
  description: string;
  swapPreferences: {
    preferredLocations: string[];
    preferredTypes: string[];
    flexibleDates: boolean;
    maxPriceDifference: number;
  };
  expirationDate: Date;
  autoAccept: boolean;
}

// Use the enhanced interface internally
export type { EnhancedCreateSwapRequest };

interface SwapCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onSubmit: (data: EnhancedCreateSwapRequest) => Promise<void>;
  loading?: boolean;
}

export const SwapCreationModal: React.FC<SwapCreationModalProps> = ({
  isOpen,
  onClose,
  booking,
  onSubmit,
  loading = false,
}) => {
  const { isConnected } = useWallet();
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(false);

  // Auto-submit when wallet gets connected
  React.useEffect(() => {
    if (isConnected && pendingSubmission && showWalletPrompt) {
      setShowWalletPrompt(false);
      setPendingSubmission(false);
      // Retry the submission
      handleActualSubmit();
    }
  }, [isConnected, pendingSubmission, showWalletPrompt]);
  const { } = useAuth();
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
      additionalRequirements: [],
    },
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preferredLocationInput, setPreferredLocationInput] = useState('');

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
    setFormData(prev => ({
      ...prev,
      acceptanceStrategy: {
        ...prev.acceptanceStrategy,
        [field]: value,
        // Clear auction date if switching to first_match
        ...(field === 'type' && value === 'first_match'
          ? {
            auctionEndDate: undefined,
            autoSelectHighest: false,
          }
          : {}),
      },
    }));
  };

  const [isLastMinuteBooking, setIsLastMinuteBooking] = useState(false);

  // Initialize form data when booking changes
  React.useEffect(() => {
    if (booking && isOpen) {
      const eventDate = new Date(booking.dateRange.checkIn);
      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const isLastMinute = eventDate <= oneWeekFromNow;

      setIsLastMinuteBooking(isLastMinute);

      setFormData(prev => ({
        ...prev,
        sourceBookingId: booking.id,
        title: `Swap: ${booking.title}`,
        description: `Looking to swap my ${booking.type} booking in ${booking.location?.city || 'Unknown'}. Original booking: ${booking.title}`,
        // Force first_match for last-minute bookings
        acceptanceStrategy: isLastMinute
          ? {
            type: 'first_match',
            auctionEndDate: undefined,
            autoSelectHighest: false,
          }
          : prev.acceptanceStrategy,
      }));
    }
  }, [booking, isOpen]);

  // Enforce default values when features are disabled
  React.useEffect(() => {
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
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Swap title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    if (formData.expirationDate <= new Date()) {
      newErrors.expirationDate = 'Expiration date must be in the future';
    }

    // Validate payment types
    if (
      !formData.paymentTypes.bookingExchange &&
      !formData.paymentTypes.cashPayment
    ) {
      newErrors.paymentTypes = 'At least one payment type must be selected';
    }

    // Validate cash payment settings - only if cash swaps are enabled
    if (FEATURE_FLAGS.ENABLE_CASH_SWAPS && formData.paymentTypes.cashPayment) {
      if (
        !formData.paymentTypes.minimumCashAmount ||
        formData.paymentTypes.minimumCashAmount < 1
      ) {
        newErrors.minimumCashAmount =
          'Minimum cash amount is required and must be at least $1';
      }

      if (
        formData.paymentTypes.preferredCashAmount &&
        formData.paymentTypes.minimumCashAmount &&
        formData.paymentTypes.preferredCashAmount <
        formData.paymentTypes.minimumCashAmount
      ) {
        newErrors.preferredCashAmount =
          'Preferred amount must be greater than or equal to minimum amount';
      }
    }

    // Validate auction settings - only if auction mode is enabled
    if (FEATURE_FLAGS.ENABLE_AUCTION_MODE && formData.acceptanceStrategy.type === 'auction') {
      if (!formData.acceptanceStrategy.auctionEndDate) {
        newErrors.auctionEndDate = 'Auction end date is required';
      } else if (booking) {
        const eventDate = new Date(booking.dateRange.checkIn);
        const oneWeekBeforeEvent = new Date(
          eventDate.getTime() - 7 * 24 * 60 * 60 * 1000
        );

        if (formData.acceptanceStrategy.auctionEndDate > oneWeekBeforeEvent) {
          newErrors.auctionEndDate =
            'Auction must end at least one week before the event date';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check if wallet is connected
    if (!isConnected) {
      setPendingSubmission(true);
      setShowWalletPrompt(true);
      return;
    }

    await handleActualSubmit();
  };

  const handleActualSubmit = async () => {
    try {
      // Prepare auction settings if auction mode is selected
      const enhancedFormData: EnhancedCreateSwapRequest = {
        ...formData,
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

      await onSubmit(enhancedFormData);
      onClose();
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error ? error.message : 'Failed to create swap',
      });
    }
  };

  const addPreferredLocation = () => {
    if (
      preferredLocationInput.trim() &&
      !(formData.swapPreferences.preferredLocations || []).includes(
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
        preferredLocations: (prev.swapPreferences.preferredLocations || []).filter(
          l => l !== location
        ),
      },
    }));
  };

  if (!booking) return null;

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
          <div
            style={{
              padding: tokens.spacing[3],
              backgroundColor: tokens.colors.warning[50],
              border: `1px solid ${tokens.colors.warning[200]}`,
              borderRadius: tokens.borderRadius.md,
              color: tokens.colors.warning[800],
              fontSize: tokens.typography.fontSize.sm,
              marginBottom: tokens.spacing[4],
            }}
          >
            <strong>⚠️ Last-Minute Booking Notice:</strong> Since your event is
            less than one week away, auction mode is not available. Your swap
            will use first-match acceptance to ensure quick processing.
          </div>
        )}

        {/* Error Display */}
        {errors.submit && (
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
            {errors.submit}
          </div>
        )}

        {/* Swap Title */}
        <Input
          label="Swap Title"
          value={formData.title}
          onChange={e =>
            setFormData(prev => ({ ...prev, title: e.target.value }))
          }
          error={errors.title}
          placeholder="e.g., Swap: Paris Hotel for London Experience"
          required
        />

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
              border: `1px solid ${errors.description ? tokens.colors.error[400] : tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.base,
              resize: 'vertical' as const,
            }}
            required
          />
          {errors.description && (
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[600],
                marginTop: tokens.spacing[1],
              }}
            >
              {errors.description}
            </div>
          )}
        </div>

        {/* Payment Type Selection */}
        <div style={sectionStyles}>
          <label style={labelStyles}>Payment Types Accepted *</label>
          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.neutral[50],
              borderRadius: tokens.borderRadius.md,
              border: `1px solid ${tokens.colors.neutral[200]}`,
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
        </div>

        {/* Acceptance Strategy Selection */}
        <div style={sectionStyles}>
          <label style={labelStyles}>Deal Acceptance Strategy *</label>
          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.neutral[50],
              borderRadius: tokens.borderRadius.md,
              border: `1px solid ${tokens.colors.neutral[200]}`,
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

            {!isLastMinuteBooking && FEATURE_FLAGS.ENABLE_AUCTION_MODE && (
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
                    <Input
                      label="Auction End Date *"
                      type="datetime-local"
                      value={
                        formData.acceptanceStrategy.auctionEndDate
                          ? new Date(formData.acceptanceStrategy.auctionEndDate)
                            .toISOString()
                            .slice(0, 16)
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
            {(formData.swapPreferences.preferredLocations || []).map(location => (
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
            value={formData.expirationDate.toISOString().split('T')[0]}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                expirationDate: new Date(e.target.value),
              }))
            }
            error={errors.expirationDate}
            required
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
          <Button type="submit" variant="primary" loading={loading}>
            Create Swap
          </Button>
        </div>
      </form>

      {/* Wallet Connection Prompt */}
      {showWalletPrompt && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: tokens.borderRadius.lg,
            padding: tokens.spacing[6],
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: tokens.spacing[4],
            }}>
              🔗
            </div>

            <h3 style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.bold,
              color: tokens.colors.neutral[900],
              marginBottom: tokens.spacing[4],
            }}>
              Wallet Connection Required
            </h3>

            <p style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[600],
              lineHeight: tokens.typography.lineHeight.relaxed,
              marginBottom: tokens.spacing[6],
            }}>
              Connect your Hedera wallet to create this swap proposal on the blockchain.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacing[3],
            }}>
              <WalletConnectButton
                variant="primary"
                size="lg"
                showBalance={false}
                style={{ width: '100%' }}
              />

              <Button
                variant="outline"
                size="md"
                onClick={() => setShowWalletPrompt(false)}
                style={{ width: '100%' }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
