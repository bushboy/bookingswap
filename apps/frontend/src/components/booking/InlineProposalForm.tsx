import React, { useState, useEffect } from 'react';
import { tokens } from '@/design-system/tokens';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BookingWithSwapInfo, InlineProposalData, Booking } from '@booking-swap/shared';
import { bookingService } from '@/services/bookingService';
import { useAuth } from '@/contexts/AuthContext';
import { 
  validateInlineProposal, 
  getAvailableProposalTypes,
  canMakeProposal,
  InlineProposalValidationErrors 
} from '@/utils/inlineProposalValidation';
import { 
  useInlineProposalAccessibility, 
  useProposalTypeSelectorAccessibility,
  useSwapFormField,
  useSwapHighContrast 
} from '@/hooks/useSwapAccessibility';

interface InlineProposalFormProps {
  booking: BookingWithSwapInfo;
  onSubmit: (proposal: InlineProposalData) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

interface ProposalTypeSelectorProps {
  selected: 'booking' | 'cash';
  onChange: (type: 'booking' | 'cash') => void;
  options: Array<{
    value: 'booking' | 'cash';
    label: string;
    disabled: boolean;
  }>;
}

interface BookingSelectorProps {
  bookings: Booking[];
  selected: string;
  onChange: (bookingId: string) => void;
  targetBooking: BookingWithSwapInfo;
  loading?: boolean;
  error?: string;
}

interface CashOfferInputProps {
  amount: number;
  onChange: (amount: number) => void;
  minAmount: number;
  maxAmount?: number;
  currency: string;
  error?: string;
}

interface MessageInputProps {
  value: string;
  onChange: (message: string) => void;
  placeholder?: string;
  maxLength?: number;
  error?: string;
}

// ProposalTypeSelector Component
const ProposalTypeSelector: React.FC<ProposalTypeSelectorProps> = ({
  selected,
  onChange,
  options,
}) => {
  const { getGroupProps, getOptionProps } = useProposalTypeSelectorAccessibility(
    options,
    selected,
    onChange
  );
  const { getInteractiveStyles } = useSwapHighContrast();
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[3],
  };

