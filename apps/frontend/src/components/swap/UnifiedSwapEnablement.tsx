import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { SwapPreferencesSection } from '@/components/booking/SwapPreferencesSection';
import { useWallet } from '@/hooks/useWallet';
import { useBookingWithWallet } from '@/hooks/useBookingWithWallet';
import { validateSwapPreferences, getValidationErrorCount } from '@/utils/validation';
import {
  Booking,
  SwapPreferencesData,
  UnifiedFormValidationErrors,
} from '@booking-swap/shared';

export interface UnifiedSwapEnablementProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to call when modal should be closed */
  onClose: () => void;
  /** Function to call when swap is successfully enabled */
  onSuccess: (swapPreferences?: SwapPreferencesData) => void;
  /** The booking to enable swapping for */
  booking: Booking;
  /** Whether this is being called from create/edit booking form (integrated mode) */
  integrated?: boolean;
  /** Whether this is being called from bookings listing */
  fromListing?: boolean;
  /** Initial swap preferences if editing existing swap */
  initialPreferences?: SwapPreferencesData;
  /** Loading state */
  loading?: boolean;
}

/**
 * Unified component for enabling swapping across all three use cases:
 * 1. Create booking form (integrated mode)
 * 2. Edit booking form (integrated mode) 
 * 3. Bookings listing enable button (modal mode)
 * 
 * This component provides a consistent interface and experience regardless
 * of where it's called from, ensuring users always get the same swap
 * configuration options and validation.
 */
