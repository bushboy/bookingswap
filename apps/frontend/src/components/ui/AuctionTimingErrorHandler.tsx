import React from 'react';
import { ErrorDisplay, GracefulDegradation } from './ErrorDisplay';
import { Button } from './Button';
import { tokens } from '@/design-system/tokens';
import { TimingError, ERROR_CODES } from '@booking-swap/shared';
import { createAuctionFallbackStrategy } from '@/utils/errorHandling';

interface AuctionTimingErrorHandlerProps {
  error: TimingError;
  eventDate: Date;
  onSwitchToFirstMatch: () => void;
  onAdjustEndDate?: (newDate: Date) => void;
  onDismiss?: () => void;
  className?: string;
}

export const AuctionTimingErrorHandler: React.FC<
  AuctionTimingErrorHandlerProps
> = ({
  error,
  eventDate,
  onSwitchToFirstMatch,
  onAdjustEndDate,
  onDismiss,
  className = '',
}) => {
  const fallbackStrategy = createAuctionFallbackStrategy(eventDate);

  const handleAction = (action: string) => {
    switch (action) {
      case 'switch_to_first_match':
        onSwitchToFirstMatch();
        break;
      case 'adjust_end_date':
        if (onAdjustEndDate && fallbackStrategy.maxAuctionEndDate) {
          onAdjustEndDate(fallbackStrategy.maxAuctionEndDate);
        }
        break;
      case 'dismiss':
        onDismiss?.();
        break;
    }
  };

  // For last-minute bookings, show graceful degradation instead of error
  if (error.code === ERROR_CODES.LAST_MINUTE_RESTRICTION) {
    return (
      <GracefulDegradation
        className={className}
        title="Auction Mode Unavailable"
        message={`Your event is on ${eventDate.toLocaleDateString()}, which is less than one week away.`}
        explanation="For events happening soon, we use first-match acceptance to ensure quick processing and successful booking transfers."
        fallbackAction={{
          label: 'Use First-Match Mode',
          onClick: () => handleAction('switch_to_first_match'),
        }}
      />
    );
  }

  // For auction timing issues, show error with adjustment options
  if (error.code === ERROR_CODES.AUCTION_TOO_CLOSE_TO_EVENT) {
    return (
      <div className={className}>
        <ErrorDisplay
          error={error}
          onAction={handleAction}
          onDismiss={onDismiss}
        />

        {fallbackStrategy.maxAuctionEndDate && (
          <div
            style={{
              marginTop: tokens.spacing[3],
              padding: tokens.spacing[3],
              backgroundColor: tokens.colors.primary[50],
              border: `1px solid ${tokens.colors.primary[200]}`,
              borderRadius: tokens.borderRadius.sm,
            }}
          >
            <h4
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.primary[800],
                margin: `0 0 ${tokens.spacing[2]} 0`,
              }}
            >
              💡 Quick Fix
            </h4>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[700],
                margin: `0 0 ${tokens.spacing[2]} 0`,
              }}
            >
              Set your auction end date before{' '}
              {fallbackStrategy.maxAuctionEndDate.toLocaleDateString()}
              to comply with the one-week requirement.
            </p>
            {onAdjustEndDate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('adjust_end_date')}
              >
                Set Maximum Date
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default error display for other timing errors
  return (
    <ErrorDisplay
      className={className}
      error={error}
      onAction={handleAction}
      onDismiss={onDismiss}
    />
  );
};

interface PaymentErrorHandlerProps {
  error: Error;
  onFallbackToBooking?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const PaymentErrorHandler: React.FC<PaymentErrorHandlerProps> = ({
  error,
  onFallbackToBooking,
  onRetry,
  onDismiss,
  className = '',
}) => {
  const handleAction = (action: string) => {
    switch (action) {
      case 'make_booking_proposal':
        onFallbackToBooking?.();
        break;
      case 'retry':
        onRetry?.();
        break;
      case 'dismiss':
        onDismiss?.();
        break;
    }
  };

  return (
    <div className={className}>
      <ErrorDisplay
        error={error}
        onAction={handleAction}
        onDismiss={onDismiss}
      />

      {onFallbackToBooking && (
        <div
          style={{
            marginTop: tokens.spacing[3],
            padding: tokens.spacing[3],
            backgroundColor: tokens.colors.green[50],
            border: `1px solid ${tokens.colors.green[200]}`,
            borderRadius: tokens.borderRadius.sm,
          }}
        >
          <h4
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.green[800],
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}
          >
            💡 Alternative Option
          </h4>
          <p
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.green[700],
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}
          >
            You can still participate in this swap by making a booking exchange
            proposal instead of a cash offer.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('make_booking_proposal')}
          >
            Make Booking Proposal
          </Button>
        </div>
      )}
    </div>
  );
};

interface ValidationErrorSummaryProps {
  errors: Record<string, string[]>;
  warnings?: Record<string, string[]>;
  onFieldFocus?: (fieldName: string) => void;
  onFixAll?: () => void;
  className?: string;
}

export const ValidationErrorSummary: React.FC<ValidationErrorSummaryProps> = ({
  errors,
  warnings = {},
  onFieldFocus,
  onFixAll,
  className = '',
}) => {
  const errorFields = Object.keys(errors).filter(
    field => errors[field].length > 0
  );
  const warningFields = Object.keys(warnings).filter(
    field => warnings[field].length > 0
  );
  const totalIssues = errorFields.length + warningFields.length;

  if (totalIssues === 0) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.warning[50],
        border: `1px solid ${tokens.colors.warning[200]}`,
        borderRadius: tokens.borderRadius.md,
        marginBottom: tokens.spacing[4],
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: tokens.spacing[3],
        }}
      >
        <h4
          style={{
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.warning[800],
            margin: 0,
          }}
        >
          ⚠️ {totalIssues} issue{totalIssues > 1 ? 's' : ''} need
          {totalIssues === 1 ? 's' : ''} attention
        </h4>

        {onFixAll && (
          <Button variant="outline" size="sm" onClick={onFixAll}>
            Fix All
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gap: tokens.spacing[2] }}>
        {errorFields.map(field => (
          <div
            key={field}
            style={{
              padding: tokens.spacing[2],
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: tokens.borderRadius.sm,
              borderLeft: `3px solid ${tokens.colors.error[400]}`,
            }}
          >
            <button
              onClick={() => onFieldFocus?.(field)}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.colors.error[700],
                cursor: 'pointer',
                fontSize: tokens.typography.fontSize.sm,
                textAlign: 'left',
                padding: 0,
                width: '100%',
              }}
            >
              <strong>{field}:</strong> {errors[field].join(', ')}
            </button>
          </div>
        ))}

        {warningFields.map(field => (
          <div
            key={field}
            style={{
              padding: tokens.spacing[2],
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: tokens.borderRadius.sm,
              borderLeft: `3px solid ${tokens.colors.warning[400]}`,
            }}
          >
            <button
              onClick={() => onFieldFocus?.(field)}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.colors.warning[700],
                cursor: 'pointer',
                fontSize: tokens.typography.fontSize.sm,
                textAlign: 'left',
                padding: 0,
                width: '100%',
              }}
            >
              ⚠️ <strong>{field}:</strong> {warnings[field].join(', ')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