  const labelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
    marginBottom: tokens.spacing[2],
  };

  const optionsStyles = {
    display: 'flex',
    gap: tokens.spacing[3],
  };

  const optionStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    padding: tokens.spacing[3],
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    flex: 1,
  };

  const selectedOptionStyles = {
    ...optionStyles,
    border: `1px solid ${tokens.colors.primary[500]}`,
    backgroundColor: tokens.colors.primary[50],
  };

  const disabledOptionStyles = {
    ...optionStyles,
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: tokens.colors.neutral[50],
  };

  const radioStyles = {
    width: '16px',
    height: '16px',
    accentColor: tokens.colors.primary[600],
  };

  const optionLabelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles} id="proposal-type-label">Proposal Type</label>
      <div style={optionsStyles} {...getGroupProps()} aria-labelledby="proposal-type-label">
        {options.map((option, index) => (
          <div
            key={option.value}
            style={getInteractiveStyles(
              option.disabled
                ? disabledOptionStyles
                : selected === option.value
                ? selectedOptionStyles
                : optionStyles
            )}
            {...getOptionProps(option, index)}
          >
            <input
              type="radio"
              checked={selected === option.value}
              onChange={() => !option.disabled && onChange(option.value)}
              style={radioStyles}
              disabled={option.disabled}
              id={`proposal-type-${option.value}`}
              name="proposal-type"
              aria-describedby={option.disabled ? `${option.value}-disabled-reason` : undefined}
            />
            <label htmlFor={`proposal-type-${option.value}`} style={optionLabelStyles}>
              {option.label}
            </label>
            {option.disabled && (
              <div id={`${option.value}-disabled-reason`} className="sr-only">
                {option.value === 'booking' 
                  ? 'No available bookings to offer in exchange'
                  : 'Cash offers not accepted for this booking'
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// BookingSelector Component
const BookingSelector: React.FC<BookingSelectorProps> = ({
  bookings,
  selected,
  onChange,
  targetBooking,
  loading,
  error,
}) => {
  const { getFieldProps, getLabelProps, getErrorProps } = useSwapFormField(
    'booking-selector',
    'Select Your Booking',
    error,
    'Choose one of your available bookings to offer in exchange',
    true
  );
  const { getInteractiveStyles } = useSwapHighContrast();
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[2],
  };

  const labelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
  };

  const selectStyles = {
    width: '100%',
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.fontSize.base,
    border: `1px solid ${error ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    color: tokens.colors.neutral[900],
    outline: 'none',
    transition: 'all 0.2s ease-in-out',
  };

  const errorStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[600],
  };

  const helperTextStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[500],
  };

  if (loading) {
    return (
      <div style={containerStyles}>
        <label style={labelStyles}>Select Your Booking</label>
        <div style={{ ...selectStyles, color: tokens.colors.neutral[500] }}>
          Loading your bookings...
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div style={containerStyles}>
        <label style={labelStyles}>Select Your Booking</label>
        <div style={{ ...selectStyles, color: tokens.colors.neutral[500] }}>
          No available bookings found
        </div>
        <div style={helperTextStyles}>
          You need an available booking to propose a swap
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      <label style={labelStyles} {...getLabelProps()}>Select Your Booking</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        style={getInteractiveStyles(selectStyles)}
        {...getFieldProps()}
        aria-describedby={`${getFieldProps().id}-help`}
      >
        <option value="">Choose a booking to swap...</option>
        {bookings.map((booking) => (
          <option key={booking.id} value={booking.id}>
            {booking.title} - {booking.location?.city || 'Unknown'}, {booking.location?.country || 'Unknown'} 
            ({booking.dateRange?.checkIn ? new Date(booking.dateRange.checkIn).toLocaleDateString() : 'Unknown'})
          </option>
        ))}
      </select>
      {error && <div style={errorStyles} {...getErrorProps()}>{error}</div>}
      <div id={`${getFieldProps().id}-help`} style={helperTextStyles}>
        Choose one of your available bookings to offer in exchange
      </div>
    </div>
  );
};

// CashOfferInput Component
const CashOfferInput: React.FC<CashOfferInputProps> = ({
  amount,
  onChange,
  minAmount,
  maxAmount,
  currency,
  error,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      onChange(value);
    } else if (e.target.value === '') {
      onChange(0);
    }
  };

  const getValidationError = (): string | undefined => {
    if (error) return error;
    
    if (amount < minAmount) {
      return `Amount must be at least ${currency}${minAmount}`;
    }
    if (maxAmount && amount > maxAmount) {
      return `Amount must not exceed ${currency}${maxAmount}`;
    }
    
    return undefined;
  };

  const validationError = getValidationError();
  const helperText = maxAmount 
    ? `Range: ${currency}${minAmount} - ${currency}${maxAmount}`
    : `Minimum: ${currency}${minAmount}`;

  return (
    <Input
      label="Cash Offer Amount"
      type="number"
      min={minAmount}
      max={maxAmount}
      step="0.01"
      value={amount || ''}
      onChange={handleChange}
      error={validationError}
      helperText={!validationError ? helperText : undefined}
      placeholder={`${minAmount}.00`}
      leftIcon={<span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[500] }}>{currency}$</span>}
    />
  );
};

// MessageInput Component
const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  placeholder = "Add a message to your proposal (optional)",
  maxLength = 500,
  error,
}) => {
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[2],
  };

  const labelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
  };

  const textareaStyles = {
    width: '100%',
    minHeight: '80px',
    padding: tokens.spacing[3],
    fontSize: tokens.typography.fontSize.base,
    border: `1px solid ${error ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    color: tokens.colors.neutral[900],
    outline: 'none',
    transition: 'all 0.2s ease-in-out',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  };

  const counterStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: value.length > maxLength * 0.9 ? tokens.colors.warning[600] : tokens.colors.neutral[500],
    textAlign: 'right' as const,
  };

  const errorStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[600],
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>Message</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={textareaStyles}
        onFocus={(e) => {
          e.target.style.borderColor = error ? tokens.colors.error[500] : tokens.colors.primary[500];
          e.target.style.boxShadow = `0 0 0 3px ${error ? tokens.colors.error[200] : tokens.colors.primary[200]}`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? tokens.colors.error[300] : tokens.colors.neutral[300];
          e.target.style.boxShadow = 'none';
        }}
      />
      <div style={counterStyles}>
        {value.length}/{maxLength}
      </div>
      {error && <div style={errorStyles}>{error}</div>}
    </div>
  );
};

// Main InlineProposalForm Component
export const InlineProposalForm: React.FC<InlineProposalFormProps> = ({
  booking,
  onSubmit,
  onCancel,
  className,
}) => {
  const { token } = useAuth();
  const [proposalType, setProposalType] = useState<'booking' | 'cash'>('booking');
  const [selectedBooking, setSelectedBooking] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<number>(booking.swapInfo?.minCashAmount || 0);
  const [message, setMessage] = useState('');
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [errors, setErrors] = useState<InlineProposalValidationErrors>({});

  // Accessibility hooks
  const { getFormProps, getTitleProps } = useInlineProposalAccessibility(
    true,
    onCancel,
    booking.title
  );
  const { getInteractiveStyles } = useSwapHighContrast();

  // Fetch user's available bookings
  useEffect(() => {
    const fetchUserBookings = async () => {
      if (!token) return;
      
      try {
        setLoadingBookings(true);
        const bookings = await bookingService.getAvailableBookings({
          status: ['available'],
        });
        
        // Filter out the current booking and only include user's own bookings
        const availableBookings = bookings.filter(b => 
          b.id !== booking.id && b.status === 'available'
        );
        
        setUserBookings(availableBookings);
      } catch (error) {
        console.error('Error fetching user bookings:', error);
        setErrors(prev => ({ ...prev, bookings: 'Failed to load your bookings' }));
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchUserBookings();
  }, [token, booking.id]);

  // Determine available proposal options using utility
  const proposalOptions = getAvailableProposalTypes(booking, userBookings.length > 0).map(option => ({
    value: option.type,
    label: option.label,
    disabled: option.disabled,
  }));

  // Set default proposal type based on available options
  useEffect(() => {
    const availableOptions = proposalOptions.filter(option => !option.disabled);
    if (availableOptions.length > 0) {
      setProposalType(availableOptions[0].value);
    }
  }, [proposalOptions]);

  const validateProposal = (): boolean => {
    const proposalData: InlineProposalData = {
      type: proposalType,
      selectedBookingId: proposalType === 'booking' ? selectedBooking : undefined,
      cashAmount: proposalType === 'cash' ? cashAmount : undefined,
      message: message.trim() || undefined,
    };

    const availableBookingIds = userBookings.map(b => b.id);
    const validationErrors = validateInlineProposal(proposalData, booking, availableBookingIds);
    
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateProposal()) return;

    try {
      setLoading(true);
      
      const proposalData: InlineProposalData = {
        type: proposalType,
        selectedBookingId: proposalType === 'booking' ? selectedBooking : undefined,
        cashAmount: proposalType === 'cash' ? cashAmount : undefined,
        message: message.trim() || undefined,
      };

      await onSubmit(proposalData);
    } catch (error) {
      console.error('Error submitting proposal:', error);
      setErrors(prev => ({ 
        ...prev, 
        submit: error instanceof Error ? error.message : 'Failed to submit proposal' 
      }));
    } finally {
      setLoading(false);
    }
  };

  const containerStyles = {
    backgroundColor: 'white',
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing[6],
    marginTop: tokens.spacing[4],
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing[6],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const formStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[5],
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[3],
    justifyContent: 'flex-end',
    marginTop: tokens.spacing[6],
    paddingTop: tokens.spacing[4],
    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const errorMessageStyles = {
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.error[50],
    border: `1px solid ${tokens.colors.error[200]}`,
    borderRadius: tokens.borderRadius.md,
    color: tokens.colors.error[700],
    fontSize: tokens.typography.fontSize.sm,
  };

  return (
    <div style={getInteractiveStyles(containerStyles)} className={className} {...getFormProps()}>
      <div style={headerStyles}>
        <h4 style={titleStyles} {...getTitleProps()}>Make a Proposal</h4>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onCancel}
          aria-label="Close proposal form"
          data-testid="cancel-proposal"
        >
          ✕
        </Button>
      </div>

      <div style={formStyles}>
        {(canMakeBookingProposal || canMakeCashProposal) && (
          <ProposalTypeSelector
            selected={proposalType}
            onChange={setProposalType}
            options={proposalOptions}
          />
        )}

        {proposalType === 'booking' && (
          <BookingSelector
            bookings={userBookings}
            selected={selectedBooking}
            onChange={setSelectedBooking}
            targetBooking={booking}
            loading={loadingBookings}
            error={errors.selectedBooking}
          />
        )}

        {proposalType === 'cash' && (
          <CashOfferInput
            amount={cashAmount}
            onChange={setCashAmount}
            minAmount={booking.swapInfo?.minCashAmount || 0}
            maxAmount={booking.swapInfo?.maxCashAmount}
            currency="$"
            error={errors.cashAmount}
          />
        )}

        <MessageInput
          value={message}
          onChange={setMessage}
          error={errors.message}
        />

        {(errors.general || errors.submit) && (
          <div style={errorMessageStyles}>
            {errors.general || errors.submit}
          </div>
        )}
      </div>

      <div style={actionsStyles}>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit}
          loading={loading}
          disabled={
            loading ||
            (proposalType === 'booking' && !selectedBooking) ||
            (proposalType === 'cash' && cashAmount < (booking.swapInfo?.minCashAmount || 0))
          }
        >
          Send Proposal
        </Button>
      </div>
    </div>
  );
};