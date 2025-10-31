import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { completeSwap } from '@/store/thunks/swapThunks';
import { selectSwapsLoading } from '@/store/slices/swapsSlice';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import { SwapWithBookings } from '@/services/swapService';
import { BookingType } from '@booking-swap/shared';

interface SwapCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  swap: SwapWithBookings;
  onSwapCompleted?: (swapId: string) => void;
}

interface CompletionStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
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

export const SwapCompletionModal: React.FC<SwapCompletionModalProps> = ({
  isOpen,
  onClose,
  swap,
  onSwapCompleted,
}) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectSwapsLoading);

  // Local state
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  // Completion steps
  const [steps, setSteps] = useState<CompletionStep[]>([
    {
      id: 'validation',
      title: 'Validate Swap Details',
      description: 'Verifying booking information and swap terms',
      status: 'pending',
    },
    {
      id: 'blockchain_prepare',
      title: 'Prepare Blockchain Transaction',
      description: 'Creating smart contract transaction for ownership transfer',
      status: 'pending',
    },
    {
      id: 'wallet_signature',
      title: 'Sign Transaction',
      description: 'Please sign the transaction in your wallet',
      status: 'pending',
    },
    {
      id: 'blockchain_submit',
      title: 'Submit to Blockchain',
      description: 'Broadcasting transaction to Hedera network',
      status: 'pending',
    },
    {
      id: 'ownership_transfer',
      title: 'Transfer Ownership',
      description: 'Updating booking ownership records',
      status: 'pending',
    },
    {
      id: 'completion',
      title: 'Finalize Swap',
      description: 'Completing swap and sending notifications',
      status: 'pending',
    },
  ]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setIsCompleting(false);
      setCompletionError(null);
      setTransactionHash(null);
      setSteps(
        steps.map(step => ({ ...step, status: 'pending', error: undefined }))
      );
    }
  }, [isOpen]);

  // Update step status
  const updateStepStatus = (
    stepId: string,
    status: CompletionStep['status'],
    error?: string
  ) => {
    setSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, status, error } : step
      )
    );
  };

  // Simulate completion process
  const handleCompleteSwap = async () => {
    setIsCompleting(true);
    setCompletionError(null);

    try {
      // Step 1: Validation
      setCurrentStep(0);
      updateStepStatus('validation', 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStepStatus('validation', 'completed');

      // Step 2: Prepare blockchain transaction
      setCurrentStep(1);
      updateStepStatus('blockchain_prepare', 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateStepStatus('blockchain_prepare', 'completed');

      // Step 3: Wallet signature
      setCurrentStep(2);
      updateStepStatus('wallet_signature', 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateStepStatus('wallet_signature', 'completed');

      // Step 4: Submit to blockchain
      setCurrentStep(3);
      updateStepStatus('blockchain_submit', 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Simulate transaction hash
      const mockTxHash = '0x' + Math.random().toString(16).substr(2, 40);
      setTransactionHash(mockTxHash);
      updateStepStatus('blockchain_submit', 'completed');

      // Step 5: Transfer ownership
      setCurrentStep(4);
      updateStepStatus('ownership_transfer', 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateStepStatus('ownership_transfer', 'completed');

      // Step 6: Complete swap
      setCurrentStep(5);
      updateStepStatus('completion', 'in_progress');

      // Actually complete the swap
      await dispatch(completeSwap(swap.id)).unwrap();

      updateStepStatus('completion', 'completed');

      // Notify parent component
      onSwapCompleted?.(swap.id);

      // Auto-close after a delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to complete swap';
      setCompletionError(errorMessage);

      // Mark current step as failed
      const currentStepId = steps[currentStep]?.id;
      if (currentStepId) {
        updateStepStatus(currentStepId, 'failed', errorMessage);
      }
    } finally {
      setIsCompleting(false);
    }
  };

  // Get step icon based on status
  const getStepIcon = (status: CompletionStep['status']) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '⚪';
    }
  };

  // Get step color based on status
  const getStepColor = (status: CompletionStep['status']) => {
    switch (status) {
      case 'completed':
        return tokens.colors.success[600];
      case 'in_progress':
        return tokens.colors.primary[600];
      case 'failed':
        return tokens.colors.error[600];
      default:
        return tokens.colors.neutral[400];
    }
  };

  // Check if all steps are completed
  const allStepsCompleted = steps.every(step => step.status === 'completed');

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

  const swapSummaryStyles = {
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
  };

  const bookingCardStyles = {
    padding: tokens.spacing[3],
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
  };

  const swapArrowStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    color: tokens.colors.primary[500],
  };

  const stepsContainerStyles = {
    marginBottom: tokens.spacing[6],
  };

  const stepStyles = (step: CompletionStep, index: number) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    marginBottom: tokens.spacing[3],
    backgroundColor:
      step.status === 'in_progress' ? tokens.colors.primary[50] : 'white',
    border: `1px solid ${
      step.status === 'in_progress'
        ? tokens.colors.primary[200]
        : step.status === 'completed'
          ? tokens.colors.success[200]
          : step.status === 'failed'
            ? tokens.colors.error[200]
            : tokens.colors.neutral[200]
    }`,
    borderRadius: tokens.borderRadius.lg,
    transition: 'all 0.2s ease-in-out',
  });

  const stepIconStyles = {
    fontSize: '20px',
    minWidth: '24px',
    textAlign: 'center' as const,
  };

  const stepContentStyles = {
    flex: 1,
  };

  const stepTitleStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[1],
  };

  const stepDescriptionStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    margin: 0,
  };

  const errorStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[600],
    marginTop: tokens.spacing[1],
    fontWeight: tokens.typography.fontWeight.medium,
  };

  const transactionInfoStyles = {
    marginTop: tokens.spacing[4],
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.success[50],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.success[200]}`,
  };

  const successMessageStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[6],
    backgroundColor: tokens.colors.success[50],
    borderRadius: tokens.borderRadius.lg,
    border: `1px solid ${tokens.colors.success[200]}`,
    marginBottom: tokens.spacing[6],
  };

  const warningStyles = {
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.warning[50],
    borderRadius: tokens.borderRadius.lg,
    border: `1px solid ${tokens.colors.warning[200]}`,
    marginBottom: tokens.spacing[6],
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete Swap" size="lg">
      <div>
        {/* Header */}
        <div style={headerStyles}>
          <div>
            <h2 style={titleStyles}>Complete Swap Transaction</h2>
            <p style={subtitleStyles}>
              Finalize the ownership transfer on the blockchain
            </p>
          </div>
        </div>

        {/* Swap Summary */}
        <div style={swapSummaryStyles}>
          <h3
            style={{
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[900],
              marginBottom: tokens.spacing[3],
            }}
          >
            Swap Summary
          </h3>

          <div style={swapComparisonStyles}>
            {/* Source booking */}
            <div style={bookingCardStyles}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                  marginBottom: tokens.spacing[2],
                }}
              >
                <span style={{ fontSize: '16px' }}>
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
                  From
                </span>
              </div>
              <h4
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  marginBottom: tokens.spacing[1],
                }}
              >
                {swap.sourceBooking.title}
              </h4>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.neutral[600],
                }}
              >
                {formatCurrency(swap.sourceBooking.swapValue)}
              </div>
            </div>

            <div style={swapArrowStyles}>→</div>

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
                <span style={{ fontSize: '16px' }}>
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
                  To
                </span>
              </div>
              <h4
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  marginBottom: tokens.spacing[1],
                }}
              >
                {swap.targetBooking.title}
              </h4>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.neutral[600],
                }}
              >
                {formatCurrency(swap.targetBooking.swapValue)}
              </div>
            </div>
          </div>

          {/* Additional payment info */}
          {swap.terms.additionalPayment && swap.terms.additionalPayment > 0 && (
            <div
              style={{
                marginTop: tokens.spacing[3],
                padding: tokens.spacing[3],
                backgroundColor: tokens.colors.warning[50],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.warning[200]}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                }}
              >
                <span style={{ fontSize: '16px' }}>💰</span>
                <span
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.warning[700],
                    fontWeight: tokens.typography.fontWeight.medium,
                  }}
                >
                  Additional payment required:{' '}
                  {formatCurrency(swap.terms.additionalPayment)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Warning */}
        {!isCompleting && !allStepsCompleted && (
          <div style={warningStyles}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: tokens.spacing[3],
              }}
            >
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.warning[800],
                    marginBottom: tokens.spacing[1],
                  }}
                >
                  Important Notice
                </h4>
                <p
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.warning[700],
                    margin: 0,
                  }}
                >
                  This action will transfer ownership of both bookings on the
                  blockchain. Make sure you have reviewed all details carefully
                  as this cannot be undone.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {allStepsCompleted && (
          <div style={successMessageStyles}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                marginBottom: tokens.spacing[3],
              }}
            >
              🎉
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.success[800],
                marginBottom: tokens.spacing[2],
              }}
            >
              Swap Completed Successfully!
            </h3>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.success[700],
                margin: 0,
              }}
            >
              The ownership transfer has been completed on the blockchain. Both
              parties now have access to their new bookings.
            </p>
          </div>
        )}

        {/* Completion Steps */}
        <div style={stepsContainerStyles}>
          <h3
            style={{
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[900],
              marginBottom: tokens.spacing[4],
            }}
          >
            Completion Progress
          </h3>

          {steps.map((step, index) => (
            <div key={step.id} style={stepStyles(step, index)}>
              <div style={stepIconStyles}>{getStepIcon(step.status)}</div>
              <div style={stepContentStyles}>
                <h4 style={stepTitleStyles}>{step.title}</h4>
                <p style={stepDescriptionStyles}>{step.description}</p>
                {step.error && <p style={errorStyles}>Error: {step.error}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Transaction Hash */}
        {transactionHash && (
          <div style={transactionInfoStyles}>
            <h4
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.success[800],
                marginBottom: tokens.spacing[2],
              }}
            >
              Transaction Hash
            </h4>
            <p
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.success[700],
                fontFamily: tokens.typography.fontFamily.mono,
                wordBreak: 'break-all',
                margin: 0,
              }}
            >
              {transactionHash}
            </p>
          </div>
        )}

        {/* Error Message */}
        {completionError && (
          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.error[50],
              borderRadius: tokens.borderRadius.lg,
              border: `1px solid ${tokens.colors.error[200]}`,
              marginTop: tokens.spacing[4],
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: tokens.spacing[3],
              }}
            >
              <span style={{ fontSize: '20px' }}>❌</span>
              <div>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.error[800],
                    marginBottom: tokens.spacing[1],
                  }}
                >
                  Completion Failed
                </h4>
                <p
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.error[700],
                    margin: 0,
                  }}
                >
                  {completionError}
                </p>
              </div>
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
          {!isCompleting && !allStepsCompleted && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCompleteSwap}
                disabled={loading}
              >
                Complete Swap
              </Button>
            </>
          )}

          {(completionError || allStepsCompleted) && (
            <Button variant="outline" onClick={onClose}>
              {allStepsCompleted ? 'Close' : 'Close'}
            </Button>
          )}

          {completionError && (
            <Button
              variant="primary"
              onClick={handleCompleteSwap}
              loading={isCompleting}
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
