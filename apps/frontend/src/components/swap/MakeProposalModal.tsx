import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { EligibleSwapSkeleton } from '../ui/SkeletonLoader';
import { LoadingSpinner } from '../ui/LoadingIndicator';
import { ErrorMessage, UserFriendlyError } from '../ui/ProposalErrorHandling';
import { ProposalErrorBoundary } from '../ui/ProposalErrorBoundary';
import { EnhancedErrorMessage, ErrorStatus } from '../ui/ErrorRecoveryComponents';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../hooks/useWallet';
import { useProposalModal } from '../../hooks/useProposalModal';
import { useAuthenticationGuard } from '../../hooks/useAuthenticationGuard';
import { useAriaLiveRegion } from '../../hooks/useAccessibility';
import { useAppDispatch } from '../../store/hooks';
import { addNotification } from '../../store/slices/notificationSlice';
import {
  MakeProposalModalProps,
  CreateProposalFromBrowseRequest,
  Notification
} from '@booking-swap/shared';
import { EligibleSwap, CreateProposalRequest } from '../../types/api';
import { ProposalCreationForm } from './ProposalCreationForm';
import { CashOfferForm } from './CashOfferForm';
import { walletService } from '../../services/walletService';
import { FEATURE_FLAGS } from '../../config/featureFlags';

