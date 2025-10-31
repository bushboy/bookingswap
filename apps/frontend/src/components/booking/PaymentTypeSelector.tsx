import React from 'react';
import { tokens } from '@/design-system/tokens';

interface PaymentTypeSelectorProps {
  selected: ('booking' | 'cash')[];
  onChange: (types: ('booking' | 'cash')[]) => void;
  error?: string;
}

export const PaymentTypeSelector: React.FC<PaymentTypeSelectorProps> = ({
  selected,
  onChange,
  error,
}) => {
  const handleToggle = (type: 'booking' | 'cash') => {
    if (selected.includes(type)) {
      // Don't allow removing the last payment type
      if (selected.length > 1) {
        onChange(selected.filter(t => t !== type));
      }
    } else {
      onChange([...selected, type]);
    }
  };

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
    gap: tokens.spacing[4],
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
    minWidth: '140px',
  };

  const selectedOptionStyles = {
    ...optionStyles,
    border: `1px solid ${tokens.colors.primary[500]}`,
    backgroundColor: tokens.colors.primary[50],
  };

  const checkboxStyles = {
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

  const descriptionStyles = {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.neutral[600],
    marginTop: tokens.spacing[1],
  };

  const errorStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[600],
    marginTop: tokens.spacing[1],
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>
        Payment Types Accepted
      </label>
      <div style={optionsStyles}>
        <div
          style={selected.includes('booking') ? selectedOptionStyles : optionStyles}
          onClick={() => handleToggle('booking')}
        >
          <input
            type="checkbox"
            checked={selected.includes('booking')}
            onChange={() => handleToggle('booking')}
            style={checkboxStyles}
            id="payment-booking"
          />
          <div>
            <label htmlFor="payment-booking" style={optionLabelStyles}>
              Booking Exchange
            </label>
            <div style={descriptionStyles}>
              Accept other bookings in exchange
            </div>
          </div>
        </div>

        <div
          style={selected.includes('cash') ? selectedOptionStyles : optionStyles}
          onClick={() => handleToggle('cash')}
        >
          <input
            type="checkbox"
            checked={selected.includes('cash')}
            onChange={() => handleToggle('cash')}
            style={checkboxStyles}
            id="payment-cash"
          />
          <div>
            <label htmlFor="payment-cash" style={optionLabelStyles}>
              Cash Offers
            </label>
            <div style={descriptionStyles}>
              Accept cash payments for your booking
            </div>
          </div>
        </div>
      </div>
      {error && <div style={errorStyles}>{error}</div>}
    </div>
  );
};