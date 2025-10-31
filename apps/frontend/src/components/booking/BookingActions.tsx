import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { Booking, SwapInfo } from '@booking-swap/shared';
import { getSwapButtonState, shouldShowManageSwap, getManageSwapTooltip } from '@/utils/swapButtonState';
import { formatErrorForUser } from '@/utils/errorHandling';
import { errorRecoveryService } from '@/services/errorRecoveryService';
import {
  isEditButtonEnabled,
  getEditButtonTooltip,
  shouldShowViewButton,
  getViewButtonTooltip
} from '@/utils/swapDetection';
import styles from './BookingActions.module.css';

// Error display component for inline error messages
interface ErrorDisplayProps {
  error: Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = memo(({ error, onRetry, onDismiss, compact = false }) => {
  if (!error) return null;

  const errorInfo = formatErrorForUser(error);

  const errorStyles = {
    backgroundColor: tokens.colors.error[50],
    border: `1px solid ${tokens.colors.error[200]}`,
    borderRadius: tokens.borderRadius.md,
    padding: compact ? tokens.spacing[2] : tokens.spacing[3],
    marginTop: tokens.spacing[2],
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[800],
  };

  const titleStyles = {
    fontWeight: tokens.typography.fontWeight.semibold,
    marginBottom: compact ? tokens.spacing[1] : tokens.spacing[2],
    fontSize: compact ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
  };

  const messageStyles = {
    marginBottom: compact ? tokens.spacing[1] : tokens.spacing[2],
    lineHeight: tokens.typography.lineHeight.relaxed,
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[2],
    flexWrap: 'wrap' as const,
  };

  const retryAction = errorInfo.actions.find(action => action.action === 'retry');

  return (
    <div style={errorStyles}>
      <div style={titleStyles}>{errorInfo.title}</div>
      <div style={messageStyles}>{errorInfo.message}</div>
      {errorInfo.details && !compact && (
        <div style={{ ...messageStyles, fontStyle: 'italic', opacity: 0.8 }}>
          {errorInfo.details}
        </div>
      )}
      <div style={actionsStyles}>
        {(retryAction || onRetry) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            style={{ fontSize: tokens.typography.fontSize.xs }}
          >
            {retryAction?.label || 'Try Again'}
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            style={{ fontSize: tokens.typography.fontSize.xs }}
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
});

ErrorDisplay.displayName = 'ErrorDisplay';

// Loading state management interface
interface LoadingState {
  isLoading: boolean;
  operation: string | null;
}

// Error state management interface
interface ErrorState {
  error: Error | null;
  operation: string | null;
  retryCount: number;
}

// Responsive Button wrapper component for mobile optimization
interface ResponsiveButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
}

const ResponsiveButton: React.FC<ResponsiveButtonProps> = memo(({ children, style, className, disabled, ...props }) => {
  const [isMobile, setIsMobile] = React.useState(false);
  const [isSmallMobile, setIsSmallMobile] = React.useState(false);

  React.useEffect(() => {
    const checkScreenSize = () => {
      const mdBreakpoint = parseInt(tokens.breakpoints.md);
      const smBreakpoint = parseInt(tokens.breakpoints.sm);
      setIsMobile(window.innerWidth <= mdBreakpoint);
      setIsSmallMobile(window.innerWidth <= smBreakpoint);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const responsiveStyles = useMemo(() => {
    if (isSmallMobile) {
      return {
        width: '100%',
        minHeight: '48px', // Larger touch targets for small screens
        fontSize: tokens.typography.fontSize.base,
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        justifyContent: 'center' as const,
      };
    } else if (isMobile) {
      return {
        width: '100%',
        minHeight: '44px', // iOS/Android touch target minimum
        fontSize: tokens.typography.fontSize.sm,
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        justifyContent: 'center' as const,
      };
    }
    return {};
  }, [isMobile, isSmallMobile]);

  // Enhanced keyboard event handling
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Skip keyboard events for disabled buttons
    if (disabled) {
      e.preventDefault();
      return;
    }

    // Handle Enter and Space key activation
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Trigger click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      e.currentTarget.dispatchEvent(clickEvent);
    }
  }, [disabled]);

  return (
    <Button
      {...props}
      disabled={disabled}
      className={`${styles.responsiveButton} ${className || ''}`}
      style={{
        ...responsiveStyles,
        ...style,
      }}
      onKeyDown={handleKeyDown}
      // Ensure proper ARIA attributes for disabled state
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {children}
    </Button>
  );
});

ResponsiveButton.displayName = 'ResponsiveButton';


// Button state interface for Edit and View buttons
interface ButtonState {
  edit: {
    enabled: boolean;
    visible: boolean;
    tooltip: string;
    variant: 'primary' | 'outline' | 'secondary';
  };
  view: {
    enabled: boolean;
    visible: boolean;
    tooltip: string;
    variant: 'outline' | 'secondary';
  };
}

export interface OwnerActionsProps {
  booking: Booking;
  swapInfo?: SwapInfo;
  onEdit?: (booking: Booking) => void;
  onViewDetails?: (booking: Booking) => void;
  onManageSwap?: (swapInfo: SwapInfo) => void;
  onCreateSwap?: (booking: Booking) => Promise<void> | void;
  onViewProposals?: (swapInfo: SwapInfo) => void;
  // Error handling props
  showErrorInline?: boolean;
  maxRetries?: number;
  onError?: (error: Error, operation: string) => void;
}

export const OwnerActions: React.FC<OwnerActionsProps> = memo(({
  booking,
  swapInfo,
  onEdit,
  onViewDetails,
  onManageSwap,
  onCreateSwap,
  onViewProposals,
  showErrorInline = true,
  maxRetries = 3,
  onError
}) => {
  // Loading state management
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    operation: null
  });

  // Error state management
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    operation: null,
    retryCount: 0
  });

  // Debounced state change handler to prevent UI flickering
  // Requirements: 8.5
  const [debouncedSwapInfo, setDebouncedSwapInfo] = useState(swapInfo);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debouncing
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSwapInfo(swapInfo);
    }, 150); // 150ms debounce delay

    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [swapInfo]);

  // Memoize expensive calculations to prevent unnecessary re-renders
  const hasPendingProposals = useMemo(() =>
    swapInfo?.activeProposalCount && swapInfo.activeProposalCount > 0,
    [swapInfo?.activeProposalCount]
  );

  const isBookingActive = useMemo(() =>
    booking.status === 'available',
    [booking.status]
  );

  // Calculate button states based on booking and swap status with enhanced validation
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 3.1, 3.5, 8.2, 8.4, 8.5
  const buttonState = useMemo((): ButtonState => {
    try {
      const isBookingActiveStatus = isBookingActive;

      // Validate callback types and availability
      const hasEditCallback = typeof onEdit === 'function';
      const hasViewCallback = typeof onViewDetails === 'function';

      // Use debounced swap info to prevent UI flickering
      const currentSwapInfo = debouncedSwapInfo;

      return {
        edit: {
          enabled: isEditButtonEnabled(currentSwapInfo, isBookingActiveStatus) && hasEditCallback,
          visible: hasEditCallback,
          tooltip: getEditButtonTooltip(currentSwapInfo, isBookingActiveStatus),
          variant: 'outline'
        },
        view: {
          enabled: hasViewCallback,
          visible: shouldShowViewButton(currentSwapInfo, hasViewCallback),
          tooltip: getViewButtonTooltip(),
          variant: 'outline'
        }
      };
    } catch (error) {
      console.error('OwnerActions: Error calculating button state, using safe defaults', { error });

      // Safe fallback state that allows basic functionality
      return {
        edit: {
          enabled: Boolean(onEdit) && isBookingActive,
          visible: Boolean(onEdit),
          tooltip: isBookingActive ? 'Edit booking details' : 'Cannot edit inactive booking',
          variant: 'outline'
        },
        view: {
          enabled: Boolean(onViewDetails),
          visible: false, // Hide view button on error to prevent confusion
          tooltip: getViewButtonTooltip(),
          variant: 'outline'
        }
      };
    }
  }, [
    isBookingActive,
    debouncedSwapInfo?.hasActiveProposals,
    debouncedSwapInfo?.activeProposalCount,
    debouncedSwapInfo?.userProposalStatus,
    debouncedSwapInfo?.hasAnySwapInitiated,
    debouncedSwapInfo?.paymentTypes,
    debouncedSwapInfo?.acceptanceStrategy,
    onEdit,
    onViewDetails
  ]);

  // Memoize button state calculation to prevent unnecessary recalculations
  const swapButtonState = useMemo(() =>
    getSwapButtonState(booking, swapInfo, onCreateSwap),
    [booking.status, booking.dateRange, booking.verification, swapInfo?.hasActiveProposals, onCreateSwap]
  );

  const showManageSwap = useMemo(() =>
    shouldShowManageSwap(swapInfo),
    [swapInfo?.hasActiveProposals]
  );

  // Enhanced error handling with recovery - optimized with useCallback
  const handleError = useCallback((error: Error, operation: string) => {
    console.error(`${operation} failed:`, error);

    setErrorState(prevState => ({
      error,
      operation,
      retryCount: prevState.retryCount + 1
    }));

    setLoadingState({
      isLoading: false,
      operation: null
    });

    // Call external error handler if provided
    onError?.(error, operation);
  }, [onError]);

  // Clear error state - optimized with useCallback
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      operation: null,
      retryCount: 0
    });
  }, []);

  // Enhanced Create Swap handler with error handling and loading states - optimized with useCallback
  const handleCreateSwap = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔵 BookingActions.handleCreateSwap clicked!', {
      hasOnCreateSwap: Boolean(onCreateSwap),
      isLoading: loadingState.isLoading,
      bookingId: booking.id
    });

    if (!onCreateSwap || loadingState.isLoading) {
      console.log('🔴 Cannot create swap - handler missing or loading');
      return;
    }

    // Clear previous errors
    clearError();

    // Set loading state
    setLoadingState({
      isLoading: true,
      operation: 'create_swap'
    });

    try {
      console.log('🔵 Calling onCreateSwap callback with booking:', booking.id);
      // Use error recovery service for robust error handling
      const result = await errorRecoveryService.executeWithRecovery(
        () => Promise.resolve(onCreateSwap(booking)),
        'create_swap',
        {
          maxAttempts: maxRetries,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        }
      );
      console.log('🟢 onCreateSwap callback executed, result:', result);

      if (!result.success && result.error) {
        throw result.error;
      }

      // Success - clear loading state
      setLoadingState({
        isLoading: false,
        operation: null
      });

    } catch (error) {
      handleError(error as Error, 'create_swap');
    }
  }, [booking, onCreateSwap, maxRetries, clearError, handleError]);

  // Retry handler for failed operations - optimized with useCallback
  const handleRetry = useCallback(async () => {
    if (!errorState.operation || errorState.retryCount >= maxRetries) return;

    switch (errorState.operation) {
      case 'create_swap':
        await handleCreateSwap({ stopPropagation: () => { } } as React.MouseEvent);
        break;
      default:
        console.warn(`Unknown operation for retry: ${errorState.operation}`);
    }
  }, [errorState.operation, errorState.retryCount, maxRetries, handleCreateSwap]);

  // Memoize button state calculations to prevent unnecessary re-renders
  const isCreateSwapLoading = useMemo(() =>
    loadingState.isLoading && loadingState.operation === 'create_swap',
    [loadingState.isLoading, loadingState.operation]
  );

  const isCreateSwapDisabled = useMemo(() =>
    !swapButtonState.enabled || isCreateSwapLoading ||
    Boolean(errorState.error && errorState.operation === 'create_swap' && errorState.retryCount >= maxRetries),
    [swapButtonState.enabled, isCreateSwapLoading, errorState.error, errorState.operation, errorState.retryCount, maxRetries]
  );

  // Memoize tooltip text to prevent unnecessary recalculations
  const createSwapTooltip = useMemo(() => {
    if (errorState.error && errorState.operation === 'create_swap') {
      return `Error: ${errorState.error.message}. Click to retry.`;
    }
    if (isCreateSwapLoading) {
      return 'Creating swap...';
    }
    return swapButtonState.tooltip;
  }, [errorState.error, errorState.operation, isCreateSwapLoading, swapButtonState.tooltip]);

  // Memoize button text to prevent unnecessary recalculations
  const createSwapButtonText = useMemo(() =>
    isCreateSwapLoading ? 'Creating...' : 'Create Swap',
    [isCreateSwapLoading]
  );

  // Enhanced callback validation and error handling
  // Requirements: 8.2, 8.4, 8.5
  const validateBookingData = useCallback((booking: Booking): boolean => {
    try {
      if (!booking) {
        console.warn('OwnerActions: Booking data is null or undefined');
        return false;
      }

      if (typeof booking !== 'object') {
        console.warn('OwnerActions: Booking data is not an object', { booking });
        return false;
      }

      // Check for essential booking properties
      const hasId = Boolean(booking.id);
      const hasStatus = Boolean(booking.status);

      if (!hasId || !hasStatus) {
        console.warn('OwnerActions: Booking data is incomplete', {
          hasId,
          hasStatus,
          booking: { id: booking.id, status: booking.status }
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('OwnerActions: Error validating booking data', { error, booking });
      return false;
    }
  }, []);

  // Memoize button event handlers with enhanced error handling and validation
  const handleEdit = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();

      // Validate callback availability
      if (!onEdit) {
        console.warn('OwnerActions: onEdit callback is not provided');
        return;
      }

      if (typeof onEdit !== 'function') {
        console.error('OwnerActions: onEdit is not a function', { onEdit });
        return;
      }

      // Validate booking data before calling callback
      if (!validateBookingData(booking)) {
        console.error('OwnerActions: Cannot execute onEdit - invalid booking data');
        return;
      }

      // Execute callback with error handling
      onEdit(booking);
    } catch (error) {
      console.error('OwnerActions: Error in handleEdit', { error, booking });
      // Don't throw - gracefully handle the error
    }
  }, [onEdit, booking, validateBookingData]);

  const handleViewDetails = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();

      // Validate callback availability
      if (!onViewDetails) {
        console.warn('OwnerActions: onViewDetails callback is not provided');
        return;
      }

      if (typeof onViewDetails !== 'function') {
        console.error('OwnerActions: onViewDetails is not a function', { onViewDetails });
        return;
      }

      // Validate booking data before calling callback
      if (!validateBookingData(booking)) {
        console.error('OwnerActions: Cannot execute onViewDetails - invalid booking data');
        return;
      }

      // Execute callback with error handling
      onViewDetails(booking);
    } catch (error) {
      console.error('OwnerActions: Error in handleViewDetails', { error, booking });
      // Don't throw - gracefully handle the error
    }
  }, [onViewDetails, booking, validateBookingData]);

  const handleManageSwap = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();

      // Validate callback availability
      if (!onManageSwap) {
        console.warn('OwnerActions: onManageSwap callback is not provided');
        return;
      }

      if (typeof onManageSwap !== 'function') {
        console.error('OwnerActions: onManageSwap is not a function', { onManageSwap });
        return;
      }

      // Validate swapInfo data
      if (!swapInfo) {
        console.warn('OwnerActions: Cannot execute onManageSwap - swapInfo is null or undefined');
        return;
      }

      if (typeof swapInfo !== 'object') {
        console.error('OwnerActions: Cannot execute onManageSwap - swapInfo is not an object', { swapInfo });
        return;
      }

      // Execute callback with error handling
      onManageSwap(swapInfo);
    } catch (error) {
      console.error('OwnerActions: Error in handleManageSwap', { error, swapInfo });
      // Don't throw - gracefully handle the error
    }
  }, [onManageSwap, swapInfo]);

  const handleViewProposals = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();

      // Validate callback availability
      if (!onViewProposals) {
        console.warn('OwnerActions: onViewProposals callback is not provided');
        return;
      }

      if (typeof onViewProposals !== 'function') {
        console.error('OwnerActions: onViewProposals is not a function', { onViewProposals });
        return;
      }

      // Validate swapInfo data
      if (!swapInfo) {
        console.warn('OwnerActions: Cannot execute onViewProposals - swapInfo is null or undefined');
        return;
      }

      if (typeof swapInfo !== 'object') {
        console.error('OwnerActions: Cannot execute onViewProposals - swapInfo is not an object', { swapInfo });
        return;
      }

      // Execute callback with error handling
      onViewProposals(swapInfo);
    } catch (error) {
      console.error('OwnerActions: Error in handleViewProposals', { error, swapInfo });
      // Don't throw - gracefully handle the error
    }
  }, [onViewProposals, swapInfo]);

  // Live region for announcing button state changes to screen readers
  const [liveRegionMessage, setLiveRegionMessage] = useState<string>('');
  const liveRegionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Announce button state changes to screen readers
  useEffect(() => {
    let message = '';

    if (!buttonState.edit.enabled && buttonState.edit.visible) {
      message = `Edit button disabled: ${buttonState.edit.tooltip}`;
    } else if (buttonState.view.visible) {
      message = 'View button available for read-only access';
    }

    if (message && message !== liveRegionMessage) {
      // Clear existing timeout
      if (liveRegionTimeoutRef.current) {
        clearTimeout(liveRegionTimeoutRef.current);
      }

      // Set the message
      setLiveRegionMessage(message);

      // Clear the message after 3 seconds to avoid cluttering
      liveRegionTimeoutRef.current = setTimeout(() => {
        setLiveRegionMessage('');
      }, 3000);
    }

    return () => {
      if (liveRegionTimeoutRef.current) {
        clearTimeout(liveRegionTimeoutRef.current);
      }
    };
  }, [buttonState.edit.enabled, buttonState.edit.visible, buttonState.view.visible, buttonState.edit.tooltip, liveRegionMessage]);

  return (
    <div className={styles.actionsContainer}>
      {/* Live region for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
        role="status"
      >
        {liveRegionMessage}
      </div>
      {/* Edit Button - Enhanced with swap restriction logic */}
      {buttonState.edit.visible && (
        <ResponsiveButton
          variant={buttonState.edit.variant}
          size="sm"
          onClick={handleEdit}
          disabled={!buttonState.edit.enabled}
          title={buttonState.edit.tooltip}
          tabIndex={buttonState.edit.enabled ? 0 : -1}
          aria-disabled={!buttonState.edit.enabled}
          aria-describedby={!buttonState.edit.enabled ? `edit-button-restriction-${booking.id}` : undefined}
          aria-label={`Edit booking ${booking.id}${!buttonState.edit.enabled ? ' (disabled)' : ''}`}
          role="button"
          className={`${styles.buttonStateTransition} ${!buttonState.edit.enabled ? styles.disabledEditButton : ''}`}
        >
          Edit
        </ResponsiveButton>
      )}

      {/* Hidden description for screen readers when Edit button is disabled */}
      {buttonState.edit.visible && !buttonState.edit.enabled && (
        <span id={`edit-button-restriction-${booking.id}`} className={styles.srOnly}>
          {buttonState.edit.tooltip}
        </span>
      )}

      {/* View Button - Show when Edit is restricted and onViewDetails is available */}
      {buttonState.view.visible && (
        <ResponsiveButton
          variant={buttonState.view.variant}
          size="sm"
          onClick={handleViewDetails}
          disabled={!buttonState.view.enabled}
          title={buttonState.view.tooltip}
          aria-label={`View booking ${booking.id} details (read-only access)`}
          aria-describedby={`view-button-description-${booking.id}`}
          role="button"
          className={`${styles.buttonStateTransition} ${styles.viewButton}`}
        >
          View
        </ResponsiveButton>
      )}

      {/* Hidden description for screen readers for View button */}
      {buttonState.view.visible && (
        <span id={`view-button-description-${booking.id}`} className={styles.srOnly}>
          Read-only access to booking details. Editing is disabled because this booking has an active swap.
        </span>
      )}

      {/* Create Swap Button - Show when no active swap exists */}
      {swapButtonState.visible && !showManageSwap && (
        <>
          <ResponsiveButton
            variant={swapButtonState.variant}
            size="sm"
            onClick={handleCreateSwap}
            disabled={isCreateSwapDisabled}
            loading={isCreateSwapLoading || false}
            title={createSwapTooltip}
            className={`${styles.buttonStateTransition} ${isCreateSwapLoading ? styles.loadingButton : ''}`}
          >
            {createSwapButtonText}
          </ResponsiveButton>

          {/* Inline error display for Create Swap */}
          {showErrorInline && errorState.error && errorState.operation === 'create_swap' && (
            <ErrorDisplay
              error={errorState.error}
              onRetry={errorState.retryCount < maxRetries ? handleRetry : undefined}
              onDismiss={clearError}
              compact={true}
            />
          )}
        </>
      )}

      {/* Existing Swap Management Buttons */}
      {showManageSwap && swapInfo && (
        <>
          <ResponsiveButton
            variant="primary"
            size="sm"
            onClick={handleManageSwap}
            title={getManageSwapTooltip(swapInfo)}
            className={styles.buttonStateTransition}
          >
            Manage Swap
          </ResponsiveButton>

          {hasPendingProposals && (
            <ResponsiveButton
              variant="secondary"
              size="sm"
              onClick={handleViewProposals}
              title={`View ${swapInfo.activeProposalCount} pending proposal${swapInfo.activeProposalCount > 1 ? 's' : ''}`}
              className={styles.buttonStateTransition}
            >
              View Proposals ({swapInfo.activeProposalCount})
            </ResponsiveButton>
          )}
        </>
      )}
    </div>
  );
});

