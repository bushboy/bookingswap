import React, { useState, useEffect, useRef } from 'react';
import { tokens } from '@/design-system/tokens';
import { useResponsive, useTouch } from '@/hooks/useResponsive';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BookingWithSwapInfo, InlineProposalData, Booking } from '@booking-swap/shared';
import { 
  validateInlineProposal, 
  getAvailableProposalTypes,
  InlineProposalValidationErrors 
} from '@/utils/inlineProposalValidation';

interface MobileProposalFormProps {
  booking: BookingWithSwapInfo;
  onSubmit: (proposal: InlineProposalData) => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
  userBookings: Booking[];
  loading?: boolean;
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  maxHeight?: string;
}

// BottomSheet Component for mobile modal presentation
const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  maxHeight = '90vh'
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
      // Add safe area padding for iOS
      document.body.style.paddingBottom = 'env(safe-area-inset-bottom)';
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingBottom = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingBottom = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentTranslateY(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragStartY;
    
    // Only allow downward dragging
    if (deltaY > 0) {
      setCurrentTranslateY(deltaY);
      
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // If dragged down more than 100px, close the sheet
    if (currentTranslateY > 100) {
      onClose();
    } else {
      // Snap back to original position
      if (sheetRef.current) {
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
    
    setCurrentTranslateY(0);
  };

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
  };

  const sheetStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.colors.neutral[50],
    borderTopLeftRadius: tokens.borderRadius['2xl'],
    borderTopRightRadius: tokens.borderRadius['2xl'],
    maxHeight,
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
    display: 'flex',
    flexDirection: 'column',
    // Safe area support
    paddingBottom: 'env(safe-area-inset-bottom)',
  };

  const handleStyles: React.CSSProperties = {
    width: '40px',
    height: '4px',
    backgroundColor: tokens.colors.neutral[300],
    borderRadius: tokens.borderRadius.full,
    margin: `${tokens.spacing[3]} auto ${tokens.spacing[2]}`,
    cursor: 'grab',
  };

  const headerStyles: React.CSSProperties = {
    padding: `0 ${tokens.spacing[6]} ${tokens.spacing[4]}`,
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    backgroundColor: tokens.colors.white,
    borderTopLeftRadius: tokens.borderRadius['2xl'],
    borderTopRightRadius: tokens.borderRadius['2xl'],
  };

  const titleStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    margin: 0,
    textAlign: 'center',
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    backgroundColor: tokens.colors.white,
    // Enable momentum scrolling on iOS
    WebkitOverflowScrolling: 'touch',
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div
        ref={sheetRef}
        style={sheetStyles}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div style={handleStyles} />
        <div style={headerStyles}>
          <h3 style={titleStyles}>{title}</h3>
        </div>
        <div ref={contentRef} style={contentStyles}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Touch-friendly proposal type selector
const MobileProposalTypeSelector: React.FC<{
  selected: 'booking' | 'cash';
  onChange: (type: 'booking' | 'cash') => void;
  options: Array<{ value: 'booking' | 'cash'; label: string; disabled: boolean }>;
}> = ({ selected, onChange, options }) => {
  const buttonStyles = (isSelected: boolean, isDisabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: `${tokens.spacing[4]} ${tokens.spacing[3]}`,
    borderRadius: tokens.borderRadius.lg,
    border: `2px solid ${isSelected ? tokens.colors.primary[500] : tokens.colors.neutral[300]}`,
    backgroundColor: isSelected ? tokens.colors.primary[50] : tokens.colors.white,
    color: isDisabled ? tokens.colors.neutral[400] : isSelected ? tokens.colors.primary[700] : tokens.colors.neutral[700],
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'all 0.2s ease-in-out',
    // Touch-friendly minimum size
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  });

  return (
    <div style={{ padding: `0 ${tokens.spacing[6]}` }}>
      <label style={{
        display: 'block',
        fontSize: tokens.typography.fontSize.base,
        fontWeight: tokens.typography.fontWeight.medium,
        color: tokens.colors.neutral[900],
        marginBottom: tokens.spacing[3],
      }}>
        How would you like to propose?
      </label>
      <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            style={buttonStyles(selected === option.value, option.disabled)}
            onClick={() => !option.disabled && onChange(option.value)}
            disabled={option.disabled}
          >
            <div>
              <div style={{ fontSize: tokens.typography.fontSize.lg, marginBottom: tokens.spacing[1] }}>
                {option.value === 'booking' ? '🔄' : '💰'}
              </div>
              <div>{option.label}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Mobile-optimized booking selector with large touch targets
const MobileBookingSelector: React.FC<{
  bookings: Booking[];
  selected: string;
  onChange: (bookingId: string) => void;
  loading?: boolean;
  error?: string;
}> = ({ bookings, selected, onChange, loading, error }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const containerStyles: React.CSSProperties = {
    padding: `0 ${tokens.spacing[6]}`,
  };

  const labelStyles: React.CSSProperties = {
    display: 'block',
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[3],
  };

  const selectorStyles: React.CSSProperties = {
    width: '100%',
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.lg,
    border: `2px solid ${error ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
    backgroundColor: tokens.colors.white,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[900],
    cursor: 'pointer',
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const optionStyles: React.CSSProperties = {
    padding: tokens.spacing[4],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    cursor: 'pointer',
    minHeight: '64px',
    display: 'flex',
    alignItems: 'center',
  };

  const selectedBooking = bookings.find(b => b.id === selected);

  if (loading) {
    return (
      <div style={containerStyles}>
        <label style={labelStyles}>Select Your Booking</label>
        <div style={{ ...selectorStyles, color: tokens.colors.neutral[500] }}>
          Loading your bookings...
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div style={containerStyles}>
        <label style={labelStyles}>Select Your Booking</label>
        <div style={{ ...selectorStyles, color: tokens.colors.neutral[500] }}>
          No available bookings found
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>Select Your Booking</label>
      
      <div style={{ position: 'relative' }}>
        <div
          style={selectorStyles}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>
            {selectedBooking ? (
              <div>
                <div style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                  {selectedBooking.title}
                </div>
                <div style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[600] }}>
                  {selectedBooking.location?.city || 'Unknown'}, {selectedBooking.location?.country || 'Unknown'}
                </div>
              </div>
            ) : (
              'Choose a booking to swap...'
            )}
          </span>
          <span style={{ fontSize: tokens.typography.fontSize.lg }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>

        {isExpanded && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: tokens.colors.white,
            border: `2px solid ${tokens.colors.neutral[300]}`,
            borderTop: 'none',
            borderBottomLeftRadius: tokens.borderRadius.lg,
            borderBottomRightRadius: tokens.borderRadius.lg,
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 10,
          }}>
            {bookings.map((booking) => (
              <div
                key={booking.id}
                style={{
                  ...optionStyles,
                  backgroundColor: selected === booking.id ? tokens.colors.primary[50] : 'transparent',
                }}
                onClick={() => {
                  onChange(booking.id);
                  setIsExpanded(false);
                }}
              >
                <div>
                  <div style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                    {booking.title}
                  </div>
                  <div style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[600] }}>
                    {booking.location?.city || 'Unknown'}, {booking.location?.country || 'Unknown'} • {booking.dateRange?.checkIn ? new Date(booking.dateRange.checkIn).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: tokens.spacing[2],
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.error[600],
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// Mobile cash input with large touch targets
const MobileCashInput: React.FC<{
  amount: number;
  onChange: (amount: number) => void;
  minAmount: number;
  maxAmount?: number;
  currency: string;
  error?: string;
}> = ({ amount, onChange, minAmount, maxAmount, currency, error }) => {
  const [displayValue, setDisplayValue] = useState(amount.toString());

  const handleChange = (value: string) => {
    setDisplayValue(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      onChange(numValue);
    } else if (value === '') {
      onChange(0);
    }
  };

  const containerStyles: React.CSSProperties = {
    padding: `0 ${tokens.spacing[6]}`,
  };

  const labelStyles: React.CSSProperties = {
    display: 'block',
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[3],
  };

  const inputContainerStyles: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const currencyStyles: React.CSSProperties = {
    position: 'absolute',
    left: tokens.spacing[4],
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[600],
    zIndex: 1,
  };

  const inputStyles: React.CSSProperties = {
    width: '100%',
    padding: `${tokens.spacing[4]} ${tokens.spacing[4]} ${tokens.spacing[4]} ${tokens.spacing[10]}`,
    borderRadius: tokens.borderRadius.lg,
    border: `2px solid ${error ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
    backgroundColor: tokens.colors.white,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    minHeight: '56px',
    // Prevent zoom on iOS
    fontSize: '16px',
  };

  const helperStyles: React.CSSProperties = {
    marginTop: tokens.spacing[2],
    fontSize: tokens.typography.fontSize.sm,
    color: error ? tokens.colors.error[600] : tokens.colors.neutral[600],
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>Cash Offer Amount</label>
      <div style={inputContainerStyles}>
        <span style={currencyStyles}>{currency}$</span>
        <input
          type="number"
          inputMode="decimal"
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          style={inputStyles}
          min={minAmount}
          max={maxAmount}
          step="0.01"
          placeholder={`${minAmount}.00`}
        />
      </div>
      <div style={helperStyles}>
        {error || (maxAmount 
          ? `Range: ${currency}$${minAmount} - ${currency}$${maxAmount}`
          : `Minimum: ${currency}$${minAmount}`
        )}
      </div>
    </div>
  );
};

// Mobile message input
const MobileMessageInput: React.FC<{
  value: string;
  onChange: (message: string) => void;
  maxLength?: number;
  error?: string;
}> = ({ value, onChange, maxLength = 500, error }) => {
  const containerStyles: React.CSSProperties = {
    padding: `0 ${tokens.spacing[6]}`,
  };

  const labelStyles: React.CSSProperties = {
    display: 'block',
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[3],
  };

  const textareaStyles: React.CSSProperties = {
    width: '100%',
    minHeight: '100px',
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.lg,
    border: `2px solid ${error ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
    backgroundColor: tokens.colors.white,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[900],
    resize: 'none',
    fontFamily: 'inherit',
    // Prevent zoom on iOS
    fontSize: '16px',
  };

  const counterStyles: React.CSSProperties = {
    marginTop: tokens.spacing[2],
    fontSize: tokens.typography.fontSize.sm,
    color: value.length > maxLength * 0.9 ? tokens.colors.warning[600] : tokens.colors.neutral[500],
    textAlign: 'right',
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>Message (Optional)</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={textareaStyles}
        placeholder="Add a message to your proposal..."
        maxLength={maxLength}
      />
      <div style={counterStyles}>
        {value.length}/{maxLength}
      </div>
      {error && (
        <div style={{
          marginTop: tokens.spacing[1],
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.error[600],
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// Main MobileProposalForm component
export const MobileProposalForm: React.FC<MobileProposalFormProps> = ({
  booking,
  onSubmit,
  onCancel,
  isOpen,
  userBookings,
  loading = false,
}) => {
  const { isMobile } = useResponsive();
  const isTouch = useTouch();
  
  const [proposalType, setProposalType] = useState<'booking' | 'cash'>('booking');
  const [selectedBooking, setSelectedBooking] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<number>(booking.swapInfo?.minCashAmount || 0);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<InlineProposalValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine available proposal options
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
      setIsSubmitting(true);
      
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
      setIsSubmitting(false);
    }
  };

  const isValidProposal = () => {
    if (proposalType === 'booking') {
      return selectedBooking.length > 0;
    }
    if (proposalType === 'cash') {
      return cashAmount >= (booking.swapInfo?.minCashAmount || 0);
    }
    return false;
  };

  // Use regular modal on desktop, bottom sheet on mobile
  if (!isMobile) {
    return null; // Fall back to regular InlineProposalForm on desktop
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onCancel}
      title="Make a Proposal"
      maxHeight="85vh"
    >
      <div style={{ paddingBottom: tokens.spacing[6] }}>
        {/* Booking info header */}
        <div style={{
          padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
          backgroundColor: tokens.colors.neutral[50],
          borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
        }}>
          <div style={{
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.neutral[900],
            marginBottom: tokens.spacing[1],
          }}>
            {booking.title}
          </div>
          <div style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
          }}>
            {booking.location?.city || 'Unknown'}, {booking.location?.country || 'Unknown'} • ${booking.swapValue.toLocaleString()}
          </div>
        </div>

        <div style={{ paddingTop: tokens.spacing[6], display: 'flex', flexDirection: 'column', gap: tokens.spacing[6] }}>
          {/* Proposal type selector */}
          {proposalOptions.length > 1 && (
            <MobileProposalTypeSelector
              selected={proposalType}
              onChange={setProposalType}
              options={proposalOptions}
            />
          )}

          {/* Booking selector */}
          {proposalType === 'booking' && (
            <MobileBookingSelector
              bookings={userBookings}
              selected={selectedBooking}
              onChange={setSelectedBooking}
              loading={loading}
              error={errors.selectedBooking}
            />
          )}

          {/* Cash input */}
          {proposalType === 'cash' && (
            <MobileCashInput
              amount={cashAmount}
              onChange={setCashAmount}
              minAmount={booking.swapInfo?.minCashAmount || 0}
              maxAmount={booking.swapInfo?.maxCashAmount}
              currency="$"
              error={errors.cashAmount}
            />
          )}

          {/* Message input */}
          <MobileMessageInput
            value={message}
            onChange={setMessage}
            error={errors.message}
          />

          {/* Error display */}
          {(errors.general || errors.submit) && (
            <div style={{
              margin: `0 ${tokens.spacing[6]}`,
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.error[50],
              border: `1px solid ${tokens.colors.error[200]}`,
              borderRadius: tokens.borderRadius.lg,
              color: tokens.colors.error[700],
              fontSize: tokens.typography.fontSize.sm,
            }}>
              {errors.general || errors.submit}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{
          position: 'sticky',
          bottom: 0,
          padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
          backgroundColor: tokens.colors.white,
          borderTop: `1px solid ${tokens.colors.neutral[200]}`,
          display: 'flex',
          gap: tokens.spacing[3],
        }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              flex: 1,
              minHeight: '48px',
              fontSize: tokens.typography.fontSize.base,
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || !isValidProposal()}
            style={{
              flex: 2,
              minHeight: '48px',
              fontSize: tokens.typography.fontSize.base,
            }}
          >
            Send Proposal
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};