export const UnifiedSwapEnablement: React.FC<UnifiedSwapEnablementProps> = ({
  isOpen,
  onClose,
  onSuccess,
  booking,
  integrated = false,
  fromListing = false,
  initialPreferences,
  loading = false,
}) => {
  const { isConnected } = useWallet();
  const { enableSwappingWithWallet, canEnableSwapping } = useBookingWithWallet();
  
  // State management
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const [swapEnabled, setSwapEnabled] = useState(!!initialPreferences);
  const [preferences, setPreferences] = useState<SwapPreferencesData>(
    initialPreferences || {
      paymentTypes: ['booking'],
      acceptanceStrategy: 'first-match',
      swapConditions: [],
    }
  );
  const [validationErrors, setValidationErrors] = useState<UnifiedFormValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSwapEnabled(!!initialPreferences);
      setPreferences(
        initialPreferences || {
          paymentTypes: ['booking'],
          acceptanceStrategy: 'first-match',
          swapConditions: [],
        }
      );
      setValidationErrors({});
      setShowWalletPrompt(false);
      setPendingSubmission(false);
      setIsSubmitting(false);
    }
  }, [isOpen, initialPreferences]);

  // Auto-submit when wallet gets connected
  useEffect(() => {
    if (isConnected && pendingSubmission && showWalletPrompt) {
      setShowWalletPrompt(false);
      setPendingSubmission(false);
      handleEnableSwap();
    }
  }, [isConnected, pendingSubmission, showWalletPrompt]);

  // Auto-enable swap when wallet gets connected (for integrated mode)
  useEffect(() => {
    if (isConnected && !pendingSubmission && showWalletPrompt && integrated) {
      setShowWalletPrompt(false);
      setSwapEnabled(true);
    }
  }, [isConnected, pendingSubmission, showWalletPrompt, integrated]);

  const handleSwapToggle = (enabled: boolean) => {
    // Prevent enabling swap if wallet is not connected (except in integrated mode)
    if (enabled && !isConnected && !integrated) {
      setShowWalletPrompt(true);
      return;
    }

    setSwapEnabled(enabled);
    
    if (enabled && !preferences) {
      setPreferences({
        paymentTypes: ['booking'],
        acceptanceStrategy: 'first-match',
        swapConditions: [],
      });
    }

    // Clear swap-related errors when disabling
    if (!enabled) {
      const newErrors = { ...validationErrors };
      delete newErrors.paymentTypes;
      delete newErrors.minCashAmount;
      delete newErrors.maxCashAmount;
      delete newErrors.acceptanceStrategy;
      delete newErrors.auctionEndDate;
      delete newErrors.swapConditions;
      setValidationErrors(newErrors);
    }
  };

  const handlePreferencesChange = (newPreferences: SwapPreferencesData) => {
    setPreferences(newPreferences);
    
    // Real-time validation for swap preferences
    if (swapEnabled) {
      const swapErrors = validateSwapPreferences(newPreferences, new Date(booking.dateRange.checkIn));
      setValidationErrors(prev => ({ ...prev, ...swapErrors }));
    }
  };

  const handleEnableSwap = async () => {
    setIsSubmitting(true);
    
    try {
      // Validate swap preferences if enabled
      if (swapEnabled && preferences) {
        const swapErrors = validateSwapPreferences(preferences, new Date(booking.dateRange.checkIn));
        if (Object.keys(swapErrors).length > 0) {
          setValidationErrors(swapErrors);
          setIsSubmitting(false);
          return;
        }
      }

      // Enable swapping with wallet if not in integrated mode
      if (!integrated && swapEnabled) {
        await enableSwappingWithWallet(booking.id);
      }

      // Call success callback
      onSuccess(swapEnabled ? preferences : undefined);
      
      // Close modal if not in integrated mode
      if (!integrated) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to enable swapping:', error);
      setValidationErrors({
        general: error instanceof Error ? error.message : 'Failed to enable swapping. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    // Check if wallet is required and connected when swap is enabled
    if (swapEnabled && !isConnected && !integrated) {
      setPendingSubmission(true);
      setShowWalletPrompt(true);
      return;
    }

    await handleEnableSwap();
  };

  const canEnable = canEnableSwapping(booking);
  const errorCount = getValidationErrorCount(validationErrors);
  const eventDate = new Date(booking.dateRange.checkIn);

  // For integrated mode, just render the swap preferences section
  if (integrated) {
    return (
      <>
        {/* Wallet Connection Prompt Modal for integrated mode */}
        {showWalletPrompt && (
          <Modal
            isOpen={showWalletPrompt}
            onClose={() => {
              setShowWalletPrompt(false);
              setPendingSubmission(false);
            }}
            title="Wallet Connection Required"
            size="sm"
          >
            <div style={{ padding: tokens.spacing[4] }}>
              <div style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.warning[50],
                border: `1px solid ${tokens.colors.warning[200]}`,
                borderRadius: tokens.borderRadius.md,
                marginBottom: tokens.spacing[4],
              }}>
                <div style={{
                  fontSize: tokens.typography.fontSize.lg,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.warning[800],
                  marginBottom: tokens.spacing[2],
                }}>
                  🔐 Wallet Required for Swapping
                </div>
                <p style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.warning[700],
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  To enable swapping for your booking, you need to connect your Hedera wallet. 
                  This allows NFT minting and secure swap transactions on the blockchain.
                </p>
              </div>

              <div style={{
                display: 'flex',
                gap: tokens.spacing[3],
                justifyContent: 'flex-end',
              }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowWalletPrompt(false);
                    setPendingSubmission(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    alert('Please connect your wallet using the wallet button in the header. After connecting, the swap option will be automatically enabled.');
                  }}
                >
                  Got It - I'll Connect My Wallet
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Integrated swap preferences section */}
        <SwapPreferencesSection
          enabled={swapEnabled}
          onToggle={handleSwapToggle}
          preferences={preferences}
          onChange={handlePreferencesChange}
          errors={validationErrors}
          eventDate={eventDate}
        />
      </>
    );
  }

  // For modal mode (from listings), render the full modal
  return (
    <>
      {/* Wallet Connection Prompt Modal */}
      {showWalletPrompt && (
        <Modal
          isOpen={showWalletPrompt}
          onClose={() => {
            setShowWalletPrompt(false);
            setPendingSubmission(false);
          }}
          title="Wallet Connection Required"
          size="sm"
        >
          <div style={{ padding: tokens.spacing[4] }}>
            <div style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.warning[50],
              border: `1px solid ${tokens.colors.warning[200]}`,
              borderRadius: tokens.borderRadius.md,
              marginBottom: tokens.spacing[4],
            }}>
              <div style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.warning[800],
                marginBottom: tokens.spacing[2],
              }}>
                🔐 Wallet Required for Swapping
              </div>
              <p style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.warning[700],
                margin: 0,
                lineHeight: 1.5,
              }}>
                To enable swapping for your booking, you need to connect your Hedera wallet. 
                This allows NFT minting and secure swap transactions on the blockchain.
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: tokens.spacing[3],
              justifyContent: 'flex-end',
            }}>
              <Button
                variant="outline"
                onClick={() => {
                  setShowWalletPrompt(false);
                  setPendingSubmission(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  alert('Please connect your wallet using the wallet button in the header. After connecting, you can enable swapping.');
                }}
              >
                Got It - I'll Connect My Wallet
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Main Swap Enablement Modal */}
      <Modal
        isOpen={isOpen && !showWalletPrompt}
        onClose={onClose}
        title={`Enable Swapping for "${booking.title}"`}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '80vh', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', paddingRight: tokens.spacing[2] }}>
            {/* Booking Summary */}
            <div style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.primary[50],
              border: `1px solid ${tokens.colors.primary[200]}`,
              borderRadius: tokens.borderRadius.md,
              marginBottom: tokens.spacing[6],
            }}>
              <h3 style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.primary[900],
                margin: `0 0 ${tokens.spacing[2]} 0`,
              }}>
                📋 Booking Details
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: tokens.spacing[3],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[800],
              }}>
                <div>
                  <strong>Location:</strong> {booking.location.city}, {booking.location.country}
                </div>
                <div>
                  <strong>Dates:</strong> {new Date(booking.dateRange.checkIn).toLocaleDateString()} - {new Date(booking.dateRange.checkOut).toLocaleDateString()}
                </div>
                <div>
                  <strong>Type:</strong> {booking.type}
                </div>
                <div>
                  <strong>Value:</strong> ${booking.swapValue || booking.originalPrice}
                </div>
              </div>
            </div>

            {/* Helper Text */}
            <div style={{
              padding: tokens.spacing[3],
              backgroundColor: tokens.colors.neutral[50],
              border: `1px solid ${tokens.colors.neutral[200]}`,
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[6],
            }}>
              💡 Enable swapping to allow other users to propose exchanges for this booking. 
              Configure your preferences below to control how proposals are handled.
            </div>

            {/* Validation Summary */}
            {errorCount > 0 && (
              <div style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.error[50],
                border: `1px solid ${tokens.colors.error[200]}`,
                borderRadius: tokens.borderRadius.md,
                marginBottom: tokens.spacing[6],
              }}>
                <div style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.error[800],
                  marginBottom: tokens.spacing[2],
                }}>
                  ⚠️ Please fix {errorCount} error{errorCount > 1 ? 's' : ''}:
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: tokens.spacing[4],
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.error[700],
                }}>
                  {Object.entries(validationErrors).map(([field, error]) =>
                    error && (
                      <li key={field} style={{ marginBottom: tokens.spacing[1] }}>
                        {error}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {/* Swap Preferences Section */}
            <SwapPreferencesSection
              enabled={swapEnabled}
              onToggle={handleSwapToggle}
              preferences={preferences}
              onChange={handlePreferencesChange}
              errors={validationErrors}
              eventDate={eventDate}
            />

            {/* Wallet Status */}
            <div style={{
              padding: tokens.spacing[4],
              backgroundColor: isConnected ? tokens.colors.success[50] : tokens.colors.warning[50],
              border: `1px solid ${isConnected ? tokens.colors.success[200] : tokens.colors.warning[200]}`,
              borderRadius: tokens.borderRadius.md,
              marginTop: tokens.spacing[6],
            }}>
              <div style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: isConnected ? tokens.colors.success[800] : tokens.colors.warning[800],
                marginBottom: tokens.spacing[2],
              }}>
                {isConnected ? '✅ Wallet Connected' : '⚠️ Wallet Not Connected'}
              </div>
              <p style={{
                fontSize: tokens.typography.fontSize.sm,
                color: isConnected ? tokens.colors.success[700] : tokens.colors.warning[700],
                margin: 0,
                lineHeight: 1.5,
              }}>
                {isConnected 
                  ? 'Your Hedera wallet is connected and ready for NFT minting and secure swap transactions.'
                  : 'Connect your Hedera wallet to enable swapping and mint NFTs for your bookings.'
                }
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: tokens.spacing[3],
            marginTop: tokens.spacing[6],
            paddingTop: tokens.spacing[4],
            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
          }}>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSubmit}
              loading={isSubmitting || loading}
              disabled={!canEnable && !isConnected}
            >
              {swapEnabled ? 'Enable Swapping & Configure Preferences' : 'Enable Basic Swapping'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