OwnerActions.displayName = 'OwnerActions';

export interface BrowserActionsProps {
  booking: Booking;
  swapInfo: SwapInfo;
  onMakeProposal?: () => Promise<void> | void;
  onViewDetails?: (booking: Booking) => void;
  // Error handling props
  showErrorInline?: boolean;
  maxRetries?: number;
  onError?: (error: Error, operation: string) => void;
}

export const BrowserActions: React.FC<BrowserActionsProps> = memo(({
  booking,
  swapInfo,
  onMakeProposal,
  onViewDetails,
  showErrorInline = true,
  maxRetries = 3,
  onError
}) => {
  // Loading state management
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    operation: null
  });

  // Error state management
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    operation: null,
    retryCount: 0
  });

  // Memoize expensive calculations to prevent unnecessary re-renders
  const canMakeProposal = useMemo(() =>
    booking.status === 'available' && swapInfo.hasActiveProposals,
    [booking.status, swapInfo.hasActiveProposals]
  );

  const isAuction = useMemo(() =>
    swapInfo.acceptanceStrategy === 'auction',
    [swapInfo.acceptanceStrategy]
  );

  const isEndingSoon = useMemo(() =>
    swapInfo.timeRemaining && swapInfo.timeRemaining < 24 * 60 * 60 * 1000,
    [swapInfo.timeRemaining]
  );

  const proposalButtonText = useMemo(() => {
    if (isAuction) {
      return isEndingSoon ? 'Bid Now!' : 'Place Bid';
    }
    return 'Make Proposal';
  }, [isAuction, isEndingSoon]);

  const proposalButtonVariant = useMemo(() => {
    if (isEndingSoon) return 'primary';
    return isAuction ? 'secondary' : 'primary';
  }, [isEndingSoon, isAuction]);

  // Enhanced error handling with recovery - optimized with useCallback
  const handleError = useCallback((error: Error, operation: string) => {
    console.error(`${operation} failed:`, error);

    setErrorState(prevState => ({
      error,
      operation,
      retryCount: prevState.retryCount + 1
    }));

    setLoadingState({
      isLoading: false,
      operation: null
    });

    // Call external error handler if provided
    onError?.(error, operation);
  }, [onError]);

  // Clear error state - optimized with useCallback
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      operation: null,
      retryCount: 0
    });
  }, []);

  // Enhanced Make Proposal handler with error handling and loading states
  const handleMakeProposal = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!onMakeProposal || loadingState.isLoading) return;

    // Clear previous errors
    clearError();

    // Set loading state
    setLoadingState({
      isLoading: true,
      operation: 'make_proposal'
    });

    try {
      // Use error recovery service for robust error handling
      const result = await errorRecoveryService.executeWithRecovery(
        () => Promise.resolve(onMakeProposal()),
        'make_proposal',
        {
          maxAttempts: maxRetries,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        }
      );

      if (!result.success && result.error) {
        throw result.error;
      }

      // Success - clear loading state
      setLoadingState({
        isLoading: false,
        operation: null
      });

    } catch (error) {
      handleError(error as Error, 'make_proposal');
    }
  }, [onMakeProposal, maxRetries, clearError, handleError]);

  // Retry handler for failed operations
  const handleRetry = useCallback(async () => {
    if (!errorState.operation || errorState.retryCount >= maxRetries) return;

    switch (errorState.operation) {
      case 'make_proposal':
        await handleMakeProposal({ stopPropagation: () => { } } as React.MouseEvent);
        break;
      default:
        console.warn(`Unknown operation for retry: ${errorState.operation}`);
    }
  }, [errorState.operation, errorState.retryCount, maxRetries, handleMakeProposal]);

  // Memoize button state calculations to prevent unnecessary re-renders
  const isMakeProposalLoading = useMemo(() =>
    loadingState.isLoading && loadingState.operation === 'make_proposal',
    [loadingState.isLoading, loadingState.operation]
  );

  const isMakeProposalDisabled = useMemo(() =>
    !canMakeProposal || isMakeProposalLoading ||
    Boolean(errorState.error && errorState.operation === 'make_proposal' && errorState.retryCount >= maxRetries),
    [canMakeProposal, isMakeProposalLoading, errorState.error, errorState.operation, errorState.retryCount, maxRetries]
  );

  // Enhanced callback validation for BrowserActions
  // Requirements: 8.2, 8.4
  const validateBookingDataBrowser = useCallback((booking: Booking): boolean => {
    try {
      if (!booking || typeof booking !== 'object') {
        console.warn('BrowserActions: Invalid booking data', { booking });
        return false;
      }

      const hasId = Boolean(booking.id);
      const hasStatus = Boolean(booking.status);

      if (!hasId || !hasStatus) {
        console.warn('BrowserActions: Booking data is incomplete', {
          hasId,
          hasStatus,
          booking: { id: booking.id, status: booking.status }
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('BrowserActions: Error validating booking data', { error, booking });
      return false;
    }
  }, []);

  // Memoize event handlers with enhanced error handling
  const handleViewDetails = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();

      // Validate callback availability
      if (!onViewDetails) {
        console.warn('BrowserActions: onViewDetails callback is not provided');
        return;
      }

      if (typeof onViewDetails !== 'function') {
        console.error('BrowserActions: onViewDetails is not a function', { onViewDetails });
        return;
      }

      // Validate booking data before calling callback
      if (!validateBookingDataBrowser(booking)) {
        console.error('BrowserActions: Cannot execute onViewDetails - invalid booking data');
        return;
      }

      // Execute callback with error handling
      onViewDetails(booking);
    } catch (error) {
      console.error('BrowserActions: Error in handleViewDetails', { error, booking });
      // Don't throw - gracefully handle the error
    }
  }, [onViewDetails, booking, validateBookingDataBrowser]);

  // Memoize tooltip and button text
  const makeProposalTooltip = useMemo(() => {
    if (errorState.error && errorState.operation === 'make_proposal') {
      return `Error: ${errorState.error.message}. Click to retry.`;
    }
    if (isMakeProposalLoading) {
      return 'Processing proposal...';
    }
    return isAuction
      ? `Place a bid in this auction${isEndingSoon ? ' - ending soon!' : ''}`
      : 'Make a swap proposal for this booking';
  }, [errorState.error, errorState.operation, isMakeProposalLoading, isAuction, isEndingSoon]);

  const makeProposalButtonText = useMemo(() =>
    isMakeProposalLoading ? 'Processing...' : proposalButtonText,
    [isMakeProposalLoading, proposalButtonText]
  );

  return (
    <div className={styles.actionsContainer}>
      <ResponsiveButton
        variant="outline"
        size="sm"
        onClick={handleViewDetails}
        title="View booking details"
        className={styles.buttonStateTransition}
      >
        View Details
      </ResponsiveButton>

      {canMakeProposal && (
        <>
          <ResponsiveButton
            variant={proposalButtonVariant}
            size="sm"
            onClick={handleMakeProposal}
            disabled={isMakeProposalDisabled}
            loading={isMakeProposalLoading || false}
            title={makeProposalTooltip}
            className={`${styles.buttonStateTransition} ${isMakeProposalLoading ? styles.loadingButton : ''}`}
          >
            {makeProposalButtonText}
          </ResponsiveButton>

          {/* Inline error display for Make Proposal */}
          {showErrorInline && errorState.error && errorState.operation === 'make_proposal' && (
            <ErrorDisplay
              error={errorState.error}
              onRetry={errorState.retryCount < maxRetries ? handleRetry : undefined}
              onDismiss={clearError}
              compact={true}
            />
          )}
        </>
      )}
    </div>
  );
});