export const MakeProposalModal: React.FC<MakeProposalModalProps> = ({
  isOpen,
  onClose,
  targetSwap,
  onSubmit,
  loading = false,
}) => {
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const {
    isConnected: isWalletConnected,
    address: walletAddress,
    walletAddress: walletAddressAlt,
    accountInfo
  } = useWallet();
  const { announce } = useAriaLiveRegion();

  // Debug wallet state
  console.log('🔍 MakeProposalModal - Wallet state:', {
    isWalletConnected,
    walletAddress,
    walletAddressAlt,
    accountInfo,
    accountId: accountInfo?.accountId,
    hasAddress: !!walletAddress,
    userWalletFromAuth: user?.walletAddress
  });
  const dispatch = useAppDispatch();
  const [showForm, setShowForm] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<EligibleSwap | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Authentication guard for additional protection
  const { requireAuthentication, isAuthError, isAuthorizationError } = useAuthenticationGuard({
    autoRedirect: false, // Don't auto-redirect since this is a modal
    preserveLocation: true,
  });

  // Use the proposal modal hook for API integration
  const {
    eligibleSwaps,
    loading: loadingSwaps,
    error,
    submitting,
    submitError,
    canRetry,
    errorThresholdReached,
    serviceHealthy,
    submitProposal,
    retry,
    manualRetry,
    clearError,
    clearSubmitError,
    reset,
    resetRetries,
    getCompatibilityScore,
    getCompatibilityAnalysis,
    isLoadingCompatibility,
    refreshCompatibilityScore,
    cancelRequests,
  } = useProposalModal({
    userId: user?.id || '',
    targetSwapId: targetSwap?.id || null,
    autoFetch: isOpen && !!user?.id,
  });

  // Debug logging for eligibleSwaps (can be removed in production)
  console.log('MakeProposalModal - eligibleSwaps:', eligibleSwaps);
  console.log('MakeProposalModal - eligibleSwaps length:', eligibleSwaps?.length);
  console.log('MakeProposalModal - loadingSwaps:', loadingSwaps);
  console.log('MakeProposalModal - error:', error);

  // Reset state and cancel requests when modal closes
  // Use a ref to track previous isOpen state to only trigger on actual close
  const prevIsOpenRef = useRef(isOpen);
  const resetFunctionsRef = useRef({ reset, cancelRequests });

  // Update refs when functions change (but don't trigger effect)
  useEffect(() => {
    resetFunctionsRef.current = { reset, cancelRequests };
  }, [reset, cancelRequests]);

  useEffect(() => {
    console.log('MakeProposalModal - Reset effect triggered:', {
      prevIsOpen: prevIsOpenRef.current,
      currentIsOpen: isOpen,
      willReset: prevIsOpenRef.current && !isOpen
    });

    // Only reset when modal actually closes (was open, now closed)
    if (prevIsOpenRef.current && !isOpen) {
      console.log('MakeProposalModal - RESETTING STATE (modal closed)');
      setShowForm(false);
      setSelectedSwap(null);
      // Cancel any in-flight requests before resetting state
      // Use refs to avoid dependency on function references
      resetFunctionsRef.current.cancelRequests();
      resetFunctionsRef.current.reset();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]); // Only depend on isOpen!

  // Cleanup on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cancel all in-flight requests when component unmounts
      cancelRequests();
    };
  }, [cancelRequests]);

  // Enhanced accessibility announcements for loading states
  useEffect(() => {
    if (loadingSwaps) {
      announce('Loading your eligible swaps. Please wait while we find compatible options.', 'polite');
    } else if (eligibleSwaps && eligibleSwaps.length > 0) {
      const swapText = eligibleSwaps.length === 1 ? 'swap' : 'swaps';
      announce(`Found ${eligibleSwaps.length} eligible ${swapText}. You can navigate through the options using Tab and Enter keys. Compatibility analysis is being performed.`, 'polite');
    } else if (!error && eligibleSwaps && eligibleSwaps.length === 0 && !loadingSwaps) {
      announce('No eligible swaps found. You may need to create more swaps or adjust your preferences. Press Escape to close this modal.', 'polite');
    }
  }, [loadingSwaps, eligibleSwaps?.length, error, announce]);

  // Enhanced error announcements with recovery guidance
  useEffect(() => {
    if (error) {
      let errorMessage = `Error loading swaps: ${error}`;
      if (canRetry) {
        errorMessage += ' You can retry by pressing the Retry button or using Alt+R.';
      }
      if (errorThresholdReached) {
        errorMessage += ' Service is temporarily unavailable. Please try again in a few minutes.';
      }
      announce(errorMessage, 'assertive');
    }
  }, [error, announce, canRetry, errorThresholdReached]);

  // Enhanced submission state announcements
  useEffect(() => {
    if (submitting) {
      announce('Submitting your proposal. Please wait, this may take a few seconds. Do not close the modal.', 'polite');
    }
  }, [submitting, announce]);

  useEffect(() => {
    if (submitError) {
      let errorMessage = `Proposal submission failed: ${submitError}`;
      if (isAuthError(submitError)) {
        errorMessage += ' Please log in again to continue.';
      } else if (isAuthorizationError(submitError)) {
        errorMessage += ' You do not have permission to perform this action.';
      } else {
        errorMessage += ' You can retry the submission or go back to modify your proposal.';
      }
      announce(errorMessage, 'assertive');
    }
  }, [submitError, announce, isAuthError, isAuthorizationError]);

  // Enhanced keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when modal is open and not submitting
      if (!isOpen || submitting) return;

      // Alt+R for retry when there's an error
      if (event.altKey && event.key.toLowerCase() === 'r' && (error || submitError)) {
        event.preventDefault();
        if (error && canRetry) {
          retry();
          announce('Retrying to load eligible swaps', 'polite');
        } else if (submitError && selectedSwap) {
          // Retry submission
          handleFormSubmit({
            message: '',
            conditions: [],
            agreedToTerms: true,
          });
          announce('Retrying proposal submission', 'polite');
        }
      }

      // Alt+B for back navigation when in form view
      if (event.altKey && event.key.toLowerCase() === 'b' && showForm) {
        event.preventDefault();
        handleBackToSelection();
        announce('Returned to swap selection', 'polite');
      }

      // Alt+C to clear errors
      if (event.altKey && event.key.toLowerCase() === 'c' && (error || submitError)) {
        event.preventDefault();
        if (error) clearError();
        if (submitError) clearSubmitError();
        announce('Errors cleared', 'polite');
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, submitting, error, submitError, canRetry, retry, showForm, selectedSwap, clearError, clearSubmitError, announce]);

  const handleSwapSelect = (swap: EligibleSwap) => {
    console.log('MakeProposalModal - handleSwapSelect called with:', swap);
    setSelectedSwap(swap);
    setShowForm(true);
    announce(`Selected ${swap.title} for your proposal. Now filling out proposal details.`, 'polite');
  };

  const handleBackToSelection = () => {
    setShowForm(false);
    setSelectedSwap(null);
    announce('Returned to swap selection. Choose a different swap or modify your selection.', 'polite');
  };

  const handleFormSubmit = async (formData: any) => {
    console.log('🔵 handleFormSubmit called with:', {
      formData,
      userId: user?.id,
      targetSwapId: targetSwap?.id,
      selectedSwap,
      hasAuthToken: !!localStorage.getItem('auth_token'),
      isWalletConnected,
    });

    if (!user?.id || !targetSwap?.id) {
      console.error('❌ Missing required data:', {
        hasUser: !!user?.id,
        hasTargetSwap: !!targetSwap?.id
      });
      return;
    }

    // WALLET CONNECTION VALIDATION
    console.log('🔍 Checking wallet connection:', { isWalletConnected });
    if (!isWalletConnected) {
      console.warn('❌ Wallet not connected! Blocking proposal submission.');
      announce('Wallet connection required to make proposals', 'assertive');
      alert('⚠️ Wallet Connection Required\n\nYou must connect a wallet before creating a proposal. This is required for blockchain transaction fees and escrow.');
      return;
    }

    console.log('✅ Wallet is connected, proceeding with proposal submission');

    // Check if this is a cash proposal (selectedSwap is null)
    const isCashProposal = !selectedSwap;

    // Prevent cash proposals when feature is disabled
    if (isCashProposal && !FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
      console.warn('❌ Cash proposals are disabled by feature flag');
      announce('Cash proposals are currently disabled', 'assertive');
      alert('⚠️ Cash proposals are currently not available. Please select a swap to exchange instead.');
      return;
    }

    console.log('MakeProposalModal - handleFormSubmit:', {
      isCashProposal,
      formData,
      selectedSwap,
      userId: user?.id,
      targetSwapId: targetSwap?.id
    });

    // WALLET BALANCE VALIDATION FOR CASH PROPOSALS
    if (isCashProposal && formData.cashAmount) {
      try {
        // Estimate required balance: transaction fee (0.1 HBAR) + escrow amount (cash offer amount)
        // Platform fee will be deducted from escrow, so we need to include it
        const estimatedTxFee = 0.1; // HBAR for blockchain transaction
        const platformFeePercent = 0.05; // 5% platform fee
        const escrowAmount = formData.cashAmount; // The cash amount to be held in escrow
        const platformFee = escrowAmount * platformFeePercent;
        const totalRequired = estimatedTxFee + escrowAmount + platformFee;

        const balanceCheck = await walletService.checkSufficientBalance(totalRequired);

        if (!balanceCheck.isSufficient) {
          announce('Insufficient wallet balance for this proposal', 'assertive');
          alert(
            `⚠️ Insufficient Wallet Balance\n\n` +
            `Your wallet does not have enough funds to create this cash proposal.\n\n` +
            `Current Balance: ${balanceCheck.currentBalance.toFixed(2)} HBAR\n` +
            `Required Amount: ${totalRequired.toFixed(2)} HBAR\n` +
            `  - Transaction Fee: ${estimatedTxFee.toFixed(2)} HBAR\n` +
            `  - Escrow Amount: ${escrowAmount.toFixed(2)} HBAR\n` +
            `  - Platform Fee: ${platformFee.toFixed(2)} HBAR\n\n` +
            `Shortfall: ${balanceCheck.shortfall?.toFixed(2)} HBAR\n\n` +
            `Please add funds to your wallet before creating this proposal.`
          );
          return;
        }
      } catch (error) {
        console.error('Failed to check wallet balance:', error);
        announce('Unable to verify wallet balance', 'assertive');
        alert('⚠️ Unable to verify wallet balance. Please ensure your wallet is connected and try again.');
        return;
      }
    }

    if (isCashProposal) {
      // For cash proposals, use the dedicated cash offer endpoint
      const cashOfferData = {
        swapId: targetSwap.id,
        amount: formData.cashAmount,
        currency: 'USD', // Default to USD, could be configurable
        paymentMethodId: formData.paymentMethodId || 'default-payment-method', // TODO: Get from user's payment methods
        escrowAgreement: formData.escrowAgreement || true,
        message: formData.message,
        conditions: formData.conditions?.length > 0 ? formData.conditions : ['Cash payment offer'],
      };

      try {
        const response = await fetch('/api/payments/cash-offer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify(cashOfferData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to submit cash offer');
        }

        const result = await response.json();
        console.log('Cash offer submitted successfully:', result);

        // Call the onSubmit callback with the result
        if (onSubmit) {
          onSubmit(result);
        }

        // Close the modal
        onClose();

      } catch (error) {
        console.error('Error submitting cash offer:', error);
        // Handle error - you might want to show an error message to the user
        alert(`Error submitting cash offer: ${error.message}`);
      }

      return;
    }

    // For regular swap proposals, use the standard proposal endpoint
    // Use wallet address from wallet hook first, fallback to user auth context
    const effectiveWalletAddress = walletAddress || user?.walletAddress;

    const apiProposalData: CreateProposalRequest = {
      sourceSwapId: selectedSwap.id,
      message: formData.message,
      conditions: formData.conditions || ['Standard swap exchange'],
      agreedToTerms: formData.agreedToTerms,
      walletAddress: effectiveWalletAddress || undefined, // Include wallet address
    };

    console.log('MakeProposalModal - API request payload:', {
      ...apiProposalData,
      hasWalletAddress: !!effectiveWalletAddress,
      walletFromHook: walletAddress,
      walletFromUser: user?.walletAddress,
      effectiveWallet: effectiveWalletAddress
    });

    // Submit through the API service
    let result;
    try {
      console.log('MakeProposalModal - Submitting non-cash proposal', {
        payload: apiProposalData,
        targetSwapId: targetSwap?.id,
        selectedSwapId: selectedSwap?.id,
      });
      result = await submitProposal(apiProposalData);
      console.log('MakeProposalModal - Proposal submission success:', result);
    } catch (error: any) {
      // Enhanced error logging
      const axiosData = (error?.response && {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
        method: error.config?.method,
      }) || null;
      console.error('MakeProposalModal - Proposal submission FAILED', {
        errorMessage: error?.message,
        axios: axiosData,
        payload: apiProposalData,
      });
      alert(`Proposal submission failed: ${error?.message || 'Unknown error'}`);
      return;
    }

    if (result) {
      // Create success notification
      const successNotification: Notification = {
        id: `proposal_${result.proposalId}_${Date.now()}`,
        userId: user.id,
        type: 'swap_proposal',
        title: isCashProposal ? 'Cash Offer Submitted Successfully' : 'Proposal Submitted Successfully',
        message: isCashProposal
          ? `Your cash offer of $${formData.cashAmount} for "${targetSwap.title || 'the selected swap'}" has been submitted and is now pending review.`
          : `Your proposal for "${targetSwap.title || 'the selected swap'}" has been submitted and is now pending review.`,
        data: {
          proposalId: result.proposalId,
          targetSwapId: targetSwap.id,
          sourceSwapId: selectedSwap?.id,
          cashAmount: isCashProposal ? formData.cashAmount : undefined,
          estimatedResponseTime: result.estimatedResponseTime,
        },
        channel: 'in_app',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
        sentAt: new Date(),
      };

      // Dispatch the notification
      dispatch(addNotification(successNotification));

      // Announce success for accessibility
      announce(
        isCashProposal
          ? `Cash offer of $${formData.cashAmount} submitted successfully. The swap owner will review your offer and respond within ${result.estimatedResponseTime}.`
          : `Proposal submitted successfully. The swap owner will review your proposal and respond within ${result.estimatedResponseTime}.`,
        'polite'
      );

      // Create the parent component payload for backward compatibility
      const parentProposalData: CreateProposalFromBrowseRequest = {
        targetSwapId: targetSwap.id,
        sourceSwapId: selectedSwap?.id || '', // Empty string for cash proposals
        proposerId: user.id,
        message: formData.message,
        conditions: formData.conditions,
        agreedToTerms: formData.agreedToTerms,
        ...(isCashProposal && { cashOffer: { amount: formData.cashAmount, currency: 'USD' } }),
      };

      // Call the original onSubmit for parent component handling
      onSubmit(parentProposalData);

      // Close the modal on successful submission
      onClose();
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Show initial loading state if modal is open but we don't have required data
  const isInitializing = isOpen && (!user?.id || !targetSwap?.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showForm ? (selectedSwap ? "Create Proposal" : (FEATURE_FLAGS.ENABLE_CASH_PROPOSALS ? "Make Cash Offer" : "Create Proposal")) : "Select Your Swap"}
      size={isMobile ? 'xl' : 'lg'}
      aria-describedby="modal-description keyboard-shortcuts-info"
    >
      <ProposalErrorBoundary context="proposal-modal">
        <div
          style={{
            padding: isMobile ? tokens.spacing[4] : tokens.spacing[6],
            maxHeight: isMobile ? '90vh' : '80vh',
            overflowY: 'auto',
          }}
        >
          {/* Keyboard Shortcuts Help */}
          <div style={{ marginBottom: tokens.spacing[4] }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
              style={{
                fontSize: tokens.typography.fontSize.xs,
                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                marginBottom: tokens.spacing[2],
              }}
              aria-expanded={showKeyboardHelp}
              aria-controls="keyboard-shortcuts-panel"
              aria-label={showKeyboardHelp ? 'Hide keyboard shortcuts' : 'Show keyboard shortcuts'}
            >
              ⌨️ {showKeyboardHelp ? 'Hide' : 'Show'} Keyboard Shortcuts
            </Button>

            {showKeyboardHelp && (
              <div
                id="keyboard-shortcuts-panel"
                style={{
                  backgroundColor: tokens.colors.neutral[50],
                  border: `1px solid ${tokens.colors.neutral[200]}`,
                  borderRadius: tokens.borderRadius.md,
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                }}
                role="region"
                aria-labelledby="keyboard-shortcuts-heading"
              >
                <h4
                  id="keyboard-shortcuts-heading"
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[2]} 0`,
                  }}
                >
                  Available Keyboard Shortcuts
                </h4>
                <ul style={{
                  margin: 0,
                  paddingLeft: tokens.spacing[4],
                  color: tokens.colors.neutral[700],
                  lineHeight: 1.5,
                }}>
                  <li><strong>Escape:</strong> Close modal</li>
                  <li><strong>Tab:</strong> Navigate between elements</li>
                  <li><strong>Enter/Space:</strong> Select swap or activate buttons</li>
                  {(error || submitError) && <li><strong>Alt+R:</strong> Retry failed operation</li>}
                  {showForm && <li><strong>Alt+B:</strong> Back to swap selection</li>}
                  {(error || submitError) && <li><strong>Alt+C:</strong> Clear error messages</li>}
                </ul>
              </div>
            )}
          </div>

          {/* Hidden description for screen readers */}
          <div
            id="modal-description"
            style={{
              position: 'absolute',
              left: '-10000px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            This modal allows you to select one of your eligible swaps to propose for a swap exchange.
            Use Tab to navigate, Enter to select, and Escape to close.
            Keyboard shortcuts are available - press the keyboard shortcuts button to learn more.
          </div>

          <div
            id="keyboard-shortcuts-info"
            style={{
              position: 'absolute',
              left: '-10000px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            Keyboard navigation is fully supported. Use Tab to move between elements, Enter or Space to activate buttons, and Escape to close the modal.
          </div>
          {!user?.id ? (
            <UserFriendlyError
              errorType="authentication"
              originalError="User not authenticated"
              onLogin={() => {
                // Use the authentication guard to handle redirect properly
                requireAuthentication();
              }}
            />
          ) : !targetSwap?.id ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: tokens.spacing[8],
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: tokens.spacing[4],
              }}>
                🤔
              </div>
              <h3 style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                margin: `0 0 ${tokens.spacing[3]} 0`,
              }}>
                Something's Not Right
              </h3>
              <p style={{
                fontSize: tokens.typography.fontSize.base,
                color: tokens.colors.neutral[600],
                margin: `0 0 ${tokens.spacing[4]} 0`,
                maxWidth: '300px',
              }}>
                We couldn't find the swap you're trying to propose for. It might have been removed or is no longer available.
              </p>
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
              >
                Go Back
              </Button>
            </div>
          ) : isInitializing ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: tokens.spacing[8],
                gap: tokens.spacing[4],
                minHeight: '300px',
              }}
              role="status"
              aria-live="polite"
              aria-label="Initializing proposal modal"
              aria-describedby="initialization-description"
            >
              <LoadingSpinner size="lg" />
              <div style={{
                textAlign: 'center',
                maxWidth: '300px',
              }}>
                <h4 style={{
                  fontSize: tokens.typography.fontSize.lg,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  margin: `0 0 ${tokens.spacing[3]} 0`,
                }}>
                  Preparing Proposal Modal
                </h4>
                <p
                  id="initialization-description"
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Setting up your proposal workspace and loading your account information...
                </p>
              </div>
            </div>
          ) : !showForm ? (
            <div>
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: tokens.spacing[6]
              }}>
                <h3
                  style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: 0,
                  }}
                >
                  Choose a swap to propose
                </h3>
              </div>

              {/* Target swap info */}
              <Card variant="outlined" style={{ marginBottom: tokens.spacing[6] }}>
                <CardHeader>
                  <h4 style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: 0,
                  }}>
                    You're proposing for:
                  </h4>
                </CardHeader>
                <CardContent>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <h5 style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: `0 0 ${tokens.spacing[1]} 0`,
                      }}>
                        Target Swap
                      </h5>
                      <p style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        margin: 0,
                      }}>
                        Swap ID: {targetSwap.id}
                      </p>
                    </div>
                    <div style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.primary[600],
                    }}>
                      {/* Value will be shown when booking details are available */}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User's eligible swaps */}
              {loadingSwaps ? (
                <div>
                  <h4 style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[4]} 0`,
                  }}>
                    Your available swaps:
                  </h4>
                  <div
                    style={{
                      display: 'grid',
                      gap: tokens.spacing[4],
                    }}
                    role="status"
                    aria-live="polite"
                    aria-label="Loading eligible swaps"
                    aria-describedby="loading-description loading-instructions"
                  >
                    {/* Show 3 skeleton loaders while loading */}
                    {Array.from({ length: 3 }).map((_, index) => (
                      <EligibleSwapSkeleton
                        key={`skeleton-${index}`}
                        aria-label={`Loading swap option ${index + 1} of 3`}
                      />
                    ))}
                  </div>
                  <div
                    id="loading-description"
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: tokens.spacing[4],
                      gap: tokens.spacing[3],
                      backgroundColor: tokens.colors.neutral[50],
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${tokens.colors.neutral[200]}`,
                    }}
                  >
                    <LoadingSpinner size="sm" aria-hidden="true" />
                    <span style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                      fontWeight: tokens.typography.fontWeight.medium,
                    }}>
                      Finding your compatible swaps...
                    </span>
                  </div>
                  <div
                    id="loading-instructions"
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.colors.neutral[500],
                      textAlign: 'center',
                      marginTop: tokens.spacing[2],
                    }}
                    aria-live="polite"
                  >
                    This process analyzes compatibility with your available swaps. Please wait while we fetch your options.
                  </div>
                </div>
              ) : error ? (
                // Enhanced error handling with comprehensive recovery mechanisms
                <div>
                  {/* Error Status */}
                  {errorThresholdReached && (
                    <div style={{ marginBottom: tokens.spacing[4] }}>
                      <ErrorStatus
                        operationName="fetch_eligible_swaps"
                        errorCount={3}
                        showDetails={true}
                      />
                    </div>
                  )}

                  {isAuthError(error) ? (
                    <UserFriendlyError
                      errorType="authentication"
                      originalError={error}
                      onLogin={() => requireAuthentication()}
                    />
                  ) : isAuthorizationError(error) ? (
                    <UserFriendlyError
                      errorType="authorization"
                      originalError={error}
                      onRetry={() => window.location.reload()}
                    />
                  ) : (
                    <EnhancedErrorMessage
                      error={error}
                      title="Unable to Load Your Swaps"
                      operationName="fetch_eligible_swaps"
                      onRetry={canRetry ? retry : undefined}
                      onManualRetry={manualRetry}
                      onDismiss={clearError}
                      showCircuitBreakerInfo={true}
                    />
                  )}
                </div>
              ) : !eligibleSwaps || !Array.isArray(eligibleSwaps) || eligibleSwaps.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: tokens.spacing[8],
                  textAlign: 'center',
                  backgroundColor: tokens.colors.neutral[50],
                  borderRadius: tokens.borderRadius.lg,
                  border: `1px solid ${tokens.colors.neutral[200]}`,
                }}>
                  <div style={{
                    fontSize: '3rem',
                    marginBottom: tokens.spacing[4],
                  }}>
                    🔄
                  </div>
                  <h3 style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[3]} 0`,
                  }}>
                    No Available Swaps
                  </h3>
                  <p style={{
                    fontSize: tokens.typography.fontSize.base,
                    color: tokens.colors.neutral[600],
                    margin: `0 0 ${tokens.spacing[4]} 0`,
                    maxWidth: '400px',
                    lineHeight: 1.5,
                  }}>
                    You don't have any swaps available to propose for this exchange right now.
                    {FEATURE_FLAGS.ENABLE_CASH_PROPOSALS &&
                      " However, you can always make a cash offer instead!"
                    }
                  </p>
                  <div style={{
                    display: 'flex',
                    gap: tokens.spacing[3],
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}>
                    {FEATURE_FLAGS.ENABLE_CASH_PROPOSALS && (
                      <Button
                        variant="primary"
                        onClick={() => {
                          // Handle cash proposal
                          setShowForm(true);
                          setSelectedSwap(null); // null indicates cash proposal
                          announce('Starting cash proposal form', 'polite');
                        }}
                        style={{
                          backgroundColor: tokens.colors.success[600],
                          borderColor: tokens.colors.success[600],
                        }}
                      >
                        💰 Make Cash Offer
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      onClick={() => {
                        // Navigate to create swap page or close modal
                        onClose();
                        // You could add navigation to create swap page here
                      }}
                    >
                      Create a Swap
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.location.reload()}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

              ) : (
                <div>
                  <h4 style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[4]} 0`,
                  }}>
                    Your available swaps:
                  </h4>

                  {/* Cash Proposal Option */}
                  {FEATURE_FLAGS.ENABLE_CASH_PROPOSALS && (
                    <Card
                      variant="outlined"
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: `2px solid ${tokens.colors.success[200]}`,
                        backgroundColor: tokens.colors.success[50],
                        marginBottom: tokens.spacing[4],
                      }}
                      onClick={() => {
                        setShowForm(true);
                        setSelectedSwap(null); // null indicates cash proposal
                        announce('Starting cash proposal form', 'polite');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setShowForm(true);
                          setSelectedSwap(null);
                          announce('Starting cash proposal form', 'polite');
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label="Make a cash offer instead of proposing a swap"
                    >
                      <CardContent>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: tokens.spacing[4],
                          textAlign: 'center',
                        }}>
                          <div style={{
                            fontSize: '2rem',
                            marginRight: tokens.spacing[3],
                          }}>
                            💰
                          </div>
                          <div>
                            <h5 style={{
                              fontSize: tokens.typography.fontSize.base,
                              fontWeight: tokens.typography.fontWeight.semibold,
                              color: tokens.colors.success[800],
                              margin: `0 0 ${tokens.spacing[1]} 0`,
                            }}>
                              Make Cash Offer
                            </h5>
                            <p style={{
                              fontSize: tokens.typography.fontSize.sm,
                              color: tokens.colors.success[700],
                              margin: 0,
                            }}>
                              Offer cash instead of a swap exchange
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div style={{
                    display: 'grid',
                    gap: tokens.spacing[4],
                  }}>
                    {(() => {
                      try {
                        if (!Array.isArray(eligibleSwaps)) {
                          console.error('eligibleSwaps is not an array:', eligibleSwaps);
                          return <div>Error: Invalid data structure</div>;
                        }
                        return eligibleSwaps.map((swap, index) => {
                          const compatibilityScore = getCompatibilityScore(swap.id);
                          const compatibilityAnalysis = getCompatibilityAnalysis(swap.id);
                          const isLoadingCompat = isLoadingCompatibility(swap.id);

                          const compatibilityText = compatibilityScore
                            ? `${compatibilityScore.value}% ${compatibilityScore.level} match`
                            : 'Compatibility score unavailable';

                          const eligibilityText = compatibilityAnalysis?.reasons?.length > 0
                            ? `Recommendations: ${compatibilityAnalysis.reasons.join(', ')}`
                            : '';

                          return (
                            <Card
                              key={swap.id}
                              variant="outlined"
                              style={{
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                opacity: submitting ? 0.6 : 1,
                                pointerEvents: submitting ? 'none' : 'auto',
                                outline: 'none',
                              }}
                              onClick={() => !submitting && handleSwapSelect(swap)}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && !submitting) {
                                  e.preventDefault();
                                  handleSwapSelect(swap);
                                }
                              }}
                              tabIndex={submitting ? -1 : 0}
                              role="button"
                              aria-label={`Select ${swap.title} for your proposal. ${compatibilityText}. ${eligibilityText}. Location: ${typeof swap.bookingDetails.location === 'string' ? swap.bookingDetails.location : `${swap.bookingDetails.location?.city || 'Unknown'}, ${swap.bookingDetails.location?.country || 'Unknown'}`}. Value: ${formatCurrency(swap.bookingDetails.estimatedValue)}. Press Enter to select.`}
                              aria-describedby={`swap-${swap.id}-details`}
                              aria-disabled={submitting}
                            >
                              <CardContent>
                                <div
                                  id={`swap-${swap.id}-details`}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: tokens.spacing[3],
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <h5 style={{
                                      fontSize: tokens.typography.fontSize.sm,
                                      fontWeight: tokens.typography.fontWeight.semibold,
                                      color: tokens.colors.neutral[900],
                                      margin: `0 0 ${tokens.spacing[1]} 0`,
                                    }}>
                                      {swap.title}
                                    </h5>
                                    <p style={{
                                      fontSize: tokens.typography.fontSize.sm,
                                      color: tokens.colors.neutral[600],
                                      margin: `0 0 ${tokens.spacing[2]} 0`,
                                    }}>
                                      {typeof swap.bookingDetails.location === 'string' ? swap.bookingDetails.location : `${swap.bookingDetails.location?.city || 'Unknown'}, ${swap.bookingDetails.location?.country || 'Unknown'}`} • {swap.bookingDetails.accommodationType} • {swap.bookingDetails.guests} guests
                                    </p>
                                  </div>
                                  <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    gap: tokens.spacing[1],
                                  }}>
                                    <div style={{
                                      fontSize: tokens.typography.fontSize.sm,
                                      fontWeight: tokens.typography.fontWeight.semibold,
                                      color: tokens.colors.primary[600],
                                    }}>
                                      {formatCurrency(swap.bookingDetails.estimatedValue)}
                                    </div>

                                    {/* Enhanced Compatibility Display */}
                                    <div style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'flex-end',
                                      gap: tokens.spacing[1],
                                    }}>
                                      {isLoadingCompat ? (
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: tokens.spacing[1],
                                          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                          backgroundColor: tokens.colors.neutral[100],
                                          borderRadius: tokens.borderRadius.full,
                                          border: `1px solid ${tokens.colors.neutral[300]}`,
                                        }}>
                                          <LoadingSpinner size="xs" />
                                          <span style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.neutral[600],
                                          }}>
                                            Analyzing...
                                          </span>
                                        </div>
                                      ) : compatibilityScore ? (
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: tokens.spacing[1],
                                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                            backgroundColor: compatibilityScore.level === 'excellent'
                                              ? tokens.colors.success[50]
                                              : compatibilityScore.level === 'good'
                                                ? tokens.colors.warning[50]
                                                : compatibilityScore.level === 'fair'
                                                  ? tokens.colors.warning[100]
                                                  : tokens.colors.error[50],
                                            borderRadius: tokens.borderRadius.full,
                                            border: `1px solid ${compatibilityScore.level === 'excellent'
                                              ? tokens.colors.success[200]
                                              : compatibilityScore.level === 'good'
                                                ? tokens.colors.warning[200]
                                                : compatibilityScore.level === 'fair'
                                                  ? tokens.colors.warning[300]
                                                  : tokens.colors.error[200]
                                              }`,
                                            cursor: 'pointer',
                                            outline: 'none',
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            refreshCompatibilityScore(swap.id);
                                            announce(`Refreshing compatibility score for ${swap.title}`, 'polite');
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              refreshCompatibilityScore(swap.id);
                                              announce(`Refreshing compatibility score for ${swap.title}`, 'polite');
                                            }
                                          }}
                                          title="Click to refresh compatibility score"
                                          role="button"
                                          tabIndex={0}
                                          aria-label={`Compatibility score: ${compatibilityScore.value}% ${compatibilityScore.level} match. Press Enter to refresh score.`}
                                          aria-describedby={`compatibility-help-${swap.id}`}
                                        >
                                          <span style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                            color: compatibilityScore.level === 'excellent'
                                              ? tokens.colors.success[700]
                                              : compatibilityScore.level === 'good'
                                                ? tokens.colors.warning[700]
                                                : compatibilityScore.level === 'fair'
                                                  ? tokens.colors.warning[800]
                                                  : tokens.colors.error[700],
                                          }}>
                                            {compatibilityScore.value}% {compatibilityScore.level} match
                                          </span>
                                        </div>
                                      ) : (
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: tokens.spacing[1],
                                          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                          backgroundColor: tokens.colors.neutral[100],
                                          borderRadius: tokens.borderRadius.full,
                                          border: `1px solid ${tokens.colors.neutral[300]}`,
                                        }}>
                                          <span style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.neutral[600],
                                          }}>
                                            Score unavailable
                                          </span>
                                        </div>
                                      )}

                                      {/* Hidden compatibility help text for screen readers */}
                                      <div
                                        id={`compatibility-help-${swap.id}`}
                                        style={{
                                          position: 'absolute',
                                          left: '-10000px',
                                          width: '1px',
                                          height: '1px',
                                          overflow: 'hidden',
                                        }}
                                      >
                                        Compatibility scores help you understand how well your swap matches with the target swap. Higher scores indicate better compatibility.
                                      </div>

                                      {/* Compatibility Recommendations */}
                                      {compatibilityAnalysis && compatibilityAnalysis.reasons && compatibilityAnalysis.reasons.length > 0 && (
                                        <div
                                          style={{
                                            maxWidth: '200px',
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.neutral[600],
                                            textAlign: 'right',
                                            lineHeight: 1.3,
                                          }}
                                          aria-label={`Compatibility recommendations: ${compatibilityAnalysis.reasons?.join(', ') || ''}`}
                                        >
                                          {compatibilityAnalysis.reasons?.slice(0, 2).join(', ') || ''}
                                          {compatibilityAnalysis.reasons && compatibilityAnalysis.reasons.length > 2 && (
                                            <span
                                              title={`Additional recommendations: ${compatibilityAnalysis.reasons?.slice(2).join(', ') || ''}`}
                                              aria-label={`and ${(compatibilityAnalysis.reasons?.length || 0) - 2} more recommendations`}
                                            >
                                              ...
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSwapSelect(swap);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSwapSelect(swap);
                                    }
                                  }}
                                  disabled={submitting}
                                  style={{ width: '100%' }}
                                  aria-label={
                                    submitting
                                      ? 'Processing proposal submission, please wait'
                                      : `Select ${swap.title} for your proposal. This swap has ${compatibilityText} and is located in ${typeof swap.bookingDetails.location === 'string' ? swap.bookingDetails.location : `${swap.bookingDetails.location?.city || 'Unknown'}, ${swap.bookingDetails.location?.country || 'Unknown'}`}.`
                                  }
                                  aria-describedby={`swap-${swap.id}-button-help`}
                                >
                                  {submitting ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                      <LoadingSpinner size="sm" aria-hidden="true" />
                                      <span>Processing...</span>
                                    </div>
                                  ) : (
                                    'Select This Swap'
                                  )}
                                </Button>

                                {/* Hidden help text for screen readers */}
                                <div
                                  id={`swap-${swap.id}-button-help`}
                                  style={{
                                    position: 'absolute',
                                    left: '-10000px',
                                    width: '1px',
                                    height: '1px',
                                    overflow: 'hidden',
                                  }}
                                >
                                  Selecting this swap will take you to the proposal creation form where you can add a message and conditions.
                                </div>
                              </CardContent>
                            </Card>
                          );
                        });
                      } catch (error) {
                        console.error('Error rendering eligible swaps:', error);
                        return <div>Error rendering swaps</div>;
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Form with back navigation */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: tokens.spacing[6]
              }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToSelection}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleBackToSelection();
                    }
                  }}
                  style={{ marginRight: tokens.spacing[3] }}
                  aria-label="Go back to swap selection. Keyboard shortcut: Alt+B"
                  title="Go back to swap selection (Alt+B)"
                >
                  ← Back to Selection
                </Button>
                <h3
                  style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: 0,
                  }}
                  id="proposal-form-heading"
                >
                  Create Your Proposal
                </h3>
              </div>

              {submitError && (
                // Enhanced submit error handling with authentication awareness
                isAuthError(submitError) ? (
                  <UserFriendlyError
                    errorType="authentication"
                    originalError={submitError}
                    onLogin={() => requireAuthentication()}
                  />
                ) : isAuthorizationError(submitError) ? (
                  <UserFriendlyError
                    errorType="authorization"
                    originalError={submitError}
                    onRetry={() => window.location.reload()}
                  />
                ) : (
                  <EnhancedErrorMessage
                    error={submitError}
                    title="Proposal Submission Failed"
                    operationName="submit_proposal"
                    onRetry={() => {
                      // Retry the last submission
                      if (selectedSwap) {
                        handleFormSubmit({
                          message: '',
                          conditions: [],
                          agreedToTerms: true,
                        });
                      }
                    }}
                    onManualRetry={() => {
                      // Manual retry for immediate submission
                      if (selectedSwap) {
                        handleFormSubmit({
                          message: '',
                          conditions: [],
                          agreedToTerms: true,
                        });
                      }
                    }}
                    onDismiss={clearSubmitError}
                    showCircuitBreakerInfo={true}
                  />
                )
              )}

              {submitting ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: tokens.spacing[8],
                    gap: tokens.spacing[4],
                    backgroundColor: tokens.colors.primary[50],
                    borderRadius: tokens.borderRadius.lg,
                    border: `2px solid ${tokens.colors.primary[200]}`,
                  }}
                  role="status"
                  aria-live="polite"
                  aria-label="Submitting proposal"
                  aria-describedby="submission-description"
                >
                  <LoadingSpinner size="lg" color={tokens.colors.primary[600]} />
                  <div style={{
                    textAlign: 'center',
                  }}>
                    <h4 style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.primary[900],
                      margin: `0 0 ${tokens.spacing[2]} 0`,
                    }}>
                      Submitting Your Proposal
                    </h4>
                    <p
                      id="submission-description"
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.primary[700],
                        margin: `0 0 ${tokens.spacing[3]} 0`,
                        lineHeight: 1.5,
                      }}
                    >
                      We're sending your proposal to the swap owner. This usually takes just a few seconds.
                    </p>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: tokens.spacing[2],
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.colors.primary[600],
                      fontWeight: tokens.typography.fontWeight.medium,
                    }}>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        backgroundColor: tokens.colors.primary[400],
                        borderRadius: '50%',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }} />
                      <span>Processing...</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div role="region" aria-labelledby="proposal-form-heading" aria-describedby="proposal-form-description">
                  <div
                    id="proposal-form-description"
                    style={{
                      position: 'absolute',
                      left: '-10000px',
                      width: '1px',
                      height: '1px',
                      overflow: 'hidden',
                    }}
                  >
                    Fill out this form to create your swap proposal. All fields are optional except agreeing to terms.
                    Use Tab to navigate between form fields and buttons.
                  </div>
                  {selectedSwap ? (
                    // Regular swap proposal form
                    <>
                      {console.log('MakeProposalModal - Rendering ProposalCreationForm with selectedSwap:', selectedSwap)}
                      {console.log('MakeProposalModal - targetSwap data:', targetSwap)}
                      <ProposalCreationForm
                        targetSwap={targetSwap}
                        eligibleSwaps={[selectedSwap]}
                        onSubmit={handleFormSubmit}
                        onCancel={handleBackToSelection}
                        loading={loading || submitting}
                      />
                    </>
                  ) : FEATURE_FLAGS.ENABLE_CASH_PROPOSALS ? (
                    // Cash offer form - only show if feature is enabled
                    <CashOfferForm
                      targetSwap={targetSwap}
                      onSubmit={handleFormSubmit}
                      onCancel={handleBackToSelection}
                      loading={loading || submitting}
                      cashDetails={{
                        minimumAmount: (targetSwap as any)?.paymentTypes?.minimumCashAmount || 0,
                        preferredAmount: (targetSwap as any)?.paymentTypes?.preferredCashAmount || undefined,
                        currency: 'USD'
                      }}
                    />
                  ) : (
                    // Feature disabled fallback
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: tokens.spacing[8],
                      textAlign: 'center',
                      backgroundColor: tokens.colors.neutral[50],
                      borderRadius: tokens.borderRadius.lg,
                      border: `1px solid ${tokens.colors.neutral[200]}`,
                    }}>
                      <div style={{
                        fontSize: '2rem',
                        marginBottom: tokens.spacing[4],
                      }}>
                        🚫
                      </div>
                      <h3 style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: `0 0 ${tokens.spacing[3]} 0`,
                      }}>
                        Feature Not Available
                      </h3>
                      <p style={{
                        fontSize: tokens.typography.fontSize.base,
                        color: tokens.colors.neutral[600],
                        margin: `0 0 ${tokens.spacing[4]} 0`,
                        maxWidth: '300px',
                      }}>
                        Cash proposals are currently disabled. Please select a swap to exchange instead.
                      </p>
                      <Button
                        variant="primary"
                        onClick={handleBackToSelection}
                      >
                        Back to Selection
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ProposalErrorBoundary>
    </Modal>
  );
};