BrowserActions.displayName = 'BrowserActions';

export interface ProposerActionsProps {
  booking: Booking;
  swapInfo: SwapInfo;
  onViewProposal?: () => void;
  onEditProposal?: () => Promise<void> | void;
  onWithdrawProposal?: () => Promise<void> | void;
  // Error handling props
  showErrorInline?: boolean;
  maxRetries?: number;
  onError?: (error: Error, operation: string) => void;
}

export const ProposerActions: React.FC<ProposerActionsProps> = memo(({
  swapInfo,
  onViewProposal,
  onEditProposal,
  onWithdrawProposal,
  showErrorInline = true,
  maxRetries = 3,
  onError
}) => {
  // Loading state management
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    operation: null
  });

  // Error state management
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    operation: null,
    retryCount: 0
  });

  // Memoize expensive calculations to prevent unnecessary re-renders
  const proposalStatus = useMemo(() =>
    swapInfo.userProposalStatus,
    [swapInfo.userProposalStatus]
  );

  const isAuction = useMemo(() =>
    swapInfo.acceptanceStrategy === 'auction',
    [swapInfo.acceptanceStrategy]
  );

  const canEdit = useMemo(() =>
    proposalStatus === 'pending' && isAuction,
    [proposalStatus, isAuction]
  );

  const canWithdraw = useMemo(() =>
    proposalStatus === 'pending',
    [proposalStatus]
  );

  // Enhanced error handling with recovery - optimized with useCallback
  const handleError = useCallback((error: Error, operation: string) => {
    console.error(`${operation} failed:`, error);

    setErrorState(prevState => ({
      error,
      operation,
      retryCount: prevState.retryCount + 1
    }));

    setLoadingState({
      isLoading: false,
      operation: null
    });

    // Call external error handler if provided
    onError?.(error, operation);
  }, [onError]);

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      operation: null,
      retryCount: 0
    });
  }, []);

  // Enhanced Edit Proposal handler with error handling and loading states
  const handleEditProposal = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!onEditProposal || loadingState.isLoading) return;

    // Clear previous errors
    clearError();

    // Set loading state
    setLoadingState({
      isLoading: true,
      operation: 'edit_proposal'
    });

    try {
      // Use error recovery service for robust error handling
      const result = await errorRecoveryService.executeWithRecovery(
        () => Promise.resolve(onEditProposal()),
        'edit_proposal',
        {
          maxAttempts: maxRetries,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        }
      );

      if (!result.success && result.error) {
        throw result.error;
      }

      // Success - clear loading state
      setLoadingState({
        isLoading: false,
        operation: null
      });

    } catch (error) {
      handleError(error as Error, 'edit_proposal');
    }
  }, [onEditProposal, maxRetries, clearError, handleError]);

  // Enhanced Withdraw Proposal handler with error handling and loading states
  const handleWithdrawProposal = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!onWithdrawProposal || loadingState.isLoading) return;

    // Clear previous errors
    clearError();

    // Set loading state
    setLoadingState({
      isLoading: true,
      operation: 'withdraw_proposal'
    });

    try {
      // Use error recovery service for robust error handling
      const result = await errorRecoveryService.executeWithRecovery(
        () => Promise.resolve(onWithdrawProposal()),
        'withdraw_proposal',
        {
          maxAttempts: maxRetries,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        }
      );

      if (!result.success && result.error) {
        throw result.error;
      }

      // Success - clear loading state
      setLoadingState({
        isLoading: false,
        operation: null
      });

    } catch (error) {
      handleError(error as Error, 'withdraw_proposal');
    }
  }, [onWithdrawProposal, maxRetries, clearError, handleError]);

  // Retry handler for failed operations
  const handleRetry = useCallback(async () => {
    if (!errorState.operation || errorState.retryCount >= maxRetries) return;

    switch (errorState.operation) {
      case 'edit_proposal':
        await handleEditProposal({ stopPropagation: () => { } } as React.MouseEvent);
        break;
      case 'withdraw_proposal':
        await handleWithdrawProposal({ stopPropagation: () => { } } as React.MouseEvent);
        break;
      default:
        console.warn(`Unknown operation for retry: ${errorState.operation}`);
    }
  }, [errorState.operation, errorState.retryCount, maxRetries, handleEditProposal, handleWithdrawProposal]);

  // Memoize button state calculations to prevent unnecessary re-renders
  const isEditProposalLoading = useMemo(() =>
    loadingState.isLoading && loadingState.operation === 'edit_proposal',
    [loadingState.isLoading, loadingState.operation]
  );

  const isWithdrawProposalLoading = useMemo(() =>
    loadingState.isLoading && loadingState.operation === 'withdraw_proposal',
    [loadingState.isLoading, loadingState.operation]
  );

  const isEditProposalDisabled = useMemo(() =>
    !canEdit || isEditProposalLoading ||
    Boolean(errorState.error && errorState.operation === 'edit_proposal' && errorState.retryCount >= maxRetries),
    [canEdit, isEditProposalLoading, errorState.error, errorState.operation, errorState.retryCount, maxRetries]
  );

  const isWithdrawProposalDisabled = useMemo(() =>
    !canWithdraw || isWithdrawProposalLoading ||
    Boolean(errorState.error && errorState.operation === 'withdraw_proposal' && errorState.retryCount >= maxRetries),
    [canWithdraw, isWithdrawProposalLoading, errorState.error, errorState.operation, errorState.retryCount, maxRetries]
  );

  // Enhanced callback validation for ProposerActions
  // Requirements: 8.2, 8.4
  const validateSwapInfoProposer = useCallback((swapInfo: SwapInfo): boolean => {
    try {
      if (!swapInfo || typeof swapInfo !== 'object') {
        console.warn('ProposerActions: Invalid swapInfo data', { swapInfo });
        return false;
      }

      // Check for essential swap properties
      const hasUserProposalStatus = Boolean(swapInfo.userProposalStatus);
      const hasAcceptanceStrategy = Boolean(swapInfo.acceptanceStrategy);

      if (!hasUserProposalStatus || !hasAcceptanceStrategy) {
        console.warn('ProposerActions: SwapInfo data is incomplete', {
          hasUserProposalStatus,
          hasAcceptanceStrategy,
          swapInfo: {
            userProposalStatus: swapInfo.userProposalStatus,
            acceptanceStrategy: swapInfo.acceptanceStrategy
          }
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('ProposerActions: Error validating swapInfo data', { error, swapInfo });
      return false;
    }
  }, []);

  // Memoize event handlers with enhanced error handling
  const handleViewProposal = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();

      // Validate callback availability
      if (!onViewProposal) {
        console.warn('ProposerActions: onViewProposal callback is not provided');
        return;
      }

      if (typeof onViewProposal !== 'function') {
        console.error('ProposerActions: onViewProposal is not a function', { onViewProposal });
        return;
      }

      // Execute callback with error handling (no data validation needed for view proposal)
      onViewProposal();
    } catch (error) {
      console.error('ProposerActions: Error in handleViewProposal', { error });
      // Don't throw - gracefully handle the error
    }
  }, [onViewProposal]);

  // Memoize tooltip texts
  const editProposalTooltip = useMemo(() => {
    if (errorState.error && errorState.operation === 'edit_proposal') {
      return `Error: ${errorState.error.message}. Click to retry.`;
    }
    if (isEditProposalLoading) {
      return 'Updating bid...';
    }
    return 'Update your bid amount';
  }, [errorState.error, errorState.operation, isEditProposalLoading]);

  const withdrawProposalTooltip = useMemo(() => {
    if (errorState.error && errorState.operation === 'withdraw_proposal') {
      return `Error: ${errorState.error.message}. Click to retry.`;
    }
    if (isWithdrawProposalLoading) {
      return 'Withdrawing proposal...';
    }
    return 'Withdraw your proposal';
  }, [errorState.error, errorState.operation, isWithdrawProposalLoading]);

  const editProposalButtonText = useMemo(() =>
    isEditProposalLoading ? 'Updating...' : 'Update Bid',
    [isEditProposalLoading]
  );

  const withdrawProposalButtonText = useMemo(() =>
    isWithdrawProposalLoading ? 'Withdrawing...' : 'Withdraw',
    [isWithdrawProposalLoading]
  );

  return (
    <div className={styles.actionsContainer}>
      <ResponsiveButton
        variant="outline"
        size="sm"
        onClick={handleViewProposal}
        title="View your proposal details"
        className={styles.buttonStateTransition}
      >
        View Proposal
      </ResponsiveButton>

      {canEdit && (
        <>
          <ResponsiveButton
            variant="secondary"
            size="sm"
            onClick={handleEditProposal}
            disabled={isEditProposalDisabled}
            loading={isEditProposalLoading || false}
            title={editProposalTooltip}
            className={`${styles.buttonStateTransition} ${isEditProposalLoading ? styles.loadingButton : ''}`}
          >
            {editProposalButtonText}
          </ResponsiveButton>

          {/* Inline error display for Edit Proposal */}
          {showErrorInline && errorState.error && errorState.operation === 'edit_proposal' && (
            <ErrorDisplay
              error={errorState.error}
              onRetry={errorState.retryCount < maxRetries ? handleRetry : undefined}
              onDismiss={clearError}
              compact={true}
            />
          )}
        </>
      )}

      {canWithdraw && (
        <>
          <ResponsiveButton
            variant="outline"
            size="sm"
            onClick={handleWithdrawProposal}
            disabled={isWithdrawProposalDisabled}
            loading={isWithdrawProposalLoading || false}
            title={withdrawProposalTooltip}
            className={`${styles.buttonStateTransition} ${isWithdrawProposalLoading ? styles.loadingButton : ''}`}
          >
            {withdrawProposalButtonText}
          </ResponsiveButton>

          {/* Inline error display for Withdraw Proposal */}
          {showErrorInline && errorState.error && errorState.operation === 'withdraw_proposal' && (
            <ErrorDisplay
              error={errorState.error}
              onRetry={errorState.retryCount < maxRetries ? handleRetry : undefined}
              onDismiss={clearError}
              compact={true}
            />
          )}
        </>
      )}
    </div>
  );
});

ProposerActions.displayName = 'ProposerActions';